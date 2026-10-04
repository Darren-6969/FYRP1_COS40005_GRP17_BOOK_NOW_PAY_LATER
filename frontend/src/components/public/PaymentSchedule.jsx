import { formatSen, formatShortDateTime } from "../../utils/formatPublic";
import styles from "../../assets/styles/public/PaymentSchedule.module.css";

const DAY_MS = 86400000;

function countdown(iso) {
  const days = Math.max(0, Math.round((new Date(iso).getTime() - Date.now()) / DAY_MS));
  if (days === 0) return "today";
  return `in ${days} ${days === 1 ? "day" : "days"}`;
}

function Step({ n, filled, title, note, amount, extra }) {
  return (
    <li className={styles.step}>
      <span className={`${styles.num} ${filled ? styles.numFilled : ""}`} aria-hidden="true">
        {n}
      </span>
      <div>
        <p className={styles.title}>
          {title}
          {extra && <span className={styles.countdown}>{extra}</span>}
        </p>
        {note && <p className={styles.note}>{note}</p>}
      </div>
      <span className={styles.amount}>{amount}</span>
    </li>
  );
}

// Every step and due date shown together before the request is sent, so a
// customer is never surprised by a second deadline. All figures come from the
// quote; nothing is calculated here.
export default function PaymentSchedule({
  quote,
  operatorName,
  responseWindowHours,
  refundRule,
  licenceNote = "Photo of the front and back, from your booking page",
  showCountdown = false,
}) {
  const due = formatShortDateTime(quote.balanceDueAt);
  const deposit = formatSen(quote.depositSen);
  const balance = formatSen(quote.balanceSen);
  const total = formatSen(quote.totalSen);
  const hasExtras =
    quote.addOnsSen > 0 || quote.surchargeSen > 0 || quote.pickupFeeSen > 0 || quote.dropoffFeeSen > 0 || quote.overtimeSen > 0;
  const partial = refundRule?.type === "PARTIAL";
  const respond = (
    <Step
      n={1}
      filled
      title={`${operatorName} responds within ${responseWindowHours} ${responseWindowHours === 1 ? "hour" : "hours"}`}
      note="We hold the car for you while you wait."
    />
  );

  // Pay everything on acceptance: either pickup is too close for a separate
  // balance, or the operator takes the full amount up front (100%).
  if (quote.payInFull || !quote.balanceSen) {
    return (
      <div>
        <p role="status" className={styles.fullNotice}>
          {quote.payInFull
            ? `If accepted, you'll pay the full ${total} at once, because pickup is within the balance window.`
            : `${operatorName} takes the full ${total} when the booking is accepted. There is no separate balance.`}
        </p>
        <ol className={styles.steps}>
          {respond}
          <Step n={2} title={`Pay the full ${total} within ${quote.depositWindowHours} hours of acceptance`} amount={total} />
          <Step
            n={3}
            title={`Upload your driving licence before ${formatShortDateTime(quote.licenceDueAt)}`}
            note={licenceNote}
          />
        </ol>
      </div>
    );
  }

  return (
    <div>
      <ol className={styles.steps}>
        {respond}
        {quote.depositSen ? (
          <Step n={2} title={`Pay the ${deposit} deposit within ${quote.depositWindowHours} hours of acceptance`} amount={deposit} />
        ) : (
          <Step n={2} title="No deposit for this car" note={`${operatorName} collects everything as the balance.`} />
        )}
        <Step
          n={3}
          title={`Pay the balance ${balance} by ${due}`}
          extra={showCountdown ? countdown(quote.balanceDueAt) : null}
          note={
            hasExtras
              ? "Includes your add-ons, pickup and drop-off charges, and any night handover charge"
              : "Add-ons and any pickup or drop-off charge are added here"
          }
          amount={balance}
        />
        <Step n={4} title={`Upload your driving licence by ${formatShortDateTime(quote.licenceDueAt)}`} note={licenceNote} />
      </ol>
      <p className={styles.consequence}>
        {!quote.depositSen
          ? `If the balance or your licence is not in by ${due}, the booking is cancelled.`
          : partial
          ? `If the balance or your licence is not in by ${due}, the booking is cancelled. The operator refunds ${refundRule.refundPct}% of the ${deposit} deposit, once paid, and keeps the rest.`
          : `If the balance or your licence is not in by ${due}, the booking is cancelled and the operator keeps the ${deposit} deposit, once paid.`}
      </p>
    </div>
  );
}
