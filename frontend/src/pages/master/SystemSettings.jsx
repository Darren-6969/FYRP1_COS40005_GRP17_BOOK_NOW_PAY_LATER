import { useEffect, useState } from "react";
import {
  getBNPLConfigs,
  updateBNPLConfig,
} from "../../services/admin_service";

export default function SystemSettings() {
  const [configs, setConfigs] = useState([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [form, setForm] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  const load = async () => {
    setLoading(true);
    const res = await getBNPLConfigs();
    const items = res.data?.configs || [];

    setConfigs(items);

    if (items.length) {
      setSelectedOperatorId(String(items[0].operatorId));
      setForm(items[0]);
    }

    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const handleSelect = (event) => {
    const operatorId = event.target.value;
    const selected = configs.find((item) => String(item.operatorId) === operatorId);

    setSelectedOperatorId(operatorId);
    setForm(selected || null);
    setMessage("");
  };

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;

    setForm((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : value,
    }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!form?.operatorId) return;

    setSaving(true);
    setMessage("");

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
      setMessage(err.response?.data?.message || "Failed to update settings.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <section className="card">Loading settings...</section>;
  }

  return (
    <section className="card">
      <div className="section-header">
        <div>
          <h3>System Settings</h3>
          <p>Configure BNPL behaviour for each operator/host.</p>
        </div>
      </div>

      {message && <div className="alert">{message}</div>}

      <label className="admin-field">
        <span>Operator / Host</span>
        <select value={selectedOperatorId} onChange={handleSelect}>
          {configs.map((config) => (
            <option key={config.operatorId} value={config.operatorId}>
              {config.operator?.companyName || `Operator ${config.operatorId}`}
            </option>
          ))}
        </select>
      </label>

      {form && (
        <form className="admin-form-grid" onSubmit={handleSubmit}>
          <label>
            <span>Payment Deadline Days</span>
            <input
              type="number"
              min="1"
              name="paymentDeadlineDays"
              value={form.paymentDeadlineDays || 3}
              onChange={handleChange}
            />
          </label>

          <label>
            <span>Invoice Logo URL</span>
            <input
              name="invoiceLogoUrl"
              value={form.invoiceLogoUrl || ""}
              onChange={handleChange}
              placeholder="https://..."
            />
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
              placeholder="DuitNow/SPay payment instructions"
            />
          </label>

          <label className="admin-checkbox">
            <input
              type="checkbox"
              name="allowReceiptUpload"
              checked={Boolean(form.allowReceiptUpload)}
              onChange={handleChange}
            />
            <span>Allow manual receipt upload</span>
          </label>

          <label className="admin-checkbox">
            <input
              type="checkbox"
              name="autoCancelOverdue"
              checked={Boolean(form.autoCancelOverdue)}
              onChange={handleChange}
            />
            <span>Auto-mark unpaid bookings as overdue</span>
          </label>

          <div className="admin-form-actions">
            <button className="btn primary" disabled={saving}>
              {saving ? "Saving..." : "Save Settings"}
            </button>
          </div>
        </form>
      )}
    </section>
  );
}