import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { operatorService, formatOperatorDateTime, formatOperatorMoney } from "../../services/operator_service";

// "Refunds to send", next to the request queue, so a DuitNow refund the
// operator still owes is not missed. A refund past its deadline carries an
// overdue badge and counts in the operator metrics.
export default function RefundsToSend() {
  const [queue, setQueue] = useState(null);

  useEffect(() => {
    let current = true;
    operatorService
      .getRefundQueue()
      .then((res) => {
        if (current) setQueue(res.data);
      })
      .catch(() => {
        // The bookings list still works without the refund panel.
      });
    return () => {
      current = false;
    };
  }, []);

  if (!queue || !queue.refunds.length) return null;
  const { summary, refunds } = queue;

  return (
    <section className="operator-card" aria-labelledby="refunds-to-send-title">
      <div className="operator-card-head">
        <div>
          <h2 id="refunds-to-send-title">
            Refunds to send ({summary.toSend})
            {summary.overdue > 0 && (
              <span className="operator-status danger" style={{ marginLeft: 8 }}>
                {summary.overdue} overdue
              </span>
            )}
          </h2>
          <p>
            Customers who paid by DuitNow are refunded by you, by the deadline. Open the booking, send the money and
            mark it sent with the transfer reference. Card refunds go out automatically.
          </p>
        </div>
      </div>

      <div className="operator-table-wrap">
        <table className="operator-table">
          <thead>
            <tr>
              <th>Booking</th>
              <th>Customer</th>
              <th>Amount</th>
              <th>Paid back by</th>
              <th>Send by</th>
            </tr>
          </thead>
          <tbody>
            {refunds.slice(0, 8).map((refund) => (
              <tr key={refund.id}>
                <td>
                  <Link to={`/operator/bookings/${refund.bookingId}`}>{refund.bookingCode || refund.bookingId}</Link>
                </td>
                <td>{refund.customerName || "-"}</td>
                <td>{formatOperatorMoney(refund.amount)}</td>
                <td>{refund.method === "STRIPE" ? (refund.status === "FAILED" ? "Card (failed, retry)" : "Card") : "DuitNow"}</td>
                <td>
                  {refund.dueAt ? formatOperatorDateTime(refund.dueAt) : "-"}
                  {refund.overdue && <span className="operator-status danger" style={{ marginLeft: 8 }}>Overdue</span>}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
