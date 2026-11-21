import { Link } from "react-router-dom";
import { formatCustomerDate, formatMoney } from "../../utils/customerUtils";
import { durationText } from "../../utils/carPricing";
import { priceBreakdownRows } from "./carBookingParts";

// Car rental sections of the customer booking detail page (SRS 4.2.6).
// The next step sits in the page header (BookingNextStep) and the licence
// and permit in BookingDocumentsCard.
// Everything shown comes from the booking record and its pricing snapshot;
// nothing is recalculated here.

const sen = (n) => formatMoney((n || 0) / 100);

function pointText(point) {
  if (!point) return "-";
  return point.address ? `${point.label}, ${point.address}` : point.label;
}

function PriceBreakdown({ pricing }) {
  if (!pricing) return null;
  const rows = priceBreakdownRows(pricing).map((row) => [row.label, row.amountSen]);

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
      {(pricing.requestedLocation || pricing.requestedDropoffLocation) &&
        !(pricing.pickupPoint?.requested && pricing.pickupFeeSen) &&
        !(pricing.dropoffPoint?.requested && pricing.dropoffFeeSen) && (
        <p className="customer-muted">
          Your requested place has no charge yet. The operator replies with any charge, and you accept it before
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

export default function CarBookingPanel({ booking }) {
  const car = booking.car;
  const listing = car.listing;
  const pricing = car.pricing;
  const pickup = booking.alternativePickupDate || booking.pickupDate;
  const ret = booking.alternativeReturnDate || booking.returnDate;
  const sameReturn = car.dropoffPoint && car.pickupPoint && car.dropoffPoint.id === car.pickupPoint.id;

  return (
    <>
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
        <div className="customer-info-list detail customer-booking-info-grid car-trip-grid">
          <div>
            <span>Pickup</span>
            <strong>{formatCustomerDate(pickup)}</strong>
          </div>
          <div>
            <span>Return</span>
            <strong>{formatCustomerDate(ret)}</strong>
          </div>
          {car.requestedLocation || car.requestedDropoffLocation ? (
            <>
              <div>
                <span>{car.requestedLocation ? "Requested pickup place" : "Pickup point"}</span>
                <strong>
                  {car.requestedLocation ||
                    (car.pickupPoint ? pointText(car.pickupPoint) : pricing?.pickupPoint?.label || "Branch counter")}
                </strong>
              </div>
              <div>
                <span>{car.requestedDropoffLocation ? "Requested drop-off place" : "Drop-off point"}</span>
                <strong>
                  {car.requestedDropoffLocation ||
                    (pricing?.dropoffPoint?.id === "requested" || (!pricing?.dropoffPoint && !car.dropoffPoint)
                      ? "Same as pickup"
                      : car.dropoffPoint
                        ? pointText(car.dropoffPoint)
                        : pricing?.dropoffPoint?.label || "Branch counter")}
                </strong>
              </div>
            </>
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
    </>
  );
}