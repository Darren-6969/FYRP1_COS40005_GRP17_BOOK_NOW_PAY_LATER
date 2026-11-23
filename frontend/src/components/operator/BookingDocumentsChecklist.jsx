import { useState } from "react";
import { hasAcceptedDriver } from "../booking/DriverPanels";
import {
  ChevronDown,
  ChevronUp,
  FileCheck2,
  Globe2,
  IdCard,
} from "lucide-react";

import {
  operatorService,
  formatOperatorDateTime,
} from "../../services/operator_service";
import { licenceIssuedInLabel } from "../booking/carBookingParts";
import { openPrivateDocument } from "../../utils/openPrivateDocument";

import "../../assets/styles/operator-booking-attention.css";

// Documents the customer must have checked before handover: the driving
// licence and, when needed, the International Driving Permit (IDP). Each row
// shows its state and lets the operator open, approve or reject the upload
// here, without going to the Licence Checks page.

const LICENCE_REJECT_REASONS = [
  ["EXPIRED", "Expired"],
  ["UNREADABLE", "Unreadable"],
  ["NOT_A_LICENCE", "Not a driving licence"],
];

const PERMIT_REJECT_REASONS = [
  ["EXPIRED", "Expired"],
  ["UNREADABLE", "Unreadable"],
  ["NOT_A_PERMIT", "Not a driving permit"],
  ["DETAILS_MISMATCH", "Details don't match the licence"],
];

// Booking statuses where the IDP requirement can still be changed
// (same list the backend accepts).
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

// Status of an upload -> badge text and colour.
function documentBadge(status) {
  switch (String(status || "").toUpperCase()) {
    case "APPROVED":
      return { label: "Approved", tone: "success" };
    case "UNDER_REVIEW":
      return { label: "Needs your review", tone: "warning" };
    case "REJECTED":
    case "REUPLOAD_REQUIRED":
      return { label: "Re-upload requested", tone: "neutral" };
    default:
      return { label: "Not uploaded yet", tone: "neutral" };
  }
}

function documentNote(status, kind) {
  switch (String(status || "").toUpperCase()) {
    case "UNDER_REVIEW":
      return `Open the ${kind}, check it, then approve or reject it.`;
    case "REJECTED":
    case "REUPLOAD_REQUIRED":
      return "Waiting for the customer to upload a new one.";
    case "APPROVED":
      return null;
    default:
      return "Waiting for the customer to upload it.";
  }
}

export default function BookingDocumentsChecklist({ booking, onUpdated }) {
  if (booking.serviceType !== "CAR_RENTAL") return null;
  // An accepted independent driver's licence is checked in their own section.
  if (hasAcceptedDriver(booking)) return null;

  return <Checklist booking={booking} onUpdated={onUpdated} />;
}

