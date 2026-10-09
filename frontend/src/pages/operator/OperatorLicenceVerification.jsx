import {
  useEffect,
  useState,
} from "react";

import { RefreshCw } from "lucide-react";

import {
  operatorService,
} from "../../services/operator_service";

const REJECTION_REASONS = [
  ["EXPIRED", "Expired document"],
  ["UNREADABLE", "Unreadable image"],
  ["NOT_A_LICENCE", "Not a driving licence"],
];

export default function OperatorLicenceVerification() {
  const [documents, setDocuments] =
    useState([]);

  const [queueStats, setQueueStats] =
    useState({
      queueDepth: 0,
      oldestItemAgeHours: 0,
    });

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [message, setMessage] =
    useState("");

  const [actionLoading, setActionLoading] =
    useState("");

  const loadQueue = async () => {
    try {
      setLoading(true);
      setError("");

      const res =
        await operatorService.getLicenceQueue();

      setDocuments(
        res.data?.documents || []
      );

      setQueueStats({
        queueDepth:
          res.data?.queueDepth || 0,

        oldestItemAgeHours:
          res.data?.oldestItemAgeHours || 0,
      });
    } catch (err) {
  console.error(
    "Licence queue error:",
    err
  );

  console.error(
    "Licence queue response:",
    err.response
  );

  setError(
    err.response?.data?.message ||
      err.message ||
      "Failed to load licence verification queue."
  );
}
    finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const viewDocument =
    async (document) => {
      try {
        setError("");

        const response =
          await operatorService.downloadLicenceDocument(
            document.id
          );

        const url =
          URL.createObjectURL(
            response.data
          );

        window.open(
          url,
          "_blank",
          "noopener,noreferrer"
        );

        window.setTimeout(
          () =>
            URL.revokeObjectURL(
              url
            ),
          60000
        );
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Failed to open licence document."
        );
      }
    };

  const reviewLicence =
    async (
      document,
      decision
    ) => {
      let reason = "";

      if (
        decision ===
        "REJECTED"
      ) {
        reason =
          window.prompt(
            `Enter rejection reason:\n${REJECTION_REASONS
              .map(
                ([value, label]) =>
                  `${value} - ${label}`
              )
              .join("\n")}`
          ) || "";

        reason =
          reason
            .trim()
            .toUpperCase();

        const validReason =
          REJECTION_REASONS.some(
            ([value]) =>
              value === reason
          );

        if (!validReason) {
          if (reason) {
            setError(
              "Invalid rejection reason. Use EXPIRED, UNREADABLE, or NOT_A_LICENCE."
            );
          }

          return;
        }
      }

      try {
        setActionLoading(
          `${decision}-${document.id}`
        );

        setError("");
        setMessage("");

        await operatorService.reviewLicenceDocument(
          document.id,
          decision,
          reason
        );

        if (
          decision ===
          "APPROVED"
        ) {
          setMessage(
            `Licence for ${document.customer?.name || "customer"} approved successfully.`
          );
        } else {
          setMessage(
            `Licence for ${document.customer?.name || "customer"} rejected. Customer has been asked to re-upload.`
          );
        }

        await loadQueue();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Failed to review licence."
        );
      } finally {
        setActionLoading("");
      }
    };

  if (loading) {
    return (
      <div className="operator-page">
        <section className="operator-card">
          Loading licence verification queue...
        </section>
      </div>
    );
  }

  return (
    <div className="operator-page">
      <section className="operator-page-head licence-page-header">
        <div>
            <h1>
            Licence Verification
            </h1>

            <p>
            Review driving licences submitted by customers
            with active bookings under your company.
            </p>
        </div>

        <button
            type="button"
            className="operator-refresh-btn"
            onClick={loadQueue}
            disabled={loading}
        >
            <RefreshCw
            size={17}
            className={loading ? "spin" : ""}
            />

            <span>
            {loading ? "Refreshing..." : "Refresh"}
            </span>
        </button>
        </section>

      {error && (
        <div className="operator-alert danger">
          {error}
        </div>
      )}

      {message && (
        <div className="operator-alert">
          {message}
        </div>
      )}

      <section className="operator-card">
        <div className="operator-page-head">
          <div>
            <h2>
              Pending Reviews
            </h2>

            <p>
              {
                queueStats.queueDepth
              }{" "}
              pending licence
              {queueStats.queueDepth ===
              1
                ? ""
                : "s"}
              {" · "}
              Oldest submission:{" "}
              {
                queueStats.oldestItemAgeHours
              }{" "}
              hour
              {queueStats.oldestItemAgeHours ===
              1
                ? ""
                : "s"}{" "}
              ago
            </p>
          </div>
        </div>

        {documents.length ===
          0 && (
          <div className="operator-empty-state">
            No licences are waiting
            for review.
          </div>
        )}

        {documents.length >
          0 && (
          <div className="operator-table-wrap">
            <table className="operator-table">
              <thead>
                <tr>
                  <th>
                    Customer
                  </th>

                  <th>
                    Document
                  </th>

                  <th>
                    Booking
                  </th>

                  <th>
                    Submitted
                  </th>

                  <th>
                    Review Due
                  </th>

                  <th>
                    Actions
                  </th>
                </tr>
              </thead>

              <tbody>
                {documents.map(
                  (document) => (
                    <tr
                      key={
                        document.id
                      }
                    >
                      <td>
                        <strong>
                          {document
                            .customer
                            ?.name ||
                            "-"}
                        </strong>

                        <small>
                          {document
                            .customer
                            ?.email ||
                            "-"}
                        </small>
                      </td>

                      <td>
                        <strong>
                          {document.originalName}
                        </strong>

                        <small>
                          {document.mimeType}
                        </small>
                      </td>

                      <td>
                        {document.booking
                          ?.bookingCode ||
                          "-"}

                        {document.booking
                          ?.paymentDeadline && (
                          <small>
                            Payment
                            deadline:{" "}
                            {new Date(
                              document
                                .booking
                                .paymentDeadline
                            ).toLocaleString(
                              "en-MY"
                            )}
                          </small>
                        )}
                      </td>

                      <td>
                        {document.submittedAt
                          ? new Date(
                              document.submittedAt
                            ).toLocaleString(
                              "en-MY"
                            )
                          : "-"}
                      </td>

                      <td>
                        <span
                          className={
                            document.sla
                              ?.overdue
                              ? "text-danger"
                              : ""
                          }
                        >
                          {document.reviewDueAt
                            ? new Date(
                                document.reviewDueAt
                              ).toLocaleString(
                                "en-MY"
                              )
                            : "-"}
                        </span>

                        <small>
                          {document.sla
                            ?.overdue
                            ? "OVERDUE"
                            : `${document.sla?.hoursRemaining ?? 0}h remaining`}
                        </small>
                      </td>

                      <td>
                        <div className="operator-table-actions">
                          <button
                            type="button"
                            onClick={() =>
                              viewDocument(
                                document
                              )
                            }
                            disabled={
                              !!actionLoading
                            }
                          >
                            Open
                          </button>

                          <button
                            type="button"
                            className="success"
                            onClick={() =>
                              reviewLicence(
                                document,
                                "APPROVED"
                              )
                            }
                            disabled={
                              !!actionLoading
                            }
                          >
                            {actionLoading ===
                            `APPROVED-${document.id}`
                              ? "..."
                              : "Approve"}
                          </button>

                          <button
                            type="button"
                            className="danger"
                            onClick={() =>
                              reviewLicence(
                                document,
                                "REJECTED"
                              )
                            }
                            disabled={
                              !!actionLoading
                            }
                          >
                            {actionLoading ===
                            `REJECTED-${document.id}`
                              ? "..."
                              : "Reject"}
                          </button>
                        </div>
                      </td>
                    </tr>
                  )
                )}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}