
import { useCallback, useEffect, useState } from "react";
import {
  FileCheck2,
  RefreshCw,
  ShieldCheck,
} from "lucide-react";

import {
  operatorService,
} from "../../services/operator_service";

const REJECTION_REASONS = [
  { value: "EXPIRED", label: "Expired permit" },
  { value: "UNREADABLE", label: "Unreadable document" },
  { value: "NOT_A_PERMIT", label: "Not an international permit" },
  { value: "DETAILS_MISMATCH", label: "Details do not match" },
];

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-MY");
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-MY");
}

function permitExpired(value) {
  if (!value) return true;

  const expiry = String(value).slice(0, 10);

  const today = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kuching",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return expiry < today;
}

export default function OperatorPermitReview() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState("");

  const [openedDocuments, setOpenedDocuments] = useState([]);
  const [rejectionReasons, setRejectionReasons] = useState({});

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const loadQueue = useCallback(async () => {
    try {
      setLoading(true);

      const response = await operatorService.getPermitQueue();

      setDocuments(
        Array.isArray(response.data?.documents)
          ? response.data.documents
          : []
      );

      setError("");
    } catch (err) {
      setError(
        err.response?.data?.message ||
          err.message ||
          "Failed to load international permit queue."
      );
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadQueue();
  }, [loadQueue]);

  const openDocument = async (document) => {
    let url = null;

    try {
      setActionLoading(`OPEN-${document.id}`);
      setError("");

      const response =
        await operatorService.downloadPermitDocument(
          document.id
        );

      const blob = response.data;

      if (!(blob instanceof Blob) || blob.size === 0) {
        throw new Error("The permit document is empty.");
      }

      const allowedTypes = [
        "application/pdf",
        "image/jpeg",
        "image/png",
      ];

      if (!allowedTypes.includes(blob.type)) {
        throw new Error("Unsupported permit document type.");
      }

      url = URL.createObjectURL(blob);

      // Open the authorised document in a new browser tab.
      const link = window.document.createElement("a");
      link.href = url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.click();

      setOpenedDocuments((previous) => [
        ...new Set([...previous, document.id]),
      ]);

      // Allow the preview to load before releasing the URL.
      const previewUrl = url;
      window.setTimeout(
        () => URL.revokeObjectURL(previewUrl),
        60000
      );
      url = null;
    } catch (err) {
      if (url) URL.revokeObjectURL(url);

      setError(
        err.response?.data?.message ||
          err.message ||
          "Unable to open permit document."
      );
    } finally {
      setActionLoading("");
    }
  };

  const reviewPermit = async (document, decision) => {
    if (!openedDocuments.includes(document.id)) {
      setError("Open and inspect the permit before reviewing.");
      return;
    }

    if (
      decision === "APPROVED" &&
      permitExpired(document.permitExpiryDate)
    ) {
      setError("An expired permit cannot be approved.");
      return;
    }

    const reason =
      rejectionReasons[document.id] || "";

    if (decision === "REJECTED" && !reason) {
      setError("Select a rejection reason first.");
      return;
    }

    const confirmed = window.confirm(
      decision === "APPROVED"
        ? `Approve the international permit for ${
            document.customer?.name || "this customer"
          }? Confirm that you inspected the document.`
        : `Reject the international permit for ${
            document.customer?.name || "this customer"
          }?`
    );

    if (!confirmed) return;

    try {
      setActionLoading(`${decision}-${document.id}`);
      setError("");
      setMessage("");

      await operatorService.reviewPermitDocument(
        document.id,
        decision,
        reason
      );

      setMessage(
        decision === "APPROVED"
          ? "International permit approved successfully."
          : "International permit rejected. A replacement is required."
      );

      await loadQueue();
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to review international permit."
      );
    } finally {
      setActionLoading("");
    }
  };

  return (
    <section className="operator-card">
      <div className="operator-page-head">
        <div>
          <h2>
            <ShieldCheck
              size={22}
              style={{
                verticalAlign: "middle",
                marginRight: 8,
              }}
            />
            International Permit Verification
          </h2>

          <p>
            Review International Driving Permits
            submitted for your company's car rentals.
          </p>
        </div>

        <button
          type="button"
          className="operator-refresh-btn"
          onClick={loadQueue}
          disabled={loading || !!actionLoading}
        >
          <RefreshCw size={17} />
          <span>
            {loading ? "Refreshing..." : "Refresh"}
          </span>
        </button>
      </div>

      {error && (
        <div
          className="operator-alert danger"
          role="alert"
        >
          {error}
        </div>
      )}

      {message && (
        <div className="operator-alert">
          {message}
        </div>
      )}

      <div
        className="operator-page-head"
        style={{ marginTop: 20 }}
      >
        <div>
          <h3>Pending Permit Reviews</h3>
          <p>
            {documents.length} permit
            {documents.length === 1 ? "" : "s"} waiting
            for verification
          </p>
        </div>
      </div>

      {loading ? (
        <div className="operator-empty-state">
          Loading international permits...
        </div>
      ) : documents.length === 0 && !error ? (
        <div className="operator-empty-state">
          <FileCheck2 size={26} />
          <p>No international permits awaiting review.</p>
        </div>
      ) : (
        <div className="operator-table-wrap">
          <table className="operator-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Document</th>
                <th>Booking</th>
                <th>Expiry</th>
                <th>Submitted</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {documents.map((document) => {
                const opened = openedDocuments.includes(
                  document.id
                );

                const expired = permitExpired(
                  document.permitExpiryDate
                );

                const busy = !!actionLoading;

                return (
                  <tr key={document.id}>
                    <td>
                      <strong>
                        {document.customer?.name || "-"}
                      </strong>
                      <small>
                        {document.customer?.email || "-"}
                      </small>
                    </td>

                    <td>
                      <strong>
                        {document.originalName}
                      </strong>
                      <small>{document.mimeType}</small>
                    </td>

                    <td>
                      {document.booking?.bookingCode ||
                        `BNPL-${document.bookingId}`}
                    </td>

                    <td>
                      <span
                        className={
                          expired ? "text-danger" : ""
                        }
                      >
                        {formatDate(
                          document.permitExpiryDate
                        )}
                      </span>
                      {expired && (
                        <small>Expired</small>
                      )}
                    </td>

                    <td>
                      {formatDateTime(document.submittedAt)}
                    </td>

                    <td>
                      <div
                        className="operator-table-actions"
                        style={{
                          flexWrap: "wrap",
                          gap: 8,
                        }}
                      >
                        <button
                          type="button"
                          disabled={busy}
                          onClick={() =>
                            openDocument(document)
                          }
                        >
                          {actionLoading ===
                          `OPEN-${document.id}`
                            ? "Opening..."
                            : opened
                              ? "Open Again"
                              : "Open"}
                        </button>

                        <button
                          type="button"
                          className="success"
                          disabled={
                            busy || !opened || expired
                          }
                          onClick={() =>
                            reviewPermit(
                              document,
                              "APPROVED"
                            )
                          }
                        >
                          Approve
                        </button>

                        <select
                          aria-label={`Rejection reason for ${document.originalName}`}
                          value={
                            rejectionReasons[
                              document.id
                            ] || ""
                          }
                          disabled={busy}
                          onChange={(event) =>
                            setRejectionReasons(
                              (previous) => ({
                                ...previous,
                                [document.id]:
                                  event.target.value,
                              })
                            )
                          }
                          style={{
                            maxWidth: 175,
                            padding: "8px",
                            borderRadius: 8,
                          }}
                        >
                          <option value="">
                            Rejection reason
                          </option>

                          {REJECTION_REASONS.map(
                            (reason) => (
                              <option
                                key={reason.value}
                                value={reason.value}
                              >
                                {reason.label}
                              </option>
                            )
                          )}
                        </select>

                        <button
                          type="button"
                          className="danger"
                          disabled={
                            busy ||
                            !opened ||
                            !rejectionReasons[document.id]
                          }
                          onClick={() =>
                            reviewPermit(
                              document,
                              "REJECTED"
                            )
                          }
                        >
                          Reject
                        </button>
                      </div>

                      {!opened && (
                        <small>
                          Open the document before
                          reviewing.
                        </small>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
