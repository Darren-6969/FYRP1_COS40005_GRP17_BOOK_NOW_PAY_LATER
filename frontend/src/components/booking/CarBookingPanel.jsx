import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { formatCustomerDate, formatMoney } from "../../utils/customerUtils";
import { getMyLicenceDocument } from "../../services/customer_service";
import { durationText, rateLineLabel } from "../../utils/carPricing";

// Car rental sections of the customer booking detail page (SRS 4.2.6).
// Everything shown comes from the booking record and its pricing snapshot;
// nothing is recalculated here.

const sen = (n) => formatMoney((n || 0) / 100);
const senLabel = (n) => formatMoney(n / 100);

function useNow(intervalMs = 30000) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(t);
  }, [intervalMs]);
  return now;
}

function timeLeft(iso, now) {
  const ms = new Date(iso).getTime() - now;
  if (ms <= 0) return "any moment now";
  const mins = Math.ceil(ms / 60000);
  if (mins < 60) return `${mins} min left`;
  const hours = Math.floor(mins / 60);
  const rest = mins % 60;
  return rest ? `${hours} h ${rest} min left` : `${hours} h left`;
}

function pointText(point) {
  if (!point) return "-";
  return point.address ? `${point.label}, ${point.address}` : point.label;
}

function StatusBanner({ booking, now }) {
  const car = booking.car;
  const op = booking.operator?.companyName || "The operator";
  const payment = booking.payment;

  if (booking.status === "PENDING") {
    return (
      <div className="customer-alert car-booking-banner" role="status">
        <strong>Waiting for {op} to accept your request.</strong>
        <span>
          {car.responseDueAt && car.autoRejectOnTimeout
            ? `They respond by ${formatCustomerDate(car.responseDueAt)} (${timeLeft(car.responseDueAt, now)}). If they don't, the request closes automatically and you can book another car. `
            : car.responseDueAt
            ? `They aim to respond by ${formatCustomerDate(car.responseDueAt)} (${timeLeft(car.responseDueAt, now)}). `
            : ""}
          Nothing is charged until they accept, and the car is held for you meanwhile.
        </span>
      </div>
    );
  }
  if (booking.status === "PENDING_PAYMENT" && payment) {
    const next =
      payment.downPaymentStatus !== "PAID"
        ? `Pay the ${formatMoney(payment.downPaymentAmount)} deposit by ${formatCustomerDate(payment.downPaymentDueDate)}.`
        : payment.finalPaymentStatus !== "PAID"
        ? `Pay the ${formatMoney(payment.finalPaymentAmount)} balance by ${formatCustomerDate(payment.finalPaymentDueDate)}.`
        : "";
    return (
      <div className="customer-alert car-booking-banner" role="status">
        <strong>{op} accepted your booking.</strong>
        <span>{next}</span>
      </div>
    );
  }
  if (booking.status === "PAID") {
    return (
      <div className="customer-alert car-booking-banner" role="status">
        <strong>Fully paid.</strong>
        <span>Bring your driving licence to pickup. The operator checks the original at handover.</span>
      </div>
    );
  }
  if (booking.status === "REJECTED") {
    return (
      <div className="customer-alert customer-alert-danger car-booking-banner" role="status">
        <strong>{op} couldn&apos;t take this booking.</strong>
        <span>Nothing was charged. <Link to="/cars">Find another car</Link></span>
      </div>
    );
  }
  return null;
}

