import { useEffect, useMemo, useState } from "react";
import {
  getBNPLConfigs,
  updateBNPLConfig,
} from "../../services/admin_service";

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

function validateUrl(value) {
  if (!value) return true;

  try {
    const url = new URL(value);
    return ["http:", "https:"].includes(url.protocol);
  } catch {
    return false;
  }
}

export default function SystemSettings() {
  const [configs, setConfigs] = useState([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [form, setForm] = useState(null);

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getBNPLConfigs();
      const items = res.data?.configs || [];

      setConfigs(items);

      if (items.length && !selectedOperatorId) {
        setSelectedOperatorId(String(items[0].operatorId));
        setForm(items[0]);
      } else if (items.length && selectedOperatorId) {
        const selected = items.find(
          (item) => String(item.operatorId) === String(selectedOperatorId)
        );
        setForm(selected || items[0]);
      }
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const filteredConfigs = useMemo(() => {
    return configs.filter((config) => {
      const text = [
        config.operator?.companyName,
        config.operator?.operatorCode,
        config.operator?.email,
      ]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

      return !query || text.includes(query.toLowerCase());
    });
  }, [configs, query]);

  const handleSelect = (operatorId) => {
    const selected = configs.find(
      (item) => String(item.operatorId) === String(operatorId)
    );

    setSelectedOperatorId(String(operatorId));
    setForm(selected || null);
    setMessage("");
    setError("");
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const validateForm = () => {
    const deadlineDays = Number(form.paymentDeadlineDays);

    if (!Number.isInteger(deadlineDays) || deadlineDays < 1) {
      return "Payment deadline days must be at least 1.";
    }

    if (form.allowReceiptUpload && !String(form.manualPaymentNote || "").trim()) {
      return "Manual payment note is required when receipt upload is enabled.";
    }

    if (!validateUrl(form.invoiceLogoUrl || "")) {
      return "Invoice logo URL must be a valid http/https URL.";
    }

    return "";
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form?.operatorId) return;

    const validationError = validateForm();

    if (validationError) {
      setError(validationError);
      return;
    }

    setSaving(true);
    setMessage("");
    setError("");

    try {
      const payload = {
        paymentDeadlineDays: Number(form.paymentDeadlineDays),
        allowReceiptUpload: Boolean(form.allowReceiptUpload),
        autoCancelOverdue: Boolean(form.autoCancelOverdue),
        invoiceLogoUrl: form.invoiceLogoUrl || "",
        invoiceFooterText: form.invoiceFooterText || "",
        manualPaymentNote: form.manualPaymentNote || "",
      };

      await updateBNPLConfig(form.operatorId, payload);

      setMessage("BNPL settings updated successfully.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <section className="card">Loading settings...</section>;
  }

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>System Settings</h3>
            <p>
              Configure BNPL rules per operator, including payment deadline,
              manual receipt upload, invoice branding, and overdue automation.
            </p>
          </div>

          <button className="btn" onClick={load}>Refresh</button>
        </div>

        {message && <div className="alert">{message}</div>}
        {error && <div className="alert danger">{error}</div>}

        <div className="stats-grid">
          <Stat title="Configured Operators" value={configs.length} />
          <Stat title="Receipt Upload Enabled" value={configs.filter((c) => c.allowReceiptUpload).length} />
          <Stat title="Auto Overdue Enabled" value={configs.filter((c) => c.autoCancelOverdue).length} />
          <Stat title="Average Deadline Days" value={averageDeadline(configs)} />
        </div>
      </section>

      <section className="card">
        <div className="admin-filter-row">
          <input
            placeholder="Search operator code, company, email..."
            value={query}
            onChange={(event) => setQuery(event.target.value)}
          />

          <select
            value={selectedOperatorId}
            onChange={(event) => handleSelect(event.target.value)}
          >
            {filteredConfigs.map((config) => (
              <option key={config.operatorId} value={config.operatorId}>
                {config.operator?.companyName || `Operator ${config.operatorId}`}
              </option>
            ))}
          </select>
        </div>

        {!form ? (
          <div className="empty-state">No BNPL config found.</div>
        ) : (
          <form className="admin-form-grid" onSubmit={handleSubmit}>
            {/* ── Operator identity ───────────────────────── */}
            <label>
              <span>Operator</span>
              <input
                value={`${form.operator?.companyName || "-"} (${form.operator?.operatorCode || "-"})`}
                disabled
              />
            </label>

            <label>
              <span>Operator Email</span>
              <input value={form.operator?.email || "-"} disabled />
            </label>

            {/* ── BNPL System Rules ───────────────────────── */}
            <div className="wide" style={{ marginTop: 8 }}>
              <h4 style={{ margin: "0 0 4px", fontSize: 14, color: "#0f172a" }}>
                BNPL System Rules
              </h4>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6b7280" }}>
                Core platform rules that govern booking and payment behaviour for this operator.
              </p>
            </div>

            <label>
              <span>Payment Deadline Days</span>
              <input
                type="number"
                min="1"
                name="paymentDeadlineDays"
                value={form.paymentDeadlineDays || 3}
                onChange={handleChange}
              />
              <small>
                Days after booking acceptance before the payment deadline is reached.
              </small>
            </label>

            <label className="admin-checkbox">
              <input
                type="checkbox"
                name="allowReceiptUpload"
                checked={Boolean(form.allowReceiptUpload)}
                onChange={handleChange}
              />
              <span>Allow manual DuitNow / SPay receipt upload</span>
            </label>

            <label className="admin-checkbox">
              <input
                type="checkbox"
                name="autoCancelOverdue"
                checked={Boolean(form.autoCancelOverdue)}
                onChange={handleChange}
              />
              <span>Auto-mark unpaid bookings as overdue after deadline</span>
            </label>

            {/* ── Email & Invoice Branding ─────────────────── */}
            <div className="wide" style={{ marginTop: 16 }}>
              <h4 style={{ margin: "0 0 4px", fontSize: 14, color: "#0f172a" }}>
                Email &amp; Invoice Branding
              </h4>
              <p style={{ margin: "0 0 12px", fontSize: 13, color: "#6b7280" }}>
                These branding fields are also configurable by each operator through their own
                portal settings. Edits here act as an admin override — the operator can still
                update them from their side.
              </p>
            </div>

            <label>
              <span>Invoice Logo URL</span>
              <input
                name="invoiceLogoUrl"
                value={form.invoiceLogoUrl || ""}
                onChange={handleChange}
                placeholder="https://..."
              />
              <small>Appears on invoices sent to customers.</small>
            </label>

            <label className="wide">
              <span>Invoice Footer Text</span>
              <textarea
                name="invoiceFooterText"
                value={form.invoiceFooterText || ""}
                onChange={handleChange}
                placeholder="Thank you for your booking."
              />
            </label>

            <label className="wide">
              <span>Manual Payment Note</span>
              <textarea
                name="manualPaymentNote"
                value={form.manualPaymentNote || ""}
                onChange={handleChange}
                placeholder="DuitNow/SPay payment instructions shown to customers"
              />
              <small>
                Required when manual receipt upload is enabled. Operators typically set this
                themselves to include their own bank/QR details.
              </small>
            </label>

            {/* ── System-managed behaviour ─────────────────── */}
            <div className="wide" style={{ marginTop: 16 }}>
              <h4 style={{ margin: "0 0 8px", fontSize: 14, color: "#0f172a" }}>
                System-Managed Behaviour
              </h4>
              <table className="table">
                <tbody>
                  <tr>
                    <td>Payment reminder emails</td>
                    <td>Sent by cron at 24 h and 6 h before deadline</td>
                  </tr>
                  <tr>
                    <td>No merchant response</td>
                    <td>Booking auto-rejected after configured response window</td>
                  </tr>
                  <tr>
                    <td>Overdue check</td>
                    <td>Unpaid bookings marked overdue after payment deadline</td>
                  </tr>
                  <tr>
                    <td>Auto completion</td>
                    <td>Paid bookings marked completed after service end date</td>
                  </tr>
                  <tr>
                    <td>Last updated</td>
                    <td>{dateTime(form.updatedAt)}</td>
                  </tr>
                </tbody>
              </table>
            </div>

            <div className="admin-form-actions">
              <button className="btn primary" disabled={saving}>
                {saving ? "Saving..." : "Save Settings"}
              </button>
            </div>
          </form>
        )}
      </section>
    </div>
  );
}

function averageDeadline(configs) {
  if (!configs.length) return "-";

  const total = configs.reduce(
    (sum, config) => sum + Number(config.paymentDeadlineDays || 0),
    0
  );

  return Math.round((total / configs.length) * 10) / 10;
}

function Stat({ title, value }) {
  return (
    <div className="stat-card">
      <span>{title}</span>
      <strong>{value}</strong>
    </div>
  );
}