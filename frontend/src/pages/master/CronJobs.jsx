import { useEffect, useMemo, useState } from "react";
import {
  getCronHistory,
  getCronStatus,
  runCompletionCheck,
  runMaintenanceChecks,
  runNoResponseCheck,
  runOverdueCheck,
  runPaymentReminderCheck,
} from "../../services/admin_service";

function formatDateTime(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}

function statusClass(status) {
  const normalized = String(status || "").toUpperCase();

  if (normalized === "SUCCESS") return "success";
  if (normalized === "RUNNING") return "warning";
  if (normalized === "FAILED") return "danger";

  return "neutral";
}

function jobLabel(jobType) {
  return String(jobType || "-")
    .replaceAll("_", " ")
    .toLowerCase()
    .replace(/\b\w/g, (char) => char.toUpperCase());
}

export default function CronJobs() {
  const [status, setStatus] = useState(null);
  const [history, setHistory] = useState([]);
  const [selectedRun, setSelectedRun] = useState(null);

  const [jobType, setJobType] = useState("ALL");
  const [runStatus, setRunStatus] = useState("ALL");

  const [running, setRunning] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);

    try {
      const [statusRes, historyRes] = await Promise.all([
        getCronStatus(),
        getCronHistory({
          jobType,
          status: runStatus,
          limit: 50,
        }),
      ]);

      setStatus(statusRes.data);
      setHistory(historyRes.data?.history || []);
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to load cron data.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [jobType, runStatus]);

  const runJob = async (type, runner) => {
    const label = jobLabel(type);

    if (!window.confirm(`Run ${label} now?`)) return;

    setRunning(type);
    setMessage("");

    try {
      const res = await runner();
      setMessage(res.data?.message || `${label} completed.`);
      await load();
    } catch (err) {
      setMessage(err.response?.data?.message || `${label} failed.`);
      await load();
    } finally {
      setRunning("");
    }
  };

  const latestSummary = useMemo(() => {
    const latest = history[0];

    return {
      latestJob: latest ? jobLabel(latest.jobType) : "-",
      latestStatus: latest?.status || "-",
      latestAffected: latest?.affectedCount ?? 0,
      latestRun: latest?.startedAt || null,
    };
  }, [history]);

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Cron Jobs</h3>
            <p>
              Run automated BNPL maintenance jobs and review saved cron history.
            </p>
          </div>
        </div>

        {message && <div className="alert">{message}</div>}

        <div className="stats-grid">
          <div className="stat-card">
            <span>Local Cron Status</span>
            <strong>{status?.cronStarted ? "Active" : "Not Active"}</strong>
          </div>

          <div className="stat-card">
            <span>Schedule</span>
            <strong>{status?.schedule || "-"}</strong>
          </div>

          <div className="stat-card">
            <span>Latest Job</span>
            <strong>{latestSummary.latestJob}</strong>
          </div>

          <div className="stat-card">
            <span>Latest Affected Count</span>
            <strong>{latestSummary.latestAffected}</strong>
          </div>
        </div>

        <div className="admin-action-grid" style={{ marginTop: 20 }}>
          <button
            className="btn primary"
            disabled={!!running}
            onClick={() => runJob("MAINTENANCE_CHECK", runMaintenanceChecks)}
          >
            {running === "MAINTENANCE_CHECK"
              ? "Running..."
              : "Run Full Maintenance"}
          </button>

          <button
            className="btn"
            disabled={!!running}
            onClick={() => runJob("OVERDUE_CHECK", runOverdueCheck)}
          >
            {running === "OVERDUE_CHECK" ? "Running..." : "Run Overdue Check"}
          </button>

          <button
            className="btn"
            disabled={!!running}
            onClick={() =>
              runJob("PAYMENT_REMINDER_CHECK", runPaymentReminderCheck)
            }
          >
            {running === "PAYMENT_REMINDER_CHECK"
              ? "Running..."
              : "Run Payment Reminders"}
          </button>

          <button
            className="btn"
            disabled={!!running}
            onClick={() => runJob("NO_RESPONSE_CHECK", runNoResponseCheck)}
          >
            {running === "NO_RESPONSE_CHECK"
              ? "Running..."
              : "Run No Response Check"}
          </button>

          <button
            className="btn"
            disabled={!!running}
            onClick={() => runJob("COMPLETION_CHECK", runCompletionCheck)}
          >
            {running === "COMPLETION_CHECK"
              ? "Running..."
              : "Run Completion Check"}
          </button>
        </div>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Cron Run History</h3>
            <p>
              Saved run history remains available after server restart or
              redeployment.
            </p>
          </div>

          <button className="btn" onClick={load} disabled={loading}>
            Refresh
          </button>
        </div>

        <div className="admin-filter-row">
          <select value={jobType} onChange={(e) => setJobType(e.target.value)}>
            <option value="ALL">All Job Types</option>
            <option value="MAINTENANCE_CHECK">Maintenance Check</option>
            <option value="OVERDUE_CHECK">Overdue Check</option>
            <option value="PAYMENT_REMINDER_CHECK">Payment Reminder Check</option>
            <option value="NO_RESPONSE_CHECK">No Response Check</option>
            <option value="COMPLETION_CHECK">Completion Check</option>
          </select>

          <select
            value={runStatus}
            onChange={(e) => setRunStatus(e.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="SUCCESS">Success</option>
            <option value="FAILED">Failed</option>
            <option value="RUNNING">Running</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state">Loading cron history...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Run ID</th>
                <th>Job Type</th>
                <th>Status</th>
                <th>Trigger Source</th>
                <th>Started At</th>
                <th>Finished At</th>
                <th>Affected</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {history.map((run) => (
                <tr key={run.id}>
                  <td>{run.id}</td>
                  <td>{jobLabel(run.jobType)}</td>
                  <td>
                    <span className={`badge ${statusClass(run.status)}`}>
                      {run.status}
                    </span>
                  </td>
                  <td>{run.triggerSource || "-"}</td>
                  <td>{formatDateTime(run.startedAt)}</td>
                  <td>{formatDateTime(run.finishedAt)}</td>
                  <td>{run.affectedCount}</td>
                  <td>
                    <button className="btn" onClick={() => setSelectedRun(run)}>
                      View Result
                    </button>
                  </td>
                </tr>
              ))}

              {!history.length && (
                <tr>
                  <td colSpan="8">No cron history found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {selectedRun && (
        <div
          className="admin-modal-backdrop"
          onClick={() => setSelectedRun(null)}
        >
          <div
            className="admin-document-modal"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="section-header">
              <div>
                <h3>Cron Run #{selectedRun.id}</h3>
                <p>{jobLabel(selectedRun.jobType)}</p>
              </div>

              <button className="btn" onClick={() => setSelectedRun(null)}>
                Close
              </button>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <span>Status</span>
                <strong>{selectedRun.status}</strong>
              </div>

              <div className="stat-card">
                <span>Affected Count</span>
                <strong>{selectedRun.affectedCount}</strong>
              </div>

              <div className="stat-card">
                <span>Started</span>
                <strong>{formatDateTime(selectedRun.startedAt)}</strong>
              </div>

              <div className="stat-card">
                <span>Finished</span>
                <strong>{formatDateTime(selectedRun.finishedAt)}</strong>
              </div>
            </div>

            {selectedRun.error && (
              <div className="alert danger">{selectedRun.error}</div>
            )}

            <pre
              style={{
                background: "#0f172a",
                color: "white",
                padding: 16,
                borderRadius: 12,
                overflow: "auto",
                maxHeight: 420,
              }}
            >
              {JSON.stringify(selectedRun.result || {}, null, 2)}
            </pre>
          </div>
        </div>
      )}
    </div>
  );
}