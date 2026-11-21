import { useState } from "react";

import { operatorService } from "../../services/operator_service";

// Reject a pending booking request with a reason the customer sees.
// Used by the booking detail page and the quick action on the Bookings list,
// so both ask for the same confirmation and reason.
export default function RejectBookingModal({
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
