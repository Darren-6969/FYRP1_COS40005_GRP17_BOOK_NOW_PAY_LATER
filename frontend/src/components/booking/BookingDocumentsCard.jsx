import { useCallback, useEffect, useState } from "react";
import { Globe2, IdCard } from "lucide-react";

import {
  formatCustomerDate,
  formatStatus,
} from "../../utils/customerUtils";
import {
  attachLicenceToBooking,
  getBookingLicenceDocument,
  getMyPermit,
  getReusableLicences,
  submitBookingLicenceDocument,
  submitPermitDocument,
} from "../../services/customer_service";
import DocumentUpload from "./DocumentUpload";

// The documents a customer needs for pickup, in one card: the driving
// licence and, when needed, the international driving permit (IDP). Each
// row shows its status and, only when something is needed from the
// customer, an upload area.

const CLOSED = ["COMPLETED", "CANCELLED", "REJECTED", "EXPIRED", "NO_SHOW", "NO_SHOW_UNPAID"];
const NEEDS_UPLOAD = ["REJECTED", "REUPLOAD_REQUIRED"];

function badgeClass(status) {
  if (status === "APPROVED") return "status-success";
  if (status === "UNDER_REVIEW") return "status-warning";
  if (NEEDS_UPLOAD.includes(status)) return "status-danger";
  return "status-neutral";
}

function plainDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-MY", {
    dateStyle: "medium",
    timeZone: "UTC",
  }).format(new Date(`${String(value).slice(0, 10)}T00:00:00Z`));
}

function todayInMalaysia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

export default function BookingDocumentsCard({ booking }) {
  const isCar = Boolean(booking.car);
  const op = booking.operator?.companyName || "The operator";
  const open = !CLOSED.includes(booking.status);
  const permitRequired = isCar && booking.internationalPermitRequired === true;
  const pickup = booking.alternativePickupDate || booking.pickupDate;
  const dueAt = booking.payment?.finalPaymentDueDate || pickup;

  const [licence, setLicence] = useState(undefined);
  const [reusable, setReusable] = useState([]);
  const [permit, setPermit] = useState(undefined);

  const driver = booking.car?.driver || booking.bookingDetails?.driver || null;

  const loadLicence = useCallback(async () => {
    // BNPLB-181: the licence check belongs to this booking. A licence already
    // on the account is offered for one-tap attaching, but only when it names
    // the driver and is valid through the return date.
    const [forBooking, candidates] = await Promise.allSettled([
      getBookingLicenceDocument(booking.id),
      getReusableLicences(booking.id),
    ]);
    setLicence(forBooking.status === "fulfilled" ? forBooking.value.data?.document || null : null);
    setReusable(candidates.status === "fulfilled" ? candidates.value.data?.licences || [] : []);
  }, [booking.id]);

  const loadPermit = useCallback(async () => {
    try {
      const response = await getMyPermit(booking.id);
      setPermit(response.data?.document || null);
    } catch {
      setPermit(null);
    }
  }, [booking.id]);

  useEffect(() => {
    loadLicence();
  }, [loadLicence]);

  useEffect(() => {
    if (isCar) loadPermit();
  }, [isCar, loadPermit]);

  const rows = [
    {
      key: "licence",
      icon: IdCard,
      title: "Driving licence",
      doc: licence,
      note: licenceNote(licence, op, dueAt, reusable.some((item) => item.eligible)),
      canUpload: open && (!licence || NEEDS_UPLOAD.includes(licence.status)),
      upload: (
        <>
          <ReusableLicences
            licences={reusable}
            onAttach={async (licenceId) => {
              await attachLicenceToBooking(booking.id, licenceId);
              await loadLicence();
            }}
          />
          <DocumentUpload
            buttonLabel={reusable.length ? "Upload a new licence" : "Upload licence"}
            needsLicenceDetails
            defaultHolderName={driver?.fullName || ""}
            defaultCountry={driver?.licenceIssuedIn === "MY" ? "Malaysia" : ""}
            minExpiry={todayInMalaysia()}
            onUpload={async (file, details) => {
              await submitBookingLicenceDocument(booking.id, file, details);
              await loadLicence();
            }}
          />
        </>
      ),
    },
  ];

  if (permitRequired || permit) {
    rows.push({
      key: "permit",
      icon: Globe2,
      title: "International driving permit",
      doc: permit,
      note: permitNote(permit, permitRequired, op),
      canUpload:
        open && permitRequired && (!permit || NEEDS_UPLOAD.includes(permit.status)),
      upload: (
        <DocumentUpload
          buttonLabel="Upload permit"
          needsExpiry
          minExpiry={todayInMalaysia()}
          onUpload={async (file, expiry) => {
            await submitPermitDocument(booking.id, file, expiry);
            await loadPermit();
          }}
        />
      ),
    });
  }

  const required = rows.filter((row) => row.key === "licence" || permitRequired);
  const approved = required.filter((row) => row.doc?.status === "APPROVED").length;

  return (
    <article className="customer-glass-card booking-docs-card" aria-labelledby="booking-docs-title">
      <div className="booking-docs-card-head">
        <h2 id="booking-docs-title">Documents for pickup</h2>
        {licence !== undefined && (
          <span className="customer-muted">
            {approved} of {required.length} approved
          </span>
        )}
      </div>

      {rows.map((row) => {
        const Icon = row.icon;
        const loading = row.doc === undefined;
        const status = row.doc?.status || "NOT_UPLOADED";

        return (
          <section key={row.key} className="booking-docs-card-row" aria-label={row.title}>
            <div className="booking-docs-card-icon">
              <Icon size={20} aria-hidden="true" />
            </div>
            <div className="booking-docs-card-body">
              <div className="booking-docs-card-title">
                <strong>{row.title}</strong>
                {!loading && (
                  <span className={`customer-status ${badgeClass(status)}`}>
                    {row.doc ? formatStatus(status) : "Not uploaded"}
                  </span>
                )}
              </div>
              <p className="customer-muted">{loading ? "Checking..." : row.note}</p>
              {!loading && row.canUpload && row.upload}
            </div>
          </section>
        );
      })}
    </article>
  );
}

