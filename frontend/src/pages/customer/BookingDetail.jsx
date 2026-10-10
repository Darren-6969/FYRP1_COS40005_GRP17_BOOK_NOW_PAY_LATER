import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCustomerBooking } from "../../hooks/useBookings";
import {
  canCustomerCancel,
  canCustomerPay,
  customerStatusClass,
  formatCustomerDate,
  formatMoney,
  statusLabel,
} from "../../utils/customerUtils";
import { refreshNotifications } from "../../utils/notifyRefresh";
import CarBookingPanel from "../../components/booking/CarBookingPanel";
import CarAlternativeCard from "../../components/booking/CarAlternativeCard";

export default function BookingDetail() {
  const { id } = useParams();

  const {
    booking,
    activity,
    loading,
    error,
    cancelBooking,
    acceptAlternative,
    rejectAlternative,
    reload,
  } = useCustomerBooking(id);

  const [alternativeBusy, setAlternativeBusy] = useState(false);

  const gocarThankYouUrl = import.meta.env.VITE_GOCAR_THANK_YOU_URL;

  const handleCancel = async () => {
    if (!window.confirm("Cancel this booking?")) return;
    await cancelBooking();
    refreshNotifications();
  };

  // A car alternative is re-checked when accepted: it may have sold out, or
  // its price may have changed (the card then reloads with the new price).
  const handleAcceptAlternative = async () => {
    if (!window.confirm("Accept this alternative booking option?")) return;
    try {
      setAlternativeBusy(true);
      await acceptAlternative();
      refreshNotifications();
    } catch (err) {
      alert(err.response?.data?.message || "Could not accept the alternative");
      await reload();
    } finally {
      setAlternativeBusy(false);
    }
  };

  const handleRejectAlternative = async () => {
    if (!window.confirm("Reject this alternative booking option?")) return;
    try {
      setAlternativeBusy(true);
      await rejectAlternative();
      refreshNotifications();
    } catch (err) {
      alert(err.response?.data?.message || "Could not decline the alternative");
    } finally {
      setAlternativeBusy(false);
    }
  };

  if (loading) {
    return (
      <div className="customer-page">
        <div className="customer-glass-card">Loading booking...</div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="customer-page">
        <div className="customer-alert customer-alert-danger">{error}</div>
      </div>
    );
  }

  if (!booking) return null;

  const bookingCode = booking.bookingCode || `#${booking.id}`;
  const isHostBooking = Boolean(booking.hostBookingRef);
  const isCarBooking = Boolean(booking.car);
  const refunds = Array.isArray(booking.refunds) ? booking.refunds: [];
  const latestRefund =refunds.length > 0? refunds[0]: null;

  return (
    <div className="customer-page customer-booking-detail-page">
      <Link className="customer-text-btn" to="/customer/bookings">
        ← Back to My Bookings
      </Link>

      <section className="customer-booking-detail-grid with-alternative">
        <article className="customer-glass-card customer-booking-detail-card">
          <div className="customer-card-head">
            <span
              className={`customer-status status-${customerStatusClass(
                booking.status
              )}`}
            >
              {statusLabel(booking.status)}
            </span>

            <span className="customer-booking-code">{bookingCode}</span>
          </div>

          <h1>{booking.serviceName}</h1>
          <p className="customer-muted">
            {booking.operator?.companyName || "Host"}
          </p>

          {!isCarBooking && (
          <div className="customer-info-list detail customer-booking-info-grid">
            <div>
              <span>Service Type</span>
              <strong>{booking.serviceType || "-"}</strong>
            </div>

            <div>
              <span>Booking Date</span>
              <strong>{formatCustomerDate(booking.createdAt)}</strong>
            </div>

            <div>
              <span>Pick-up / Check-in</span>
              {formatCustomerDate(booking.alternativePickupDate || booking.pickupDate)}
            </div>

            <div>
              <span>Return / Check-out</span>
              {formatCustomerDate(booking.alternativeReturnDate || booking.returnDate)}
            </div>

            <div>
              <span>Location</span>
              <strong>{booking.location || "-"}</strong>
            </div>

            <div>
              <span>Total Amount</span>
              <strong>{formatMoney(booking.totalAmount)}</strong>
            </div>

            <div>
              <span>Deadline</span>
              <strong>{formatCustomerDate(booking.paymentDeadline)}</strong>
            </div>

            <div>
              <span>Payment Status</span>
              <strong>{statusLabel(booking.payment?.status || "UNPAID")}</strong>
            </div>
          </div>
          )}

          <div className="customer-card-actions">
            {!isCarBooking && canCustomerPay(booking) && (
              <Link
                className="customer-primary-btn"
                to={`/customer/checkout/${booking.id}`}
              >
                Proceed to Payment
              </Link>
            )}

            {canCustomerCancel(booking) && (
              <button
                className="customer-secondary-btn"
                onClick={handleCancel}
              >
                Cancel Booking
              </button>
            )}

            {booking.invoice?.id && (
              <Link
                className="customer-secondary-btn"
                to={`/customer/invoices/${booking.invoice.id}`}
              >
                View Invoice
              </Link>
            )}

            {isHostBooking && gocarThankYouUrl && (
              <a
                className="customer-secondary-btn"
                href={gocarThankYouUrl}
                target="_blank"
                rel="noreferrer"
              >
                Return to GoCar
              </a>
            )}
          </div>
        </article>

        {isCarBooking && <CarBookingPanel booking={booking} />}
        {latestRefund && (
          <article className="customer-glass-card">

            <div className="customer-card-head">
              <div>
                <p className="customer-eyebrow">
                  Refund
                </p>

                <h2>
                  Refund Details
                </h2>
              </div>

              <span
                className={`customer-status status-${customerStatusClass(
                  latestRefund.status
                )}`}
              >
                {statusLabel(
                  latestRefund.status
                )}
              </span>
            </div>

            <div className="customer-info-list detail customer-booking-info-grid">

              <div>
                <span>
                  Refund Reference
                </span>

                <strong>
                  {latestRefund.refundReference ||
                    `RF-${String(
                      latestRefund.id
                    ).padStart(6, "0")}`}
                </strong>
              </div>

              <div>
                <span>
                  Original Deposit
                </span>

                <strong>
                  {formatMoney(
                    latestRefund.paidAmount
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Refund Percentage
                </span>

                <strong>
                  {latestRefund.refundPercent != null
                    ? `${latestRefund.refundPercent}%`
                    : "-"}
                </strong>
              </div>

              <div>
                <span>
                  Refund Amount
                </span>

                <strong>
                  {formatMoney(
                    latestRefund.amount
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Refund Method
                </span>

                <strong>
                  {latestRefund.method || "-"}
                </strong>
              </div>

              <div>
                <span>
                  Refund Status
                </span>

                <strong>
                  {statusLabel(
                    latestRefund.status
                  )}
                </strong>
              </div>

              <div>
                <span>
                  Requested
                </span>

                <strong>
                  {formatCustomerDate(
                    latestRefund.createdAt
                  )}
                </strong>
              </div>

              {latestRefund.processedAt && (
                <div>
                  <span>
                    Refunded At
                  </span>

                  <strong>
                    {formatCustomerDate(
                      latestRefund.processedAt
                    )}
                  </strong>
                </div>
              )}

            </div>

            {latestRefund.reason && (
              <div className="customer-alternative-reason">
                <strong>
                  Refund Reason
                </strong>

                <p>
                  {latestRefund.reason}
                </p>
              </div>
            )}

            {latestRefund.status ===
              "PENDING" &&
              latestRefund.method !==
                "STRIPE" && (
                <div className="customer-alert">
                  Your refund is awaiting
                  processing by the operator.
                </div>
              )}

            {latestRefund.status ===
              "REFUNDED" && (
                <div className="customer-alert">
                  Your refund has been
                  completed.
                </div>
              )}

          </article>
        )}

        {booking.status === "ALTERNATIVE_SUGGESTED" && booking.car?.alternative && (
          <CarAlternativeCard
            booking={booking}
            onAccept={handleAcceptAlternative}
            onDecline={handleRejectAlternative}
            busy={alternativeBusy}
          />
        )}

        {booking.status === "ALTERNATIVE_SUGGESTED" && !booking.car?.alternative && (
          <article className="customer-glass-card customer-alternative-card">
            <div className="customer-alternative-head">
              <div>
                <p className="customer-eyebrow">
                  Alternative Booking Suggested
                </p>
                <h2>Review the operator’s suggested option</h2>
              </div>

              <span className="customer-status status-warning">
                Action Required
              </span>
            </div>

            <div className="customer-alternative-compare">
              <div className="customer-alt-box original">
                <p>Original Booking</p>
                <h3>{booking.serviceName}</h3>

                <div>
                  <span>Pick-up / Check-in</span>
                  <strong>{formatCustomerDate(booking.pickupDate)}</strong>
                </div>

                <div>
                  <span>Return / Check-out</span>
                  <strong>{formatCustomerDate(booking.returnDate)}</strong>
                </div>

                <div>
                  <span>Total Amount</span>
                  <strong>{formatMoney(booking.totalAmount)}</strong>
                </div>
              </div>

              <div className="customer-alt-arrow">→</div>

              <div className="customer-alt-box suggested">
                <p>Suggested Alternative</p>
                <h3>{booking.alternativeServiceName || "Alternative option"}</h3>

                <div>
                  <span>Pick-up / Check-in</span>
                  <strong>
                    {formatCustomerDate(
                      booking.alternativePickupDate || booking.pickupDate
                    )}
                  </strong>
                </div>

                <div>
                  <span>Return / Check-out</span>
                  <strong>
                    {formatCustomerDate(
                      booking.alternativeReturnDate || booking.returnDate
                    )}
                  </strong>
                </div>

                <div>
                  <span>Total Amount</span>
                  <strong>
                    {formatMoney(booking.alternativePrice || booking.totalAmount)}
                  </strong>
                </div>
              </div>
            </div>

            {booking.alternativeReason && (
              <div className="customer-alternative-reason">
                <strong>Reason from operator</strong>
                <p>{booking.alternativeReason}</p>
              </div>
            )}

            <div className="customer-card-actions">
              <button
                className="customer-secondary-btn"
                onClick={handleRejectAlternative}
              >
                Reject Alternative
              </button>

              <button
                className="customer-primary-btn"
                onClick={handleAcceptAlternative}
              >
                Accept Alternative
              </button>
            </div>

            <p className="customer-alt-note">
              You can only receive one alternative suggestion for this booking.
            </p>
          </article>
        )}

        <article className="customer-glass-card customer-timeline-card">
          <h2>Booking Timeline</h2>

          <div className="customer-timeline">
            {activity.length ? (
              activity.map((item) => (
                <div key={item.id} className="customer-timeline-item">
                  <span />
                  <div>
                    <strong>{item.action.replaceAll("_", " ")}</strong>
                    <p>{formatCustomerDate(item.createdAt)}</p>
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="customer-timeline-item">
                  <span />
                  <div>
                    <strong>Booking Created</strong>
                    <p>{formatCustomerDate(booking.createdAt)}</p>
                  </div>
                </div>

                <div className="customer-timeline-item">
                  <span />
                  <div>
                    <strong>Current Status</strong>
                    <p>{statusLabel(booking.status)}</p>
                  </div>
                </div>
              </>
            )}
          </div>
        </article>
      </section>
    </div>
  );
}