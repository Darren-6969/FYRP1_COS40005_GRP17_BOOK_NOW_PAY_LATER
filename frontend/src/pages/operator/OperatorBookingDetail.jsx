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

  const [showAlternative, setShowAlternative] =
  useState(false);

  const [showReject, setShowReject] =
  useState(false);

  const [showPaymentDeadline, setShowPaymentDeadline] =
    useState(false);

  const [showCancel, setShowCancel] =
    useState(false);

  const [showRefund, setShowRefund] =
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

  const handleBookingDecision = async (action) => {
  try {
    if (
      action === "reject" &&
      !window.confirm(
        "Are you sure you want to reject this booking?"
      )
    ) {
      return;
    }

    setActionLoading(action);

    if (action === "accept") {
      await operatorService.acceptBooking(id);
    }

    if (action === "reject") {
      await operatorService.rejectBooking(id);
    }

    await loadBooking();
  } catch (err) {
    alert(
      err.response?.data?.message ||
        "Booking action failed"
    );
  } finally {
    setActionLoading("");
  }
};

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

  const canAcceptReject =
  bookingStatus === "PENDING";

  const bookingDetails =
    booking.bookingDetails || {};

  const chauffeur =
    bookingDetails.chauffeur || {};

  const chauffeurRequested =
    chauffeur.requested === true;

  const chauffeurNote =
    chauffeur.note || "";

    const selectedAddons =
      Array.isArray(
        booking.addons
      )
        ? booking.addons
        : [];

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

  const canSuggestAlternative =
  bookingStatus === "PENDING" &&
  !booking.alternativeUsed;

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
  const hasAnyPayment =
  paymentStatus === "PAID" ||
  paymentStatus === "PARTIALLY_PAID" ||
  booking.payment?.downPaymentStatus === "PAID" ||
  booking.payment?.finalPaymentStatus === "PAID";

  const canCancel =
    [
      "ACCEPTED",
      "PENDING_PAYMENT",
    ].includes(bookingStatus) &&
    !hasAnyPayment &&
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

  const paidToDate =
  (
    booking.payment
      ?.downPaymentStatus === "PAID"
      ? Number(
          booking.payment
            ?.downPaymentAmount || 0
        )
      : 0
  ) +
  (
    booking.payment
      ?.finalPaymentStatus === "PAID"
      ? Number(
          booking.payment
            ?.finalPaymentAmount || 0
        )
      : 0
  );

  const refunds =
    Array.isArray(booking.refunds)
      ? booking.refunds
      : [];

  const latestRefund =
    refunds.length > 0
      ? refunds[0]
      : null;

  const activeRefund =
    refunds.find((refund) =>
      [
        "PENDING",
        "PROCESSING",
        "REFUNDED",
      ].includes(
        String(
          refund.status || ""
        ).toUpperCase()
      )
    );

  const downPaymentPaid =
    booking.payment?.downPaymentStatus ===
    "PAID";

  const finalPaymentPaid =
    booking.payment?.finalPaymentStatus ===
    "PAID";

  const downPaymentAmount =
    Number(
      booking.payment?.downPaymentAmount ||
        0
    );

  const refundableBookingStatus = [
    "PENDING_PAYMENT",
    "CANCELLED",
    "OVERDUE",
    "NO_SHOW_UNPAID",
  ].includes(bookingStatus);

  const canCreateRefund =
    refundableBookingStatus &&
    downPaymentPaid &&
    !finalPaymentPaid &&
    downPaymentAmount > 0 &&
    !activeRefund;  

  const hasAnyAction =
    canAcceptReject ||
    canSuggestAlternative ||
    canHandover ||
    canReturn ||
    canEditDeadline ||
    canCancel ||
    canCreateRefund ||
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

      {/* =====================================================
    Compact Booking Header
====================================================== */}
<section className="booking-clean-header">
  <div>
    <div className="booking-clean-title-row">
      <div>
        <h1>
          {booking.bookingCode ||
            `BNPL-${String(
              booking.id
            ).padStart(4, "0")}`}
        </h1>

        <p className="booking-clean-vehicle">
          {booking.serviceName || "-"}
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

    <div className="booking-clean-meta">
      <span>
        {booking.customer?.name || "-"}
      </span>

      <span>•</span>

      <span>
        {formatOperatorDateTime(
          booking.pickupDate
        )}
      </span>

      <span>→</span>

      <span>
        {formatOperatorDateTime(
          booking.returnDate
        )}
      </span>

      {booking.location && (
        <>
          <span>•</span>
          <span>
            {booking.location}
          </span>
        </>
      )}
    </div>

    <p className="booking-clean-created">
      Created{" "}
      {formatOperatorDateTime(
        booking.createdAt
      )}
    </p>
  </div>
