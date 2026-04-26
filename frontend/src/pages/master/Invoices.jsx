import { useEffect, useState } from "react";
import { getInvoices, sendInvoice } from "../../services/invoice_service";

export default function Invoices() {
  const [invoices, setInvoices] = useState([]);

  const load = async () => {
    const res = await getInvoices();
    setInvoices(res.data);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSend = async (id) => {
    await sendInvoice(id);
    load();
  };

  return (
    <section className="card">
      <h3>Invoices</h3>

      <table className="table">
        <thead>
          <tr>
            <th>Invoice No</th>
            <th>Booking</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Issued</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {invoices.map((i) => (
            <tr key={i.id}>
              <td>{i.invoiceNo}</td>
              <td>{i.bookingId}</td>
              <td>RM {Number(i.amount || 0).toFixed(2)}</td>
              <td><span className={`badge ${String(i.status).toLowerCase()}`}>{i.status}</span></td>
              <td>{new Date(i.issuedAt).toLocaleDateString("en-MY")}</td>
              <td>
                <button className="btn primary" onClick={() => handleSend(i.id)}>
                  Send
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}