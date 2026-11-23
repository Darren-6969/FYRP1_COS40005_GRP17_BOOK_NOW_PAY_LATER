import { uniqueOperatorSlug } from "../services/operator_storefront_service.js";
import crypto from "crypto";
import bcrypt from "bcryptjs";
import prisma from "../config/db.js";
import { sendEmail } from "../services/email_service.js";
import { createInAppNotification, notifyMasterUsers } from "../services/notification_email_service.js";
import { generateUserCode } from "../services/userCode.js";
import { escapeHtml } from "../utils/escapeHTML.js";
import {validateSecureDocument,} from "../utils/secure_upload.js";
import { getPlatformSettings } from "../services/platform_settings_service.js";
import { initialTermData } from "../services/subscription_rules.js";
import { DRIVER_LICENCE_DOCUMENTS } from "../services/driver_service_rules.js";
import {
  applicationRulesFor,
  approvalDocumentsMessage,
  checkApplicationDocuments,
  missingApprovalDocuments,
  parseOperatorType,
} from "../services/operator_type_rules.js";

const TYPE_NAMES = { CAR_RENTAL: "car rental company", TOUR_GUIDE: "tour guide", DRIVER: "driver" };

function documentTypeOf(file) {
  return String(file.fieldname || "").replace(/^document_/, "").toUpperCase();
}
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
    const operatorType = parseOperatorType(req.body.operatorType);
    const rules = applicationRulesFor(operatorType);
    const registrationNumber = String(businessRegistrationNumber || "").trim() || null;

    if (!companyName || !applicantName || !email || !businessAddress) {
      return res.status(400).json({ message: "Name, applicant, email and address are required." });
    }

    if (rules.businessRegistrationNumberRequired && !registrationNumber) {
      return res.status(400).json({ message: "A business registration number is required for car rental companies." });
    }

    // Each type sends its own documents (operator_type_rules.js).
    checkApplicationDocuments(operatorType, files.map(documentTypeOf));

    const validatedFiles =
  await Promise.all(
    files.map(async (file) => {
      const validated =
        await validateSecureDocument(
          file.buffer,
          {
            allowedTypes: [
              "application/pdf",
              "image/png",
              "image/jpeg",
            ],

            maxBytes:
              3 * 1024 * 1024,
          }
        );

      return {
        file,
        validated,
      };
    })
  );

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
          slug: await uniqueOperatorSlug(companyName, tx),
          companyName: String(companyName).trim(),
          email: normalizedEmail,
          phone: phone ? String(phone).trim() : null,
          status: "PENDING",
          operatorType,
        },
      });

      await tx.user.create({
        data: {
          userCode,
          name: String(applicantName).trim(),
          email: normalizedEmail,
          password: unusablePassword,
          role: "NORMAL_SELLER",
          emailVerifiedAt: null,
          operatorAccessLevel: "OWNER",
          operatorUserStatus: "SUSPENDED",
          operatorId: operator.id,
        },
      });

      const createdApplication = await tx.operatorApplication.create({
        data: {
          operatorId: operator.id,
          businessRegistrationNumber: registrationNumber,
          businessAddress: String(businessAddress).trim(),
          status: "SUBMITTED",
        },
      });

      for (
        const {
          file,
          validated,
        } of validatedFiles
      ) {
        const documentType = documentTypeOf(file);

        const storageKey = `${operator.id}/${crypto.randomUUID()}-${safeDocumentName(file.originalname)}`;
        await tx.operatorDocument.create({
          data: {
            operatorId: operator.id,
            applicationId: createdApplication.id,
            documentType,
            originalName: safeDocumentName(file.originalname),
            storageKey,
            content: validated.buffer,
            mimeType: validated.mime,
            sizeBytes:validated.size,
            },
          });
        }

      return tx.operatorApplication.findUnique({
        where: { id: createdApplication.id },
        include: { documents: { select: documentPublicSelect } },
      });
      // Several writes plus the document bytes: Prisma's 5 s default is too
      // tight on a slow database link, as for bookings.
    }, { maxWait: 10000, timeout: 15000 });

    await prisma.auditLog.create({
      data: {
        action: "OPERATOR_APPLICATION_SUBMITTED",
        entityType: "OperatorApplication",
        entityId: String(application.id),
        details: { operatorCode, email: normalizedEmail, operatorType },
      },
    });

    await notifyMasterUsers({
      title: "New operator application submitted",
      message: `${companyName} (${TYPE_NAMES[operatorType]}) submitted an operator application for review.`,
      type: "OPERATOR_APPLICATION_SUBMITTED",
      emailSubject: `New Operator Application - ${companyName}`,
      emailText: `${companyName} submitted an operator application for administrator review.`,
      emailHtml: `<p><strong>${escapeHtml(companyName)}</strong> submitted an operator application for administrator review.</p><p>Applicant: ${escapeHtml(applicantName)}<br>Type: ${TYPE_NAMES[operatorType]}<br>Email: ${escapeHtml(normalizedEmail)}<br>Documents: ${files.length}</p>`,
      relatedEntityType: "OperatorApplication",
      relatedEntityId: application.id,
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
      where: { status: { in: ["SUBMITTED", "UNDER_REVIEW", "NEEDS_INFORMATION"] } },
      orderBy: { submittedAt: "desc" },
      include: {
        operator: {
          select: {
            id: true,
            operatorCode: true,
            companyName: true,
            email: true,
            phone: true,
            status: true,
            operatorType: true,
            // The applicant: the owner account created with the application.
            users: { where: { operatorAccessLevel: "OWNER" }, select: { name: true }, take: 1 },
          },
        },
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

// { [documentId]: "YYYY-MM-DD" } from the review form. Only this
// application's documents are accepted, and a date must be in the future.
function readDocumentExpiry(input, documents) {
  const dates = new Map();
  if (input === undefined || input === null) return { dates, error: null };
  if (typeof input !== "object" || Array.isArray(input)) {
    return { dates, error: "Document expiry dates are not in the right format." };
  }
  const today = new Date().toISOString().slice(0, 10);
  for (const [key, value] of Object.entries(input)) {
    if (value === null || value === "") continue;
    const documentId = Number(key);
    if (!documents.some((document) => document.id === documentId)) {
      return { dates, error: "An expiry date was sent for a document that is not on this application." };
    }
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(value) || Number.isNaN(Date.parse(value))) {
      return { dates, error: "Enter expiry dates as a full date." };
    }
    if (value <= today) {
      return { dates, error: "A document that has already expired cannot be accepted." };
    }
    // End of that day in Malaysia time (UTC+8): 23:59:59 local is 15:59:59 UTC.
    dates.set(documentId, new Date(`${value}T15:59:59.000Z`));
  }
  return { dates, error: null };
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
      include: {
        operator: true,
        documents: { select: { id: true, documentType: true, status: true } },
        reviews: true,
      },
    });

    if (!application) return res.status(404).json({ message: "Operator application not found." });
    if (application.status === "APPROVED") {
      return res.status(409).json({ message: "This application has already reached a final decision." });
    }

    if (decision === "APPROVED") {
      const missing = missingApprovalDocuments(
        application.operator.operatorType,
        application.documents.map((document) => document.documentType)
      );
      if (missing.length) {
        return res.status(400).json({ message: approvalDocumentsMessage(missing) });
      }
      if (application.documents.some((document) => document.status !== "UNDER_REVIEW" && document.status !== "APPROVED")) {
        return res.status(400).json({ message: "All submitted documents must be reviewable before approval." });
      }
    }

    // Expiry dates the administrator read off the documents. A driver can
    // only be booked while their driving licence and PSV permit are valid,
    // so both dates are required to approve a driver.
    const expiry = readDocumentExpiry(req.body.documentExpiry, application.documents);
    if (expiry.error) {
      return res.status(400).json({ code: "DOCUMENT_EXPIRY_INVALID", message: expiry.error });
    }
    if (decision === "APPROVED" && application.operator.operatorType === "DRIVER") {
      const missingExpiry = DRIVER_LICENCE_DOCUMENTS.filter(
        (type) =>
          !application.documents.some(
            (document) => document.documentType === type && expiry.dates.has(document.id)
          )
      );
      if (missingExpiry.length) {
        return res.status(400).json({
          code: "DOCUMENT_EXPIRY_REQUIRED",
          message: "Enter the expiry date of the driving licence and the PSV permit before approving a driver.",
        });
      }
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
        // FR-SUB-002: the Starter term starts when the administrator approves the operator.
        const approved = await tx.operator.findUnique({
          where: { id: application.operatorId },
          select: { subscriptionPlan: true, subscriptionStartedAt: true },
        });
        const tiers = (await getPlatformSettings(tx)).subscriptionTiers;
        await tx.operator.update({
          where: { id: application.operatorId },
          // FR-SUB-004: inactivity is measured from approval.
          data: { status: "ACTIVE", lastActivityAt: new Date(), ...initialTermData(approved, tiers) },
        });
        await tx.user.updateMany({ where: { operatorId: application.operatorId, operatorAccessLevel: "OWNER" }, data: { operatorUserStatus: "ACTIVE" } });
        await tx.operatorDocument.updateMany({ where: { applicationId }, data: { status: "APPROVED", reviewedAt: new Date(), reviewedById: req.user.id } });
        for (const [documentId, expiresAt] of expiry.dates) {
          await tx.operatorDocument.update({ where: { id: documentId }, data: { expiresAt } });
        }
      } else if (decision === "REJECTED") {
        await tx.operator.update({ where: { id: application.operatorId }, data: { status: "SUSPENDED" } });
        await tx.user.updateMany({ where: { operatorId: application.operatorId }, data: { operatorUserStatus: "SUSPENDED" } });
        await tx.operatorDocument.updateMany({
          where: { applicationId },
          data: { status: "REJECTED", rejectionReason: reason, reviewedAt: new Date(), reviewedById: req.user.id },
        });
      } else if (decision === "NEEDS_INFORMATION") {
        // The documents stay reviewable: applicants reply by email (there is
        // no re-upload page yet), and the administrator can still approve.
        // Marking them REJECTED here made a later approval impossible.
        await tx.operator.update({ where: { id: application.operatorId }, data: { status: "PENDING" } });
        await tx.user.updateMany({ where: { operatorId: application.operatorId }, data: { operatorUserStatus: "SUSPENDED" } });
      }

      return updated;
    }, { maxWait: 10000, timeout: 15000 });

    await prisma.refreshToken.deleteMany({ where: { user: { operatorId: application.operatorId } } });

    let setupUrl = null;
    let emailStatus = null;
    if (decision === "APPROVED") {
      const rawToken = crypto.randomBytes(32).toString("hex");
      await prisma.passwordSetupToken.deleteMany({ where: { user: { operatorId: application.operatorId } } });
      const owner = await prisma.user.findFirst({
        where: { operatorId: application.operatorId, operatorAccessLevel: "OWNER" },
        select: { id: true, email: true },
      });
      if (owner) {
        await prisma.passwordSetupToken.create({
          data: { tokenHash: hashToken(rawToken), userId: owner.id, expiresAt: new Date(Date.now() + SETUP_TOKEN_EXPIRY_MS) },
        });
        setupUrl = `${process.env.FRONTEND_URL || "http://localhost:5173"}/setup-password?token=${rawToken}`;
        const emailResult = await sendEmail({
          to: owner.email,
          subject: "Your operator account has been approved",
          type: "OPERATOR_ACCOUNT_APPROVED",
          relatedEntityType: "OperatorApplication",
          relatedEntityId: applicationId,
          userId: owner.id,
          text: `Your account has been approved. Set your password here: ${setupUrl}`,
          html: `<p>Your operator account for <strong>${application.operator.companyName}</strong> has been approved.</p><p><a href="${setupUrl}">Set up your password</a>. This link expires in 24 hours.</p>`,
        });
        emailStatus = emailResult.skipped ? "SKIPPED" : emailResult.sent ? "SENT" : "FAILED";
      } else {
        emailStatus = "OWNER_MISSING";
      }
    } else {
      const owner = await prisma.user.findFirst({
        where: { operatorId: application.operatorId, operatorAccessLevel: "OWNER" },
        select: { id: true, email: true, name: true },
      });
      const title = decision === "REJECTED" ? "Operator application rejected" : "Operator documents need attention";
      const message = decision === "REJECTED"
        ? `Your operator application was rejected. Reason: ${reason}`
        : `We need more information about your operator application: ${reason} Please reply to this email with what is asked.`;

      if (owner) {
        await createInAppNotification({ userId: owner.id, title, message, type: "OPERATOR_APPLICATION_REJECTED" });
        await sendEmail({
          to: owner.email,
          subject: title,
          type: "OPERATOR_APPLICATION_REJECTED",
          relatedEntityType: "OperatorApplication",
          relatedEntityId: applicationId,
          userId: owner.id,
          text: message,
          html: `<p>Hello ${escapeHtml(owner.name)},</p><p>${escapeHtml(message)}</p>`,
        });
      }
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

    const message = decision === "APPROVED" && emailStatus !== "SENT"
      ? `Application approved, but the password setup email was ${emailStatus === "OWNER_MISSING" ? "not sent because the owner account is missing" : emailStatus.toLowerCase()}. Use the owner account's setup-link action or check email logs.`
      : `Operator application ${decision.toLowerCase()}.`;
    res.json({ message, application: result, setupUrl, ...(emailStatus ? { emailStatus } : {}) });
  } catch (err) {
    next(err);
  }
}

export async function downloadOperatorDocument(req, res, next) {
  try {
    const documentId = Number(req.params.documentId);
    const document = await prisma.operatorDocument.findUnique({ where: { id: documentId } });
    if (!document) return res.status(404).json({ message: "Document not found." });
    const content = Buffer.from(document.content);
    res.set({
      "Content-Type": document.mimeType,
      "Content-Disposition": `inline; filename="${document.originalName.replace(/[^a-zA-Z0-9._-]/g, "_")}"`,
      "Content-Length": String(content.length),
    });
    res.send(content);
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
