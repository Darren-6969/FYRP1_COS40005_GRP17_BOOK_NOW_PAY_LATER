import { useEffect, useState } from "react";
import { ShieldCheck } from "lucide-react";

import {
  operatorService,
  formatOperatorDateTime,
} from "../../services/operator_service";
import { licenceIssuedInLabel } from "../booking/carBookingParts";
import { openPrivateDocument } from "../../utils/openPrivateDocument";

const PERMIT_STATUS_LABELS = {
  UNDER_REVIEW: "Under Review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  REUPLOAD_REQUIRED: "Re-upload Required",
};

const EDITABLE_STATUSES = [
  "PENDING",
  "ACCEPTED",
  "PENDING_PAYMENT",
  "CONFIRMED",
  "OVERDUE",
  "ALTERNATIVE_SUGGESTED",
  "PAID",
  "READY_FOR_PICKUP",
];

export default function OperatorPermitRequirement({
  booking,
  onUpdated,
}) {
  const details = booking.bookingDetails || {};

const savedRequired =
  typeof details.internationalPermitRequired === "boolean"
    ? details.internationalPermitRequired
    : null;

// What applies now: the operator's decision, else the backend's rule
// (a licence issued outside Malaysia needs an IDP).
const effectiveRequired =
  savedRequired !== null
    ? savedRequired
    : booking.internationalPermitRequired === true;

const licenceIssuedIn = details.driver?.licenceIssuedIn || null;
const permit = booking.permit || null;

const [required, setRequired] = useState(
  savedRequired
);

useEffect(() => {
  setRequired(savedRequired);
}, [savedRequired]);

  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const canEdit = EDITABLE_STATUSES.includes(
    booking.status
  );

  const changed =
  required !== null && required !== savedRequired;

  const save = async () => {
    if (!changed) return;

    if (!reason.trim()) {
      setError("Please enter the reason for this decision.");
      return;
    }

    if (
      !window.confirm(
        "Save this document requirement? This may change whether the booking is ready for handover."
      )
    ) {
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      await operatorService.updateBookingPermitRequirement(
        booking.id,
        required,
        reason.trim()
      );

      setMessage("Document requirement updated.");

      await onUpdated?.();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Unable to update document requirements."
      );
    } finally {
      setSaving(false);
    }
  };

  if (booking.serviceType !== "CAR_RENTAL") {
    return null;
  }

  return (
    <div className="booking-clean-section">
      <h3>
        <ShieldCheck
          size={19}
          style={{
            verticalAlign: "middle",
            marginRight: 8,
          }}
        />
        Document Requirements
      </h3>

      <div className="booking-clean-licence-details">
        <div>
          <strong>Driving Licence</strong>
          <p>Required for car rental bookings.</p>
        </div>

        <div>
          <strong>International Driving Permit</strong>
          <p>
            Current requirement:{" "}
            <strong>
              {effectiveRequired ? "Required" : "Not Required"}
            </strong>
            {savedRequired === null && (
              <>
                {" "}
                <small>
                  ({licenceIssuedIn
                    ? `licence issued in: ${licenceIssuedInLabel(licenceIssuedIn)}`
                    : "not assessed by you yet"})
                </small>
              </>
            )}
          </p>

          {(effectiveRequired || permit) && (
            <p>
              Uploaded permit:{" "}
              <strong>
                {permit
                  ? PERMIT_STATUS_LABELS[permit.status] || permit.status
                  : "Not uploaded yet"}
              </strong>
              {permit?.permitExpiryDate && (
                <>
                  {" "}· valid until{" "}
                  {String(permit.permitExpiryDate).slice(0, 10)}
                </>
              )}
              {permit?.submittedAt && (
                <>
                  {" "}· submitted{" "}
                  {formatOperatorDateTime(permit.submittedAt)}
                </>
              )}
            </p>
          )}

          {permit && (
            <button
              type="button"
              className="operator-secondary-btn"
              onClick={() =>
                openPrivateDocument(() =>
                  operatorService.downloadPermitDocument(permit.id)
                ).catch(() =>
                  alert("Failed to open the permit document.")
                )
              }
            >
              View permit document
            </button>
          )}
        </div>
      </div>

      <div
        style={{
          display: "grid",
          gap: 14,
          marginTop: 18,
          maxWidth: 580,
        }}
      >
        <label
          htmlFor="idp-requirement"
          style={{ fontWeight: 600 }}
        >
          International Permit Requirement
        </label>

        <select
          id="idp-requirement"
          className="form-input"
          value={
            required === null
                ? "not-assessed"
                : required
                ? "required"
                : "not-required"
            }
          disabled={!canEdit || saving}
          onChange={(event) =>
            setRequired(event.target.value === "required")
          }
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
          }}
        >
          <option value="not-assessed" disabled>
            Not Assessed — Select Requirement
          </option>
          <option value="not-required">
            IDP Not Required
          </option>
          <option value="required">
            IDP Required
          </option>
        </select>

        <label
          htmlFor="idp-reason"
          style={{ fontWeight: 600 }}
        >
          Reason for Decision
        </label>

        <textarea
          id="idp-reason"
          className="form-input"
          value={reason}
          disabled={!canEdit || saving}
          onChange={(event) =>
            setReason(event.target.value)
          }
          placeholder="Explain why this booking requires or does not require an IDP."
          maxLength={300}
          rows={3}
          style={{
            width: "100%",
            padding: 12,
            borderRadius: 10,
            resize: "vertical",
          }}
        />

        {error && (
          <div className="operator-alert danger" role="alert">
            {error}
          </div>
        )}

        {message && (
          <div className="operator-alert">
            {message}
          </div>
        )}

        {!canEdit && (
          <p className="operator-muted">
            Document requirements can no longer be
            changed for this booking.
          </p>
        )}

        <button
          type="button"
          className="operator-primary-btn"
          onClick={save}
          disabled={!canEdit || !changed || saving}
        >
          {saving
            ? "Saving..."
            : "Save Document Requirements"}
        </button>
      </div>
    </div>
  );
}
