import { useEffect, useState } from "react";
import {
  getBookings,
  acceptBooking,
  rejectBooking,
} from "../../services/booking_service";

export default function Bookings() {
  const [bookings, setBookings] = useState([]);
  const [search, setSearch] = useState("");

  const loadBookings = async () => {
    const res = await getBookings();
    setBookings(res.data);
  };

  useEffect(() => {
    loadBookings();
  }, []);

  const filtered = bookings.filter((b) =>
    `${b.id} ${b.customer?.name || ""} ${b.serviceName || ""}`
      .toLowerCase()
      .includes(search.toLowerCase())
  );

  const handleAccept = async (id) => {
    await acceptBooking(id);
    loadBookings();
  };

  const handleReject = async (id) => {
    await rejectBooking(id);
    loadBookings();
  };

  return (
    <section className="card">
      <div className="section-head">
        <h3>Booking Log</h3>
        <input
          className="input"
          placeholder="Search booking/customer..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
      </div>

      <table className="table">
        <thead>
          <tr>
            <th>Booking ID</th>
            <th>Customer</th>
            <th>Service</th>
            <th>Date</th>
            <th>Deadline</th>
            <th>Amount</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>

        <tbody>
          {filtered.map((b) => (
            <tr key={b.id}>
              <td>{b.id}</td>
              <td>{b.customer?.name || "-"}</td>
              <td>{b.serviceName}</td>
              <td>{formatDate(b.bookingDate)}</td>
              <td>{formatDate(b.paymentDeadline)}</td>
              <td>RM {Number(b.totalAmount || 0).toFixed(2)}</td>
              <td><Badge value={b.status} /></td>
              <td>
                {b.status === "PENDING" && (
                  <div className="actions">
                    <button className="btn primary" onClick={() => handleAccept(b.id)}>Accept</button>
                    <button className="btn danger" onClick={() => handleReject(b.id)}>Reject</button>
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

function Badge({ value }) {
  return <span className={`badge ${String(value).toLowerCase()}`}>{value}</span>;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleDateString("en-MY");
}