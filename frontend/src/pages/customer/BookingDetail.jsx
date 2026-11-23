import { useState } from "react";
import { Link, useParams } from "react-router-dom";
import { useCustomerBooking } from "../../hooks/useBookings";
import {
  canCustomerCancel,
  canCustomerPay,
  cancellationClosedByPickup,
  customerStatusClass,
  formatCustomerDate,
  formatMoney,
  statusLabel,
  formatStatus,
} from "../../utils/customerUtils";
import { refreshNotifications } from "../../utils/notifyRefresh";
import CarBookingPanel from "../../components/booking/CarBookingPanel";
import TourBookingPanel from "../../components/booking/TourBookingPanel";
import CarAlternativeCard from "../../components/booking/CarAlternativeCard";
import CancelBookingDialog from "../../components/booking/CancelBookingDialog";
import RefundSummary, { CancellationNotice } from "../../components/booking/RefundSummary";
import BookingNextStep from "../../components/booking/BookingNextStep";
import BookingDocumentsCard from "../../components/booking/BookingDocumentsCard";
import "../../assets/styles/customer-booking-detail.css";

export default function BookingDetail() {
  const { id } = useParams();

  const {
    booking,
    activity,
    loading,
    error,
    acceptAlternative,
    rejectAlternative,
    reload,
  } = useCustomerBooking(id);

  const [alternativeBusy, setAlternativeBusy] = useState(false);
  const [showCancel, setShowCancel] = useState(false);
  const gocarThankYouUrl = import.meta.env.VITE_GOCAR_THANK_YOU_URL;

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

  return (
    <div className="customer-page customer-booking-detail-page">
      <Link className="customer-text-btn" to="/customer/bookings">
        ← Back to my bookings
      </Link>

      {/* One column with even spacing; each card is a direct child. */}
      <section className="booking-detail-stack">
        <article className="customer-glass-card customer-booking-detail-card booking-detail-header">
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

          {/* Car and tour bookings have their own panels below. */}
          {!isCarBooking && !booking.tour && (
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

          {isCarBooking && <BookingNextStep booking={booking} />}

          <div className="customer-card-actions booking-detail-actions">
            {!isCarBooking && canCustomerPay(booking) && (
              <Link
                className="customer-primary-btn"
                to={`/customer/checkout/${booking.id}`}
              >
                Proceed to payment
              </Link>
            )}

            {booking.invoice?.id && (
              <Link
                className="customer-secondary-btn"
                to={`/customer/invoices/${booking.invoice.id}`}
              >
                View invoice
              </Link>
            )}

            {["NO_SHOW", "NO_SHOW_UNPAID"].includes(booking.status) && (
              <Link className="customer-secondary-btn" to={`/customer/credit?booking=${booking.id}`}>
                Appeal no-show decision
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

            {/* Kept quiet so it is not pressed instead of the main action. */}
            {canCustomerCancel(booking) && (
              <button
                type="button"
                className="booking-detail-cancel"
                onClick={() => setShowCancel(true)}
              >
                Cancel booking
              </button>
            )}
          </div>

          {cancellationClosedByPickup(booking) && (
            <p className="customer-muted">
              Pickup time has passed, so this booking can no longer be cancelled.
            </p>
          )}
        </article>

        {/* An offer waiting for the customer comes straight after the header. */}
        {booking.status === "ALTERNATIVE_SUGGESTED" && booking.car?.alternative && (
          <CarAlternativeCard
            booking={booking}
            onAccept={handleAcceptAlternative}
            onDecline={handleRejectAlternative}
            busy={alternativeBusy}
          />
        )}

        {/* Tours need no driving licence: the operator drives. */}
        {!booking.tour && <BookingDocumentsCard booking={booking} />}

        {isCarBooking && <CarBookingPanel booking={booking} />}
        {booking.tour && <TourBookingPanel booking={booking} />}
        <CancellationNotice booking={booking} />
        <RefundSummary booking={booking} />

        {showCancel && (
          <CancelBookingDialog
            booking={booking}
            onClose={() => setShowCancel(false)}
            onCancelled={async () => {
              await reload();
              refreshNotifications();
            }}
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
          <h2>Booking timeline</h2>

          <div className="customer-timeline">
            {activity.length ? (
              activity.map((item) => (
                <div key={item.id} className="customer-timeline-item">
                  <span />
                  <div>
                    <strong>{formatStatus(item.action)}</strong>
                    <p>{formatCustomerDate(item.createdAt)}</p>
                  </div>
                </div>
              ))
            ) : (
              <>
                <div className="customer-timeline-item">
                  <span />
                  <div>
                    <strong>Booking created</strong>
                    <p>{formatCustomerDate(booking.createdAt)}</p>
                  </div>
                </div>

                <div className="customer-timeline-item">
                  <span />
                  <div>
                    <strong>Current status</strong>
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