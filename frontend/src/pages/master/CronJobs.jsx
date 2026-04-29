import { useEffect, useState } from "react";
import {
  getCronStatus,
  runOverdueCheck,
} from "../../services/admin_service";

export default function CronJobs() {
  const [status, setStatus] = useState(null);
  const [running, setRunning] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    const res = await getCronStatus();
    setStatus(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleRun = async () => {
    if (!window.confirm("Run overdue booking check now?")) return;

    setRunning(true);
    setMessage("");

    try {
      const res = await runOverdueCheck();
      setMessage(res.data?.message || "Cron job completed.");
      await load();
    } catch (err) {
      setMessage(err.response?.data?.message || "Failed to run cron job.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Cron Jobs</h3>
            <p>Manage automated BNPL background jobs.</p>
          </div>

          <button className="btn primary" disabled={running} onClick={handleRun}>
            {running ? "Running..." : "Run Overdue Check"}
          </button>
        </div>

        {message && <div className="alert">{message}</div>}

        <div className="stats-grid">
          <div className="stat-card">
            <span>Status</span>
            <strong>{status?.cronStarted ? "Active" : "Not Active"}</strong>
          </div>

          <div className="stat-card">
            <span>Schedule</span>
            <strong>{status?.schedule || "-"}</strong>
          </div>

          <div className="stat-card">
            <span>Last Run</span>
            <strong>
              {status?.lastOverdueRun
                ? new Date(status.lastOverdueRun).toLocaleString()
                : "Never"}
            </strong>
          </div>

          <div className="stat-card">
            <span>Last Expired Count</span>
            <strong>{status?.lastOverdueResult?.expiredCount || 0}</strong>
          </div>
        </div>
      </section>

      <section className="card">
        <h3>Last Overdue Result</h3>

        <table className="table">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Customer</th>
              <th>Operator</th>
              <th>Payment Deadline</th>
            </tr>
          </thead>

          <tbody>
            {(status?.lastOverdueResult?.expiredBookings || []).map((booking) => (
              <tr key={booking.id}>
                <td>{booking.bookingCode || booking.id}</td>
                <td>{booking.customerName || "-"}</td>
                <td>{booking.operatorName || "-"}</td>
                <td>
                  {booking.paymentDeadline
                    ? new Date(booking.paymentDeadline).toLocaleString()
                    : "-"}
                </td>
              </tr>
            ))}

            {!status?.lastOverdueResult?.expiredBookings?.length && (
              <tr>
                <td colSpan="4">No overdue result yet.</td>
              </tr>
            )}
          </tbody>
        </table>
      </section>
    </div>
  );
}