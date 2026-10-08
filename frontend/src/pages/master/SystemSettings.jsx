import { useEffect, useMemo, useState } from "react";
import {
  getBNPLConfigs,
  updateBNPLConfig,
  getPeakDates,
  createPeakDate,
  deletePeakDate,
  getPlatformDeadlineSettings,
  updatePlatformDeadlineSettings,
  getPlatformSettings,
  updatePlatformSettings,
} from "../../services/admin_service";
import {
  deleteFeatureFlagOverride,
  getManagedFeatureFlags,
  updateFeatureFlag,
} from "../../services/feature_flag_service";

// creditTierPolicy is the E17 switch. Credit tier thresholds, the down payment
// floor and the exposure limits have no effect while it is off.
const DEFAULT_FEATURE_FLAGS = {
  allowReceiptUpload: true,
  automaticOverdueHandling: true,
  creditTierPolicy: false,
};

const FLAG_LABELS = {
  allowReceiptUpload: "Manual receipt upload",
  automaticOverdueHandling: "Automatic overdue processing",
  creditTierPolicy: "Credit tier policy (E17)",
};

const DEFAULT_REMINDER_TIMING = {
  paymentFirstHours: 24,
  paymentFinalHours: 6,
  licenceReminderHours: 24,
};

const SUBSCRIPTION_PLANS = ["FREE", "BASIC", "PREMIUM"];

const DEFAULT_SUBSCRIPTION_TIERS = {
  FREE: { label: "Starter", listingLimit: 5, monthlyPriceRm: 0, termDays: 90 },
  BASIC: { label: "Standard", listingLimit: 10, monthlyPriceRm: 20, termDays: null },
  PREMIUM: { label: "Premium", listingLimit: 20, monthlyPriceRm: null, termDays: null },
};

function tiersToForm(tiers) {
  return Object.fromEntries(
    SUBSCRIPTION_PLANS.map((plan) => {
      const tier = { ...DEFAULT_SUBSCRIPTION_TIERS[plan], ...(tiers?.[plan] || {}) };
      return [plan, {
        label: tier.label,
        listingLimit: String(tier.listingLimit),
        monthlyPriceRm: tier.monthlyPriceRm == null ? "" : String(tier.monthlyPriceRm),
        termDays: tier.termDays == null ? "" : String(tier.termDays),
      }];
    })
  );
}

