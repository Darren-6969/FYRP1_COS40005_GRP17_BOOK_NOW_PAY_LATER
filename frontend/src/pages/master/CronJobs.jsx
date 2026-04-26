export default function CronJobs() {
  return (
    <section className="card">
      <h3>Cron Jobs</h3>

      <table className="table">
        <thead>
          <tr>
            <th>Job</th>
            <th>Purpose</th>
            <th>Status</th>
          </tr>
        </thead>

        <tbody>
          <tr>
            <td>Payment Expiry Job</td>
            <td>Marks unpaid bookings as overdue after deadline</td>
            <td><span className="badge active">ACTIVE</span></td>
          </tr>
          <tr>
            <td>Invoice Reminder Job</td>
            <td>Sends reminder email before payment deadline</td>
            <td><span className="badge active">ACTIVE</span></td>
          </tr>
        </tbody>
      </table>
    </section>
  );
}