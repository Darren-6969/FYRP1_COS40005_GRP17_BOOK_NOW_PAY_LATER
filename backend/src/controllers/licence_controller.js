import multer from "multer";
import prisma from "../config/db.js";
import { createInAppNotification } from "../services/notification_email_service.js";
import { sendEmail } from "../services/email_service.js";
import { escapeHtml } from "../utils/escapeHTML.js";

const SLA_HOURS = 48;
const REJECTION_REASONS = new Set(["EXPIRED", "UNREADABLE", "NOT_A_LICENCE"]);

export const licenceUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024, files: 1 },
  fileFilter: (_req, file, cb) => {
    if (!["application/pdf", "image/png", "image/jpeg"].includes(file.mimetype)) {
      cb(new Error("Licence documents must be PDF, PNG, or JPEG files."));
      return;
    }
    cb(null, true);
  },
});

function publicDocument(document) {
  if (!document) return null;
  const safe = { ...document };
  delete safe.content;
  return safe;
}

export async function getMyLicenceDocument(req, res, next) {
  try {
    const document = await prisma.customerLicenceDocument.findFirst({
      where: { customerId: req.user.id },
      orderBy: { submittedAt: "desc" },
    });
    res.json({ document: publicDocument(document), canReupload: !document || ["REJECTED", "REUPLOAD_REQUIRED"].includes(document.status) });
  } catch (err) {
    next(err);
  }
}

export async function submitLicenceDocument(req, res, next) {
  try {
    const file = req.file;
    if (!file) return res.status(400).json({ message: "A licence document is required." });

    const latest = await prisma.customerLicenceDocument.findFirst({
      where: { customerId: req.user.id },
      orderBy: { submittedAt: "desc" },
    });
    if (latest?.status === "UNDER_REVIEW") {
      return res.status(409).json({ message: "Your latest licence is already waiting for review." });
    }

    const document = await prisma.customerLicenceDocument.create({
      data: {
        customerId: req.user.id,
        originalName: file.originalname.replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120),
        mimeType: file.mimetype,
        sizeBytes: file.size,
        content: file.buffer,
        reviewDueAt: new Date(Date.now() + SLA_HOURS * 60 * 60 * 1000),
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: "CUSTOMER_LICENCE_SUBMITTED",
        entityType: "CustomerLicenceDocument",
        entityId: String(document.id),
      },
    });

    res.status(201).json({ message: "Licence submitted for preliminary review.", document: publicDocument(document) });
  } catch (err) {
    next(err);
  }
}

export async function getLicenceQueue(req, res, next) {
  try {
    const documents = await prisma.customerLicenceDocument.findMany({
      where: { status: "UNDER_REVIEW" },
      orderBy: [{ reviewDueAt: "asc" }, { submittedAt: "asc" }],
      include: { customer: { select: { id: true, name: true, email: true, phone: true } } },
    });
    const now = Date.now();
    res.json(documents.map((document) => ({
      ...publicDocument(document),
      sla: {
        overdue: document.reviewDueAt.getTime() < now,
        hoursRemaining: Math.ceil((document.reviewDueAt.getTime() - now) / (60 * 60 * 1000)),
      },
    })));
  } catch (err) {
    next(err);
  }
}

export async function downloadLicenceDocument(req, res, next) {
  try {
    const document = await prisma.customerLicenceDocument.findUnique({ where: { id: Number(req.params.id) } });
    if (!document) return res.status(404).json({ message: "Licence document not found." });
    res.set({
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename="${document.originalName}"`,
      "Content-Length": String(document.sizeBytes),
    });
    res.send(Buffer.from(document.content));
  } catch (err) {
    next(err);
  }
}

export async function reviewLicenceDocument(req, res, next) {
  try {
    const documentId = Number(req.params.id);
    const decision = String(req.body.decision || "").toUpperCase();
    const reason = String(req.body.reason || "").toUpperCase();
    if (!Number.isInteger(documentId) || !["APPROVED", "REJECTED"].includes(decision)) {
      return res.status(400).json({ message: "A valid licence review decision is required." });
    }
    if (decision === "REJECTED" && !REJECTION_REASONS.has(reason)) {
      return res.status(400).json({ message: "Choose expired, unreadable, or not a licence as the rejection reason." });
    }

    const document = await prisma.customerLicenceDocument.findUnique({
      where: { id: documentId },
      include: { customer: { select: { id: true, name: true, email: true } } },
    });
    if (!document || document.status !== "UNDER_REVIEW") return res.status(404).json({ message: "Licence is no longer in the review queue." });

    const updated = await prisma.customerLicenceDocument.update({
      where: { id: documentId },
      data: {
        status: decision === "APPROVED" ? "APPROVED" : "REUPLOAD_REQUIRED",
        rejectionReason: decision === "REJECTED" ? reason : null,
        reviewedAt: new Date(),
        reviewedById: req.user.id,
      },
    });

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: `CUSTOMER_LICENCE_${decision}`,
        entityType: "CustomerLicenceDocument",
        entityId: String(documentId),
        details: { reason: decision === "REJECTED" ? reason : null },
      },
    });

    if (decision === "REJECTED") {
      const message = `Your driving licence needs to be re-uploaded. Preliminary review result: ${reason.toLowerCase().replaceAll("_", " ")}. Please submit a clearer, current licence image.`;
      await createInAppNotification({ userId: document.customerId, title: "Licence re-upload required", message, type: "LICENCE_REUPLOAD_REQUIRED" });
      if (document.customer.email) {
        await sendEmail({
          to: document.customer.email,
          subject: "Driving licence re-upload required",
          type: "LICENCE_REUPLOAD_REQUIRED",
          relatedEntityType: "CustomerLicenceDocument",
          relatedEntityId: documentId,
          userId: document.customerId,
          text: message,
          html: `<p>Hello ${escapeHtml(document.customer.name)},</p><p>${escapeHtml(message)}</p>`,
        });
      }
    }

    res.json({ message: `Licence ${decision.toLowerCase()}.`, document: publicDocument(updated) });
  } catch (err) {
    next(err);
  }
}

export async function getPeakDates(req, res, next) {
  try {
    const dates = await prisma.platformPeakDate.findMany({ orderBy: { peakDate: "asc" } });
    res.json(dates);
  } catch (err) {
    next(err);
  }
}

export async function createPeakDate(req, res, next) {
  try {
    const peakDate = new Date(`${String(req.body.date || "")}T00:00:00.000Z`);
    const label = String(req.body.label || "Peak period").trim();
    if (Number.isNaN(peakDate.getTime()) || !/^\d{4}-\d{2}-\d{2}$/.test(String(req.body.date || "")) || !label) {
      return res.status(400).json({ message: "A valid date and label are required." });
    }
    const date = await prisma.platformPeakDate.create({ data: { peakDate, label } });
    res.status(201).json(date);
  } catch (err) {
    if (err.code === "P2002") return res.status(409).json({ message: "That peak date already exists." });
    next(err);
  }
}

export async function deletePeakDate(req, res, next) {
  try {
    await prisma.platformPeakDate.delete({ where: { id: Number(req.params.id) } });
    res.status(204).end();
  } catch (err) {
    next(err);
  }
}
