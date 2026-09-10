import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/db.js";
import { sendEmail } from "../services/email_service.js";
import { generateUserCode } from "../services/userCode.js";

const DOCUMENT_TYPES = new Set(["BUSINESS_REGISTRATION", "BUSINESS_LICENSE", "OWNER_IDENTITY"]);
const APPLICATION_DECISIONS = new Set(["APPROVED", "REJECTED", "NEEDS_INFORMATION"]);
const SETUP_TOKEN_EXPIRY_MS = 24 * 60 * 60 * 1000;

function hashToken(value) {
  return crypto.createHash("sha256").update(value).digest("hex");
}

function safeDocumentName(name) {
  return String(name || "document").replace(/[^a-zA-Z0-9._-]/g, "_").slice(-120);
}

async function generateOperatorCode() {
  const latest = await prisma.operator.findFirst({ orderBy: { id: "desc" }, select: { id: true } });
  return `OPR${String((latest?.id || 0) + 1).padStart(4, "0")}`;
}

function applicationResponse(application) {
  return {
    ...application,
    documents: application.documents || [],
    reviews: application.reviews || [],
  };
}

const documentPublicSelect = {
  id: true,
  operatorId: true,
  applicationId: true,
  documentType: true,
  originalName: true,
  storageKey: true,
  mimeType: true,
  sizeBytes: true,
  status: true,
  expiresAt: true,
  rejectionReason: true,
  reviewedAt: true,
  reviewedById: true,
  createdAt: true,
  updatedAt: true,
};

export async function submitOperatorApplication(req, res, next) {
  try {
    const { companyName, applicantName, email, phone, businessRegistrationNumber, businessAddress } = req.body;
    const files = req.files || [];

    if (!companyName || !applicantName || !email || !businessRegistrationNumber || !businessAddress) {
      return res.status(400).json({ message: "Company, applicant, registration number, and business address are required." });
    }

    if (!files.length) {
      return res.status(400).json({ message: "At least one business document is required." });
    }

    const normalizedEmail = String(email).trim().toLowerCase();
    const [existingOperator, existingUser] = await Promise.all([
      prisma.operator.findUnique({ where: { email: normalizedEmail } }),
      prisma.user.findUnique({ where: { email: normalizedEmail } }),
    ]);

    if (existingOperator || existingUser) {
      return res.status(409).json({ message: "An account or application already uses this email." });
    }

    const operatorCode = await generateOperatorCode();
    const userCode = await generateUserCode("NORMAL_SELLER");
    const unusablePassword = await bcrypt.hash(crypto.randomBytes(32).toString("hex"), 12);

    const application = await prisma.$transaction(async (tx) => {
      const operator = await tx.operator.create({
        data: {
          operatorCode,
          companyName: String(companyName).trim(),
          email: normalizedEmail,
          phone: phone ? String(phone).trim() : null,
          status: "PENDING",
        },
      });

      const user = await tx.user.create({
        data: {
          userCode,
          name: String(applicantName).trim(),
          email: normalizedEmail,
          password: unusablePassword,
          role: "NORMAL_SELLER",
          operatorAccessLevel: "OWNER",
          operatorUserStatus: "SUSPENDED",
          operatorId: operator.id,
        },
      });

      const createdApplication = await tx.operatorApplication.create({
        data: {
          operatorId: operator.id,
          businessRegistrationNumber: String(businessRegistrationNumber).trim(),
          businessAddress: String(businessAddress).trim(),
          status: "SUBMITTED",
        },
      });

      for (const file of files) {
        const documentType = String(file.fieldname || "").replace(/^document_/, "").toUpperCase();
        if (!DOCUMENT_TYPES.has(documentType)) {
          throw new Error(`Unsupported document type: ${documentType}`);
        }

        const storageKey = `${operator.id}/${crypto.randomUUID()}-${safeDocumentName(file.originalname)}`;
        await tx.operatorDocument.create({
          data: {
            operatorId: operator.id,
            applicationId: createdApplication.id,
            documentType,
            originalName: safeDocumentName(file.originalname),
            storageKey,
            content: file.buffer,
            mimeType: file.mimetype,
            sizeBytes: file.size,
          },
        });
      }

      return tx.operatorApplication.findUnique({
        where: { id: createdApplication.id },
        include: { documents: { select: documentPublicSelect } },
      });
    });

    await prisma.auditLog.create({
      data: {
        action: "OPERATOR_APPLICATION_SUBMITTED",
        entityType: "OperatorApplication",
        entityId: String(application.id),
        details: { operatorCode, email: normalizedEmail },
      },
    });

    res.status(201).json({
      message: "Application submitted for administrator review.",
      application: applicationResponse(application),
    });
  } catch (err) {
    next(err);
  }
}

export async function getOperatorApplications(req, res, next) {
  try {
    const applications = await prisma.operatorApplication.findMany({
      orderBy: { submittedAt: "desc" },
      include: {
        operator: { select: { id: true, operatorCode: true, companyName: true, email: true, phone: true, status: true } },
        documents: {
          select: {
            id: true,
            operatorId: true,
            applicationId: true,
            documentType: true,
            originalName: true,
            storageKey: true,
            mimeType: true,
            sizeBytes: true,
            status: true,
            expiresAt: true,
            rejectionReason: true,
            reviewedAt: true,
            reviewedById: true,
            createdAt: true,
            updatedAt: true,
          },
        },
        reviews: { orderBy: { createdAt: "desc" }, include: { reviewer: { select: { id: true, name: true, email: true } } } },
      },
    });
    res.json(applications.map(applicationResponse));
  } catch (err) {
    next(err);
  }
}