</section>


{/* =====================================================
    Main Layout
====================================================== */}
<div className="booking-clean-layout">

  {/* ===================================================
      LEFT - ONE MAIN CARD
  ==================================================== */}
  <main className="booking-clean-main">

    <section className="operator-card booking-clean-details">

      <div className="booking-clean-card-title">
        <div>
          <span>Booking</span>
          <h2>Booking Details</h2>
        </div>
      </div>


      {/* =========================
          Trip
      ========================== */}
      <div className="booking-clean-section">
        <h3>Trip</h3>

        <div className="booking-clean-trip-grid">

        <div>
          <span>
            Pickup / Check-in
          </span>

          <strong>
            {formatOperatorDateTime(
              booking.pickupDate
            )}
          </strong>
        </div>

        <div>
          <span>
            Return / Check-out
          </span>

          <strong>
            {formatOperatorDateTime(
              booking.returnDate
            )}
          </strong>
        </div>

        <div>
          <span>
            Pickup Point
          </span>

          <strong>
            {booking.pickupPoint?.label ||
              booking.requestedLocation ||
              "-"}
          </strong>

          {booking.pickupPoint?.address && (
            <small className="booking-clean-location-note">
              {booking.pickupPoint.address}
            </small>
          )}
        </div>

        <div>
          <span>
            Drop-off Point
          </span>

          <strong>
            {booking.dropoffPoint?.label ||
              booking.requestedLocation ||
              "-"}
          </strong>

          {booking.dropoffPoint?.address && (
            <small className="booking-clean-location-note">
              {booking.dropoffPoint.address}
            </small>
          )}
        </div>

        <div>
          <span>
            Branch / Area
          </span>

          <strong>
            {booking.location || "-"}
          </strong>
        </div>

        <div>
          <span>
            Payment Deadline
          </span>

          <strong>
            {formatOperatorDateTime(
              booking.paymentDeadline
            )}
          </strong>
        </div>

      </div>
      </div>


      {/* =========================
          Customer
      ========================== */}
      <div className="booking-clean-section">
        <h3>Customer</h3>

        <div className="booking-clean-customer">
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

        <div className="booking-clean-status-row">
          <div>
            <span>
              Driving Licence
            </span>

            <strong>
              {getLicenceStatusLabel(
                licenceStatus
              )}
            </strong>
          </div>

          <span
            className={`operator-status ${getLicenceStatusClass(
              licenceStatus
            )}`}
          >
            {getLicenceStatusLabel(
              licenceStatus
            )}
          </span>
        </div>

        {(licenceNumber !== "-" ||
          licenceExpiry ||
          licenceVerifiedAt) && (
          <div className="booking-clean-licence-details">

            {licenceNumber !== "-" && (
              <InfoRow
                label="Licence Number"
                value={licenceNumber}
              />
            )}

            {licenceExpiry && (
              <InfoRow
                label="Expiry Date"
                value={formatOperatorDateTime(
                  licenceExpiry
                )}
              />
            )}

            {licenceVerifiedAt && (
              <InfoRow
                label="Verified At"
                value={formatOperatorDateTime(
                  licenceVerifiedAt
                )}
              />
            )}

          </div>
        )}
      </div>


      {/* =========================
          Add-ons
      ========================== */}
      <div className="booking-clean-section">
        <h3>
          Add-ons & Requests
        </h3>

        <div className="booking-clean-addon-list">

          {!selectedAddons.length && (
            <div className="booking-clean-simple-row">
              <span>
                Paid Add-ons
              </span>

              <strong>
                None selected
              </strong>
            </div>
          )}

          {selectedAddons.map(
            (addon) => (
              <div
                key={addon.id}
                className="booking-clean-addon-row"
              >
                <div>
                  <strong>
                    {addon.name}
                  </strong>

                  <span>
                    {formatOperatorMoney(
                      addon.unitPrice
                    )}

                    {addon.unit ===
                    "PER_DAY"
                      ? " / day"
                      : " / booking"}

                    {addon.quantity > 1
                      ? ` × ${addon.quantity}`
                      : ""}
                  </span>
                </div>

                <strong className="booking-clean-addon-price">
                  {formatOperatorMoney(
                    addon.totalPrice
                  )}
                </strong>
              </div>
            )
          )}

          <div className="booking-clean-simple-row">
            <span>
              Chauffeur
            </span>

            <strong>
              {chauffeurRequested
                ? "Requested"
                : "Not requested"}
            </strong>
          </div>

          {chauffeurRequested && (
            <div className="booking-clean-note">
              <span>
                Customer note
              </span>

              <p>
                {chauffeurNote ||
                  "No note provided."}
              </p>

              <small>
                Chauffeur pricing is
                arranged separately and
                is not included in the
                booking total.
              </small>
            </div>
          )}

        </div>
      </div>


      {/* =========================
          Timeline
      ========================== */}
      <div className="booking-clean-section booking-clean-section-last">
        <h3>
          Activity
        </h3>

        <div className="booking-clean-activity">

          {timeline.map(
            (item) => (
              <div
                key={item.id}
                className="booking-clean-activity-row"
              >
                <span className="booking-clean-dot" />

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
            )
          )}

          {!timeline.length && (
            <p className="booking-clean-muted">
              No activity recorded yet.
            </p>
          )}

        </div>
      </div>

    </section>
  </main>


  {/* ===================================================
      RIGHT SIDEBAR
  ==================================================== */}
  <aside className="booking-clean-sidebar">

    {/* Payment */}
    <section className="operator-card booking-clean-side-card">

      <div className="booking-clean-side-head">
        <div>
          <span>Payment</span>
          <h2>
            Payment Summary
          </h2>
        </div>

        <span
          className={`operator-status ${operatorStatusClass(
            booking.payment?.status ||
              "UNPAID"
          )}`}
        >
          {operatorStatusLabel(
            booking.payment?.status ||
              "UNPAID"
          )}
        </span>
      </div>

      <div className="booking-clean-total">
        <span>
          Total Booking Amount
        </span>

        <strong>
          {formatOperatorMoney(
            booking.payment?.amount ||
              booking.totalAmount
          )}
        </strong>

        <small>
          {formatOperatorMoney(
            paidToDate
          )}{" "}
          paid to date
        </small>
      </div>

      <div className="booking-clean-payment-lines">

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

        {booking.payment?.method && (
          <InfoRow
            label="Payment Method"
            value={
              booking.payment.method
            }
          />
        )}

        {booking.payment
          ?.transactionId && (
          <InfoRow
            label="Transaction ID"
            value={
              booking.payment
                .transactionId
            }
          />
        )}

      </div>

    </section>

    {/* Refund */}
    <section className="operator-card booking-clean-side-card">

      <div className="booking-clean-side-head">
        <div>
          <span>Payment</span>
          <h2>Refund</h2>
        </div>

        {latestRefund && (
          <span
            className={`operator-status ${operatorStatusClass(
              latestRefund.status
            )}`}
          >
            {operatorStatusLabel(
              latestRefund.status
            )}
          </span>
        )}
      </div>

      {latestRefund ? (
        <div className="booking-clean-payment-lines">

          <InfoRow
            label="Paid Deposit"
            value={formatOperatorMoney(
              latestRefund.paidAmount
            )}
          />

          <InfoRow
            label="Refund Percentage"
            value={
              latestRefund.refundPercent != null
                ? `${latestRefund.refundPercent}%`
                : "-"
            }
          />

          <InfoRow
            label="Refund Amount"
            value={formatOperatorMoney(
              latestRefund.amount
            )}
            strong
          />

          <InfoRow
            label="Method"
            value={
              latestRefund.method || "-"
            }
          />

          <InfoRow
            label="Reason"
            value={
              latestRefund.reason || "-"
            }
          />

          {latestRefund.processedAt && (
            <InfoRow
              label="Processed"
              value={formatOperatorDateTime(
                latestRefund.processedAt
              )}
            />
          )}

          {latestRefund.providerRefundId && (
            <InfoRow
              label="Refund Reference"
              value={
                latestRefund.providerRefundId
              }
            />
          )}

          {latestRefund.lastError && (
            <div className="operator-alert danger">
              {latestRefund.lastError}
            </div>
          )}

          {["PENDING", "PROCESSING"].includes(
            String(
              latestRefund.status || ""
            ).toUpperCase()
          ) &&
            latestRefund.method !== "STRIPE" && (
              <button
                type="button"
                className="operator-primary-btn"
                disabled={!!actionLoading}
                onClick={async () => {
                  const confirmed =
                    window.confirm(
                      `Confirm that ${formatOperatorMoney(
                        latestRefund.amount
                      )} has already been refunded to the customer?`
                    );

                  if (!confirmed) {
                    return;
                  }

                  try {
                    setActionLoading(
                      "complete-refund"
                    );

                    await operatorService.completeBookingRefund(
                      booking.id,
                      latestRefund.id
                    );

                    await loadBooking();
                  } catch (err) {
                    alert(
                      err.response?.data?.message ||
                        "Failed to complete refund"
                    );
                  } finally {
                    setActionLoading("");
                  }
                }}
              >
                {actionLoading ===
                "complete-refund"
                  ? "Completing Refund..."
                  : "Mark as Refunded"}
              </button>
            )}

        </div>
      ) : (
        <>
          <div className="booking-clean-payment-lines">

            <InfoRow
              label="Down-payment"
              value={`${operatorStatusLabel(
                booking.payment
                  ?.downPaymentStatus ||
                  "UNPAID"
              )} · ${formatOperatorMoney(
                downPaymentAmount
              )}`}
            />

            <InfoRow
              label="Final Payment"
              value={operatorStatusLabel(
                booking.payment
                  ?.finalPaymentStatus ||
                  "UNPAID"
              )}
            />

          </div>

          {canCreateRefund ? (
            <button
              type="button"
              className="operator-danger-btn"
              disabled={!!actionLoading}
              onClick={() =>
                setShowRefund(true)
              }
            >
              Process Partial Refund
            </button>
          ) : (
            <div className="operator-empty-state compact">
              This booking is not currently
              eligible for a partial refund.
            </div>
          )}
        </>
      )}

    </section>

    {/* Actions */}
    <section className="operator-card booking-clean-side-card">

      <div className="booking-clean-side-head">
        <div>
          <span>Workflow</span>
          <h2>
            Booking Actions
          </h2>
        </div>
      </div>

      <div className="operator-action-stack">

        {canAcceptReject && (
          <>
            <button
              type="button"
              className="operator-primary-btn"
              disabled={
                !!actionLoading
              }
              onClick={() =>
                handleBookingDecision(
                  "accept"
                )
              }
            >
              {actionLoading ===
              "accept"
                ? "Accepting..."
                : "Accept Booking"}
            </button>

            <button
              type="button"
              className="operator-danger-btn"
              disabled={
                !!actionLoading
              }
              onClick={() =>
                setShowReject(true)
              }
            >
              Reject Booking
            </button>
          </>
        )}

        {canSuggestAlternative && (
          <button
            type="button"
            className="operator-secondary-btn"
            disabled={
              !!actionLoading
            }
            onClick={() =>
              setShowAlternative(
                true
              )
            }
          >
            Suggest Alternative
          </button>
        )}

        {canHandover && (
          <button
            type="button"
            className="operator-primary-btn"
            disabled={
              !!actionLoading
            }
            onClick={
              handleHandover
            }
          >
            {actionLoading ===
            "handover"
              ? "Processing Handover..."
              : "Handover Booking"}
          </button>
        )}

        {canReturn && (
          <button
            type="button"
            className="operator-primary-btn"
            disabled={
              !!actionLoading
            }
            onClick={
              handleReturn
            }
          >
            {actionLoading ===
            "return"
              ? "Processing Return..."
              : "Complete Return"}
          </button>
        )}

        {shouldShowPaymentVerificationLink && (
          <Link
            className="operator-primary-btn"
            to={`/operator/payments?bookingId=${booking.id}`}
          >
            View Payment Verification
          </Link>
        )}

        {canEditDeadline && (
          <button
            type="button"
            className="operator-secondary-btn"
            disabled={
              !!actionLoading
            }
            onClick={() =>
              setShowPaymentDeadline(
                true
              )
            }
          >
            Edit Payment Deadline
          </button>
        )}

        {canCancel && (
          <button
            type="button"
            className="operator-danger-btn"
            disabled={
              !!actionLoading
            }
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

    </section>

  </aside>
</div>

      {showAlternative && (
        <AlternativeModal
          booking={booking}
          onClose={() =>
            setShowAlternative(false)
          }
          onDone={loadBooking}
        />
      )}

      {showReject && (
        <RejectBookingModal
          booking={booking}
          onClose={() =>
            setShowReject(false)
          }
          onDone={loadBooking}
        />
      )}

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

      {showRefund && (
        <RefundModal
          booking={booking}
          onClose={() =>
            setShowRefund(false)
          }
          onDone={loadBooking}
        />
      )}
    </div>
  );
}