function Checklist({ booking, onUpdated }) {
  const details = booking.bookingDetails || {};
  const driver = booking.car?.driver || details.driver || null;

  const licenceStatus = booking.customer?.licenceStatus || "NOT_SUBMITTED";
  const licenceDocumentId = booking.customer?.licenceDocumentId || null;

  const permitRequired = booking.internationalPermitRequired === true;
  const permit = booking.permit || null;
  const showPermit = permitRequired || Boolean(permit);

  const savedOverride =
    typeof details.internationalPermitRequired === "boolean"
      ? details.internationalPermitRequired
      : null;

  const requiredRows = 1 + (permitRequired ? 1 : 0);
  const approvedRows =
    (licenceStatus === "APPROVED" ? 1 : 0) +
    (permitRequired && permit?.status === "APPROVED" ? 1 : 0);

  // Short reason shown under the permit row.
  const permitReason =
    savedOverride !== null
      ? "Set by your team"
      : driver?.licenceIssuedIn && driver.licenceIssuedIn !== "MY"
        ? driver.licenceIssuedIn === "OTHER"
          ? "Licence from another country"
          : `Licence from ${licenceIssuedInLabel(driver.licenceIssuedIn)}`
        : null;

  return (
    <div
      className="booking-clean-section booking-docs"
      id="booking-documents"
    >
      <div className="booking-docs-head">
        <h3>
          <FileCheck2 size={17} aria-hidden="true" />
          Documents before handover
        </h3>
        <span
          className={`operator-status ${
            approvedRows === requiredRows ? "success" : "neutral"
          }`}
        >
          {approvedRows} of {requiredRows} approved
        </span>
      </div>

      <DocumentRow
        icon={<IdCard size={20} aria-hidden="true" />}
        title="Driving licence"
        status={licenceStatus}
        meta={
          licenceStatus === "APPROVED" && booking.customer?.licenceVerifiedAt
            ? `Approved ${formatOperatorDateTime(booking.customer.licenceVerifiedAt)}`
            : booking.customer?.licenceSubmittedAt
              ? `Uploaded ${formatOperatorDateTime(booking.customer.licenceSubmittedAt)}`
              : null
        }
        kind="licence"
        reasons={LICENCE_REJECT_REASONS}
        onView={
          licenceDocumentId
            ? () => operatorService.downloadLicenceDocument(licenceDocumentId)
            : null
        }
        onReview={
          licenceDocumentId
            ? (decision, reason) =>
                operatorService.reviewLicenceDocument(
                  licenceDocumentId,
                  decision,
                  reason
                )
            : null
        }
        onUpdated={onUpdated}
      />

      {showPermit && (
        <DocumentRow
          icon={<Globe2 size={20} aria-hidden="true" />}
          title="International driving permit"
          status={permit?.status || "NOT_SUBMITTED"}
          notRequired={!permitRequired}
          meta={[
            permitRequired
              ? permitReason
                ? `Required: ${permitReason.toLowerCase()}`
                : "Required"
              : "Not required for this booking",
            permit?.permitExpiryDate
              ? `Valid until ${String(permit.permitExpiryDate).slice(0, 10)}`
              : null,
            permit?.submittedAt
              ? `Uploaded ${formatOperatorDateTime(permit.submittedAt)}`
              : null,
          ]
            .filter(Boolean)
            .join(" · ")}
          kind="permit"
          reasons={PERMIT_REJECT_REASONS}
          onView={
            permit
              ? () => operatorService.downloadPermitDocument(permit.id)
              : null
          }
          onReview={
            permit
              ? (decision, reason) =>
                  operatorService.reviewPermitDocument(permit.id, decision, reason)
              : null
          }
          onUpdated={onUpdated}
        />
      )}

      <PermitOverride
        booking={booking}
        savedOverride={savedOverride}
        permitRequired={permitRequired}
        onUpdated={onUpdated}
      />
    </div>
  );
}

