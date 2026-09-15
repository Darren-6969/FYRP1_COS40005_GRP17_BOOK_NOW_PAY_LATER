import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";

import {
  operatorService,
  formatOperatorMoney,
  formatOperatorDateTime,
  operatorStatusClass,
  operatorStatusLabel,
} from "../../services/operator_service";

export default function OperatorBookingDetail() {
  const { id } = useParams();

  const [booking, setBooking] = useState(null);
  const [timeline, setTimeline] = useState([]);

  const [showPaymentDeadline, setShowPaymentDeadline] =
    useState(false);

  const [showCancel, setShowCancel] =
    useState(false);

  const [loading, setLoading] =
    useState(true);

  const [actionLoading, setActionLoading] =
    useState("");

  const [error, setError] =
    useState("");

  // =========================================================
  // Load booking
  // =========================================================
  const loadBooking = async () => {
    try {
      setLoading(true);
      setError("");

      const res =
        await operatorService.getBookingById(id);

      setBooking(res.data.booking);
      setTimeline(res.data.timeline || []);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load booking"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBooking();
  }, [id]);

  // =========================================================
  // Handover
  // Backend/service will be added in Step 2
  // =========================================================
  const handleHandover = async () => {
    try {
      setActionLoading("handover");

      if (!operatorService.handoverBooking) {
        alert(
          "Handover backend API will be connected in the next step."
        );
        return;
      }

      await operatorService.handoverBooking(id);

      await loadBooking();
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to hand over booking"
      );
    } finally {
      setActionLoading("");
    }
  };

  // =========================================================
  // Return
  // Backend/service will be added in Step 2
  // =========================================================
  const handleReturn = async () => {
    try {
      setActionLoading("return");

      if (!operatorService.returnBooking) {
        alert(
          "Return backend API will be connected in the next step."
        );
        return;
      }

      await operatorService.returnBooking(id);

      await loadBooking();
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to complete vehicle return"
      );
    } finally {
      setActionLoading("");
    }
  };

  // =========================================================
  // Loading
  // =========================================================
  if (loading) {
    return (
      <div className="operator-page">
        <div className="operator-card">
          Loading booking details...
        </div>
      </div>
    );
  }

  // =========================================================
  // Error
  // =========================================================
  if (error || !booking) {
    return (
      <div className="operator-page">
        <div className="operator-alert danger">
          {error || "Booking not found"}

          <button
            type="button"
            onClick={loadBooking}
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  // =========================================================
  // Booking/payment status
  // =========================================================
  const bookingStatus = String(
    booking.status || ""
  ).toUpperCase();

  const paymentStatus = String(
    booking.payment?.status || ""
  ).toUpperCase();

  const isPaid =
    bookingStatus === "PAID" ||
    bookingStatus === "COMPLETED" ||
    paymentStatus === "PAID";

  const isClosed = [
    "COMPLETED",
    "CANCELLED",
    "OVERDUE",
    "REJECTED",
  ].includes(bookingStatus);

  // =========================================================
  // Handover
  //
  // A paid booking is ready for customer collection.
  // =========================================================
  const canHandover =
  isPaid &&
  !isClosed &&
  bookingStatus !== "IN_PROGRESS";

  // =========================================================
  // Return
  //
  // Supports either status name while backend is being
  // implemented.
  // =========================================================
  const canReturn =
  bookingStatus === "IN_PROGRESS";

  // =========================================================
  // Payment deadline
  // =========================================================
  const canEditDeadline =
    bookingStatus === "PENDING_PAYMENT" &&
    paymentStatus !== "PAID" &&
    !isClosed;

  // =========================================================
  // Cancellation
  //
  // Operator may withdraw a confirmed booking.
  // Cancellation reason will be mandatory.
  // =========================================================
  const canCancel =
    [
      "ACCEPTED",
      "PENDING_PAYMENT",
      "PAID",
    ].includes(bookingStatus) &&
    !isClosed;

  const shouldShowPaymentVerificationLink =
    [
      "PENDING_VERIFICATION",
      "DOWN_PAYMENT_PENDING_VERIFICATION",
      "FINAL_PAYMENT_PENDING_VERIFICATION",
    ].includes(paymentStatus);

  // =========================================================
  // Licence information
  //
  // Flexible field lookup for now.
  // Once we inspect your backend/customer schema,
  // we can use the exact field names.
  // =========================================================
  const licenceStatus =
    booking.customer?.licenceVerificationStatus ||
    booking.customer?.licenseVerificationStatus ||
    booking.customer?.licenceStatus ||
    booking.customer?.licenseStatus ||
    booking.customer?.drivingLicence?.status ||
    booking.customer?.drivingLicense?.status ||
    "NOT_SUBMITTED";

  const licenceNumber =
    booking.customer?.licenceNumber ||
    booking.customer?.licenseNumber ||
    booking.customer?.drivingLicence?.number ||
    booking.customer?.drivingLicense?.number ||
    "-";

  const licenceExpiry =
    booking.customer?.licenceExpiryDate ||
    booking.customer?.licenseExpiryDate ||
    booking.customer?.drivingLicence?.expiryDate ||
    booking.customer?.drivingLicense?.expiryDate ||
    null;

  const licenceVerifiedAt =
    booking.customer?.licenceVerifiedAt ||
    booking.customer?.licenseVerifiedAt ||
    booking.customer?.drivingLicence?.verifiedAt ||
    booking.customer?.drivingLicense?.verifiedAt ||
    null;

  const hasAnyAction =
    canHandover ||
    canReturn ||
    canEditDeadline ||
    canCancel ||
    shouldShowPaymentVerificationLink;

  return (
    <div className="operator-page">

      {/* =====================================================
          Back
      ====================================================== */}
      <div className="operator-detail-top">
        <Link to="/operator/bookings">
          ‹ Back to Bookings
        </Link>
      </div>

      <section className="operator-detail-grid">

        {/* ===================================================
            Booking Summary
        ==================================================== */}
        <div className="operator-card operator-booking-summary">
          <div className="operator-card-head">
            <div>
              <h2>
                {booking.bookingCode ||
                  `BNPL-${String(
                    booking.id
                  ).padStart(4, "0")}`}
              </h2>

              <p>
                Booked on{" "}
                {formatOperatorDateTime(
                  booking.createdAt
                )}
              </p>
            </div>

            <span
              className={`operator-status ${operatorStatusClass(
                booking.status
              )}`}
            >
              {operatorStatusLabel(
                booking.status
              )}
            </span>
          </div>

          <div className="operator-service-preview">
            <div className="operator-car-thumb">
              BN
            </div>

            <div>
              <strong>
                {booking.serviceName || "-"}
              </strong>

              <p>
                {booking.serviceType ||
                  "Service"}
              </p>
            </div>
          </div>

          <InfoRow
            label="Booking Date"
            value={formatOperatorDateTime(
              booking.createdAt
            )}
          />

          <InfoRow
            label="Pickup / Check-in"
            value={formatOperatorDateTime(
              booking.pickupDate
            )}
          />

          <InfoRow
            label="Return / Check-out"
            value={formatOperatorDateTime(
              booking.returnDate
            )}
          />

          <InfoRow
            label="Location"
            value={
              booking.location || "-"
            }
          />

          <InfoRow
            label="Total Amount"
            value={formatOperatorMoney(
              booking.totalAmount
            )}
            strong
          />

          <InfoRow
            label="Payment Deadline"
            value={formatOperatorDateTime(
              booking.paymentDeadline
            )}
          />
        </div>

        {/* ===================================================
            Customer Information
        ==================================================== */}
        <div className="operator-card operator-card-secondary">
          <h2>Customer Information</h2>

          <div className="operator-customer-box">
            <div className="operator-avatar-large">
              {(booking.customer?.name ||
                "C").charAt(0)}
            </div>

            <div>
              <strong>
                {booking.customer?.name ||
                  "-"}
              </strong>

              <p>
                {booking.customer?.email ||
                  "-"}
              </p>
            </div>
          </div>

          {/* =================================================
              Licence Verification
          ================================================== */}
          <h2 className="operator-section-title">
            Licence Verification
          </h2>

          <InfoRow
            label="Verification Status"
            value={
              <span
                className={`operator-status ${getLicenceStatusClass(
                  licenceStatus
                )}`}
              >
                {getLicenceStatusLabel(
                  licenceStatus
                )}
              </span>
            }
          />

          <InfoRow
            label="Licence Number"
            value={licenceNumber}
          />

          <InfoRow
            label="Expiry Date"
            value={
              licenceExpiry
                ? formatOperatorDateTime(
                    licenceExpiry
                  )
                : "-"
            }
          />

          <InfoRow
            label="Verified At"
            value={
              licenceVerifiedAt
                ? formatOperatorDateTime(
                    licenceVerifiedAt
                  )
                : "-"
            }
          />

          <h2 className="operator-section-title">
            Booking Information
          </h2>

          <InfoRow
            label="Created By"
            value={
              booking.operator
                ?.companyName || "-"
            }
          />

          <InfoRow
            label="Operator Email"
            value={
              booking.operator?.email ||
              "-"
            }
          />

          <InfoRow
            label="Updated At"
            value={formatOperatorDateTime(
              booking.updatedAt
            )}
          />
        </div>

        {/* ===================================================
            Timeline
        ==================================================== */}
        <div className="operator-card operator-card-secondary">
          <h2>Booking Timeline</h2>

          <div className="operator-timeline">
            {timeline.map((item) => (
              <div
                key={item.id}
                className="operator-timeline-item done"
              >
                <span />

                <div>
                  <strong>
                    {operatorStatusLabel(
                      item.action
                    )}
                  </strong>

                  <p>
                    {formatOperatorDateTime(
                      item.createdAt
                    )}
                  </p>
                </div>
              </div>
            ))}

            {!timeline.length && (
              <div className="operator-empty-state">
                No timeline records yet.
              </div>
            )}
          </div>
        </div>

        {/* ===================================================
            Payment + Actions
        ==================================================== */}
        <div className="operator-card operator-card-secondary">
          <h2>Payment Status</h2>

          <InfoRow
            label="Amount"
            value={formatOperatorMoney(
              booking.payment?.amount ||
                booking.totalAmount
            )}
            strong
          />

          <InfoRow
            label="Paid to Date"
            value={formatOperatorMoney(
              (
                booking.payment
                  ?.downPaymentStatus ===
                "PAID"
                  ? Number(
                      booking.payment
                        ?.downPaymentAmount ||
                        0
                    )
                  : 0
              ) +
                (booking.payment
                  ?.finalPaymentStatus ===
                "PAID"
                  ? Number(
                      booking.payment
                        ?.finalPaymentAmount ||
                        0
                    )
                  : 0)
            )}
            strong
          />

          <InfoRow
            label="Payment Status"
            value={operatorStatusLabel(
              booking.payment?.status ||
                "UNPAID"
            )}
          />

          <InfoRow
            label="Down-payment"
            value={`${operatorStatusLabel(
              booking.payment
                ?.downPaymentStatus ||
                "UNPAID"
            )} · ${formatOperatorMoney(
              booking.payment
                ?.downPaymentAmount
            )}`}
          />

          <InfoRow
            label="Final Payment"
            value={`${operatorStatusLabel(
              booking.payment
                ?.finalPaymentStatus ||
                "UNPAID"
            )} · ${formatOperatorMoney(
              booking.payment
                ?.finalPaymentAmount
            )}`}
          />

          <InfoRow
            label="Payment Method"
            value={
              booking.payment?.method ||
              "-"
            }
          />

          <InfoRow
            label="Transaction ID"
            value={
              booking.payment
                ?.transactionId || "-"
            }
          />

          {/* =================================================
              NEW V2.6 ACTIONS
          ================================================== */}
          <h2 className="operator-section-title">
            Booking Actions
          </h2>

          <div className="operator-action-stack">

            {/* Handover */}
            {canHandover && (
              <button
                type="button"
                className="operator-primary-btn"
                disabled={!!actionLoading}
                onClick={handleHandover}
              >
                {actionLoading ===
                "handover"
                  ? "Processing Handover..."
                  : "Handover Booking"}
              </button>
            )}

            {/* Return */}
            {canReturn && (
              <button
                type="button"
                className="operator-primary-btn"
                disabled={!!actionLoading}
                onClick={handleReturn}
              >
                {actionLoading ===
                "return"
                  ? "Processing Return..."
                  : "Complete Return"}
              </button>
            )}

            {/* Payment verification */}
            {shouldShowPaymentVerificationLink && (
              <Link
                className="operator-primary-btn"
                to={`/operator/payments?bookingId=${booking.id}`}
              >
                View Payment Verification
              </Link>
            )}

            {/* Payment deadline */}
            {canEditDeadline && (
              <button
                type="button"
                className="operator-secondary-btn"
                disabled={!!actionLoading}
                onClick={() =>
                  setShowPaymentDeadline(
                    true
                  )
                }
              >
                Edit Payment Deadline
              </button>
            )}

            {/* Cancellation */}
            {canCancel && (
              <button
                type="button"
                className="operator-danger-btn"
                disabled={!!actionLoading}
                onClick={() =>
                  setShowCancel(true)
                }
              >
                Cancel This Booking
              </button>
            )}

            {!hasAnyAction && (
              <div className="operator-empty-state compact">
                No further action is
                available for this booking.
              </div>
            )}
          </div>
        </div>
      </section>

      {/* =====================================================
          Payment Deadline Modal
      ====================================================== */}
      {showPaymentDeadline && (
        <PaymentDeadlineModal
          booking={booking}
          onClose={() =>
            setShowPaymentDeadline(false)
          }
          onDone={loadBooking}
        />
      )}

      {/* =====================================================
          Cancellation Modal
      ====================================================== */}
      {showCancel && (
        <CancelBookingModal
          booking={booking}
          onClose={() =>
            setShowCancel(false)
          }
          onDone={loadBooking}
        />
      )}
    </div>
  );
}

// ===========================================================
// Info Row
// ===========================================================
function InfoRow({
  label,
  value,
  strong,
}) {
  return (
    <div className="operator-info-row">
      <span>{label}</span>

      <strong
        className={
          strong ? "strong" : ""
        }
      >
        {value}
      </strong>
    </div>
  );
}

// ===========================================================
// Licence Status Label
// ===========================================================
function getLicenceStatusLabel(status) {
  const normalized = String(
    status || ""
  ).toUpperCase();

  const labels = {
    VERIFIED: "Verified",
    APPROVED: "Verified",

    PENDING:
      "Pending Verification",

    PENDING_VERIFICATION:
      "Pending Verification",

    REJECTED: "Rejected",

    FAILED:
      "Verification Failed",

    NOT_SUBMITTED:
      "Not Submitted",
  };

  return (
    labels[normalized] ||
    operatorStatusLabel(normalized)
  );
}

// ===========================================================
// Licence Status Class
// ===========================================================
function getLicenceStatusClass(status) {
  const normalized = String(
    status || ""
  ).toUpperCase();

  if (
    ["VERIFIED", "APPROVED"].includes(
      normalized
    )
  ) {
    return "success";
  }

  if (
    [
      "PENDING",
      "PENDING_VERIFICATION",
    ].includes(normalized)
  ) {
    return "warning";
  }

  if (
    ["REJECTED", "FAILED"].includes(
      normalized
    )
  ) {
    return "danger";
  }

  return "neutral";
}

// ===========================================================
// datetime-local helper
// ===========================================================
function toDatetimeLocalValue(value) {
  if (!value) {
    const defaultDate = new Date();

    defaultDate.setDate(
      defaultDate.getDate() + 3
    );

    defaultDate.setHours(
      23,
      59,
      0,
      0
    );

    return formatDatetimeLocal(
      defaultDate
    );
  }

  const date = new Date(value);

  if (
    Number.isNaN(date.getTime())
  ) {
    return "";
  }

  return formatDatetimeLocal(date);
}

function formatDatetimeLocal(date) {
  const pad = (number) =>
    String(number).padStart(2, "0");

  return `${date.getFullYear()}-${pad(
    date.getMonth() + 1
  )}-${pad(
    date.getDate()
  )}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function datetimeLocalToMalaysiaLocalString(
  value
) {
  if (!value) return null;

  return value;
}

// ===========================================================
// Payment Deadline Modal
// ===========================================================
function PaymentDeadlineModal({
  booking,
  onClose,
  onDone,
}) {
  const [
    paymentDeadline,
    setPaymentDeadline,
  ] = useState(
    toDatetimeLocalValue(
      booking.paymentDeadline
    )
  );

  const [method, setMethod] =
    useState("PENDING");

  const [loading, setLoading] =
    useState(false);

  const handleSubmit = async () => {
    if (!paymentDeadline) {
      alert(
        "Please select a payment deadline."
      );

      return;
    }

    try {
      setLoading(true);

      const paymentDeadlineValue =
        datetimeLocalToMalaysiaLocalString(
          paymentDeadline
        );

      if (!paymentDeadlineValue) {
        alert(
          "Invalid payment deadline."
        );

        return;
      }

      await operatorService.sendPaymentRequest(
        booking.id,
        {
          method,
          paymentDeadline:
            paymentDeadlineValue,
        }
      );

      await onDone();
      onClose();
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to update payment deadline"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="operator-modal-backdrop">
      <div className="operator-modal">
        <div className="operator-card-head">
          <div>
            <h2>
              Edit Payment Deadline
            </h2>

            <p>
              Update the payment deadline
              for this booking.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <label className="operator-field">
          Payment Method

          <select
            value={method}
            onChange={(e) =>
              setMethod(
                e.target.value
              )
            }
          >
            <option value="PENDING">
              Any Supported Method
            </option>

            <option value="STRIPE">
              Stripe
            </option>

            <option value="DUITNOW">
              DuitNow
            </option>

            <option value="SPAY">
              SPay
            </option>

            <option value="BANK_TRANSFER">
              Bank Transfer
            </option>
          </select>
        </label>

        <label className="operator-field">
          Payment Deadline

          <input
            type="datetime-local"
            value={paymentDeadline}
            onChange={(e) =>
              setPaymentDeadline(
                e.target.value
              )
            }
          />
        </label>

        <div className="operator-modal-actions">
          <button
            type="button"
            className="operator-secondary-btn"
            onClick={onClose}
          >
            Cancel
          </button>

          <button
            type="button"
            className="operator-primary-btn"
            onClick={handleSubmit}
            disabled={loading}
          >
            {loading
              ? "Saving..."
              : "Save Payment Deadline"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================
// Cancel Booking Modal
// ===========================================================
function CancelBookingModal({
  booking,
  onClose,
  onDone,
}) {
  const [reason, setReason] =
    useState("");

  const [loading, setLoading] =
    useState(false);

  const trimmedReason =
    reason.trim();

  const handleCancelBooking =
    async () => {
      // Mandatory cancellation reason
      if (!trimmedReason) {
        alert(
          "Cancellation reason is required."
        );

        return;
      }

      if (
        trimmedReason.length < 5
      ) {
        alert(
          "Please provide a clear cancellation reason."
        );

        return;
      }

      const confirmed =
        window.confirm(
          "Cancel this confirmed booking? The customer will be notified."
        );

      if (!confirmed) return;

      try {
        setLoading(true);

        await operatorService.cancelBooking(
          booking.id,
          {
            reason: trimmedReason,
          }
        );

        await onDone();

        onClose();
      } catch (err) {
        alert(
          err.response?.data?.message ||
            "Failed to cancel booking"
        );
      } finally {
        setLoading(false);
      }
    };

  return (
    <div className="operator-modal-backdrop">
      <div className="operator-modal">
        <div className="operator-card-head">
          <div>
            <h2>
              Cancel This Booking
            </h2>

            <p>
              This is the operator safety
              valve for withdrawing a
              confirmed booking. A reason
              is required and the customer
              will be notified.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <label className="operator-field">
          Cancellation Reason *

          <textarea
            placeholder="Explain why this booking must be cancelled..."
            value={reason}
            onChange={(e) =>
              setReason(
                e.target.value
              )
            }
            required
          />
        </label>

        {!trimmedReason && (
          <p className="operator-field-error">
            Cancellation reason is
            required.
          </p>
        )}

        <div className="operator-modal-actions">
          <button
            type="button"
            className="operator-secondary-btn"
            onClick={onClose}
            disabled={loading}
          >
            Keep Booking
          </button>

          <button
            type="button"
            className="operator-danger-btn"
            onClick={
              handleCancelBooking
            }
            disabled={
              loading ||
              !trimmedReason
            }
          >
            {loading
              ? "Cancelling..."
              : "Cancel This Booking"}
          </button>
        </div>
      </div>
    </div>
  );
}