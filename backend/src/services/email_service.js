// TEMPORARY DEMO EMAIL SERVICE USING GMAIL SMTP
// ------------------------------------------------
// Resend is commented out for now because resend.dev testing domain
// can only send to the verified Resend account email.
// After buying/verifying a domain, you can restore Resend later.

// import { Resend } from "resend";
import nodemailer from "nodemailer";
import prisma from "../config/db.js";

// const resend = process.env.RESEND_API_KEY
//   ? new Resend(process.env.RESEND_API_KEY)
//   : null;

function configured() {
  return Boolean(process.env.GMAIL_SMTP_USER && process.env.GMAIL_SMTP_PASS);

  // Resend version for future production use:
  // return Boolean(process.env.RESEND_API_KEY);
}

function getTransporter() {
  return nodemailer.createTransport({
    service: "gmail",
    auth: {
      user: process.env.GMAIL_SMTP_USER,
      pass: process.env.GMAIL_SMTP_PASS,
    },
  });
}

export async function sendEmail({
  to,
  subject,
  html,
  text,
  type = "GENERAL",
  relatedEntityType,
  relatedEntityId,
  userId,
}) {
  const toEmail = Array.isArray(to) ? to.join(",") : to;

  const emailLog = await prisma.emailLog.create({
    data: {
      toEmail,
      subject,
      type,
      relatedEntityType: relatedEntityType || null,
      relatedEntityId:
        relatedEntityId === null || relatedEntityId === undefined
          ? null
          : String(relatedEntityId),
      userId: userId || null,
      status: configured() ? "PENDING" : "SKIPPED",
      error: configured()
        ? null
        : "GMAIL_SMTP_USER or GMAIL_SMTP_PASS is not configured. Email was skipped.",
    },
  });

  if (!configured()) {
    console.warn(`[EMAIL SKIPPED] ${subject} -> ${toEmail}`);
    return {
      skipped: true,
      emailLog,
    };
  }

  try {
    const transporter = getTransporter();

    const providerResponse = await transporter.sendMail({
      from:
        process.env.EMAIL_FROM ||
        `BNPL System <${process.env.GMAIL_SMTP_USER}>`,
      to,
      subject,
      html,
      text,
    });

    const updatedLog = await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: "SENT",
        sentAt: new Date(),
      },
    });

    return {
      sent: true,
      providerResponse,
      emailLog: updatedLog,
    };
  } catch (err) {
    const updatedLog = await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: {
        status: "FAILED",
        error: err.message,
      },
    });

    console.error(`[EMAIL FAILED] ${subject} -> ${toEmail}:`, err.message);

    return {
      sent: false,
      emailLog: updatedLog,
      error: err,
    };
  }
}