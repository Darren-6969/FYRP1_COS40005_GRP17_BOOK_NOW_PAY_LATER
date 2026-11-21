import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { CheckCircle2, Clock3, CircleAlert, XCircle } from "lucide-react";

import { formatCustomerDate, formatMoney } from "../../utils/customerUtils";
import { timeLeft } from "./carBookingParts";

// The one thing that matters now on a car booking: what happened, what the
// customer should do next and by when. Sits inside the booking header card.

const ICONS = {
  action: CircleAlert,
  wait: Clock3,
  done: CheckCircle2,
  stop: XCircle,
};

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(timer);
  }, [intervalMs]);
  return now;
}

// A DuitNow receipt is waiting for the operator to check it.
const receiptBeingChecked = (status) =>
  String(status || "").includes("PENDING_VERIFICATION");

function paymentStep(booking, op, now) {
  const payment = booking.payment;
  const depositNeeded = Number(payment.downPaymentAmount) > 0;
  const depositDone = !depositNeeded || payment.downPaymentStatus === "PAID";

  if (!depositDone) {
    if (receiptBeingChecked(payment.downPaymentStatus)) {
      return {
        tone: "wait",
        title: "Your deposit receipt is being checked",
        detail: `${op} confirms it, usually within a day. You don't need to do anything.`,
      };
    }
    return {
      tone: "action",
      title: `${op} accepted your booking`,
      detail: `Pay the ${formatMoney(payment.downPaymentAmount)} deposit by ${formatCustomerDate(
        payment.downPaymentDueDate
      )} (${timeLeft(payment.downPaymentDueDate, now)}).`,
      cta: {
        label: `Pay ${formatMoney(payment.downPaymentAmount)} deposit`,
        to: `/customer/checkout/${booking.id}?type=DOWN_PAYMENT`,
      },
    };
  }

  if (Number(payment.finalPaymentAmount) > 0 && payment.finalPaymentStatus !== "PAID") {
    if (receiptBeingChecked(payment.finalPaymentStatus)) {
      return {
        tone: "wait",
        title: "Your balance receipt is being checked",
        detail: `${op} confirms it, usually within a day. You don't need to do anything.`,
      };
    }
    return {
      tone: "action",
      title: "Deposit paid",
      detail: `Pay the ${formatMoney(payment.finalPaymentAmount)} balance by ${formatCustomerDate(
        payment.finalPaymentDueDate
      )} (${timeLeft(payment.finalPaymentDueDate, now)}).`,
      cta: {
        label: `Pay ${formatMoney(payment.finalPaymentAmount)} balance`,
        to: `/customer/checkout/${booking.id}?type=FINAL_PAYMENT`,
      },
    };
  }

  return null;
}

function stepFor(booking, now) {
  const op = booking.operator?.companyName || "The operator";
  const car = booking.car;
  const pickup = booking.alternativePickupDate || booking.pickupDate;
  const ret = booking.alternativeReturnDate || booking.returnDate;

  switch (booking.status) {
    case "PENDING":
      return {
        tone: "wait",
        title: `Waiting for ${op} to accept your request`,
        detail: [
          car?.responseDueAt && car.autoRejectOnTimeout
            ? `They respond by ${formatCustomerDate(car.responseDueAt)} (${timeLeft(car.responseDueAt, now)}). If they don't, the request closes and you can book another car.`
            : car?.responseDueAt
              ? `They aim to respond by ${formatCustomerDate(car.responseDueAt)} (${timeLeft(car.responseDueAt, now)}).`
              : null,
          "Nothing is charged until they accept, and the car is held for you.",
        ]
          .filter(Boolean)
          .join(" "),
      };
    case "ALTERNATIVE_SUGGESTED":
      return {
        tone: "action",
        title: `${op} sent you an offer`,
        detail: "Check the offer below, then accept or decline it.",
      };
    case "ACCEPTED":
    case "PENDING_PAYMENT":
      return booking.payment ? paymentStep(booking, op, now) : null;
    case "PAID":
      return {
        tone: "done",
        title: "Fully paid",
        detail: `${op} still needs to approve your documents below before pickup.`,
      };
    case "READY_FOR_PICKUP":
      return {
        tone: "done",
        title: "Ready for pickup",
        detail: `Pick up on ${formatCustomerDate(pickup)}. Bring your original driving licence${
          booking.internationalPermitRequired ? " and international driving permit" : ""
        }.`,
      };
    case "IN_PROGRESS":
      return {
        tone: "done",
        title: "Car picked up",
        detail: `Return it by ${formatCustomerDate(ret)}. Late returns are charged by the hour.`,
      };
    case "OVERDUE":
      return {
        tone: "stop",
        title: "The payment deadline passed",
        detail: "This booking can no longer be paid. Check the cancellation details below.",
      };
    case "REJECTED":
      return {
        tone: "stop",
        title: `${op} couldn't take this booking`,
        detail: "Nothing was charged.",
        cta: { label: "Find another car", to: "/cars", quiet: true },
      };
    default:
      return null;
  }
}

export default function BookingNextStep({ booking }) {
  const now = useNow();
  const step = stepFor(booking, now);
  if (!step) return null;

  const Icon = ICONS[step.tone];

  return (
    <div className={`booking-next-step ${step.tone}`} role="status">
      <Icon className="booking-next-step-icon" size={22} aria-hidden="true" />
      <div className="booking-next-step-text">
        <strong>{step.title}</strong>
        <p>{step.detail}</p>
      </div>
      {step.cta && (
        <Link
          className={step.cta.quiet ? "customer-secondary-btn" : "customer-primary-btn"}
          to={step.cta.to}
        >
          {step.cta.label}
        </Link>
      )}
    </div>
  );
}
