import { useEffect, useState } from "react";
import { getPayments } from "../../services/payment_service";

export default function Payments() {
  const [payments, setPayments] = useState([]);

  useEffect(() => {
    getPayments().then((res) => setPayments(res.data));
  }, []);

  return (
    <section className="card">
      <h3>Payments</h3>

      <table className="table">
        <thead>
          <tr>
            <th>Payment ID</th>
            <th>Booking</th>
            <th>Method</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Paid At</th>
          </tr>
        </thead>

        <tbody>
          {payments.map((p) => (
            <tr key={p.id}>
              <td>{p.id}</td>
              <td>{p.bookingId}</td>
              <td>{p.method}</td>
              <td>RM {Number(p.amount || 0).toFixed(2)}</td>
              <td><span className={`badge ${String(p.status).toLowerCase()}`}>{p.status}</span></td>
              <td>{p.paidAt ? new Date(p.paidAt).toLocaleString("en-MY") : "-"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}