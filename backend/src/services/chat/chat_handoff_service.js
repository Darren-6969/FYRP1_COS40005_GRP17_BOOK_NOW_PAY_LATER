// Layer 3 in the chat window: passing the customer to a person (chatbot
// design, "Layer 3: Human hand-off and support pages"; development plan
// Step 9). A short button flow, with no AI call:
//
//   topic → booking (signed-in, booking topics) → details → email (visitors)
//   → confirm → ticket
//
// The flow can start from the "Talk to a person" button, from Layer 1
// wording ("talk to a human"), after the answer check refused an answer, or
// from the AI's hand_off tool, which fills in what it already knows. Nothing
// is raised until the customer presses Send: that press is their agreement.
//
// Emergencies (breakdown, accident) get the phone numbers straight away and
// no ticket.
//
// The flow's state lives in the conversation's searchCriteria.handoff.

import prisma from "../../config/db.js";
import {
  EMERGENCY_TOPIC,
  SUMMARY_MAX,
  TOPICS,
  cleanEmail,
  cleanText,
  emergencyText,
  replyTargetText,
  routeFor,
  topicLabel,
} from "../support/support_rules.js";
import { createTicket, customerBookingForTicket, ticketBanner } from "../support/support_ticket_service.js";

export const HANDOFF_ACTION = { key: "handoff", label: "Talk to a person", action: { type: "handoff", value: "start" } };

const STEP_LABEL = "Talk to a person";
const RECENT_BOOKING_DAYS = 90;
const EMERGENCY_STATUSES = ["IN_PROGRESS", "OVERDUE", "READY_FOR_PICKUP", "PAID", "CONFIRMED"];

function options(text, choices, extra = {}) {
  return {
    kind: "options",
    optionType: "handoff",
    text,
    stepLabel: STEP_LABEL,
    options: choices,
    ...extra,
  };
}

const CANCEL = { value: "cancel", label: "Never mind" };

function topicStep(signedIn) {
  const choices = TOPICS.filter((t) => signedIn || !t.needsBooking || t.optionalBooking).map((t) => ({ value: `topic:${t.key}`, label: t.label }));
  choices.push({ value: `topic:${EMERGENCY_TOPIC.key}`, label: EMERGENCY_TOPIC.label }, CANCEL);
  return {
    state: { step: "topic" },
    reply: options(
      "What is it about?",
      choices,
      signedIn ? {} : { note: "To ask about one of your bookings, sign in first.", links: [{ label: "Sign in", href: "/login" }] }
    ),
  };
}

function shortDate(d) {
  return d ? new Date(d).toLocaleDateString("en-GB", { day: "numeric", month: "short", timeZone: "Asia/Kuala_Lumpur" }) : null;
}

async function recentBookings(customerId, db) {
  const since = new Date(Date.now() - RECENT_BOOKING_DAYS * 24 * 3600 * 1000);
  return db.booking.findMany({
    where: { customerId, listingId: { not: null }, OR: [{ returnDate: { gte: since } }, { bookingDate: { gte: since } }] },
    orderBy: [{ pickupDate: "desc" }],
    take: 5,
    select: {
      id: true,
      bookingCode: true,
      pickupDate: true,
      returnDate: true,
      listing: { select: { vehicleMake: true, vehicleModel: true } },
    },
  });
}

function bookingLabel(b) {
  const car = `${b.listing?.vehicleMake || ""} ${b.listing?.vehicleModel || ""}`.trim();
  const dates = [shortDate(b.pickupDate), shortDate(b.returnDate)].filter(Boolean).join(" to ");
  return [b.bookingCode, car, dates].filter(Boolean).join(" · ");
}

function detailsStep(state) {
  return {
    state: { ...state, step: "details" },
    reply: {
      kind: "text",
      text: "In a sentence or two, what do you need help with? Type it below.",
      actions: [{ key: "handoff-cancel", label: "Never mind", action: { type: "handoff", value: "cancel" } }],
      handoffStep: "details",
    },
  };
}

