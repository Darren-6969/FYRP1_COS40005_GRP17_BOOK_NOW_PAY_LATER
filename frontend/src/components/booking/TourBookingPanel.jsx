import { formatCustomerDate, formatMoney } from "../../utils/customerUtils";

// Tour sections of the customer and operator booking detail pages (operator
// types plan, Phase 3). Everything shown comes from the booking's tour view
// (car_booking_view.mapTourBooking) and its pricing snapshot.

const sen = (n) => formatMoney((n || 0) / 100);

function rows(tour) {
  const point = tour.pickupPoint;
  return [
    ["Starts", formatCustomerDate(tour.startAt)],
    ["Pickup time", tour.pickupTime || "-"],
    ["Duration", tour.durationDays === 1 ? "1 day" : `${tour.durationDays} days`],
    ["Passengers", tour.passengers ?? "-"],
    ["Pickup point", point ? [point.label, point.address].filter(Boolean).join(", ") : "Arranged with the operator"],
  ];
}

function priceRows(pricing) {
  if (!pricing) return [];
  const unit = pricing.priceUnit === "PER_PACKAGE" ? "Tour package" : "Charter tour (per car)";
  return [
    [unit, pricing.rentalSen],
    ...(pricing.pickupFeeSen ? [["Pickup charge", pricing.pickupFeeSen]] : []),
    [`Down payment (${pricing.depositPct}%)`, pricing.depositSen],
    ["Balance", pricing.balanceSen],
  ];
}

function paymentStatusText(booking) {
  if (booking.status === "PENDING") return "Nothing to pay until the operator accepts";
  const status = booking.payment?.status || "UNPAID";
  return status.charAt(0) + status.slice(1).toLowerCase().replace(/_/g, " ");
}

export default function TourBookingPanel({ booking, variant = "customer" }) {
  const tour = booking.tour;
  if (!tour) return null;

  if (variant === "operator") {
    return (
      <div className="booking-clean-section">
        <h3>Tour</h3>
        <div className="booking-clean-trip-grid">
          {rows(tour).map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          {tour.contact?.phone && (
            <div>
              <span>Customer phone</span>
              <strong>{tour.contact.phone}</strong>
            </div>
          )}
        </div>
        {tour.note && (
          <p className="booking-clean-location-note">
            <strong>Customer note:</strong> {tour.note}
          </p>
        )}
      </div>
    );
  }

  return (
    <>
      <article className="customer-glass-card">
        <h2>Your tour</h2>
        <div className="customer-info-list">
          {rows(tour).map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          {tour.note && (
            <div>
              <span>Your note</span>
              <strong>{tour.note}</strong>
            </div>
          )}
          <div>
            <span>Payment status</span>
            <strong>{paymentStatusText(booking)}</strong>
          </div>
          {booking.paymentDeadline && (
            <div>
              <span>Pay by</span>
              <strong>{formatCustomerDate(booking.paymentDeadline)}</strong>
            </div>
          )}
        </div>
      </article>
      {tour.pricing && (
        <article className="customer-glass-card">
          <h2>Price breakdown</h2>
          <div className="customer-info-list">
            {priceRows(tour.pricing).map(([label, value]) => (
              <div key={label}>
                <span>{label}</span>
                <strong>{sen(value)}</strong>
              </div>
            ))}
            <div className="car-booking-total">
              <span>Total</span>
              <strong>{sen(tour.pricing.totalSen)}</strong>
            </div>
          </div>
          <p className="customer-muted">
            One price for your group, never per person. If you cancel, the operator keeps the down payment and any
            balance you have paid is refunded in full.
          </p>
        </article>
      )}
    </>
  );
}
