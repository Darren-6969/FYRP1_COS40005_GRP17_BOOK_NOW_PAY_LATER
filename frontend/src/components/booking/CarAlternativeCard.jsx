import { formatCustomerDate } from "../../utils/customerUtils";
import {
  carTitle,
  depositLabel,
  formatSen,
  priceBreakdownRows,
  rentalDurationText,
} from "./carBookingParts";

// The operator's suggested car for a car booking (Module 3). Both prices come
// from the server: the original booking's snapshot and the quote for the
// suggested car, so what is shown here is what will be charged.
export default function CarAlternativeCard({ booking, onAccept, onDecline, busy = false }) {
  const car = booking.car;
  const alternative = car?.alternative;
  if (!alternative) return null;

  const original = car.pricing;
  const offered = alternative.pricing;
  const quote = offered?.quote || {};
  const difference = offered && original ? offered.totalSen - original.totalSen : 0;

  return (
    <article className="customer-glass-card customer-alternative-card">
      <div className="customer-alternative-head">
        <div>
          <p className="customer-eyebrow">Alternative Car Suggested</p>
          <h2>{booking.operator?.companyName || "The operator"} suggested another car</h2>
        </div>

        <span className="customer-status status-warning">Action Required</span>
      </div>

      <div className="customer-alternative-compare">
        <div className="customer-alt-box original">
          <p>You requested</p>
          <h3>{carTitle(car.listing) || booking.serviceName}</h3>

          <div>
            <span>Pick-up</span>
            <strong>{formatCustomerDate(booking.pickupDate)}</strong>
          </div>

          <div>
            <span>Return</span>
            <strong>{formatCustomerDate(booking.returnDate)}</strong>
          </div>

          <div>
            <span>Total</span>
            <strong>{original ? formatSen(original.totalSen) : "-"}</strong>
          </div>
        </div>

        <div className="customer-alt-arrow">→</div>

        <div className="customer-alt-box suggested">
          <p>Suggested car</p>
          <h3>{carTitle(alternative.listing) || booking.alternativeServiceName}</h3>

          {alternative.listing?.branch?.name && (
            <div>
              <span>Branch</span>
              <strong>{alternative.listing.branch.name}</strong>
            </div>
          )}

          <div>
            <span>Pick-up</span>
            <strong>{formatCustomerDate(alternative.pickupAt)}</strong>
          </div>

          <div>
            <span>Return</span>
            <strong>{formatCustomerDate(alternative.returnAt)}</strong>
          </div>

          <div>
            <span>Duration</span>
            <strong>{rentalDurationText(offered)}</strong>
          </div>
        </div>
      </div>

      {offered && (
        <div className="customer-info-list">
          {priceBreakdownRows(offered).map((row) => (
            <div key={row.label}>
              <span>{row.label}</span>
              <strong>{formatSen(row.amountSen)}</strong>
            </div>
          ))}

          <div className="car-booking-total">
            <span>New total</span>
            <strong>{formatSen(offered.totalSen)}</strong>
          </div>

          <div>
            <span>{depositLabel(offered)}, paid after you accept</span>
            <strong>{formatSen(offered.depositSen)}</strong>
          </div>

          <div>
            <span>Balance</span>
            <strong>{formatSen(offered.balanceSen)}</strong>
          </div>
        </div>
      )}

      {difference !== 0 && (
        <p className="customer-muted">
          {difference > 0
            ? `This is ${formatSen(difference)} more than your original request.`
            : `This is ${formatSen(-difference)} less than your original request.`}
        </p>
      )}

      {quote.pointsChanged && (
        <p className="customer-muted">
          This car is at another branch, so pick-up and drop-off are at{" "}
          {offered?.pickupPoint?.label || "that branch"}
          {offered?.dropoffPoint && offered.dropoffPoint.label !== offered.pickupPoint?.label
            ? ` and ${offered.dropoffPoint.label}`
            : ""}
          .
        </p>
      )}

      {quote.droppedAddons?.length > 0 && (
        <p className="customer-muted">
          Not offered with this car, so not included: {quote.droppedAddons.join(", ")}.
        </p>
      )}

      {alternative.reason && (
        <div className="customer-alternative-reason">
          <strong>Reason from operator</strong>
          <p>{alternative.reason}</p>
        </div>
      )}

      <p className="customer-muted">
        Nothing is charged until you accept. If you decline, this booking closes and you can book another car.
      </p>

      <div className="customer-card-actions">
        <button className="customer-secondary-btn" onClick={onDecline} disabled={busy}>
          Decline
        </button>

        <button className="customer-primary-btn" onClick={onAccept} disabled={busy}>
          {busy ? "Please wait..." : `Accept and continue to payment`}
        </button>
      </div>
    </article>
  );
}
