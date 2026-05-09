import { useEffect, useState } from "react";
import {
  CreditCard,
  DollarSign,
  Receipt,
  Wallet,
  Percent,
} from "lucide-react";

const API_BASE = (
  import.meta.env.VITE_API_BASE_URL ||
  import.meta.env.VITE_API_URL ||
  "http://localhost:5000/api"
).replace(/\/$/, "");

function getToken() {
  return (
    localStorage.getItem("bnpl_token") ||
    localStorage.getItem("token") ||
    sessionStorage.getItem("bnpl_token") ||
    sessionStorage.getItem("token")
  );
}

function formatMoney(value) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

function formatDate(value) {
  if (!value) return "-";
  return new Date(value).toLocaleString("en-MY", {
    dateStyle: "medium",
    timeStyle: "short",
  });
}

export default function OperatorSettlements() {
  const [data, setData] = useState({
    summary: null,
    settlements: [],
    platformFeePercent: 10,
  });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  async function loadSettlements() {
    try {
      setLoading(true);
      setError("");

      const token = getToken();

      const res = await fetch(`${API_BASE}/operators/settlements`, {
        headers: {
          Authorization: `Bearer ${token}`,
        },
      });

      const json = await res.json();

      if (!res.ok) {
        throw new Error(json.message || "Failed to load settlement data");
      }

      setData(json);
    } catch (err) {
      setError(err.message || "Failed to load settlement data");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    loadSettlements();
  }, []);

  const summary = data.summary || {
    totalCustomerPaid: 0,
    totalBnplAdminFee: 0,
    totalStripeFee: 0,
    totalMerchantReceives: 0,
  };

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <p className="operator-eyebrow">Merchant Settlement</p>
          <h1>Payment Breakdown</h1>
          <p>
            View how much customers paid, how much BNPL admin earned, and how
            much the merchant receives from Stripe payments.
          </p>
        </div>

        <span className="operator-model-badge">
          BNPL Fee: {data.platformFeePercent}%
        </span>
      </section>

      {error && <div className="operator-alert danger">{error}</div>}

      <section className="operator-metric-grid four">
        <div className="operator-metric">
          <span>Customer Paid</span>
          <strong>{formatMoney(summary.totalCustomerPaid)}</strong>
          <small>Total Stripe payments</small>
        </div>

        <div className="operator-metric">
          <span>BNPL Admin Fee (10%)</span>
          <strong>{formatMoney(summary.totalBnplAdminFee)}</strong>
          <small>Platform commission</small>
        </div>

        <div className="operator-metric">
          <span>Stripe Fee (3%+RM1)</span>
          <strong>{formatMoney(summary.totalStripeFee)}</strong>
          <small>Processing fee</small>
        </div>

        <div className="operator-metric">
          <span>Merchant Receives</span>
          <strong>{formatMoney(summary.totalMerchantReceives)}</strong>
          <small>Net merchant amount</small>
        </div>
      </section>

      <section className="operator-card">
        <div className="operator-card-head">
          <div>
            <h2>Settlement Details</h2>
            <p>
              Each row is connected to a real paid booking and its Stripe
              transaction ID.
            </p>
          </div>

          <button className="operator-secondary-btn" onClick={loadSettlements}>
            Refresh
          </button>
        </div>

        {loading ? (
          <div className="operator-empty-state">Loading settlement data...</div>
        ) : data.settlements.length === 0 ? (
          <div className="operator-empty-state">
            No paid Stripe bookings found yet.
          </div>
        ) : (
          <div className="operator-table-wrap">
            <table className="operator-table">
              <thead>
                <tr>
                  <th>Booking</th>
                  <th>Customer</th>
                  <th>Customer Paid</th>
                  <th>BNPL Fee</th>
                  <th>Stripe Fee</th>
                  <th>Merchant Receives</th>
                  <th>Transaction</th>
                  <th>Paid At</th>
                </tr>
              </thead>

              <tbody>
                {data.settlements.map((item) => (
                  <tr key={item.bookingId}>
                    <td>
                      <strong>{item.bookingCode}</strong>
                      <small>{item.serviceName}</small>
                    </td>

                    <td>
                      <strong>{item.customerName}</strong>
                      <small>{item.customerEmail || "-"}</small>
                    </td>

                    <td>{formatMoney(item.customerPaid)}</td>

                    <td>
                      <strong>{formatMoney(item.bnplAdminFee)}</strong>
                      <small>{item.platformFeePercent}% platform fee</small>
                    </td>

                    <td>
                      <strong>{formatMoney(item.stripeFee)}</strong>
                      <small>Stripe processing</small>
                    </td>

                    <td>
                      <strong>{formatMoney(item.merchantReceives)}</strong>
                      <small>Net amount</small>
                    </td>

                    <td>
                      <small>{item.transactionId || "-"}</small>
                    </td>

                    <td>{formatDate(item.paidAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="operator-card">
        <div className="operator-card-head">
          <div>
            <h2>How this is calculated</h2>
            <p>Formula used for the merchant settlement calculation.</p>
          </div>
        </div>

        <div className="operator-settlement-formula">
          <div>
            <CreditCard size={22} />
            <span>Customer Paid</span>
            <strong>Full booking amount paid through Stripe</strong>
          </div>

          <div>
            <Percent size={22} />
            <span>BNPL Admin Fee</span>
            <strong>Customer Paid × {data.platformFeePercent}%</strong>
          </div>

          <div>
            <Receipt size={22} />
            <span>Stripe Fee</span>
            <strong>Processing fee from Stripe</strong>
          </div>

          <div>
            <Wallet size={22} />
            <span>Merchant Receives</span>
            <strong>Customer Paid - BNPL Fee - Stripe Fee</strong>
          </div>
        </div>
      </section>
    </div>
  );
}