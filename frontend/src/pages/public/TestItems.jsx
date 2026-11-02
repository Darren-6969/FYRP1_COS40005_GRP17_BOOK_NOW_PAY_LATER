// TEST-ITEM-MISC: the bookable fixed-price test item.
//
// DELETE THIS FILE when testing is finished, with its route in App.jsx and
// services/test_item_service.js (search for TEST-ITEM-MISC, and see
// backend/TEST_ITEM_MISCELLANEOUS.md). The page is at /test-items.
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { createTestItemBooking, getTestItems } from "../../services/test_item_service";
import { formatMoney } from "../../utils/customerUtils";

export default function TestItems() {
  const navigate = useNavigate();
  const [items, setItems] = useState(null);
  const [error, setError] = useState("");
  const [busyId, setBusyId] = useState(null);

  useEffect(() => {
    let current = true;
    getTestItems()
      .then((res) => {
        if (current) setItems(res.data.items || []);
      })
      .catch((err) => {
        if (current) setError(err.response?.data?.message || "Could not load the test items.");
      });
    return () => {
      current = false;
    };
  }, []);

  const book = async (item) => {
    setBusyId(item.id);
    setError("");
    try {
      const res = await createTestItemBooking(item.id);
      navigate(`/customer/bookings/${res.data.id}`);
    } catch (err) {
      setError(err.response?.data?.message || "This item could not be booked.");
      setBusyId(null);
    }
  };

  return (
    <div className="customer-page">
      <p className="customer-eyebrow">Test items</p>
      <h1>Fixed-price test items</h1>
      <p className="customer-muted">
        For testing only. Booking one sends a request to the operator. Once they accept it, you pay by card or DuitNow,
        and can cancel and be refunded like any booking.
      </p>

      {error && <div className="customer-alert customer-alert-danger">{error}</div>}
      {!items && !error && <p className="customer-muted">Loading...</p>}
      {items && items.length === 0 && (
        <div className="customer-alert">No test item is published yet.</div>
      )}

      <div style={{ display: "grid", gap: 16, gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", marginTop: 16 }}>
        {(items || []).map((item) => (
          <article key={item.id} className="customer-glass-card" style={{ display: "grid", gap: 10 }}>
            {item.imageUrl && (
              <img
                src={item.imageUrl}
                alt={item.name}
                style={{ width: "100%", height: 180, objectFit: "cover", borderRadius: 12 }}
              />
            )}
            <h2 style={{ margin: 0 }}>{item.name}</h2>
            {item.operatorName && <p className="customer-muted" style={{ margin: 0 }}>{item.operatorName}</p>}
            {item.description && <p style={{ margin: 0 }}>{item.description}</p>}
            <strong style={{ fontSize: 20 }}>{formatMoney(item.price)}</strong>
            <button
              type="button"
              className="customer-primary-btn"
              disabled={busyId !== null}
              onClick={() => book(item)}
            >
              {busyId === item.id ? "Booking..." : "Book this item"}
            </button>
          </article>
        ))}
      </div>
    </div>
  );
}
