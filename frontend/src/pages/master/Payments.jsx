import { useEffect, useMemo, useState } from "react";
import { getPayments } from "../../services/admin_service";

function money(value) {
  return new Intl.NumberFormat("en-MY", {
    style: "currency",
    currency: "MYR",
  }).format(Number(value || 0));
}

function dateTime(value) {
  if (!value) return "-";

  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Kuala_Lumpur",
  }).format(new Date(value));
}

function label(value) {
  return String(value || "-").replaceAll("_", " ");
}

function statusClass(status) {
  const value = String(status || "").toUpperCase();

  if (["PAID", "APPROVED"].includes(value)) return "active";
  if (["UNPAID", "PENDING_VERIFICATION", "PENDING"].includes(value)) return "pending";
  if (["OVERDUE", "FAILED", "REJECTED"].includes(value)) return "suspended";

  return "pending";
}

export default function Payments() {
  const [payments, setPayments] = useState([]);
  const [selected, setSelected] = useState(null);

  const [query, setQuery] = useState("");
  const [status, setStatus] = useState("ALL");
  const [method, setMethod] = useState("ALL");
  const [operator, setOperator] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getPayments();
      setPayments(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load payments.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const operators = useMemo(() => {
    const map = new Map();

    payments.forEach((p) => {
      if (p.booking?.operator?.id) {
        map.set(p.booking.operator.id, p.booking.operator.companyName);
      }
    });

    return Array.from(map.entries()).map(([id, name]) => ({ id, name }));
  }, [payments]);

  const filtered = useMemo(() => {
    return payments.filter((payment) => {
      const text = [
        payment.id,
        payment.bookingId,
        payment.booking?.bookingCode,
        payment.booking?.customer?.name,
        payment.booking?.customer?.email,
        payment.booking?.operator?.companyName,
        payment.method,
        payment.transactionId,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery = !query || text.includes(query.toLowerCase());
      const matchesStatus = status === "ALL" || payment.status === status;
      const matchesMethod = method === "ALL" || payment.method === method;
      const matchesOperator =
        operator === "ALL" ||
        String(payment.booking?.operator?.id) === String(operator);

      return matchesQuery && matchesStatus && matchesMethod && matchesOperator;
    });
  }, [payments, query, status, method, operator]);

  const summary = useMemo(() => {
    const paid = payments.filter((p) => p.status === "PAID");
    return {
      total: payments.length,
      paid: paid.length,
      pendingVerification: payments.filter(
        (p) => p.status === "PENDING_VERIFICATION"
      ).length,
      unpaid: payments.filter((p) => p.status === "UNPAID").length,
      overdue: payments.filter((p) => p.status === "OVERDUE").length,
      revenue: paid.reduce((sum, p) => sum + Number(p.amount || 0), 0),
    };
  }, [payments]);

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Payment Monitoring</h3>
            <p>
              Platform-wide payment overview including Stripe and manual
              DuitNow/SPay payments.
            </p>
          </div>

          <button className="btn" onClick={load}>Refresh</button>
        </div>

        {error && <div className="alert danger">{error}</div>}

        <div className="stats-grid">
          <Stat title="Total Payments" value={summary.total} />
          <Stat title="Paid" value={summary.paid} />
          <Stat title="Pending Verification" value={summary.pendingVerification} danger={summary.pendingVerification > 0} />
          <Stat title="Unpaid" value={summary.unpaid} />
          <Stat title="Overdue" value={summary.overdue} danger={summary.overdue > 0} />
          <Stat title="Revenue" value={money(summary.revenue)} />
        </div>
      </section>

      <section className="card">
        <div className="admin-filter-row">
          <input
            placeholder="Search payment, booking, customer, transaction..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <select value={status} onChange={(event) => setStatus(event.target.value)}>
            <option value="ALL">All Status</option>
            <option value="UNPAID">Unpaid</option>
            <option value="PENDING_VERIFICATION">Pending Verification</option>
            <option value="PAID">Paid</option>
            <option value="OVERDUE">Overdue</option>
            <option value="FAILED">Failed</option>
          </select>

          <select value={method} onChange={(event) => setMethod(event.target.value)}>
            <option value="ALL">All Methods</option>
            <option value="STRIPE">Stripe</option>
            <option value="DUITNOW">DuitNow</option>
            <option value="SPAY">SPay</option>
            <option value="BANK_TRANSFER">Bank Transfer</option>
            <option value="PAYPAL">PayPal</option>
            <option value="CASH">Cash</option>
            <option value="PENDING">Pending</option>
          </select>

          <select value={operator} onChange={(event) => setOperator(event.target.value)}>
            <option value="ALL">All Operators</option>
            {operators.map((op) => (
              <option key={op.id} value={op.id}>{op.name}</option>
            ))}
          </select>
        </div>

        {loading ? (
          <div className="empty-state">Loading payments...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Payment</th>
                <th>Booking</th>
                <th>Customer</th>
                <th>Operator</th>
                <th>Method</th>
                <th>Amount</th>
                <th>Status</th>
                <th>Paid At</th>
                <th>Receipt</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {filtered.map((payment) => (
                <tr key={payment.id}>
                  <td>
                    <strong>#{payment.id}</strong>
                    <br />
                    <small>{payment.transactionId || "-"}</small>
                  </td>

                  <td>{payment.booking?.bookingCode || payment.bookingId}</td>
                  <td>
                    {payment.booking?.customer?.name || "-"}
                    <br />
                    <small>{payment.booking?.customer?.email || "-"}</small>
                  </td>
                  <td>{payment.booking?.operator?.companyName || "-"}</td>
                  <td>{payment.method || "-"}</td>
                  <td>{money(payment.amount)}</td>

                  <td>
                    <span className={`badge ${statusClass(payment.status)}`}>
                      {label(payment.status)}
                    </span>
                  </td>

                  <td>{dateTime(payment.paidAt)}</td>

                  <td>
                    {payment.booking?.receipt?.imageUrl ? (
                      <button
                        className="btn"
                        onClick={() => window.open(payment.booking.receipt.imageUrl, "_blank")}
                      >
                        View
                      </button>
                    ) : (
                      "-"
                    )}
                  </td>

                  <td>
                    <button className="btn" onClick={() => setSelected(payment)}>
                      Detail
                    </button>
                  </td>
                </tr>
              ))}

              {!filtered.length && (
                <tr>
                  <td colSpan="10">No payments found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>

      {selected && (
        <div className="admin-modal-backdrop" onClick={() => setSelected(null)}>
          <div className="admin-document-modal" onClick={(e) => e.stopPropagation()}>
            <div className="section-header">
              <div>
                <h3>Payment #{selected.id}</h3>
                <p>{selected.booking?.bookingCode || selected.bookingId}</p>
              </div>
              <button className="btn" onClick={() => setSelected(null)}>Close</button>
            </div>

            <div className="stats-grid">
              <Info title="Customer" value={selected.booking?.customer?.name || "-"} />
              <Info title="Operator" value={selected.booking?.operator?.companyName || "-"} />
              <Info title="Method" value={selected.method || "-"} />
              <Info title="Status" value={label(selected.status)} />
              <Info title="Amount" value={money(selected.amount)} />
              <Info title="Paid At" value={dateTime(selected.paidAt)} />
            </div>

            <table className="table">
              <tbody>
                <tr><td>Transaction ID</td><td>{selected.transactionId || "-"}</td></tr>
                <tr><td>Booking Status</td><td>{label(selected.booking?.status)}</td></tr>
                <tr><td>Invoice</td><td>{selected.booking?.invoice?.invoiceNo || "-"}</td></tr>
                <tr><td>Receipt Status</td><td>{selected.booking?.receipt?.status || "-"}</td></tr>
                <tr><td>Receipt Remarks</td><td>{selected.booking?.receipt?.remarks || "-"}</td></tr>
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ title, value, danger }) {
  return (
    <div className={`stat-card ${danger ? "danger" : ""}`}>
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}

function Info({ title, value }) {
  return (
    <div className="stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}