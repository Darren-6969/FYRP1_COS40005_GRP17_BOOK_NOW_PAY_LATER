import { useEffect, useState } from "react";
import {
  createOperator,
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

export default function Operators() {
  const [operators, setOperators] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [showForm, setShowForm] = useState(false);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

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

      await createOperator(form);

      setForm(initialForm);
      setShowForm(false);
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

    await updateOperatorStatus(op.id, nextStatus);
    await load();
  };

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Operator Accounts</h3>
            <p>Create and manage seller/operator accounts.</p>
          </div>

          <button className="btn primary" onClick={() => setShowForm((prev) => !prev)}>
            {showForm ? "Close Form" : "Create Operator"}
          </button>
        </div>

        {error && <div className="alert danger">{error}</div>}

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
              <input
                name="phone"
                value={form.phone}
                onChange={handleChange}
              />
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
        {loading ? (
          <div className="empty-state">Loading operators...</div>
        ) : (
          <table className="table">
            <thead>
              <tr>
                <th>Operator Code</th>
                <th>Company</th>
                <th>Email</th>
                <th>Status</th>
                <th>Login Users</th>
                <th>Bookings</th>
                <th>Action</th>
              </tr>
            </thead>

            <tbody>
              {operators.map((op) => (
                <tr key={op.id}>
                  <td>{op.operatorCode}</td>
                  <td>
                    <strong>{op.companyName}</strong>
                    <br />
                    <small>{op.phone || "-"}</small>
                  </td>
                  <td>{op.email}</td>
                  <td>
                    <span className={`badge ${String(op.status).toLowerCase()}`}>
                      {op.status}
                    </span>
                  </td>
                  <td>{op.users?.length || 0}</td>
                  <td>{op.bookings?.length || 0}</td>
                  <td>
                    <button className="btn" onClick={() => toggleStatus(op)}>
                      {op.status === "ACTIVE" ? "Suspend" : "Activate"}
                    </button>
                  </td>
                </tr>
              ))}

              {!operators.length && (
                <tr>
                  <td colSpan="7">No operators found.</td>
                </tr>
              )}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}