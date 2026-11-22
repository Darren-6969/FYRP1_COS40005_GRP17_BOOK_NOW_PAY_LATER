import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getCustomers } from "../../services/admin_service";
import styles from "../../assets/styles/master/Customers.module.css";
import CustomerStatusPill from "../../components/system/CustomerStatusPill";
import { formatDate } from "../../components/system/customerFormat";

// Admin Customers page: every customer account, searchable by name, email,
// phone or customer code. A row opens the customer, where an account can be
// deleted on the customer's request. Search, filter and page live in the URL
// so the back button returns to the same list.

const PAGE_SIZE = 20;
const STATUS_OPTIONS = [
  { value: "ALL", label: "All statuses" },
  { value: "ACTIVE", label: "Active" },
  { value: "RESTRICTED", label: "Restricted" },
  { value: "DELETED", label: "Deleted" },
];

export default function Customers() {
  const [params, setParams] = useSearchParams();
  const q = params.get("q") || "";
  const status = params.get("status") || "ALL";
  const page = Math.max(Number(params.get("page")) || 1, 1);

  const [typed, setTyped] = useState(q);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reloadKey, setReloadKey] = useState(0);

  const update = (changes) => {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => {
      if (value === "" || value === null || value === undefined || value === "ALL" || (key === "page" && value === 1)) next.delete(key);
      else next.set(key, String(value));
    });
    setParams(next, { replace: true });
  };

  // Search after the admin stops typing, not on every key.
  useEffect(() => {
    if (typed.trim() === q) return undefined;
    const timer = setTimeout(() => update({ q: typed.trim(), page: 1 }), 350);
    return () => clearTimeout(timer);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [typed]);

  useEffect(() => {
    let current = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLoading(true);
    setError("");
    getCustomers({ q: q || undefined, status, page, pageSize: PAGE_SIZE })
      .then((res) => current && setData(res.data))
      .catch((err) => current && setError(err.response?.data?.message || "Could not load customers."))
      .finally(() => current && setLoading(false));
    return () => {
      current = false;
    };
  }, [q, status, page, reloadKey]);

  const customers = data?.customers || [];
  const total = data?.total || 0;
  const totalPages = Math.max(Math.ceil(total / PAGE_SIZE), 1);
  const counts = data?.counts;
  const filtered = Boolean(q) || status !== "ALL";

  return (
    <div className={styles.page}>
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Customers</h3>
            <p>Every customer account. Open a customer to see their bookings and refunds, or to delete their account when they ask.</p>
          </div>
          <button className="btn" type="button" onClick={() => setReloadKey((k) => k + 1)}>
            Refresh
          </button>
        </div>

        <div className="stats-grid">
          <Stat title="All customers" value={counts?.all} />
          <Stat title="Active" value={counts?.active} />
          <Stat title="Restricted" value={counts?.restricted} />
          <Stat title="Deleted" value={counts?.deleted} />
        </div>
      </section>

      <section className="card">
        <div className={styles.filters}>
          <input
            type="search"
            aria-label="Search customers"
            placeholder="Search name, email, phone or customer code"
            value={typed}
            onChange={(event) => setTyped(event.target.value)}
          />
          <select
            aria-label="Filter by status"
            value={status}
            onChange={(event) => update({ status: event.target.value, page: 1 })}
          >
            {STATUS_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>

        {error && (
          <div className="alert danger" role="alert">
            {error}
          </div>
        )}

        {loading && !data ? (
          <div className="empty-state" aria-live="polite">Loading customers...</div>
        ) : !customers.length ? (
          <div className="empty-state" aria-live="polite">
            {filtered ? "No customers match this search." : "No customers have signed up yet."}
            {filtered && (
              <p className={`${styles.muted} ${styles.emptyHint}`}>
                Check the spelling, search by email or customer code, or{" "}
                <button
                  type="button"
                  className="btn"
                  onClick={() => {
                    setTyped("");
                    update({ q: "", status: "ALL", page: 1 });
                  }}
                >
                  clear the filters
                </button>
              </p>
            )}
          </div>
        ) : (
          <>
            <div className={styles.tableWrap} aria-busy={loading}>
              <table className="table">
                <thead>
                  <tr>
                    <th scope="col">Customer</th>
                    <th scope="col">Email</th>
                    <th scope="col">Phone</th>
                    <th scope="col">Bookings</th>
                    <th scope="col">Status</th>
                    <th scope="col">Joined</th>
                  </tr>
                </thead>
                <tbody>
                  {customers.map((customer) => (
                    <tr key={customer.id}>
                      <td>
                        <Link className={styles.rowLink} to={`/master/customers/${customer.id}`}>
                          {customer.name || "Unnamed customer"}
                        </Link>
                        <div className={styles.code}>{customer.userCode}</div>
                      </td>
                      <td>{customer.email}</td>
                      <td>{customer.phone || <span className={styles.muted}>-</span>}</td>
                      <td>{customer.bookingCount}</td>
                      <td>
                        <CustomerStatusPill customer={customer} />
                      </td>
                      <td>{formatDate(customer.createdAt)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="operator-pagination">
              <span>
                Showing {(page - 1) * PAGE_SIZE + 1}-{Math.min(page * PAGE_SIZE, total)} of {total}
              </span>
              <div className="operator-pagination-actions">
                <button type="button" onClick={() => update({ page: page - 1 })} disabled={page <= 1}>
                  Prev
                </button>
                <span aria-current="page">
                  Page {page} of {totalPages}
                </span>
                <button type="button" onClick={() => update({ page: page + 1 })} disabled={page >= totalPages}>
                  Next
                </button>
              </div>
            </div>
          </>
        )}
      </section>
    </div>
  );
}

function Stat({ title, value }) {
  return (
    <div className="stat-card">
      <span>{title}</span>
      <strong>{value ?? "-"}</strong>
    </div>
  );
}
