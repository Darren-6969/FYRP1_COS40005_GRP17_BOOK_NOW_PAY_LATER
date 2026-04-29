import { useEffect, useMemo, useState } from "react";
import { getEmailLogs } from "../../services/admin_service";

export default function EmailLogs() {
  const [logs, setLogs] = useState([]);
  const [status, setStatus] = useState("ALL");
  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const res = await getEmailLogs();
    setLogs(res.data?.emailLogs || []);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      const matchesStatus = status === "ALL" || log.status === status;
      const text = `${log.toEmail} ${log.subject} ${log.type} ${log.error || ""}`.toLowerCase();
      const matchesQuery = !query || text.includes(query.toLowerCase());

      return matchesStatus && matchesQuery;
    });
  }, [logs, status, query]);

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h3>Email Logs</h3>
          <p>Track automated invoice, receipt, payment, and notification emails.</p>
        </div>

        <button className="btn" onClick={load}>Refresh</button>
      </div>

      <div className="admin-filter-row">
        <input 
          placeholder="Search recipient, subject, type, error..."
          value={query}
          onChange={(event) => setQuery(event.target.value)}
        />

        <select value={status} onChange={(event) => setStatus(event.target.value)}>
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