function PriceBreakdown({ pricing }) {
  if (!pricing) return null;
  const days = pricing.days || 0;
  const rows = [
    ...(pricing.rateLines || []).map((l) => [`Rental ${rateLineLabel(l, senLabel)}`, l.amountSen]),
    ...(pricing.overtimeSen ? [["Night handover charge", pricing.overtimeSen]] : []),
    ...(pricing.addOnLines || []).map((a) => [
      `${a.label}${a.qty > 1 ? ` × ${a.qty}` : ""}${a.unit === "per_day" ? `, ${days} ${days === 1 ? "day" : "days"}` : ""}`,
      a.amountSen,
    ]),
    // Only bookings priced before driver age was removed carry this.
    ...(pricing.surchargeSen ? [["Young driver surcharge", pricing.surchargeSen]] : []),
    ...(pricing.pickupFeeSen ? [[`Pickup at ${pricing.pickupPoint?.label}`, pricing.pickupFeeSen]] : []),
    ...(pricing.dropoffFeeSen ? [[`Drop-off at ${pricing.dropoffPoint?.label}`, pricing.dropoffFeeSen]] : []),
  ];

  return (
    <article className="customer-glass-card">
      <h2>Price breakdown</h2>
      <div className="customer-info-list">
        {rows.map(([k, v]) => (
          <div key={k}>
            <span>{k}</span>
            <strong>{sen(v)}</strong>
          </div>
        ))}
        <div className="car-booking-total">
          <span>Total</span>
          <strong>{sen(pricing.totalSen)}</strong>
        </div>
      </div>
      {pricing.requestedLocation && (
        <p className="customer-muted">
          Your requested location has no charge yet. The operator replies with any charge, and you accept it before
          paying anything.
        </p>
      )}
      <p className="customer-muted">Late returns are charged by the hour at the counter and are not part of this total.</p>
    </article>
  );
}

function PaymentPart({ title, amount, due, status, payType, booking, canPay }) {
  const paid = status === "PAID";
  const pending = String(status || "").includes("PENDING");
  return (
    <div className="car-booking-part">
      <div>
        <strong>{title}</strong>
        <p className="customer-muted">
          {paid ? "Paid" : pending ? "Receipt sent, waiting for the operator to check it" : `Due ${formatCustomerDate(due)}`}
        </p>
      </div>
      <strong>{formatMoney(amount)}</strong>
      {canPay && !paid && !pending && (
        <Link className="customer-primary-btn" to={`/customer/checkout/${booking.id}?type=${payType}`}>
          Pay {title.toLowerCase()}
        </Link>
      )}
    </div>
  );
}

function PaymentSchedulePanel({ booking }) {
  const payment = booking.payment;
  const pricing = booking.car.pricing;

  // Before acceptance there is no schedule yet; show what will apply.
  if (!payment) {
    if (!pricing) return null;
    return (
      <article className="customer-glass-card">
        <h2>Payment schedule</h2>
        <p className="customer-muted">Payment is requested only after the operator accepts.</p>
        <div className="customer-info-list">
          <div>
            <span>{pricing.depositSen ? `Deposit (${pricing.depositPct}% of the rental)` : "Deposit"}</span>
            <strong>{pricing.depositSen ? sen(pricing.depositSen) : "None"}</strong>
          </div>
          <div>
            <span>Balance, before pickup</span>
            <strong>{pricing.balanceSen ? sen(pricing.balanceSen) : "None"}</strong>
          </div>
        </div>
      </article>
    );
  }

  const open = ["PENDING_PAYMENT", "ACCEPTED"].includes(booking.status);
  const depositNeeded = Number(payment.downPaymentAmount) > 0;
  const balanceNeeded = Number(payment.finalPaymentAmount) > 0;

  return (
    <article className="customer-glass-card">
      <h2>Payment schedule</h2>
      {depositNeeded && (
        <PaymentPart
          title="Deposit"
          amount={payment.downPaymentAmount}
          due={payment.downPaymentDueDate}
          status={payment.downPaymentStatus}
          payType="DOWN_PAYMENT"
          booking={booking}
          canPay={open}
        />
      )}
      {balanceNeeded && (
        <PaymentPart
          title="Balance"
          amount={payment.finalPaymentAmount}
          due={payment.finalPaymentDueDate}
          status={payment.finalPaymentStatus}
          payType="FINAL_PAYMENT"
          booking={booking}
          canPay={open && payment.downPaymentStatus === "PAID"}
        />
      )}
      <p className="customer-muted">
        Pay by card through Stripe, or by DuitNow where {booking.operator?.companyName || "the operator"} accepts it and
        upload the receipt.
      </p>
    </article>
  );
}

// Account-level licence (Farah's verification queue). The per-booking check
// against this licence is BNPLB-104; until then the card shows the account
// status and links to the upload page.
const LICENCE_STATE = {
  APPROVED: ["Approved", "Your licence is checked. Bring the original to pickup."],
  UNDER_REVIEW: ["Under review", "The platform checks it within 48 hours."],
  REJECTED: ["Rejected", "Upload a clearer photo of the front and back."],
  REUPLOAD_REQUIRED: ["New upload needed", "Upload a clearer photo of the front and back."],
};

