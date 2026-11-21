import { Fragment, useState } from "react";
import { Link } from "react-router-dom";
import { FileCheck2 } from "lucide-react";

import { openPrivateDocument } from "../../utils/openPrivateDocument";

import "../../assets/styles/operator-booking-attention.css";

// One review queue (driving licences or international driving permits) on
// the Licence Checks page. Both queues share this table so they look and
// work the same: open the document first, then Approve, or Reject with a
// reason picked in a row that opens under the document.
//
// columns: [{ key, label, render(document) }] shown between Booking and Actions.
export default function DocumentReviewTable({
  id,
  title,
  description,
  kind,
  documents,
  loading,
  error,
  columns,
  reasons,
  fetchDocument,
  review,
  canApprove = () => ({ ok: true }),
  onReviewed,
}) {
  const [opened, setOpened] = useState([]);
  const [rejectingId, setRejectingId] = useState(null);
  const [reason, setReason] = useState("");
  const [busy, setBusy] = useState("");
  const [rowError, setRowError] = useState({});
  const [message, setMessage] = useState("");

  const setErrorFor = (documentId, text) =>
    setRowError((previous) => ({ ...previous, [documentId]: text }));

  const open = async (document) => {
    try {
      setBusy(`OPEN-${document.id}`);
      setErrorFor(document.id, "");
      await openPrivateDocument(() => fetchDocument(document.id));
      setOpened((previous) => [...new Set([...previous, document.id])]);
    } catch (err) {
      setErrorFor(
        document.id,
        err.response?.status === 404
          ? `This ${kind} is no longer in the queue. Refresh the page.`
          : `Couldn't open the ${kind}. Try again.`
      );
    } finally {
      setBusy("");
    }
  };

  const decide = async (document, decision) => {
    if (decision === "REJECTED" && !reason) {
      setErrorFor(document.id, "Choose a reason first.");
      return;
    }

    if (
      decision === "APPROVED" &&
      !window.confirm(
        `Approve the ${kind} for ${document.customer?.name || "this customer"}?`
      )
    ) {
      return;
    }

    try {
      setBusy(`${decision}-${document.id}`);
      setErrorFor(document.id, "");
      setMessage("");
      await review(document.id, decision, decision === "REJECTED" ? reason : "");
      setRejectingId(null);
      setReason("");
      setMessage(
        decision === "APPROVED"
          ? `${capitalise(kind)} for ${document.customer?.name || "the customer"} approved.`
          : `${capitalise(kind)} for ${document.customer?.name || "the customer"} rejected. They have been asked to upload a new one.`
      );
      await onReviewed?.();
    } catch (err) {
      setErrorFor(
        document.id,
        err.response?.data?.message || "Couldn't save the review. Try again."
      );
    } finally {
      setBusy("");
    }
  };

  return (
    <section className="operator-card doc-review" aria-labelledby={`${id}-title`}>
      <div className="doc-review-head">
        <div>
          <h2 id={`${id}-title`}>
            {title}
            {!loading && (
              <span className={`doc-review-count ${documents.length ? "" : "empty"}`}>
                {documents.length}
              </span>
            )}
          </h2>
          <p>{description}</p>
        </div>
      </div>

      {error && (
        <div className="operator-alert danger" role="alert">
          {error}
        </div>
      )}

      {message && (
        <div className="operator-alert" role="status">
          {message}
        </div>
      )}

      {loading ? (
        <div className="operator-empty-state">Loading...</div>
      ) : documents.length === 0 ? (
        <div className="doc-review-empty">
          <FileCheck2 size={22} aria-hidden="true" />
          <p>Nothing waiting for review.</p>
        </div>
      ) : (
        <div className="operator-table-wrap">
          <table className="doc-review-table">
            <thead>
              <tr>
                <th>Customer</th>
                <th>Booking</th>
                {columns.map((column) => (
                  <th key={column.key}>{column.label}</th>
                ))}
                <th className="doc-review-actions-head">Actions</th>
              </tr>
            </thead>

            <tbody>
              {documents.map((document) => {
                const wasOpened = opened.includes(document.id);
                const approval = canApprove(document);
                const isBusy = Boolean(busy);
                const rejecting = rejectingId === document.id;
                const bookingId = document.booking?.id || document.bookingId;

                return (
                  <Fragment key={document.id}>
                    <tr className={rejecting ? "doc-review-row-open" : ""}>
                      <td>
                        <strong>{document.customer?.name || "-"}</strong>
                        <small>{document.customer?.email || "-"}</small>
                      </td>

                      <td>
                        {bookingId ? (
                          <Link className="doc-review-booking" to={`/operator/bookings/${bookingId}`}>
                            {document.booking?.bookingCode || `#${bookingId}`}
                          </Link>
                        ) : (
                          "-"
                        )}
                      </td>

                      {columns.map((column) => (
                        <td key={column.key}>{column.render(document)}</td>
                      ))}

                      <td>
                        <div className="doc-review-actions">
                          <button
                            type="button"
                            className="booking-docs-btn"
                            disabled={isBusy}
                            onClick={() => open(document)}
                          >
                            {busy === `OPEN-${document.id}` ? "Opening..." : wasOpened ? "Open again" : "Open"}
                          </button>

                          {!rejecting && (
                            <>
                              <button
                                type="button"
                                className="booking-docs-btn approve"
                                disabled={isBusy || !wasOpened || !approval.ok}
                                onClick={() => decide(document, "APPROVED")}
                              >
                                {busy === `APPROVED-${document.id}` ? "Approving..." : "Approve"}
                              </button>
                              <button
                                type="button"
                                className="booking-docs-btn reject"
                                disabled={isBusy || !wasOpened}
                                onClick={() => {
                                  setRejectingId(document.id);
                                  setReason("");
                                  setErrorFor(document.id, "");
                                }}
                              >
                                Reject
                              </button>
                            </>
                          )}
                        </div>

                        {!wasOpened && (
                          <small className="doc-review-hint">Open it before you approve or reject.</small>
                        )}
                        {wasOpened && !approval.ok && (
                          <small className="doc-review-hint">{approval.reason}</small>
                        )}
                        {rowError[document.id] && !rejecting && (
                          <small className="booking-docs-error" role="alert">
                            {rowError[document.id]}
                          </small>
                        )}
                      </td>
                    </tr>

                    {rejecting && (
                      <tr className="doc-review-reject-row">
                        <td colSpan={columns.length + 3}>
                          <div className="doc-review-reject">
                            <label htmlFor={`${id}-reason-${document.id}`}>
                              Why are you rejecting this {kind}?
                            </label>
                            <select
                              id={`${id}-reason-${document.id}`}
                              value={reason}
                              onChange={(event) => {
                                setReason(event.target.value);
                                setErrorFor(document.id, "");
                              }}
                            >
                              <option value="">Choose a reason</option>
                              {reasons.map(([value, label]) => (
                                <option key={value} value={value}>
                                  {label}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className="booking-docs-btn reject-solid"
                              disabled={isBusy}
                              onClick={() => decide(document, "REJECTED")}
                            >
                              {busy === `REJECTED-${document.id}` ? "Rejecting..." : "Confirm reject"}
                            </button>
                            <button
                              type="button"
                              className="booking-docs-btn"
                              disabled={isBusy}
                              onClick={() => {
                                setRejectingId(null);
                                setReason("");
                                setErrorFor(document.id, "");
                              }}
                            >
                              Cancel
                            </button>
                          </div>
                          <p className="booking-docs-meta">
                            The customer is told the reason and asked to upload a new one.
                          </p>
                          {rowError[document.id] && (
                            <p className="booking-docs-error" role="alert">
                              {rowError[document.id]}
                            </p>
                          )}
                        </td>
                      </tr>
                    )}
                  </Fragment>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}

function capitalise(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}