function emailStep(state, retry = false) {
  return {
    state: { ...state, step: "email" },
    reply: {
      kind: "text",
      text: retry
        ? "That email address doesn't look right. Please type it again, for example name@example.com."
        : "What email address should the reply go to? Type it below.",
      actions: [{ key: "handoff-cancel", label: "Never mind", action: { type: "handoff", value: "cancel" } }],
      handoffStep: "email",
    },
  };
}

function recipientName(state) {
  const { route } = routeFor({ topic: state.topic, booking: state.operatorId ? { operatorId: state.operatorId } : null });
  return { route, name: route === "OPERATOR" ? state.operatorName || "the operator" : "platform support" };
}

function confirmStep(state) {
  const { route, name } = recipientName(state);
  const lines = [`I'll pass this to ${name}: "${state.summary}".`];
  if (state.bookingCode) lines.push(`Booking ${state.bookingCode}.`);
  lines.push(`They aim to reply ${replyTargetText(route)}.`);
  if (state.contactEmail) lines.push(`The reply goes to ${state.contactEmail}.`);
  lines.push("They'll see this chat, so you won't need to repeat yourself.");
  return {
    state: { ...state, step: "confirm" },
    reply: options(lines.join(" "), [{ value: "confirm", label: `Send to ${name}` }, { value: "cancel", label: "Cancel" }]),
  };
}

/** The next step once the topic (and booking) are known. */
function afterTopic(state, signedIn) {
  if (!state.summary) return detailsStep(state);
  if (!signedIn && !state.contactEmail) return emailStep(state);
  return confirmStep(state);
}

/** Operators to call: those of the customer's bookings on rental or about to start. */
async function emergencyOperators(customerId, db) {
  if (!customerId) return [];
  const soon = new Date(Date.now() + 2 * 24 * 3600 * 1000);
  const rows = await db.booking.findMany({
    where: { customerId, status: { in: EMERGENCY_STATUSES }, pickupDate: { lte: soon } },
    select: { operator: { select: { id: true, companyName: true, phone: true } } },
    take: 5,
  });
  const seen = new Map();
  rows.forEach((r) => r.operator && seen.set(r.operator.id, { name: r.operator.companyName, phone: r.operator.phone }));
  return [...seen.values()];
}

export async function emergencyReply(customerId, db = prisma) {
  const operators = await emergencyOperators(customerId, db);
  return {
    kind: "text",
    text: emergencyText({ operators }),
    emergency: true,
    actions: [HANDOFF_ACTION],
  };
}

/** The flow's first message. */
export function startHandoff({ signedIn }) {
  return topicStep(signedIn);
}

/**
 * The AI's hand_off tool: the AI has the topic and a summary (and maybe a
 * booking code), so the flow jumps ahead. The customer still confirms.
 */
export async function handoffFromAi({ draft, customer, db = prisma }) {
  const signedIn = Boolean(customer);
  if (draft.topic === EMERGENCY_TOPIC.key) return { state: null, reply: await emergencyReply(customer?.id, db) };
  const state = { topic: draft.topic, summary: cleanText(draft.summary, SUMMARY_MAX), reason: "ai_offer" };
  if (signedIn && draft.bookingCode) {
    const booking = await db.booking.findFirst({
      where: { customerId: customer.id, bookingCode: { equals: String(draft.bookingCode).trim(), mode: "insensitive" } },
      select: { id: true, bookingCode: true, operatorId: true, operator: { select: { companyName: true } } },
    });
    if (booking) Object.assign(state, { bookingId: booking.id, bookingCode: booking.bookingCode, operatorId: booking.operatorId, operatorName: booking.operator?.companyName });
  }
  return afterTopic(state, signedIn);
}

/**
 * A button press in the flow. value: start | cancel | confirm | topic:KEY |
 * booking:ID | booking:none.
 * Returns { userText, reply, state (null ends the flow), ticket? }.
 */