function LicenceCard({ dueAt }) {
  const [doc, setDoc] = useState(undefined);

  useEffect(() => {
    let alive = true;
    getMyLicenceDocument()
      .then((r) => alive && setDoc(r.data?.document || null))
      .catch(() => alive && setDoc(null));
    return () => {
      alive = false;
    };
  }, []);

  const [label, note] = doc ? LICENCE_STATE[doc.status] || [doc.status, ""] : ["Not uploaded", ""];
  const needsAction = !doc || ["REJECTED", "REUPLOAD_REQUIRED"].includes(doc.status);

  return (
    <article className="customer-glass-card">
      <h2>Driving licence</h2>
      {doc !== undefined && (
        <div className="customer-info-list">
          <div>
            <span>Status</span>
            <strong>{label}</strong>
          </div>
        </div>
      )}
      <p className="customer-muted">
        {needsAction
          ? `Upload your driving licence before ${formatCustomerDate(dueAt)}. `
          : ""}
        {note || "A licence already approved on your account is reused for later bookings."}
      </p>
      <div className="customer-card-actions">
        <Link className={needsAction ? "customer-primary-btn" : "customer-secondary-btn"} to="/customer/licence">
          {needsAction ? "Upload licence" : "View licence"}
        </Link>
      </div>
    </article>
  );
}

export default function CarBookingPanel({ booking }) {
  const now = useNow();
  const car = booking.car;
  const listing = car.listing;
  const pricing = car.pricing;
  const pickup = booking.alternativePickupDate || booking.pickupDate;
  const ret = booking.alternativeReturnDate || booking.returnDate;
  const sameReturn = car.dropoffPoint && car.pickupPoint && car.dropoffPoint.id === car.pickupPoint.id;
  const accepted = ["PENDING_PAYMENT", "ACCEPTED", "PAID", "IN_PROGRESS"].includes(booking.status);

  return (
    <>
      <StatusBanner booking={booking} now={now} />

      <article className="customer-glass-card">
        <div className="car-booking-head">
          {listing?.imageUrl && <img src={listing.imageUrl} alt="" className="car-booking-thumb" />}
          <div>
            <h2>
              {[listing?.make, listing?.model].filter(Boolean).join(" ") || booking.serviceName}
              {listing?.modelYear ? ` (${listing.modelYear})` : ""}
            </h2>
            <p className="customer-muted">
              {booking.operator?.companyName}
              {listing?.branch?.name ? `, ${listing.branch.name}` : ""}
            </p>
          </div>
        </div>
        <div className="customer-info-list detail customer-booking-info-grid">
          <div>
            <span>Pickup</span>
            <strong>{formatCustomerDate(pickup)}</strong>
          </div>
          <div>
            <span>Return</span>
            <strong>{formatCustomerDate(ret)}</strong>
          </div>
          {car.requestedLocation ? (
            <div>
              <span>Requested location</span>
              <strong>{car.requestedLocation}</strong>
            </div>
          ) : (
            <>
              <div>
                <span>Pickup point</span>
                <strong>{car.pickupPoint ? pointText(car.pickupPoint) : listing?.branch?.address || "Branch counter"}</strong>
              </div>
              <div>
                <span>Drop-off point</span>
                <strong>{sameReturn || !car.dropoffPoint ? "Same as pickup" : pointText(car.dropoffPoint)}</strong>
              </div>
            </>
          )}
          <div>
            <span>Rental length</span>
            <strong>{pricing?.hours ? durationText(pricing.hours) : "-"}</strong>
          </div>
          <div>
            <span>Driver</span>
            <strong>{car.driver?.fullName || "-"}</strong>
          </div>
          {car.chauffeur?.requested && (
            <div>
              <span>Chauffeur</span>
              <strong>Requested{car.chauffeur.note ? `: ${car.chauffeur.note}` : ""}</strong>
            </div>
          )}
        </div>
        {car.chauffeur?.requested && (
          <p className="customer-muted">The operator arranges the chauffeur and any charge with you directly.</p>
        )}
      </article>

      <PaymentSchedulePanel booking={booking} />
      <PriceBreakdown pricing={pricing} />

      {accepted && <LicenceCard dueAt={booking.payment?.finalPaymentDueDate || pickup} />}
    </>
  );
}
