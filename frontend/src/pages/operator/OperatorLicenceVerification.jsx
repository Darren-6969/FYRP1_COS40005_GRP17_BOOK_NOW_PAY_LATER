import { useCallback, useEffect, useState } from "react";
import { RefreshCw } from "lucide-react";

import {
  operatorService,
  formatOperatorDateTime,
} from "../../services/operator_service";
import DocumentReviewTable from "../../components/operator/DocumentReviewTable";

// Licence Checks: driving licences and international driving permits (IDP)
// waiting for this operator's review. Both queues use the same table.

const LICENCE_REASONS = [
  ["EXPIRED", "Expired"],
  ["UNREADABLE", "Unreadable"],
  ["NOT_A_LICENCE", "Not a driving licence"],
];

const PERMIT_REASONS = [
  ["EXPIRED", "Expired"],
  ["UNREADABLE", "Unreadable"],
  ["NOT_A_PERMIT", "Not a driving permit"],
  ["DETAILS_MISMATCH", "Details don't match the licence"],
];

function todayInMalaysia() {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
}

function permitExpired(value) {
  if (!value) return true;
  return String(value).slice(0, 10) < todayInMalaysia();
}

const LICENCE_COLUMNS = [
  {
    key: "document",
    label: "Document",
    render: (document) => (
      <>
        <strong className="doc-review-file">{document.originalName}</strong>
        <small>{formatOperatorDateTime(document.submittedAt)}</small>
      </>
    ),
  },
  {
    key: "due",
    label: "Review by",
    render: (document) => (
      <>
        <strong>{formatOperatorDateTime(document.reviewDueAt)}</strong>
        <small className={document.sla?.overdue ? "doc-review-late" : ""}>
          {document.sla?.overdue
            ? "Overdue"
            : `${document.sla?.hoursRemaining ?? 0} h left`}
        </small>
      </>
    ),
  },
];

const PERMIT_COLUMNS = [
  {
    key: "document",
    label: "Document",
    render: (document) => (
      <>
        <strong className="doc-review-file">{document.originalName}</strong>
        <small>{formatOperatorDateTime(document.submittedAt)}</small>
      </>
    ),
  },
  {
    key: "expiry",
    label: "Valid until",
    render: (document) => {
      const expired = permitExpired(document.permitExpiryDate);
      return (
        <>
          <strong>{String(document.permitExpiryDate || "-").slice(0, 10)}</strong>
          {expired && <small className="doc-review-late">Expired</small>}
        </>
      );
    },
  },
];

export default function OperatorLicenceVerification() {
  const [licences, setLicences] = useState([]);
  const [permits, setPermits] = useState([]);
  const [loading, setLoading] = useState(true);
  const [licenceError, setLicenceError] = useState("");
  const [permitError, setPermitError] = useState("");

  const loadQueues = useCallback(async () => {
    setLoading(true);

    const [licenceResult, permitResult] = await Promise.allSettled([
      operatorService.getLicenceQueue(),
      operatorService.getPermitQueue(),
    ]);

    if (licenceResult.status === "fulfilled") {
      setLicences(licenceResult.value.data?.documents || []);
      setLicenceError("");
    } else {
      setLicenceError(
        licenceResult.reason?.response?.data?.message ||
          "Couldn't load the licence queue. Try refreshing."
      );
    }

    if (permitResult.status === "fulfilled") {
      setPermits(permitResult.value.data?.documents || []);
      setPermitError("");
    } else {
      setPermitError(
        permitResult.reason?.response?.data?.message ||
          "Couldn't load the permit queue. Try refreshing."
      );
    }

    setLoading(false);
  }, []);

  useEffect(() => {
    loadQueues();
  }, [loadQueues]);

  const waiting = licences.length + permits.length;

  return (
    <div className="operator-page">
      <section className="operator-page-head licence-page-header">
        <div>
          <h1>Licence Checks</h1>
          <p>
            {loading
              ? "Loading documents..."
              : waiting === 0
                ? "No documents are waiting for your review."
                : `${waiting} document${waiting === 1 ? "" : "s"} waiting for your review. Open each one before you approve or reject it.`}
          </p>
        </div>

        <button
          type="button"
          className="operator-refresh-btn"
          onClick={loadQueues}
          disabled={loading}
        >
          <RefreshCw size={17} className={loading ? "spin" : ""} aria-hidden="true" />
          <span>{loading ? "Refreshing..." : "Refresh"}</span>
        </button>
      </section>

      <DocumentReviewTable
        id="licence-queue"
        title="Driving licences"
        description="Licences from customers with active bookings at your company."
        kind="licence"
        documents={licences}
        loading={loading}
        error={licenceError}
        columns={LICENCE_COLUMNS}
        reasons={LICENCE_REASONS}
        fetchDocument={(documentId) => operatorService.downloadLicenceDocument(documentId)}
        review={(documentId, decision, reason) =>
          operatorService.reviewLicenceDocument(documentId, decision, reason)
        }
        onReviewed={loadQueues}
      />

      <DocumentReviewTable
        id="permit-queue"
        title="International driving permits"
        description="Needed when the driver's licence was issued outside Malaysia."
        kind="permit"
        documents={permits}
        loading={loading}
        error={permitError}
        columns={PERMIT_COLUMNS}
        reasons={PERMIT_REASONS}
        fetchDocument={(documentId) => operatorService.downloadPermitDocument(documentId)}
        review={(documentId, decision, reason) =>
          operatorService.reviewPermitDocument(documentId, decision, reason)
        }
        canApprove={(document) =>
          permitExpired(document.permitExpiryDate)
            ? { ok: false, reason: "Expired permits can't be approved. Reject it as expired." }
            : { ok: true }
        }
        onReviewed={loadQueues}
      />
    </div>
  );
}
