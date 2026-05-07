import { useEffect, useMemo, useState } from "react";
import {
  createOperator,
  deleteOperator,
  getOperators,
  updateOperatorStatus,
} from "../../services/admin_service";

const initialForm = {
  companyName: "",
  operatorName: "",
  email: "",
  phone: "",
  logoUrl: "",
  password: "Password123!",
  sendWelcomeEmail: true,
};

function countByBookingStatus(bookings = [], status) {
  return bookings.filter(
    (booking) => String(booking.status || "").toUpperCase() === status
  ).length;
}

function countPendingVerification(bookings = []) {
  return bookings.filter(
    (booking) =>
      String(booking.payment?.status || "").toUpperCase() ===
      "PENDING_VERIFICATION"
  ).length;
}

function countPaidBookings(bookings = []) {
  return bookings.filter((booking) => {
    const bookingStatus = String(booking.status || "").toUpperCase();
    const paymentStatus = String(booking.payment?.status || "").toUpperCase();

    return bookingStatus === "PAID" || paymentStatus === "PAID";
  }).length;
}

function readinessLabel(op) {
  const hasConfig = Array.isArray(op.configs) && op.configs.length > 0;
  const hasLoginUser = Array.isArray(op.users) && op.users.length > 0;
  const hasStripe = Boolean(op.stripeAccountId);

  if (hasConfig && hasLoginUser && hasStripe) {
    return {
      label: "Ready",
      className: "active",
    };
  }

  if (hasConfig && hasLoginUser) {
    return {
      label: "Config Ready",
      className: "pending",
    };
  }

  return {
    label: "Incomplete",
    className: "suspended",
  };
}

