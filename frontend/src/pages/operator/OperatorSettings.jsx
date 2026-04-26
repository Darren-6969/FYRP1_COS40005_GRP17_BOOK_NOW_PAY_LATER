import { useEffect, useState } from "react";
import { operatorService } from "../../services/operator_service";

export default function OperatorSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError("");

      const res = await operatorService.getSettings();

      setSettings(res.data);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load settings");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  if (loading) {
    return (
      <div className="operator-page">
        <div className="operator-card">Loading settings...</div>
      </div>
    );
  }

  const user = settings?.user;
  const operator = settings?.operator;
  const config = settings?.config;

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <h1>Operator Profile & Settings</h1>
          <p>Manage operator account, deadline settings, and company profile.</p>
        </div>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
          <button type="button" onClick={loadSettings}>Retry</button>
        </div>
      )}

      <section className="operator-settings-grid">
        <div className="operator-card operator-profile-card">
          <div className="operator-avatar-xl">
            {(user?.name || "O").charAt(0)}
          </div>

          <h2>{user?.name || "Operator"}</h2>
          <p>{user?.role || "NORMAL_SELLER"}</p>

          <div className="operator-profile-info">
            <span>{user?.email || "-"}</span>
            <span>{operator?.companyName || "No company assigned"}</span>
            <span>{operator?.phone || "-"}</span>
          </div>
        </div>

        <Setting title="Payment Deadline">
          {config ? `${config.paymentDeadlineDays} day(s)` : "No config found"}
        </Setting>

        <Setting title="Receipt Upload">
          {config?.allowReceiptUpload ? "Enabled" : "Disabled"}
        </Setting>

        <Setting title="Auto Cancel Overdue">
          {config?.autoCancelOverdue ? "Enabled" : "Disabled"}
        </Setting>

        <Setting title="Company Email">
          {operator?.email || "-"}
        </Setting>

        <Setting title="Company Status">
          {operator?.status || "-"}
        </Setting>
      </section>
    </div>
  );
}

function Setting({ title, children }) {
  return (
    <div className="operator-card operator-setting-card">
      <div>
        <h2>{title}</h2>
        <p>{children}</p>
      </div>
    </div>
  );
}