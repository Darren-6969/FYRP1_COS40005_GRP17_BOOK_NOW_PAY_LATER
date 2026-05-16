import { useEffect, useMemo, useState } from "react";
import { getEmailLogs } from "../../services/admin_service";

const EMAIL_TYPES = [
  { value: "ALL", label: "All Types" },
  { value: "PAYMENT_OVERDUE", label: "Payment Overdue" },
  { value: "PAYMENT_REMINDER", label: "Payment Reminder" },
  { value: "FINAL_PAYMENT_REMINDER", label: "Final Payment Reminder" },
  { value: "PAYMENT_CONFIRMED", label: "Payment Confirmed" },
  { value: "PAYMENT_REJECTED", label: "Payment Rejected" },
  { value: "PAYMENT_RECEIPT_ISSUED", label: "Receipt Issued" },
  { value: "PAYMENT_RECEIPT_RESENT", label: "Receipt Resent" },
  { value: "BOOKING_ACCEPTED_PAYMENT_AVAILABLE", label: "Booking Accepted" },
  { value: "BOOKING_AUTO_REJECTED_NO_RESPONSE", label: "Auto-Rejected (No Response)" },
  { value: "BOOKING_CONFIRMED", label: "Booking Confirmed" },
  { value: "BOOKING_COMPLETED", label: "Booking Completed" },
  { value: "OPERATOR_BOOKING_CANCELLED", label: "Booking Cancelled" },
  { value: "ALTERNATIVE_SUGGESTED", label: "Alternative Suggested" },
  { value: "INVOICE_SENT", label: "Invoice Sent" },
  { value: "INVOICE_RESENT", label: "Invoice Resent" },
  { value: "OPERATOR_ACCOUNT_CREATED", label: "Operator Account Created" },
  { value: "OPERATOR_STAFF_ACCOUNT_CREATED", label: "Staff Account Created" },
];

export default function EmailLogs() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("ALL");
  const [emailType, setEmailType] = useState("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await getEmailLogs();
      setLogs(res.data?.emailLogs || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load email logs");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesStatus = status === "ALL" || log.status === status;
      const matchesType = emailType === "ALL" || log.type === emailType;

      const searchableText = [
        log.toEmail,
        log.subject,
        log.type,
        log.status,
        log.relatedEntityType,
        log.relatedEntityId,
        log.error,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery =
        !query || searchableText.includes(query.toLowerCase());

      return matchesStatus && matchesType && matchesQuery;
    });
  }, [logs, status, emailType, query]);

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h3>Email Logs</h3>
          <p>
            Track automated invoice, receipt, payment, and notification emails.
          </p>
        </div>

        <button className="btn" onClick={load}>
          Refresh
        </button>
      </div>

      {error && <div className="alert danger">{error}</div>}

      <div className="admin-filter-row">
        <input
          placeholder="Search recipient, subject, type, error..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <select
          value={emailType}
          onChange={(event) => setEmailType(event.target.value)}
        >
          {EMAIL_TYPES.map((t) => (
            <option key={t.value} value={t.value}>{t.label}</option>
          ))}
        </select>

        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
        >
          <option value="ALL">All Status</option>
          <option value="SENT">Sent</option>
          <option value="FAILED">Failed</option>
          <option value="SKIPPED">Skipped</option>
          <option value="PENDING">Pending</option>
        </select>
      </div>

      {loading ? (
        <div className="empty-state">Loading email logs...</div>
      ) : (
        <table className="table">
          <thead>
            <tr>
              <th>Time</th>
              <th>Recipient</th>
              <th>Subject</th>
              <th>Type</th>
              <th>Status</th>
              <th>Related</th>
              <th>Error</th>
            </tr>
          </thead>

          <tbody>
            {filteredLogs.map((log) => (
              <tr key={log.id}>
                <td>{new Date(log.createdAt).toLocaleString()}</td>
                <td>{log.toEmail}</td>
                <td>{log.subject}</td>
                <td>{log.type}</td>
                <td>
                  <span className={`badge ${String(log.status).toLowerCase()}`}>
                    {log.status}
                  </span>
                </td>
                <td>
                  {log.relatedEntityType || "-"} {log.relatedEntityId || ""}
                </td>
                <td>{log.error || "-"}</td>
              </tr>
            ))}

            {!filteredLogs.length && (
              <tr>
                <td colSpan="7">No email logs found.</td>
              </tr>
            )}
          </tbody>
        </table>
      )}
    </section>
  );
}