export default function Operators() {
  const [operators, setOperators] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [showForm, setShowForm] = useState(false);

  const [query, setQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("ALL");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getOperators();
      setOperators(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load operators");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const summary = useMemo(() => {
    return {
      total: operators.length,
      active: operators.filter((op) => op.status === "ACTIVE").length,
      suspended: operators.filter((op) => op.status === "SUSPENDED").length,
      incomplete: operators.filter(
        (op) => readinessLabel(op).label === "Incomplete"
      ).length,
    };
  }, [operators]);

  const filteredOperators = useMemo(() => {
    return operators.filter((op) => {
      const text = [
        op.operatorCode,
        op.companyName,
        op.email,
        op.phone,
        ...(op.users || []).map((user) => user.email),
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      const matchesQuery = !query || text.includes(query.toLowerCase());
      const matchesStatus =
        statusFilter === "ALL" || op.status === statusFilter;

      return matchesQuery && matchesStatus;
    });
  }, [operators, query, statusFilter]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleCreate = async (event) => {
    event.preventDefault();

    try {
      setSaving(true);
      setError("");
      setMessage("");

      await createOperator(form);

      setForm(initialForm);
      setShowForm(false);
      setMessage("Operator company and login account created successfully.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to create operator");
    } finally {
      setSaving(false);
    }
  };

  const toggleStatus = async (op) => {
    const nextStatus = op.status === "ACTIVE" ? "SUSPENDED" : "ACTIVE";

    if (!window.confirm(`Change ${op.companyName} to ${nextStatus}?`)) return;

    try {
      setError("");
      setMessage("");
      await updateOperatorStatus(op.id, nextStatus);
      setMessage(`${op.companyName} updated to ${nextStatus}.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update operator status");
    }
  };

  const handleDelete = async (op) => {
    const bookingCount = op.bookings?.length || 0;

    if (bookingCount > 0) {
      alert(
        `${op.companyName} has ${bookingCount} booking(s). It cannot be deleted because booking/payment/invoice history must be preserved. Suspend this operator instead.`
      );
      return;
    }

    const confirmText = `DELETE ${op.companyName}`;

    const typed = window.prompt(
      `This will permanently delete the operator company, its operator login users, BNPL config, and pending host intents.\n\nType exactly: ${confirmText}`
    );

    if (typed !== confirmText) {
      return;
    }

    try {
      setError("");
      setMessage("");
      await deleteOperator(op.id);
      setMessage(`${op.companyName} was deleted successfully.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to delete operator");
    }
  };

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Operator Accounts</h3>
            <p>
              Create, monitor, suspend, activate, or delete wrongly created
              operator companies.
            </p>
          </div>

          <button
            className="btn primary"
            onClick={() => setShowForm((prev) => !prev)}
          >
            {showForm ? "Close Form" : "Create Operator"}
          </button>
        </div>

        {error && <div className="alert danger">{error}</div>}
        {message && <div className="alert">{message}</div>}

        <div className="stats-grid">
          <div className="stat-card">
            <span>Total Operators</span>
            <strong>{summary.total}</strong>
          </div>

          <div className="stat-card">
            <span>Active</span>
            <strong>{summary.active}</strong>
          </div>

          <div className="stat-card">
            <span>Suspended</span>
            <strong>{summary.suspended}</strong>
          </div>

          <div className="stat-card">
            <span>Incomplete Setup</span>
            <strong>{summary.incomplete}</strong>
          </div>
        </div>

        {showForm && (
          <form className="admin-form-grid" onSubmit={handleCreate}>
            <label>
              <span>Company Name</span>
              <input
                name="companyName"
                value={form.companyName}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              <span>Operator Name</span>
              <input
                name="operatorName"
                value={form.operatorName}
                onChange={handleChange}
                placeholder="Person in charge"
              />
            </label>

            <label>
              <span>Login Email</span>
              <input
                type="email"
                name="email"
                value={form.email}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              <span>Temporary Password</span>
              <input
                name="password"
                value={form.password}
                onChange={handleChange}
                required
              />
            </label>

            <label>
              <span>Phone</span>
              <input name="phone" value={form.phone} onChange={handleChange} />
            </label>

            <label>
              <span>Logo URL</span>
              <input
                name="logoUrl"
                value={form.logoUrl}
                onChange={handleChange}
              />
            </label>

            <label className="admin-checkbox">
              <input
                type="checkbox"
                name="sendWelcomeEmail"
                checked={form.sendWelcomeEmail}
                onChange={handleChange}
              />
              <span>Send welcome email with login details</span>
            </label>

            <div className="admin-form-actions">
              <button className="btn primary" disabled={saving}>
                {saving ? "Creating..." : "Create Operator + Login"}
              </button>
            </div>
          </form>
        )}
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Operator List</h3>
            <p>
              Delete is only allowed for wrongly created operators with no
              bookings.
            </p>
          </div>
        </div>

        <div className="admin-filter-row">
          <input
            placeholder="Search operator code, company, email, user..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <select
            value={statusFilter}
            onChange={(event) => setStatusFilter(event.target.value)}
          >
            <option value="ALL">All Status</option>
            <option value="ACTIVE">Active</option>
            <option value="SUSPENDED">Suspended</option>
            <option value="PENDING">Pending</option>
          </select>
        </div>

        {loading ? (
          <div className="empty-state">Loading operators...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Operator</th>
                <th>Company</th>
                <th>Status</th>
                <th>Readiness</th>
                <th>Login Users</th>
                <th>Bookings</th>
                <th>Pending Verification</th>
                <th>Overdue</th>
                <th>Paid</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {filteredOperators.map((op) => {
                const readiness = readinessLabel(op);
                const bookings = op.bookings || [];
                const bookingCount = bookings.length;

                return (
                  <tr key={op.id}>
                    <td>
                      <strong>{op.operatorCode}</strong>
                      <br />
                      <small>{op.email}</small>
                    </td>

                    <td>
                      <strong>{op.companyName}</strong>
                      <br />
                      <small>{op.phone || "-"}</small>
                    </td>

                    <td>
                      <span
                        className={`badge ${String(op.status).toLowerCase()}`}
                      >
                        {op.status}
                      </span>
                    </td>

                    <td>
                      <span className={`badge ${readiness.className}`}>
                        {readiness.label}
                      </span>
                      <br />
                      <small>
                        {op.stripeAccountId ? "Stripe linked" : "No Stripe"}
                      </small>
                    </td>

                    <td>{op.users?.length || 0}</td>
                    <td>{bookingCount}</td>
                    <td>{countPendingVerification(bookings)}</td>
                    <td>{countByBookingStatus(bookings, "OVERDUE")}</td>
                    <td>{countPaidBookings(bookings)}</td>

                    <td>
                      <div className="actions">
                        <button className="btn" onClick={() => toggleStatus(op)}>
                          {op.status === "ACTIVE" ? "Suspend" : "Activate"}
                        </button>

                        <button
                          className="btn danger"
                          disabled={bookingCount > 0}
                          title={
                            bookingCount > 0
                              ? "Cannot delete an operator with existing bookings"
                              : "Delete wrongly created operator"
                          }
                          onClick={() => handleDelete(op)}
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}

              {!filteredOperators.length && (
                <tr>
                  <td colSpan="10">No operators found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}