function RefundModal({
  booking,
  onClose,
  onDone,
}) {
  const [reason, setReason] =
    useState(
      "Customer cancellation"
    );

  const [loading, setLoading] =
    useState(false);

  const handleRefund = async () => {
    const cleanReason =
      reason.trim();

    if (cleanReason.length < 5) {
      alert(
        "Please provide a refund reason of at least 5 characters."
      );
      return;
    }

    const confirmed =
      window.confirm(
        "Create this partial refund request? This action will cancel the booking if it is still awaiting final payment."
      );

    if (!confirmed) {
      return;
    }

    try {
      setLoading(true);

      await operatorService.createBookingRefund(
        booking.id,
        {
          reason: cleanReason,
        }
      );

      await onDone();

      onClose();
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to create refund"
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
              Process Partial Refund
            </h2>

            <p>
              Create a partial refund for{" "}
              {booking.bookingCode}.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
            disabled={loading}
          >
            ×
          </button>
        </div>

        <div className="booking-clean-payment-lines">

          <InfoRow
            label="Paid Deposit"
            value={formatOperatorMoney(
              booking.payment
                ?.downPaymentAmount
            )}
          />

          <InfoRow
            label="Payment Method"
            value={
              booking.payment?.method ||
              "-"
            }
          />

        </div>

        <label className="operator-field">
          Refund Reason *

          <textarea
            value={reason}
            placeholder="Example: Customer cancelled before final payment."
            onChange={(e) =>
              setReason(
                e.target.value
              )
            }
          />
        </label>

        <p className="booking-clean-muted">
          The refund amount will be
          calculated automatically using
          the operator's Partial Refund
          setting.
        </p>

        <div className="operator-modal-actions">

          <button
            type="button"
            className="operator-secondary-btn"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="button"
            className="operator-danger-btn"
            onClick={handleRefund}
            disabled={loading}
          >
            {loading
              ? "Creating Refund..."
              : "Process Partial Refund"}
          </button>

        </div>
      </div>
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

function RejectBookingModal({
    booking,
    onClose,
    onDone,
  }) {
    const [reason, setReason] =
      useState("");

    const [loading, setLoading] =
      useState(false);

    const handleReject = async () => {
      const cleanReason =
        reason.trim();

      if (cleanReason.length < 5) {
        alert(
          "Please provide a rejection reason of at least 5 characters."
        );
        return;
      }

      try {
        setLoading(true);

        await operatorService.rejectBooking(
          booking.id,
          cleanReason
        );

        await onDone();
        onClose();
      } catch (err) {
        alert(
          err.response?.data?.message ||
            "Failed to reject booking"
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
              <h2>Reject Booking</h2>

              <p>
                Please provide a reason for
                rejecting{" "}
                {booking.bookingCode}.
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
            Rejection Reason *

            <textarea
              placeholder="Example: The selected vehicle is unavailable."
              value={reason}
              onChange={(e) =>
                setReason(e.target.value)
              }
            />
          </label>

          <div className="operator-modal-actions">
            <button
              type="button"
              className="operator-secondary-btn"
              onClick={onClose}
              disabled={loading}
            >
              Cancel
            </button>

            <button
              type="button"
              className="operator-danger-btn"
              onClick={handleReject}
              disabled={loading}
            >
              {loading
                ? "Rejecting..."
                : "Reject Booking"}
            </button>
          </div>
        </div>
      </div>
    );
  }

function AlternativeModal({
  booking,
  onClose,
  onDone,
}) {
  const [form, setForm] = useState({
    alternativeServiceName: "",
    alternativePrice:
      booking.totalAmount || "",
    alternativePickupDate:
      toDatetimeLocalValue(
        booking.pickupDate
      ),
    alternativeReturnDate:
      toDatetimeLocalValue(
        booking.returnDate
      ),
    reason: "",
  });

  const [loading, setLoading] =
    useState(false);

  const handleSubmit = async () => {
    if (
      !form.alternativeServiceName.trim() ||
      !form.reason.trim()
    ) {
      alert(
        "Alternative service name and reason are required."
      );
      return;
    }

    try {
      setLoading(true);

      await operatorService.suggestAlternative(
        booking.id,
        {
          alternativeServiceName:
            form.alternativeServiceName.trim(),

          alternativePrice:
            form.alternativePrice
              ? Number(
                  form.alternativePrice
                )
              : null,

          alternativePickupDate:
            form.alternativePickupDate ||
            null,

          alternativeReturnDate:
            form.alternativeReturnDate ||
            null,

          reason: form.reason.trim(),
        }
      );

      await onDone();
      onClose();
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to suggest alternative"
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
              Suggest an Alternative
            </h2>

            <p>
              Suggest another vehicle or
              booking option to the customer.
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <div className="operator-alternative-grid">

          <div className="operator-alt-card">
            <p>Original Booking</p>

            <strong>
              {booking.serviceName}
            </strong>

            <span>
              Pickup:{" "}
              {formatOperatorDateTime(
                booking.pickupDate
              )}
            </span>

            <span>
              Return:{" "}
              {formatOperatorDateTime(
                booking.returnDate
              )}
            </span>

            <strong>
              {formatOperatorMoney(
                booking.totalAmount
              )}
            </strong>
          </div>

          <div className="operator-alt-arrow">
            →
          </div>

          <div className="operator-alt-card">
            <p>Suggested Alternative</p>

            <input
              placeholder="Alternative vehicle / service"
              value={
                form.alternativeServiceName
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  alternativeServiceName:
                    e.target.value,
                })
              }
            />

            <input
              type="number"
              min="0"
              step="0.01"
              placeholder="Alternative price"
              value={
                form.alternativePrice
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  alternativePrice:
                    e.target.value,
                })
              }
            />

            <input
              type="datetime-local"
              value={
                form.alternativePickupDate
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  alternativePickupDate:
                    e.target.value,
                })
              }
            />

            <input
              type="datetime-local"
              value={
                form.alternativeReturnDate
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  alternativeReturnDate:
                    e.target.value,
                })
              }
            />
          </div>
        </div>

        <label className="operator-field">
          Reason for Suggestion *

          <textarea
            placeholder="Example: The selected vehicle is unavailable."
            value={form.reason}
            onChange={(e) =>
              setForm({
                ...form,
                reason: e.target.value,
              })
            }
          />
        </label>

        <div className="operator-modal-actions">
          <button
            type="button"
            className="operator-secondary-btn"
            onClick={onClose}
            disabled={loading}
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
              ? "Sending..."
              : "Send Suggestion"}
          </button>
        </div>
      </div>
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