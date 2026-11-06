// Emails and in-app notifications for support tickets, sent from the job
// queue so a slow mail provider never holds up the chat (development plan
// Step 9). Handlers must be idempotent (FR-ARCH-001): a job can run twice
// after a lease expiry, so each one first checks the email log for its key.

import prisma from "../../config/db.js";
import { sendEmail } from "../email_service.js";
import { adminActionTemplate } from "../email_templates.js";
import { createInAppNotification } from "../notification_email_service.js";
import { adminSupportUrl, assistantUrl, operatorSupportUrl } from "../../utils/frontendUrls.js";
import { TOPIC_SHORT } from "./support_rules.js";
import { SUPPORT_ALERT_JOB, SUPPORT_REPLY_JOB } from "./support_ticket_service.js";

const MARK_TYPE = "ChatEscalationJob";

async function alreadySent(key, db) {
  const found = await db.emailLog.findFirst({ where: { relatedEntityType: MARK_TYPE, relatedEntityId: key }, select: { id: true } });
  return Boolean(found);
}

function staffRecipients(ticket, db) {
  const where = ticket.route === "OPERATOR" ? { role: "NORMAL_SELLER", operatorId: ticket.operatorId } : { role: "MASTER_SELLER" };
  return db.user.findMany({ where, select: { id: true, email: true } });
}

const EVENT_TEXT = {
  new: { title: "New customer message", intro: "A customer asked to talk to a person in the chat." },
  customer_reply: { title: "Customer replied", intro: "The customer wrote again on a support ticket." },
  reassigned: { title: "Ticket assigned to you", intro: "A support ticket has been assigned to you." },
};

/** payload: { ticketId, event: new | customer_reply | reassigned, key } */
export async function handleSupportAlert(payload, _job, db = prisma) {
  if (await alreadySent(payload.key, db)) return;
  const ticket = await db.chatEscalation.findUnique({
    where: { id: payload.ticketId },
    include: { booking: { select: { bookingCode: true } }, conversation: { select: { customer: { select: { name: true } } } } },
  });
  if (!ticket || ticket.status === "RESOLVED") return;

  const text = EVENT_TEXT[payload.event] || EVENT_TEXT.new;
  const url = ticket.route === "OPERATOR" ? operatorSupportUrl(ticket.id) : adminSupportUrl(ticket.id);
  const summary = String(ticket.reason || "").split(": ").slice(1).join(": ");
  const rows = [
    { label: "Ticket", value: ticket.reference },
    { label: "Topic", value: TOPIC_SHORT[ticket.topic] || ticket.topic },
    { label: "Customer", value: ticket.conversation?.customer?.name || "Visitor (not signed in)" },
    ...(ticket.booking ? [{ label: "Booking", value: ticket.booking.bookingCode }] : []),
    { label: "Summary", value: summary || "-" },
    ...(ticket.dueAt ? [{ label: "Reply by", value: new Date(ticket.dueAt).toLocaleString("en-GB", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" }) }] : []),
  ];
  const subject = `${text.title}: ${ticket.reference}`;
  const html = adminActionTemplate({ title: text.title, intro: text.intro, rows, buttonText: "Open the ticket", buttonUrl: url });

  for (const user of await staffRecipients(ticket, db)) {
    await createInAppNotification({ userId: user.id, title: subject, message: `${TOPIC_SHORT[ticket.topic] || "Support"}: ${summary}`.slice(0, 250), type: "SUPPORT" });
    if (user.email) {
      await sendEmail({
        to: user.email,
        subject,
        html,
        text: `${text.intro} ${ticket.reference}. Open: ${url}`,
        type: "SUPPORT",
        relatedEntityType: MARK_TYPE,
        relatedEntityId: payload.key,
        userId: user.id,
      });
    }
  }
}

/** payload: { messageId, ticketId }. Tells the customer a person replied. */
export async function handleSupportReply(payload, _job, db = prisma) {
  const key = `reply:${payload.messageId}`;
  if (await alreadySent(key, db)) return;
  const message = await db.chatMessage.findUnique({
    where: { id: payload.messageId },
    include: { conversation: { select: { contactEmail: true, customerId: true, customer: { select: { email: true } } } } },
  });
  const ticket = await db.chatEscalation.findUnique({ where: { id: payload.ticketId }, select: { reference: true } });
  if (!message || !ticket) return;

  const from = message.payload?.from || "Support";
  const subject = `${from} replied to your request ${ticket.reference}`;
  const conversation = message.conversation;
  const signedIn = Boolean(conversation.customerId);
  const intro = signedIn
    ? `${from} replied to your request. You can read and answer it in the chat on the site.`
    : `${from} replied to your request. If you need more help, open the chat on the site again and ask to talk to a person.`;
  const html = adminActionTemplate({
    title: "You have a reply",
    intro,
    rows: [
      { label: "Request", value: ticket.reference },
      { label: "Reply", value: message.content },
    ],
    ...(signedIn ? { buttonText: "Open the chat", buttonUrl: assistantUrl() } : {}),
  });

  if (signedIn) {
    await createInAppNotification({ userId: conversation.customerId, title: subject, message: message.content.slice(0, 250), type: "SUPPORT" });
  }
  const to = signedIn ? conversation.customer?.email : conversation.contactEmail;
  if (to) {
    await sendEmail({
      to,
      subject,
      html,
      text: `${from}: ${message.content}`,
      type: "SUPPORT",
      relatedEntityType: MARK_TYPE,
      relatedEntityId: key,
      userId: conversation.customerId || undefined,
    });
  }
}

export const SUPPORT_JOB_HANDLERS = {
  [SUPPORT_ALERT_JOB]: handleSupportAlert,
  [SUPPORT_REPLY_JOB]: handleSupportReply,
};