function tiersFromForm(form) {
  return Object.fromEntries(
    SUBSCRIPTION_PLANS.map((plan) => [plan, {
      label: form[plan].label,
      listingLimit: Number(form[plan].listingLimit),
      monthlyPriceRm: form[plan].monthlyPriceRm === "" ? null : Number(form[plan].monthlyPriceRm),
      termDays: form[plan].termDays === "" ? null : Number(form[plan].termDays),
    }])
  );
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
  const [peakDates, setPeakDates] = useState([]);
  const [peakForm, setPeakForm] = useState({ date: "", label: "" });
  const [deadlinePolicy, setDeadlinePolicy] = useState({ publishedTiers: [1, 3, 7], mostLenientDays: 7 });
  const [tierInput, setTierInput] = useState("1, 3, 7");
  const [platformForm, setPlatformForm] = useState({
    commissionRate: "10",
    defaultPaymentDeadlineDays: "3",
    licenceReuploadWindowHours: "24",
    creditTierThresholds: "{}",
    exposureLimits: "{}",
    downPaymentFloorPercent: "0",
    reminderTiming: { ...DEFAULT_REMINDER_TIMING },
    subscriptionTiers: tiersToForm(),
    featureFlags: DEFAULT_FEATURE_FLAGS,
  });
  const [flagRows, setFlagRows] = useState([]);
  const [overrideForm, setOverrideForm] = useState({ operatorId: "", key: "creditTierPolicy", enabled: true });

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingPlatform, setSavingPlatform] = useState(false);

  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getBNPLConfigs();
      const peakRes = await getPeakDates();
      const policyRes = await getPlatformDeadlineSettings();
      const platformRes = await getPlatformSettings();
      const flagRes = await getManagedFeatureFlags();
      const items = res.data?.configs || [];
      const settings = platformRes.data;

      setConfigs(items);
      setPeakDates(peakRes.data || []);
      setDeadlinePolicy(policyRes.data);
      setTierInput((policyRes.data?.publishedTiers || []).join(", "));
      setFlagRows(flagRes.data || []);
      setPlatformForm({
        commissionRate: String(settings.commissionRate ?? 10),
        defaultPaymentDeadlineDays: String(settings.defaultPaymentDeadlineDays ?? 3),
        licenceReuploadWindowHours: String(settings.licenceReuploadWindowHours ?? 24),
        creditTierThresholds: JSON.stringify(settings.creditTierThresholds || {}, null, 2),
        exposureLimits: JSON.stringify(settings.exposureLimits || {}, null, 2),
        downPaymentFloorPercent: String(settings.downPaymentFloorPercent ?? 0),
        reminderTiming: { ...DEFAULT_REMINDER_TIMING, ...(settings.reminderTiming || {}) },
        subscriptionTiers: tiersToForm(settings.subscriptionTiers),
        featureFlags: { ...DEFAULT_FEATURE_FLAGS, ...(settings.featureFlags || {}) },
      });

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

  const addPeakDate = async (event) => {
    event.preventDefault();
    try {
      await createPeakDate(peakForm);
      setPeakForm({ date: "", label: "" });
      setMessage("Peak date added.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to add peak date.");
    }
  };

  const removePeakDate = async (id) => {
    try {
      await deletePeakDate(id);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove peak date.");
    }
  };

  const saveDeadlinePolicy = async (event) => {
    event.preventDefault();
    const publishedTiers = [...new Set(tierInput.split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0))].sort((a, b) => a - b);
    const mostLenientDays = Number(deadlinePolicy.mostLenientDays);
    if (!publishedTiers.length || publishedTiers[publishedTiers.length - 1] !== mostLenientDays) {
      setError("The most lenient value must be the largest published tier.");
      return;
    }
    try {
      await updatePlatformDeadlineSettings({ publishedTiers, mostLenientDays });
      setMessage("Platform deadline tiers published.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update platform deadline tiers.");
    }
  };

  const handlePlatformChange = (event) => {
    const { name, value } = event.target;
    setPlatformForm((prev) => ({ ...prev, [name]: value }));
  };

  const handleReminderChange = (event) => {
    const { name, value } = event.target;
    setPlatformForm((prev) => ({ ...prev, reminderTiming: { ...prev.reminderTiming, [name]: value } }));
  };

  const handleTierChange = (plan, field, value) => {
    setPlatformForm((prev) => ({
      ...prev,
      subscriptionTiers: {
        ...prev.subscriptionTiers,
        [plan]: { ...prev.subscriptionTiers[plan], [field]: value },
      },
    }));
  };

  const saveOperatorOverride = async (event) => {
    event.preventDefault();
    if (!overrideForm.operatorId) {
      setError("Choose an operator for the override.");
      return;
    }
    setMessage("");
    setError("");
    try {
      await updateFeatureFlag({
        key: overrideForm.key,
        enabled: overrideForm.enabled,
        operatorId: Number(overrideForm.operatorId),
      });
      setMessage("Operator feature override saved.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to save the operator override.");
    }
  };

  const toggleOverride = async (row) => {
    try {
      await updateFeatureFlag({ key: row.key, enabled: !row.enabled, operatorId: row.operatorId });
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to update the override.");
    }
  };

  const removeOverride = async (row) => {
    try {
      await deleteFeatureFlagOverride({ key: row.key, operatorId: row.operatorId });
      setMessage("Override removed. The operator now follows the global value.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to remove the override.");
    }
  };

  const handleGlobalFeatureFlagChange = (event) => {
    const { name, checked } = event.target;
    setPlatformForm((prev) => ({
      ...prev,
      featureFlags: { ...prev.featureFlags, [name]: checked },
    }));
  };

  const savePlatformSettings = async (event) => {
    event.preventDefault();
    setSavingPlatform(true);
    setMessage("");
    setError("");

    try {
      const creditTierThresholds = JSON.parse(platformForm.creditTierThresholds);
      const exposureLimits = JSON.parse(platformForm.exposureLimits);
      if (!creditTierThresholds || typeof creditTierThresholds !== "object" || Array.isArray(creditTierThresholds)) {
        throw new Error("Credit tier thresholds must be a JSON object.");
      }
      if (!exposureLimits || typeof exposureLimits !== "object" || Array.isArray(exposureLimits)) {
        throw new Error("Exposure limits must be a JSON object.");
      }

      await updatePlatformSettings({
        commissionRate: Number(platformForm.commissionRate),
        defaultPaymentDeadlineDays: Number(platformForm.defaultPaymentDeadlineDays),
        licenceReuploadWindowHours: Number(platformForm.licenceReuploadWindowHours),
        creditTierThresholds,
        exposureLimits,
        downPaymentFloorPercent: Number(platformForm.downPaymentFloorPercent),
        reminderTiming: Object.fromEntries(
          Object.entries(platformForm.reminderTiming).map(([key, value]) => [key, Number(value)])
        ),
        subscriptionTiers: tiersFromForm(platformForm.subscriptionTiers),
        featureFlags: platformForm.featureFlags,
      });
      setMessage("Platform rules and feature flags saved.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || err.message || "Failed to update platform settings.");
    } finally {
      setSavingPlatform(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const operatorOverrides = useMemo(() => flagRows.filter((row) => row.operatorId !== null), [flagRows]);

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
            <h3>Platform Rules &amp; Feature Flags</h3>
            <p>Global rules apply platform-wide. Operator-level controls below can further disable supported features for an individual operator.</p>
          </div>
        </div>
        <form className="admin-form-grid" onSubmit={savePlatformSettings}>
          <label>
            <span>Commission rate (%)</span>
            <input name="commissionRate" type="number" min="0" max="100" step="0.01" value={platformForm.commissionRate} onChange={handlePlatformChange} required />
          </label>
          <label>
            <span>Default payment deadline (days)</span>
            <input name="defaultPaymentDeadlineDays" type="number" min="1" value={platformForm.defaultPaymentDeadlineDays} onChange={handlePlatformChange} required />
            <small>Must be one of the published deadline tiers.</small>
          </label>
          <label>
            <span>Licence re-upload window (hours)</span>
            <input name="licenceReuploadWindowHours" type="number" min="1" max="720" value={platformForm.licenceReuploadWindowHours} onChange={handlePlatformChange} required />
            <small>Counted from a rejected licence review. Default 24 hours.</small>
          </label>
          <label>
            <span>First payment reminder (hours before deadline)</span>
            <input name="paymentFirstHours" type="number" min="2" max="168" value={platformForm.reminderTiming.paymentFirstHours} onChange={handleReminderChange} required />
          </label>
          <label>
            <span>Final payment reminder (hours before deadline)</span>
            <input name="paymentFinalHours" type="number" min="1" max="167" value={platformForm.reminderTiming.paymentFinalHours} onChange={handleReminderChange} required />
            <small>Must be closer to the deadline than the first reminder.</small>
          </label>
          <label>
            <span>Licence reminder (hours before obligation is due)</span>
            <input name="licenceReminderHours" type="number" min="1" max="168" value={platformForm.reminderTiming.licenceReminderHours} onChange={handleReminderChange} required />
          </label>

          <div className="wide">
            <h4 style={{ margin: "4px 0 6px", fontSize: 14, color: "#0f172a" }}>
              Credit tier policy settings{" "}
              <span className={`badge ${platformForm.featureFlags.creditTierPolicy ? "success" : ""}`}>
                {platformForm.featureFlags.creditTierPolicy ? "Policy on" : "Policy off: values are saved but not applied"}
              </span>
            </h4>
            <p style={{ margin: 0, fontSize: 13 }}>
              The three settings below take effect only while the credit tier policy switch is on.
            </p>
          </div>
          <label>
            <span>Platform down payment floor (%)</span>
            <input name="downPaymentFloorPercent" type="number" min="0" max="100" step="1" value={platformForm.downPaymentFloorPercent} onChange={handlePlatformChange} required />
            <small>An operator percentage below this is raised to the floor.</small>
          </label>
          <label>
            <span>Credit tier thresholds (JSON object)</span>
            <textarea name="creditTierThresholds" value={platformForm.creditTierThresholds} onChange={handlePlatformChange} rows={4} placeholder={'{"Tier 1": 1000, "Tier 2": 5000}'} />
            <small>Use tier names as keys and the maximum booking exposure in MYR as each value.</small>
          </label>
          <label>
            <span>Exposure limits (JSON object)</span>
            <textarea name="exposureLimits" value={platformForm.exposureLimits} onChange={handlePlatformChange} rows={4} placeholder={'{"Normal": 2, "Caution": 1}'} />
            <small>Maximum unpaid bookings a customer may hold per credit tier. Tiers left out use 2 / 5 / 1 / 0 (Normal / Trusted / Caution / High Risk).</small>
          </label>

          <div className="wide">
            <h4 style={{ margin: "4px 0 10px", fontSize: 14, color: "#0f172a" }}>Subscription tiers</h4>
            <div style={{ overflowX: "auto" }}>
              <table className="table">
                <thead>
                  <tr><th>Plan</th><th>Name</th><th>Listing limit</th><th>Monthly price (RM)</th><th>Term (days)</th></tr>
                </thead>
                <tbody>
                  {SUBSCRIPTION_PLANS.map((plan) => (
                    <tr key={plan}>
                      <td>{plan}</td>
                      <td><input value={platformForm.subscriptionTiers[plan].label} onChange={(event) => handleTierChange(plan, "label", event.target.value)} maxLength={40} required /></td>
                      <td><input type="number" min="0" max="1000" value={platformForm.subscriptionTiers[plan].listingLimit} onChange={(event) => handleTierChange(plan, "listingLimit", event.target.value)} required /></td>
                      <td><input type="number" min="0" step="0.01" value={platformForm.subscriptionTiers[plan].monthlyPriceRm} onChange={(event) => handleTierChange(plan, "monthlyPriceRm", event.target.value)} placeholder="Not confirmed" /></td>
                      <td><input type="number" min="1" value={platformForm.subscriptionTiers[plan].termDays} onChange={(event) => handleTierChange(plan, "termDays", event.target.value)} placeholder="Ongoing" /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            <small>Listing limits apply at the next publish. Operators already above a lowered limit keep their published listings.</small>
          </div>

          <div className="wide">
            <h4 style={{ margin: "4px 0 10px", fontSize: 14, color: "#0f172a" }}>Global feature switches</h4>
            <div className="admin-form-grid" style={{ margin: 0 }}>
              {Object.keys(DEFAULT_FEATURE_FLAGS).map((key) => (
                <label className="admin-checkbox" key={key}>
                  <input type="checkbox" name={key} checked={Boolean(platformForm.featureFlags[key])} onChange={handleGlobalFeatureFlagChange} />
                  <span>{FLAG_LABELS[key]}</span>
                </label>
              ))}
            </div>
          </div>
          <div className="admin-form-actions">
            <button className="btn primary" type="submit" disabled={savingPlatform}>
              {savingPlatform ? "Saving..." : "Save Platform Rules"}
            </button>
          </div>
        </form>
      </section>

      <section className="card">
        <div className="section-header">
          <div>
            <h3>Published Deadline Tiers</h3>
            <p>Operators may select only these payment deadline values. The largest value is the most lenient term allowed.</p>
          </div>
        </div>
        <form className="admin-form-grid" onSubmit={saveDeadlinePolicy}>
          <label><span>Published tiers (days)</span><input value={tierInput} onChange={(event) => setTierInput(event.target.value)} placeholder="1, 3, 7" /></label>
          <label><span>Most lenient selectable value</span><input type="number" min="1" value={deadlinePolicy.mostLenientDays} onChange={(event) => setDeadlinePolicy((prev) => ({ ...prev, mostLenientDays: event.target.value }))} /></label>
          <button className="btn primary" type="submit">Publish tiers</button>
        </form>
      </section>
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Operator Feature Overrides</h3>
            <p>An override replaces the global value for one operator. Remove it to follow the global value again. Every change is written to the audit log.</p>
          </div>
        </div>
        <form className="admin-form-grid" onSubmit={saveOperatorOverride}>
          <label>
            <span>Operator</span>
            <select value={overrideForm.operatorId} onChange={(event) => setOverrideForm((prev) => ({ ...prev, operatorId: event.target.value }))} required>
              <option value="">Select operator</option>
              {configs.map((config) => (
                <option key={config.operatorId} value={config.operatorId}>
                  {config.operator?.companyName || config.operator?.operatorCode || `Operator ${config.operatorId}`}
                </option>
              ))}
            </select>
          </label>
          <label>
            <span>Feature</span>
            <select value={overrideForm.key} onChange={(event) => setOverrideForm((prev) => ({ ...prev, key: event.target.value }))}>
              {Object.keys(DEFAULT_FEATURE_FLAGS).map((key) => <option key={key} value={key}>{FLAG_LABELS[key]}</option>)}
            </select>
          </label>
          <label className="admin-checkbox">
            <input type="checkbox" checked={overrideForm.enabled} onChange={(event) => setOverrideForm((prev) => ({ ...prev, enabled: event.target.checked }))} />
            <span>Enabled for this operator</span>
          </label>
          <button className="btn primary" type="submit">Save override</button>
        </form>
        {operatorOverrides.length === 0 ? (
          <p>No operator overrides are set.</p>
        ) : (
          <div style={{ overflowX: "auto" }}>
            <table className="table">
              <thead><tr><th>Operator</th><th>Feature</th><th>Value</th><th /></tr></thead>
              <tbody>
                {operatorOverrides.map((row) => (
                  <tr key={row.id}>
                    <td>{row.operator?.companyName || row.operator?.operatorCode || row.operatorId}</td>
                    <td>{FLAG_LABELS[row.key] || row.key}</td>
                    <td>{row.enabled ? "Enabled" : "Disabled"}</td>
                    <td className="actions">
                      <button className="btn" type="button" onClick={() => toggleOverride(row)}>{row.enabled ? "Disable" : "Enable"}</button>
                      <button className="btn danger" type="button" onClick={() => removeOverride(row)}>Remove</button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
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
        <div className="section-header">
          <div>
            <h3>Peak Calendar</h3>
            <p>Platform-maintained dates when operators cannot elect the partial refund rule.</p>
          </div>
        </div>
        <form className="admin-form-grid" onSubmit={addPeakDate}>
          <label><span>Date</span><input type="date" value={peakForm.date} onChange={(event) => setPeakForm((prev) => ({ ...prev, date: event.target.value }))} required /></label>
          <label><span>Label</span><input value={peakForm.label} onChange={(event) => setPeakForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="Public holiday" required /></label>
          <button className="btn primary" type="submit">Add peak date</button>
        </form>
        {peakDates.length === 0 ? <p>No platform peak dates configured.</p> : (
          <div className="list-row">
            <div>{peakDates.map((date) => <p key={date.id}><strong>{String(date.peakDate).slice(0, 10)}</strong> · {date.label}</p>)}</div>
            <div className="actions">{peakDates.map((date) => <button className="btn danger" type="button" key={date.id} onClick={() => removePeakDate(date.id)}>Remove {String(date.peakDate).slice(0, 10)}</button>)}</div>
          </div>
        )}
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
                <span>Per-operator feature flag: manual receipt upload</span>
            </label>

            <label className="admin-checkbox">
              <input
                type="checkbox"
                name="autoCancelOverdue"
                checked={Boolean(form.autoCancelOverdue)}
                onChange={handleChange}
              />
                <span>Per-operator feature flag: automatic overdue processing</span>
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