export async function advanceHandoff({ value, stored, conversation, customer, ip, db = prisma }) {
  const signedIn = Boolean(customer);
  const state = stored || {};

  if (value === "start") {
    const { state: next, reply } = topicStep(signedIn);
    return { userText: HANDOFF_ACTION.label, reply, state: { ...next, reason: state.reason || "customer_request" } };
  }

  if (value === "cancel") {
    return { userText: "Never mind", reply: { kind: "text", text: "No problem. Ask me anything else, or pick a topic." }, state: null, showTopics: true };
  }

  if (value.startsWith("topic:")) {
    const key = value.slice(6);
    if (key === EMERGENCY_TOPIC.key) return { userText: EMERGENCY_TOPIC.label, reply: await emergencyReply(customer?.id, db), state: null };
    const topic = TOPICS.find((t) => t.key === key);
    if (!topic) return { userText: null, ...topicStep(signedIn) };
    const next = { ...state, topic: topic.key };
    if (signedIn && topic.needsBooking) {
      const bookings = await recentBookings(customer.id, db);
      if (bookings.length) {
        const choices = bookings.map((b) => ({ value: `booking:${b.id}`, label: bookingLabel(b) }));
        choices.push({ value: "booking:none", label: topic.optionalBooking ? "Not about one booking" : "Another booking" }, CANCEL);
        return { userText: topic.label, reply: options("Which booking is it about?", choices), state: { ...next, step: "booking" } };
      }
    }
    const { state: after, reply } = afterTopic(next, signedIn);
    return { userText: topic.label, reply, state: after };
  }

  if (value.startsWith("booking:")) {
    const next = { ...state, bookingId: null, bookingCode: null, operatorId: null, operatorName: null };
    let label = value === "booking:none" ? "Not about one booking" : null;
    if (value !== "booking:none" && signedIn) {
      const booking = await customerBookingForTicket(customer.id, Number(value.slice(8)), db);
      if (booking) {
        Object.assign(next, { bookingId: booking.id, bookingCode: booking.bookingCode, operatorId: booking.operatorId, operatorName: booking.operator?.companyName });
        label = booking.bookingCode;
      }
    }
    const { state: after, reply } = afterTopic(next, signedIn);
    return { userText: label, reply, state: after };
  }

  if (value === "confirm") {
    if (state.step !== "confirm" || !state.topic || !state.summary) {
      const { state: next, reply } = topicStep(signedIn);
      return { userText: null, reply, state: next };
    }
    try {
      const { ticket, existing } = await createTicket({
        conversation,
        customer,
        draft: { topic: state.topic, summary: state.summary, bookingId: state.bookingId, contactEmail: state.contactEmail },
        reason: state.reason || "customer_request",
        ip,
        db,
      });
      const banner = ticketBanner(ticket);
      const text = existing
        ? `You already have request ${ticket.reference} open with ${banner.with}. Anything you type now goes to them.`
        : `Sent. Your reference is ${ticket.reference}. ${banner.with === "platform support" ? "Platform support" : banner.with} will reply ${replyTargetText(ticket.route)}${
            signedIn ? " here in the chat, and by email" : ` by email to ${state.contactEmail}`
          }. Anything you type now goes to them.`;
      return { userText: "Send", reply: { kind: "text", text, ticketReference: ticket.reference }, state: null, ticket };
    } catch (err) {
      if (!err?.statusCode || err.statusCode >= 500) throw err;
      return { userText: "Send", reply: { kind: "text", text: err.message, actions: [HANDOFF_ACTION] }, state: null };
    }
  }

  const { state: next, reply } = topicStep(signedIn);
  return { userText: null, reply, state: next };
}

/**
 * A typed message while the flow waits for text (the details or the email).
 * Returns null when the flow isn't waiting for text, so the message is
 * answered as usual.
 */
export function typedIntoHandoff({ text, stored, customer }) {
  if (!stored || !["details", "email"].includes(stored.step)) return null;
  const signedIn = Boolean(customer);
  if (stored.step === "details") {
    const summary = cleanText(text, SUMMARY_MAX);
    const { state, reply } = afterTopic({ ...stored, summary }, signedIn);
    return { reply, state };
  }
  const email = cleanEmail(text);
  if (!email) return emailStep(stored, true);
  const { state, reply } = confirmStep({ ...stored, contactEmail: email });
  return { reply, state };
}

export { topicLabel };
