// The signed-in customer's upcoming car bookings, summarised for the chat's
// fixed answers (booking status, payments due, licence check). The customer
// always comes from the login session, never from the message, so no wording
// can reach another customer's booking.

import prisma from "../../config/db.js";
import { ringgit, shortDate } from "../../utils/chat_text.js";

const UPCOMING = [
  "PENDING",
  "ACCEPTED",
  "ALTERNATIVE_SUGGESTED",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "PAID",
  "READY_FOR_PICKUP",
  "IN_PROGRESS",
];

const STATUS_LABEL = {
  PENDING: "Waiting for the operator",
  ACCEPTED: "Accepted",
  ALTERNATIVE_SUGGESTED: "Offer to review",
  PENDING_PAYMENT: "Payment due",
  CONFIRMED: "Confirmed",
  PAID: "Paid in full",
  READY_FOR_PICKUP: "Ready for pickup",
  IN_PROGRESS: "On rental",
};

const PART_LABEL = {
  DOWN_PAYMENT: "deposit",
  FINAL_PAYMENT: "balance",
  FULL_PAYMENT: "full payment",
};

const LICENCE_LABEL = {
  UNDER_REVIEW: "being checked by the operator",
  APPROVED: "approved",
  REJECTED: "rejected, please upload another",
  REUPLOAD_REQUIRED: "needs a new upload",
};

const KL = "Asia/Kuala_Lumpur";

function plainDate(date) {
  return date ? new Date(date).toLocaleDateString("en-CA", { timeZone: KL }) : null;
}

function dueText(date) {
  const d = new Date(date);
  const day = d.toLocaleDateString("en-GB", { weekday: "short", day: "numeric", month: "short", timeZone: KL });
  const time = d.toLocaleTimeString("en-GB", { hour: "2-digit", minute: "2-digit", hour12: false, timeZone: KL });
  return `${day}, ${time}`;
}

function carName(booking) {
  const l = booking.listing;
  const name = [l?.vehicleMake, l?.vehicleModel].filter(Boolean).join(" ");
  return name || l?.name || booking.serviceName;
}

function dateLine(booking) {
  const from = plainDate(booking.pickupDate);
  const to = plainDate(booking.returnDate);
  return from && to ? `${shortDate(from)} to ${shortDate(to)}` : "";
}

function toSen(decimal) {
  return Math.round(Number(decimal || 0) * 100);
}

/** Up to five upcoming car bookings with what is paid, due and needed. */
export async function upcomingBookings(customerId) {
  if (!Number.isInteger(customerId)) return [];
  const rows = await prisma.booking.findMany({
    where: {
      customerId,
      listingId: { not: null },
      status: { in: UPCOMING },
      OR: [{ returnDate: null }, { returnDate: { gte: new Date() } }],
    },
    orderBy: [{ pickupDate: "asc" }, { id: "asc" }],
    take: 5,
    select: {
      id: true,
      bookingCode: true,
      serviceName: true,
      status: true,
      pickupDate: true,
      returnDate: true,
      operator: { select: { companyName: true } },
      listing: { select: { name: true, vehicleMake: true, vehicleModel: true } },
      paymentScheduleEntries: {
        where: { status: { not: "VOID" } },
        orderBy: { dueAt: "asc" },
        select: { type: true, paymentPart: true, amount: true, dueAt: true, status: true },
      },
      licenceDocuments: {
        orderBy: { submittedAt: "desc" },
        take: 1,
        select: { status: true },
      },
    },
  });

  return rows.map((b) => {
    const payments = b.paymentScheduleEntries.filter((e) => e.type === "PAYMENT");
    const licenceTask = b.paymentScheduleEntries.find((e) => e.type === "LICENCE");
    const paidSen = payments.filter((e) => e.status === "PAID").reduce((sum, e) => sum + toSen(e.amount), 0);
    const due = payments
      .filter((e) => e.status === "DUE")
      .map((e) => ({ label: PART_LABEL[e.paymentPart] || "payment", amountSen: toSen(e.amount), dueAt: e.dueAt }));
    const licenceDoc = b.licenceDocuments[0] || null;

    let licence = null;
    if (licenceDoc) licence = { state: licenceDoc.status, text: LICENCE_LABEL[licenceDoc.status] || "uploaded" };
    else if (licenceTask && licenceTask.status === "DUE") licence = { state: "MISSING", text: `not uploaded yet, due ${dueText(licenceTask.dueAt)}` };

    return {
      id: b.id,
      code: b.bookingCode,
      car: carName(b),
      operator: b.operator?.companyName || "",
      dates: dateLine(b),
      status: b.status,
      statusLabel: STATUS_LABEL[b.status] || b.status,
      paidSen,
      due,
      licence,
      href: `/customer/bookings/${b.id}`,
      payHref: due.length ? `/customer/checkout/${b.id}` : null,
      licenceHref: licence && licence.state !== "APPROVED" && licence.state !== "UNDER_REVIEW" ? "/customer/licence" : null,
    };
  });
}

// ── Lines for the three templates ───────────────────────────────────

export function bookingLines(bookings) {
  return bookings
    .map((b) => `${b.code} · ${b.car}, ${b.dates}: ${b.statusLabel}${b.due.length ? `, ${b.due[0].label} due` : ""}`)
    .join("\n");
}

export function paymentLines(bookings) {
  return bookings
    .map((b) => {
      const paid = b.paidSen ? `${ringgit(b.paidSen)} paid` : "nothing paid yet";
      const due = b.due.length
        ? b.due.map((d) => `${ringgit(d.amountSen)} ${d.label} due by ${dueText(d.dueAt)}`).join(", ")
        : "nothing more to pay";
      return `${b.code}: ${paid}, ${due}`;
    })
    .join("\n");
}

export function licenceLines(bookings) {
  return bookings
    .map((b) => `${b.code}: ${b.licence ? `licence ${b.licence.text}` : "no licence needed yet"}`)
    .join("\n");
}

/** Card data for the chat window, without anything the template doesn't need. */
export function bookingCards(bookings, focus) {
  return bookings.map((b) => {
    const facts = [];
    if (focus !== "licence") {
      b.due.forEach((d) => facts.push({ label: `${ringgit(d.amountSen)} ${d.label}`, detail: `due by ${dueText(d.dueAt)}`, tone: "warn" }));
      if (!b.due.length && b.paidSen) facts.push({ label: `${ringgit(b.paidSen)} paid`, detail: "nothing more to pay", tone: "ok" });
    }
    if (focus !== "payments" && b.licence) {
      facts.push({
        label: "Licence",
        detail: b.licence.text,
        tone: b.licence.state === "APPROVED" ? "ok" : b.licence.state === "UNDER_REVIEW" ? "info" : "warn",
      });
    }
    const actions = [];
    if (b.payHref && focus !== "licence") actions.push({ label: `Pay ${b.due[0].label}`, href: b.payHref, primary: true });
    if (b.licenceHref && focus !== "payments") actions.push({ label: "Upload licence", href: b.licenceHref });
    actions.push({ label: "Open booking", href: b.href });
    return {
      code: b.code,
      car: b.car,
      operator: b.operator,
      dates: b.dates,
      status: b.statusLabel,
      facts,
      actions: actions.slice(0, 2),
    };
  });
}