// BNPLB-181: licences already on the account. One that names the driver and
// is valid through the return date is attached in one tap; the others are
// shown greyed with the reason.
function ReusableLicences({ licences, onAttach }) {
  const [busy, setBusy] = useState(null);
  const [error, setError] = useState("");
  if (!licences.length) return null;

  const attach = async (id) => {
    try {
      setBusy(id);
      setError("");
      await onAttach(id);
    } catch (err) {
      setError(err.response?.data?.message || "Couldn't attach the licence. Try again.");
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="booking-docs-reuse">
      <p className="booking-docs-reuse-title">Licences on your account</p>
      <ul>
        {licences.map((item) => (
          <li key={item.id} className={item.eligible ? "" : "is-refused"}>
            <div>
              <strong>{item.holderName || "Licence"}</strong>
              <span className="customer-muted">
                {item.expiresAt ? `Valid until ${plainDate(item.expiresAt)}` : "No expiry date on record"}
                {item.issuingCountry ? ` · ${item.issuingCountry}` : ""}
              </span>
              {!item.eligible && item.reason && <span className="booking-docs-reuse-reason">{item.reason}</span>}
            </div>
            {item.eligible && (
              <button
                type="button"
                className="customer-primary-btn"
                disabled={busy !== null}
                onClick={() => attach(item.id)}
              >
                {busy === item.id ? "Attaching..." : "Use this licence"}
              </button>
            )}
          </li>
        ))}
      </ul>
      {error && (
        <p className="doc-upload-error" role="alert">
          {error}
        </p>
      )}
    </div>
  );
}

function licenceNote(doc, op, dueAt, canReuse = false) {
  if (!doc) {
    return canReuse
      ? `Use a licence already on your account, or upload one, before ${formatCustomerDate(dueAt)}.`
      : `Upload a clear photo of the front and back before ${formatCustomerDate(dueAt)}.`;
  }
  switch (doc.status) {
    case "APPROVED":
      return "Approved. Bring the original to pickup.";
    case "UNDER_REVIEW":
      return `Uploaded ${formatCustomerDate(doc.submittedAt)}. ${op} checks it before pickup.`;
    default:
      return doc.rejectionReason === "DIFFERENT_DRIVER"
        ? "Reason: the name on the licence is not the driver's name. Attach or upload the driver's licence."
        : `${doc.rejectionReason ? `Reason: ${formatStatus(doc.rejectionReason).toLowerCase()}. ` : ""}Upload a clearer photo of the front and back.`;
  }
}

function permitNote(doc, required, op) {
  if (!required) return "Not needed for this booking.";
  const validUntil = doc?.permitExpiryDate ? ` Valid until ${plainDate(doc.permitExpiryDate)}.` : "";
  if (!doc) {
    return "Needed because your licence was issued outside Malaysia. It must be valid until your return date.";
  }
  switch (doc.status) {
    case "APPROVED":
      return `Approved.${validUntil} Bring the original to pickup.`;
    case "UNDER_REVIEW":
      return `Uploaded ${formatCustomerDate(doc.submittedAt)}.${validUntil} ${op} checks it before pickup.`;
    default:
      return `${doc.rejectionReason ? `Reason: ${formatStatus(doc.rejectionReason).toLowerCase()}. ` : ""}Upload the permit again.`;
  }
}
