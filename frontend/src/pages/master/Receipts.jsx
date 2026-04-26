import { useEffect, useState } from "react";
import {
  getReceipts,
  approveReceipt,
  rejectReceipt,
} from "../../services/receipt_service";

export default function Receipts() {
  const [receipts, setReceipts] = useState([]);

  const load = async () => {
    const res = await getReceipts();
    setReceipts(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (id) => {
    await approveReceipt(id);
    load();
  };

  const reject = async (id) => {
    await rejectReceipt(id);
    load();
  };

  return (
    <section className="card">
      <h3>Receipt Verification</h3>

      <table className="table">
        <thead>
          <tr>
            <th>Receipt ID</th>
            <th>Booking</th>
            <th>Preview</th>
            <th>Status</th>
            <th>Uploaded</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {receipts.map((r) => (
            <tr key={r.id}>
              <td>{r.id}</td>
              <td>{r.bookingId}</td>
              <td>
                {r.imageUrl ? (
                  <a href={r.imageUrl} target="_blank">View receipt</a>
                ) : "-"}
              </td>
              <td><span className={`badge ${String(r.status).toLowerCase()}`}>{r.status}</span></td>
              <td>{new Date(r.uploadedAt).toLocaleString("en-MY")}</td>
              <td>
                {r.status === "PENDING" && (
                  <div className="actions">
                    <button className="btn primary" onClick={() => approve(r.id)}>Approve</button>
                    <button className="btn danger" onClick={() => reject(r.id)}>Reject</button>
                  </div>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}