function DocumentRow({
  icon,
  title,
  status,
  meta,
  kind,
  reasons,
  notRequired = false,
  onView,
  onReview,
  onUpdated,
}) {
  const [rejecting, setRejecting] = useState(false);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const normalized = String(status || "").toUpperCase();
  const badge = notRequired && normalized !== "APPROVED"
    ? { label: "Not required", tone: "neutral" }
    : documentBadge(normalized);
  const note = notRequired ? null : documentNote(normalized, kind);
  const canReview = normalized === "UNDER_REVIEW" && Boolean(onReview);

  const view = () =>
    openPrivateDocument(onView).catch((err) =>
      setError(
        err.response?.status === 404
          ? `This ${kind} can no longer be opened for this booking.`
          : `Couldn't open the ${kind}. Try again.`
      )
    );

  const review = async (decision) => {
    if (decision === "REJECTED" && !reason) {
      setError("Choose a reason first.");
      return;
    }

    if (
      decision === "APPROVED" &&
      !window.confirm(`Approve this ${kind}? Make sure you have opened and checked it.`)
    ) {
      return;
    }

    try {
      setBusy(decision);
      setError("");
      await onReview(decision, decision === "REJECTED" ? reason : "");
      setRejecting(false);
      setReason("");
      await onUpdated?.();
    } catch (err) {
      setError(err.response?.data?.message || `Couldn't save the review. Try again.`);
    } finally {
      setBusy("");
    }
  };

  return (
    <div className="booking-docs-row">
      <div className="booking-docs-icon">{icon}</div>

      <div className="booking-docs-body">
        <div className="booking-docs-title-row">
          <strong>{title}</strong>
          <span className={`operator-status ${badge.tone}`}>{badge.label}</span>
        </div>

        {meta && <p className="booking-docs-meta">{meta}</p>}
        {note && <p className="booking-docs-meta">{note}</p>}

        {rejecting && (
          <div className="booking-docs-reject">
            <label htmlFor={`reject-${kind}`}>Reason for rejecting</label>
            <select
              id={`reject-${kind}`}
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                setError("");
              }}
            >
              <option value="">Choose a reason</option>
              {reasons.map(([value, label]) => (
                <option key={value} value={value}>
                  {label}
                </option>
              ))}
            </select>
            <p className="booking-docs-meta">
              The customer is told the reason and asked to upload again.
            </p>
          </div>
        )}

        {error && (
          <p className="booking-docs-error" role="alert">
            {error}
          </p>
        )}
      </div>

      <div className="booking-docs-actions">
        {onView && (
          <button type="button" className="booking-docs-btn" onClick={view}>
            View
          </button>
        )}

        {canReview && !rejecting && (
          <>
            <button
              type="button"
              className="booking-docs-btn approve"
              disabled={!!busy}
              onClick={() => review("APPROVED")}
            >
              {busy === "APPROVED" ? "Approving..." : "Approve"}
            </button>
            <button
              type="button"
              className="booking-docs-btn reject"
              disabled={!!busy}
              onClick={() => setRejecting(true)}
            >
              Reject
            </button>
          </>
        )}

        {canReview && rejecting && (
          <>
            <button
              type="button"
              className="booking-docs-btn reject"
              disabled={!!busy}
              onClick={() => review("REJECTED")}
            >
              {busy === "REJECTED" ? "Rejecting..." : "Confirm reject"}
            </button>
            <button
              type="button"
              className="booking-docs-btn"
              disabled={!!busy}
              onClick={() => {
                setRejecting(false);
                setReason("");
                setError("");
              }}
            >
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

// The operator's own decision on whether this booking needs an IDP. Hidden
// behind a link: the default (a licence from outside Malaysia needs one) is
// right for most bookings.
function PermitOverride({ booking, savedOverride, permitRequired, onUpdated }) {
  const [open, setOpen] = useState(false);
  const [required, setRequired] = useState(permitRequired);
  const [reason, setReason] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const canEdit = EDITABLE_STATUSES.includes(booking.status);
  if (!canEdit) return null;

  const changed = required !== permitRequired;

  const save = async () => {
    if (!reason.trim()) {
      setError("Enter the reason for this decision.");
      return;
    }

    try {
      setSaving(true);
      setError("");
      await operatorService.updateBookingPermitRequirement(
        booking.id,
        required,
        reason.trim()
      );
      setReason("");
      setOpen(false);
      await onUpdated?.();
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't save. Try again.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="booking-docs-override">
      <button
        type="button"
        className="booking-docs-link"
        aria-expanded={open}
        onClick={() => {
          setOpen((value) => !value);
          setRequired(permitRequired);
          setError("");
        }}
      >
        {open ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
        Change whether an IDP is needed
        {savedOverride !== null && " (set by your team)"}
      </button>

      {open && (
        <div className="booking-docs-override-form">
          <div className="booking-docs-choice" role="radiogroup" aria-label="International driving permit">
            <label>
              <input
                type="radio"
                name={`idp-${booking.id}`}
                checked={required === true}
                onChange={() => setRequired(true)}
              />
              IDP needed
            </label>
            <label>
              <input
                type="radio"
                name={`idp-${booking.id}`}
                checked={required === false}
                onChange={() => setRequired(false)}
              />
              IDP not needed
            </label>
          </div>

          <p className="booking-docs-meta">
            For example, an English-language licence from an ASEAN country may not need one.
            Changing this may change whether the car can be handed over.
          </p>

          <label htmlFor={`idp-reason-${booking.id}`} className="booking-docs-label">
            Reason
          </label>
          <textarea
            id={`idp-reason-${booking.id}`}
            rows={2}
            maxLength={300}
            value={reason}
            placeholder="Licence is in English and issued in Singapore."
            onChange={(event) => {
              setReason(event.target.value);
              setError("");
            }}
          />

          {error && (
            <p className="booking-docs-error" role="alert">
              {error}
            </p>
          )}

          <div className="booking-docs-override-actions">
            <button
              type="button"
              className="operator-primary-btn"
              disabled={!changed || saving}
              onClick={save}
            >
              {saving ? "Saving..." : "Save"}
            </button>
            <button
              type="button"
              className="operator-secondary-btn"
              disabled={saving}
              onClick={() => setOpen(false)}
            >
              Cancel
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
