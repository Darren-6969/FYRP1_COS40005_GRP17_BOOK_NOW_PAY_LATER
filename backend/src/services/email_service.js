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

function getSmtpConfiguration() {
  const host = process.env.SMTP_HOST;

  if (host) {
    const user = process.env.SMTP_USER || process.env.GMAIL_SMTP_PASS;
    const pass = process.env.SMTP_PASS || process.env.GMAIL_SMTP_PASS;;
    const port = Number(process.env.SMTP_PORT || 587);
    const secure = process.env.SMTP_SECURE
      ? ["true", "1", "yes"].includes(process.env.SMTP_SECURE.toLowerCase())
      : port === 465;

    return {
      host,
      port,
      secure,
      auth: user && pass ? { user, pass } : undefined,
      user,
    };
  }

  if (process.env.GMAIL_SMTP_USER && process.env.GMAIL_SMTP_PASS) {
    return {
      service: "gmail",
      auth: { user: process.env.GMAIL_SMTP_USER, pass: process.env.GMAIL_SMTP_PASS },
      user: process.env.GMAIL_SMTP_USER,
    };
  }

  return null;
}

function getTransporter(configuration) {
  return nodemailer.createTransport(configuration);
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
  const smtpConfiguration = getSmtpConfiguration();

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
      status: smtpConfiguration ? "PENDING" : "SKIPPED",
      error: smtpConfiguration
        ? null
        : "SMTP_HOST or Gmail SMTP credentials are not configured. Email was skipped.",
    },
  });

  if (!smtpConfiguration) {
    console.warn(`[EMAIL SKIPPED] ${subject} -> ${toEmail}`);
    return {
      skipped: true,
      emailLog,
    };
  }

  try {
    const transporter = getTransporter(smtpConfiguration);

    const providerResponse = await transporter.sendMail({
      from: process.env.EMAIL_FROM || (smtpConfiguration.user ? `BNPL System <${smtpConfiguration.user}>` : undefined),
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