// Email delivery for the platform.
//
// Provider choice (EMAIL_PROVIDER):
//   "resend" - Resend HTTP API. Use this on Vercel and DigitalOcean, which
//              blocks outbound SMTP ports. Needs RESEND_API_KEY and an
//              EMAIL_FROM address on a domain verified in Resend.
//   "smtp"   - Any SMTP server (SMTP_HOST), or Gmail with an App Password
//              (GMAIL_SMTP_USER / GMAIL_SMTP_PASS). For local development.
//   unset    - Resend when RESEND_API_KEY is set, otherwise SMTP.
//
// Every attempt is written to EmailLog, including emails that are skipped.

import { Resend } from "resend";
import nodemailer from "nodemailer";
import prisma from "../config/db.js";
import { preferenceColumnFor, optOutReason } from "./email_preferences.js";
import { isReservedTestAddress, resolveProvider } from "./email_provider.js";

export { isReservedTestAddress, getSmtpConfiguration, resolveProvider } from "./email_provider.js";

let resendClient = null;
let resendKey = null;

function getResend(apiKey) {
  if (!resendClient || resendKey !== apiKey) {
    resendClient = new Resend(apiKey);
    resendKey = apiKey;
  }
  return resendClient;
}

async function deliver(provider, message) {
  if (provider.name === "resend") {
    const { data, error } = await getResend(provider.apiKey).emails.send({
      from: provider.from,
      to: message.to,
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(process.env.EMAIL_REPLY_TO ? { replyTo: process.env.EMAIL_REPLY_TO } : {}),
    });
    if (error) throw new Error(`Resend: ${error.message || error.name || "send failed"}`);
    return data;
  }

  return nodemailer.createTransport(provider.smtp).sendMail({
    from: provider.from,
    to: message.to,
    subject: message.subject,
    html: message.html,
    text: message.text,
    ...(process.env.EMAIL_REPLY_TO ? { replyTo: process.env.EMAIL_REPLY_TO } : {}),
  });
}

async function skipReasonFor({ recipients, type, userId }) {
  if (recipients.length === 0) return "No recipient address.";

  if (recipients.every(isReservedTestAddress)) {
    return "Recipient uses a reserved test domain that cannot receive email.";
  }

  const column = userId ? preferenceColumnFor(type) : null;
  if (column) {
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { [column]: true },
    });
    if (user && user[column] === false) return optOutReason(type);
  }

  return null;
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
  const recipients = (Array.isArray(to) ? to : [to]).filter(Boolean);
  const deliverable = recipients.filter((address) => !isReservedTestAddress(address));
  const toEmail = recipients.join(",");

  const provider = resolveProvider();
  const skipReason = provider.name
    ? await skipReasonFor({ recipients, type, userId })
    : provider.reason;

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
      status: skipReason ? "SKIPPED" : "PENDING",
      error: skipReason,
    },
  });

  if (skipReason) {
    console.warn(`[EMAIL SKIPPED] ${subject} -> ${toEmail}: ${skipReason}`);
    return { skipped: true, reason: skipReason, emailLog };
  }

  try {
    const providerResponse = await deliver(provider, {
      to: deliverable,
      subject,
      html,
      text,
    });

    const updatedLog = await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { status: "SENT", sentAt: new Date() },
    });

    return { sent: true, provider: provider.name, providerResponse, emailLog: updatedLog };
  } catch (err) {
    const updatedLog = await prisma.emailLog.update({
      where: { id: emailLog.id },
      data: { status: "FAILED", error: err.message },
    });

    console.error(`[EMAIL FAILED] ${subject} -> ${toEmail}:`, err.message);

    return { sent: false, emailLog: updatedLog, error: err };
  }
}
