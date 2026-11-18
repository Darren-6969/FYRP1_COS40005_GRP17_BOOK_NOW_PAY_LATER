
import { useEffect, useState } from "react";
import { ClipboardCheck } from "lucide-react";

import {
  operatorService,
} from "../../services/operator_service";

export default function OperatorCounterVerification({
  booking,
  onUpdated,
}) {
  const [identityMatched, setIdentityMatched] =
    useState(false);
  const [licenceSighted, setLicenceSighted] =
    useState(false);
  const [permitSighted, setPermitSighted] =
    useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const details = booking.bookingDetails || {};
  const verification = details.counterVerification;

  const permitRequired =
    details.internationalPermitRequired === true ||
    (
      details.internationalPermitRequired == null &&
      details.driver?.internationalPermitRequired === true
    );

  const eligible =
    booking.status === "READY_FOR_PICKUP" &&
    booking.serviceType === "CAR_RENTAL";

  const completed =
    verification?.identityMatched === true &&
    verification?.licenceSighted === true &&
    verification?.permitRequired === permitRequired &&
    (!permitRequired || verification?.permitSighted === true);

  useEffect(() => {
    setIdentityMatched(false);
    setLicenceSighted(false);
    setPermitSighted(false);
    setError("");
  }, [booking.id, verification?.verifiedAt]);

  if (!eligible && !verification) return null;

  const save = async () => {
    if (
      !identityMatched ||
      !licenceSighted ||
      (permitRequired && !permitSighted)
    ) {
      setError(
        "Complete all required counter checks."
      );
      return;
    }

    if (
      !window.confirm(
        "Confirm you physically inspected the driver's documents at the counter?"
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");

      await operatorService.verifyBookingAtCounter(
        booking.id,
        {
          identityMatched,
          licenceSighted,
          permitSighted: permitRequired
            ? permitSighted
            : false,
        }
      );

      await onUpdated?.();
    } catch (err) {
      setError(
        err.response?.data?.message ||
        "Failed to complete counter verification."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <section className="booking-clean-section">
      <h3>
        <ClipboardCheck
          size={20}
          style={{ verticalAlign: "middle", marginRight: 8 }}
        />
        Counter Verification
      </h3>

      {completed ? (
        <div className="operator-alert">
          <strong>Counter verification completed</strong>
          <p>
            Verified at:{" "}
            {new Date(
              verification.verifiedAt
            ).toLocaleString("en-MY")}
          </p>
          <p>
            Verified by Staff ID:{" "}
            {verification.verifiedById}
          </p>
        </div>
      ) : eligible ? (
        <div style={{ display: "grid", gap: 14 }}>
          <p>
            Inspect the original documents presented
            by the driver at vehicle collection.
          </p>

          <label>
            <input
              type="checkbox"
              checked={identityMatched}
              onChange={(e) =>
                setIdentityMatched(e.target.checked)
              }
            />{" "}
            Driver identity matches the booking details.
          </label>

          <label>
            <input
              type="checkbox"
              checked={licenceSighted}
              onChange={(e) =>
                setLicenceSighted(e.target.checked)
              }
            />{" "}
            Physical driving licence inspected and valid.
          </label>

          {permitRequired && (
            <label>
              <input
                type="checkbox"
                checked={permitSighted}
                onChange={(e) =>
                  setPermitSighted(e.target.checked)
                }
              />{" "}
              Physical International Driving Permit
              inspected and valid.
            </label>
          )}

          {error && (
            <div className="operator-alert danger">
              {error}
            </div>
          )}

          <button
            type="button"
            className="operator-primary-btn"
            onClick={save}
            disabled={
              saving ||
              !identityMatched ||
              !licenceSighted ||
              (permitRequired && !permitSighted)
            }
          >
            {saving
              ? "Saving Verification..."
              : "Confirm Counter Verification"}
          </button>
        </div>
      ) : (
        <p className="operator-muted">
          Counter verification is available when the
          booking is ready for pickup.
        </p>
      )}
    </section>
  );
}
