import { useEffect, useState } from "react";
import {
  getBNPLConfig,
  updateBNPLConfig,
} from "../../services/system_service";

export default function SystemSettings() {
  const [config, setConfig] = useState({
    paymentDeadlineDays: 3,
    allowReceiptUpload: true,
    autoCancelOverdue: true,
  });

  const [loading, setLoading] = useState(false);

  useEffect(() => {
    getBNPLConfig().then((res) => {
      if (res.data) setConfig(res.data);
    });
  }, []);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;

    setConfig((prev) => ({
      ...prev,
      [name]: type === "checkbox" ? checked : Number(value),
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    await updateBNPLConfig(config);

    setLoading(false);
    alert("Settings updated successfully");
  };

  return (
    <section className="card">
      <h3>BNPL System Settings</h3>

      <form onSubmit={handleSubmit} className="settings-form">
        {/* Deadline */}
        <div className="form-group">
          <label>Payment Deadline (Days)</label>
          <input
            type="number"
            name="paymentDeadlineDays"
            value={config.paymentDeadlineDays}
            onChange={handleChange}
            className="input"
            min={1}
          />
        </div>

        {/* Allow receipt upload */}
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="allowReceiptUpload"
              checked={config.allowReceiptUpload}
              onChange={handleChange}
            />
            Allow Receipt Upload
          </label>
        </div>

        {/* Auto cancel */}
        <div className="form-group">
          <label>
            <input
              type="checkbox"
              name="autoCancelOverdue"
              checked={config.autoCancelOverdue}
              onChange={handleChange}
            />
            Auto Cancel Overdue Bookings
          </label>
        </div>

        <button className="btn primary" disabled={loading}>
          {loading ? "Saving..." : "Save Settings"}
        </button>
      </form>
    </section>
  );
}