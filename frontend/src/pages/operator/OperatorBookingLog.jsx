import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  operatorService,
  formatOperatorMoney,
  formatOperatorDateTime,
  operatorStatusClass,
  operatorStatusLabel,
} from "../../services/operator_service";

export default function OperatorBookingLog() {
  const [bookings, setBookings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadBookings = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await operatorService.getBookings();

      setBookings(res.data.bookings || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load booking log");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadBookings();
  }, []);

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <h1>Booking Log / History</h1>
          <p>Complete record of booking status, payment progress, and transaction history.</p>
        </div>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={loadBookings}>Retry</button>
        </div>
      )}

      <section className="operator-card">
        {loading ? (
          <div className="operator-empty-state">Loading booking log...</div>
        ) : (
          <div className="operator-table-wrap">
            <table className="operator-table">
              <thead>
                <tr>
                  <th>Booking ID</th>
                  <th>Customer</th>
                  <th>Service</th>
                  <th>Pick-up / Check-in</th>
                  <th>Return / Check-out</th>
                  <th>Amount</th>
                  <th>Payment Status</th>
                  <th>Booking Status</th>
                  <th>Action</th>
                </tr>
              </thead>

              <tbody>
                {bookings.map((booking) => (
                  <tr key={booking.id}>
                    <td>{booking.id}</td>
                    <td>{booking.customer?.name || "-"}</td>
                    <td>{booking.serviceName}</td>
                    <td>{formatOperatorDateTime(booking.pickupDate)}</td>
                    <td>{formatOperatorDateTime(booking.returnDate)}</td>
                    <td>{formatOperatorMoney(booking.totalAmount)}</td>
                    <td>
                      <span className={`operator-status ${operatorStatusClass(booking.payment?.status)}`}>
                        {operatorStatusLabel(booking.payment?.status || "UNPAID")}
                      </span>
                    </td>
                    <td>
                      <span className={`operator-status ${operatorStatusClass(booking.status)}`}>
                        {operatorStatusLabel(booking.status)}
                      </span>
                    </td>
                    <td>
                      <Link to={`/operator/bookings/${booking.id}`}>View</Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>

            {!bookings.length && (
              <div className="operator-empty-state">
                No booking history found from backend.
              </div>
            )}
          </div>
        )}
      </section>
    </div>
  );
}