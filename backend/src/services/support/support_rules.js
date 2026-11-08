// Rules for chatbot hand-offs and support tickets (chatbot design, "Layer 3:
// Human hand-off and support pages"; development plan Step 9). Pure, so they
// can be unit tested without a database.

import crypto from "node:crypto";

// What a hand-off is about. A specific booking goes to that booking's
// operator; everything else goes to platform support (the admin).
export const TOPICS = [
  { key: "BOOKING", label: "A booking: the car, pickup, return or a change", needsBooking: true },
  { key: "PAYMENT", label: "A payment or refund" },
  { key: "OPERATOR_PROBLEM", label: "A problem with an operator", needsBooking: true, optionalBooking: true },
  { key: "ACCOUNT", label: "My account" },
  { key: "OTHER", label: "Something else" },
];

export const EMERGENCY_TOPIC = { key: "EMERGENCY", label: "Breakdown, accident or emergency" };

export const TOPIC_KEYS = TOPICS.map((t) => t.key);

export function topicLabel(key) {
  return [...TOPICS, EMERGENCY_TOPIC].find((t) => t.key === key)?.label || "Something else";
}

/** Short wording of a topic for staff lists and emails. */
export const TOPIC_SHORT = {
  BOOKING: "Booking",
  PAYMENT: "Payment or refund",
  OPERATOR_PROBLEM: "Problem with an operator",
  ACCOUNT: "Account",
  OTHER: "Other",
};

/**
 * Where a ticket goes. Only a booking question with a booking goes to the
 * operator; a dispute with an operator always goes to the admin.
 */
export function routeFor({ topic, booking }) {
  if (topic === "BOOKING" && booking?.operatorId) return { route: "OPERATOR", operatorId: booking.operatorId };
  return { route: "ADMIN", operatorId: null };
}

// Reply targets. Proposed in the design (4 working hours for operators, 1
// working day for the admin), still to be confirmed by Felix, so they are
// settings. Counted as clock hours for now.
export function replyTargetHours(env = process.env) {
  const num = (value, fallback) => {
    const n = Number(value);
    return Number.isFinite(n) && n > 0 ? n : fallback;
  };
  return {
    OPERATOR: num(env.SUPPORT_OPERATOR_REPLY_HOURS, 4),
    ADMIN: num(env.SUPPORT_ADMIN_REPLY_HOURS, 24),
  };
}

export function dueAtFor(route, now = new Date(), env = process.env) {
  const hours = replyTargetHours(env)[route] ?? 24;
  return new Date(now.getTime() + hours * 3600 * 1000);
}

/** How the reply target reads to the customer. */
export function replyTargetText(route, env = process.env) {
  const hours = replyTargetHours(env)[route];
  if (hours % 24 === 0) {
    const days = hours / 24;
    return days === 1 ? "within 1 day" : `within ${days} days`;
  }
  return hours === 1 ? "within 1 hour" : `within ${hours} hours`;
}

export function supportPhone(env = process.env) {
  const value = String(env.SUPPORT_PHONE || "").trim();
  return value || null;
}

// A ticket a customer can still write into from the chat.
export const ACTIVE_STATUSES = ["OPEN", "ANSWERED"];

export const AUTO_RESOLVE_DAYS = 3;

/**
 * The status after an event, or null when the event is not allowed.
 * Open → Answered when staff reply; Answered → Open when the customer writes
 * again; any active ticket → Resolved. A resolved ticket stays resolved.
 */
export function nextStatus(current, event) {
  if (current === "RESOLVED") return null;
  switch (event) {
    case "staff_reply":
      return "ANSWERED";
    case "customer_message":
      return "OPEN";
    case "resolve":
      return "RESOLVED";
    default:
      return null;
  }
}

/** True when an open ticket's reply target has passed. */
export function isOverdue(ticket, now = new Date()) {
  return ticket.status === "OPEN" && ticket.dueAt && new Date(ticket.dueAt) < now;
}

// No 0, O, 1 or I, so a reference read out on the phone is not misheard.
const REF_ALPHABET = "23456789ABCDEFGHJKLMNPQRSTUVWXYZ";

export function newReference(random = crypto.randomBytes) {
  const bytes = random(6);
  let code = "";
  for (let i = 0; i < 6; i += 1) code += REF_ALPHABET[bytes[i] % REF_ALPHABET.length];
  return `SUP-${code}`;
}

// A plain check: something@something.tld, no spaces. The reply goes to this
// address, so it is shown back to the visitor before the ticket is raised.
export function cleanEmail(value) {
  const email = String(value || "").trim().toLowerCase();
  if (email.length > 254) return null;
  return /^[^\s@]+@[^\s@]+\.[a-z]{2,}$/i.test(email) ? email : null;
}

export const SUMMARY_MAX = 500;
export const REPLY_MAX = 2000;

export function cleanText(value, max) {
  return String(value || "").replace(/\s+/g, " ").trim().slice(0, max);
}

// Ticket caps, so the Support page can't be flooded.
export const TICKET_CAPS = { customerPerDay: 5, visitorPerDay: 3 };

// Layer 1 wording that starts a hand-off or shows the emergency numbers with
// no AI call. Matched on whole words or phrases.
const HANDOFF_PHRASES = [
  "talk to a person",
  "talk to someone",
  "speak to a person",
  "speak to someone",
  "speak to a human",
  "talk to a human",
  "real person",
  "human",
  "agent",
  "customer service",
  "customer support",
  "contact support",
  "live chat",
  "complaint",
  "complain",
  "make a complaint",
  "nak cakap dengan orang",
];

const EMERGENCY_PHRASES = [
  "emergency",
  "accident",
  "crash",
  "crashed",
  "breakdown",
  "broke down",
  "broken down",
  "car won't start",
  "car wont start",
  "flat tyre",
  "flat tire",
  "kemalangan",
  "kecemasan",
  "kereta rosak",
];

function hasPhrase(text, phrases) {
  const t = ` ${String(text || "").toLowerCase().replace(/[^a-z0-9' ]+/g, " ").replace(/\s+/g, " ")} `;
  return phrases.some((p) => t.includes(` ${p} `));
}

// A question about the rules ("what happens if I have an accident?") is a
// policy question for Layers 1 and 2, not an emergency.
const POLICY_QUESTION = /^\s*(what|how|does|do|is|are|can|could|will|would|if|who|when|where|which|apa|bagaimana)\b/i;

export function isEmergencyMessage(text) {
  return hasPhrase(text, EMERGENCY_PHRASES) && !POLICY_QUESTION.test(String(text || ""));
}

export function isHandoffMessage(text) {
  return hasPhrase(text, HANDOFF_PHRASES);
}

/**
 * The text of the emergency answer. operators: [{ name, phone }] for the
 * customer's bookings that are on rental or about to start.
 */
export function emergencyText({ operators = [], phone = supportPhone() } = {}) {
  const lines = ["If anyone is hurt or in danger, call 999 first."];
  const withPhone = operators.filter((o) => o.phone);
  if (withPhone.length) {
    lines.push(withPhone.map((o) => `${o.name}: ${o.phone}`).join(". ") + ".");
  } else {
    lines.push("Call the operator you rented from; their number is on your booking page.");
  }
  if (phone) lines.push(`Platform support: ${phone}.`);
  return lines.join(" ");
}
