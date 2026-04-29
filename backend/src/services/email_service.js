import { Resend } from "resend";
import prisma from "../config/db.js";

const resend = process.env.RESEND_API_KEY
  ? new Resend(process.env.RESEND_API_KEY)
  : null;

function configured() {
  return Boolean(process.env.RESEND_API_KEY);
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
        : "RESEND_API_KEY is not configured. Email was skipped.",
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
    const providerResponse = await resend.emails.send({
      from: process.env.EMAIL_FROM || "BNPL System <onboarding@resend.dev>",
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