export async function reviewOperatorApplication(req, res, next) {
  try {
    const applicationId = Number(req.params.id);
    const decision = String(req.body.decision || "").toUpperCase();
    const reason = String(req.body.reason || "").trim();

    if (!Number.isInteger(applicationId) || !APPLICATION_DECISIONS.has(decision) || reason.length < 5) {
      return res.status(400).json({ message: "A valid decision and review reason of at least 5 characters are required." });
    }

    const application = await prisma.operatorApplication.findUnique({
      where: { id: applicationId },
      include: { operator: true, documents: true, reviews: true },
    });

    if (!application) return res.status(404).json({ message: "Operator application not found." });
    if (["APPROVED", "REJECTED"].includes(application.status)) {
      return res.status(409).json({ message: "This application has already reached a final decision." });
    }

    if (decision === "APPROVED" && application.documents.some((document) => document.status !== "UNDER_REVIEW" && document.status !== "APPROVED")) {
      return res.status(400).json({ message: "All submitted documents must be reviewable before approval." });
    }

    const result = await prisma.$transaction(async (tx) => {
      const updated = await tx.operatorApplication.update({
        where: { id: applicationId },
        data: {
          status: decision,
          reviewedAt: new Date(),
          reviewedById: req.user.id,
          rejectionReason: decision === "REJECTED" ? reason : null,
        },
      });

      await tx.operatorApplicationReview.create({
        data: { applicationId, reviewerId: req.user.id, decision, reason },
      });

      if (decision === "APPROVED") {
        await tx.operator.update({ where: { id: application.operatorId }, data: { status: "ACTIVE" } });
        await tx.user.updateMany({ where: { operatorId: application.operatorId, operatorAccessLevel: "OWNER" }, data: { operatorUserStatus: "ACTIVE" } });
        await tx.operatorDocument.updateMany({ where: { applicationId }, data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: req.user.id } });
      } else if (decision === "REJECTED") {
        await tx.operator.update({ where: { id: application.operatorId }, data: { status: "SUSPENDED" } });
        await tx.user.updateMany({ where: { operatorId: application.operatorId }, data: { operatorUserStatus: "SUSPENDED" } });
      }

      return updated;
    });

    await prisma.refreshToken.deleteMany({ where: { user: { operatorId: application.operatorId } } });

    let setupUrl = null;
    if (decision === "APPROVED") {
      const rawToken = crypto.randomBytes(32).toString("hex");
      await prisma.passwordSetupToken.deleteMany({ where: { user: { operatorId: application.operatorId } } });
      const owner = await prisma.user.findFirst({ where: { operatorId: application.operatorId, operatorAccessLevel: "OWNER" } });
      await prisma.passwordSetupToken.create({
        data: { tokenHash: hashToken(rawToken), userId: owner.id, expiresAt: new Date(Date.now() + SETUP_TOKEN_EXPIRY_MS) },
      });
      setupUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/setup-password?token=${rawToken}`;
      await sendEmail({
        to: owner.email,
        subject: "Your operator account has been approved",
        type: "OPERATOR_ACCOUNT_APPROVED",
        relatedEntityType: "OperatorApplication",
        relatedEntityId: applicationId,
        userId: owner.id,
        text: `Your account has been approved. Set your password here: ${setupUrl}`,
        html: `<p>Your operator account for <strong>${application.operator.companyName}</strong> has been approved.</p><p><a href="${setupUrl}">Set up your password</a>. This link expires in 24 hours.</p>`,
      });
    }

    await prisma.auditLog.create({
      data: {
        userId: req.user.id,
        action: `OPERATOR_APPLICATION_${decision}`,
        entityType: "OperatorApplication",
        entityId: String(applicationId),
        details: { reason },
      },
    });

    res.json({ message: `Operator application ${decision.toLowerCase()}.`, application: result, setupUrl });
  } catch (err) {
    next(err);
  }
}

export async function downloadOperatorDocument(req, res, next) {
  try {
    const documentId = Number(req.params.documentId);
    const document = await prisma.operatorDocument.findUnique({ where: { id: documentId } });
    if (!document) return res.status(404).json({ message: "Document not found." });
    res.set({
      "Content-Type": document.mimeType,
      "Content-Disposition": `attachment; filename="${document.originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      "Content-Length": String(document.content.length),
    });
    res.send(document.content);
  } catch (err) {
    next(err);
  }
}

export async function setOperatorPassword(req, res, next) {
  try {
    const { token, password } = req.body;
    if (!token || typeof password !== "string" || password.length < 8 || !/[A-Z]/.test(password) || !/[a-z]/.test(password) || !/[0-9]/.test(password)) {
      return res.status(400).json({ message: "Token and a strong password are required." });
    }

    const setupToken = await prisma.passwordSetupToken.findUnique({ where: { tokenHash: hashToken(token) }, include: { user: { include: { operator: true } } } });
    if (!setupToken || setupToken.usedAt || setupToken.expiresAt < new Date() || setupToken.user.operator?.status !== "ACTIVE") {
      return res.status(400).json({ message: "This password setup link is invalid or expired." });
    }

    await prisma.$transaction([
      prisma.user.update({ where: { id: setupToken.userId }, data: { password: await bcrypt.hash(password, 12), operatorUserStatus: "ACTIVE" } }),
      prisma.passwordSetupToken.update({ where: { id: setupToken.id }, data: { usedAt: new Date() } }),
      prisma.refreshToken.deleteMany({ where: { userId: setupToken.userId } }),
    ]);

    await prisma.auditLog.create({ data: { userId: setupToken.userId, action: "OPERATOR_PASSWORD_SETUP", entityType: "User", entityId: String(setupToken.userId) } });
    res.json({ message: "Password created successfully. You can now sign in." });
  } catch (err) {
    next(err);
  }
}
