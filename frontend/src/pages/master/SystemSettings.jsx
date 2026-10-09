import { useEffect, useMemo, useRef, useState } from "react";
import {
  Bell,
  Building2,
  CalendarDays,
  Clock,
  Gauge,
  Layers,
  Percent,
  RefreshCw,
  Save,
  Trash2,
  ToggleRight,
} from "lucide-react";
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
import {
  FormField,
  SettingsDrawer,
  SettingsMenuCard,
  SettingsSection,
  ToggleField,
} from "../../components/system/SettingsParts";

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

const FLAG_HELPERS = {
  allowReceiptUpload: "Let customers upload DuitNow / SPay receipts for operator verification.",
  automaticOverdueHandling: "Mark unpaid bookings overdue automatically once the payment deadline passes.",
  creditTierPolicy:
    "Turns on credit tier thresholds, the down payment floor and the exposure limits. Off by default.",
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

const SETTINGS_MENU = [
  {
    id: "commission-deadlines",
    title: "Commission & Deadlines",
    description: "Commission rate and the default payment deadline.",
    icon: Percent,
  },
  {
    id: "deadline-tiers",
    title: "Payment Deadline Tiers",
    description: "The deadline options operators may choose from.",
    icon: Clock,
  },
  {
    id: "reminders-licence",
    title: "Reminders & Licence",
    description: "Payment reminder timing and the licence re-upload window.",
    icon: Bell,
  },
  {
    id: "credit-policy",
    title: "Credit Tier Policy",
    description: "Down payment floor, credit thresholds and exposure limits.",
    icon: Gauge,
  },
  {
    id: "subscription-tiers",
    title: "Subscription Tiers",
    description: "Plan names, listing limits, prices and terms.",
    icon: Layers,
  },
  {
    id: "feature-flags",
    title: "Feature Flags",
    description: "Global switches and per-operator overrides.",
    icon: ToggleRight,
  },
  {
    id: "peak-calendar",
    title: "Peak Calendar",
    description: "Dates when operators cannot elect the partial refund rule.",
    icon: CalendarDays,
  },
  {
    id: "operator-bnpl",
    title: "Operator BNPL Settings",
    description: "Payment deadline, receipts and branding for one operator.",
    icon: Building2,
  },
];

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

// A global flag is on when its flag row is on and the settings copy does not
// switch it off. A missing row falls back to the built-in default.
function effectiveGlobalFlags(settings, flagRows) {
  const globalRows = new Map(flagRows.filter((row) => row.operatorId === null).map((row) => [row.key, row.enabled]));
  return Object.fromEntries(
    Object.entries(DEFAULT_FEATURE_FLAGS).map(([key, fallback]) => {
      const rowValue = globalRows.has(key) ? globalRows.get(key) : fallback;
      return [key, rowValue && settings?.featureFlags?.[key] !== false];
    })
  );
}

function settingsToForm(settings, flagRows) {
  return {
    commissionRate: String(settings.commissionRate ?? 10),
    defaultPaymentDeadlineDays: String(settings.defaultPaymentDeadlineDays ?? 3),
    licenceReuploadWindowHours: String(settings.licenceReuploadWindowHours ?? 24),
    creditTierThresholds: JSON.stringify(settings.creditTierThresholds || {}, null, 2),
    exposureLimits: JSON.stringify(settings.exposureLimits || {}, null, 2),
    downPaymentFloorPercent: String(settings.downPaymentFloorPercent ?? 0),
    reminderTiming: { ...DEFAULT_REMINDER_TIMING, ...(settings.reminderTiming || {}) },
    subscriptionTiers: tiersToForm(settings.subscriptionTiers),
    featureFlags: effectiveGlobalFlags(settings, flagRows),
  };
}

const EMPTY_PLATFORM_FORM = settingsToForm({}, []);

export default function SystemSettings() {
  const [configs, setConfigs] = useState([]);
  const [selectedOperatorId, setSelectedOperatorId] = useState("");
  const [form, setForm] = useState(null);
  const [peakDates, setPeakDates] = useState([]);
  const [peakForm, setPeakForm] = useState({ date: "", label: "" });
  const [deadlinePolicy, setDeadlinePolicy] = useState({ publishedTiers: [1, 3, 7], mostLenientDays: 7 });
  const [tierInput, setTierInput] = useState("1, 3, 7");
  const [platformForm, setPlatformForm] = useState(EMPTY_PLATFORM_FORM);
  const [serverSettings, setServerSettings] = useState(null);
  const [flagRows, setFlagRows] = useState([]);
  const [overrideForm, setOverrideForm] = useState({ operatorId: "", key: "creditTierPolicy", enabled: true });

  const [query, setQuery] = useState("");
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [activeSection, setActiveSection] = useState(null);
  const [toast, setToast] = useState(null);
  const toastTimer = useRef(null);

  const notify = (type, text) => {
    clearTimeout(toastTimer.current);
    setToast({ type, text });
    toastTimer.current = setTimeout(() => setToast(null), type === "danger" ? 6000 : 3500);
  };

  useEffect(() => () => clearTimeout(toastTimer.current), []);

  // `silent` refreshes the data without replacing the page with a loading card,
  // so an open settings panel stays on screen after a save.
  const load = async ({ silent = false } = {}) => {
    try {
      if (!silent) setLoading(true);
      setLoadError("");
      const [res, peakRes, policyRes, platformRes, flagRes] = await Promise.all([
        getBNPLConfigs(),
        getPeakDates(),
        getPlatformDeadlineSettings(),
        getPlatformSettings(),
        getManagedFeatureFlags(),
      ]);
      const items = res.data?.configs || [];
      const settings = platformRes.data;
      const flags = flagRes.data || [];

      setConfigs(items);
      setPeakDates(peakRes.data || []);
      setDeadlinePolicy(policyRes.data);
      setTierInput((policyRes.data?.publishedTiers || []).join(", "));
      setServerSettings(settings);
      setFlagRows(flags);
      setPlatformForm(settingsToForm(settings, flags));

      if (items.length) {
        const selected = items.find((item) => String(item.operatorId) === String(selectedOperatorId));
        const next = selected || items[0];
        setSelectedOperatorId(String(next.operatorId));
        setForm(next);
      }
    } catch (err) {
      setLoadError(err.response?.data?.message || "Failed to load settings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
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

  const operatorOverrides = useMemo(() => flagRows.filter((row) => row.operatorId !== null), [flagRows]);

  // ── Actions that save immediately ───────────────────────────────────────────

  const addPeakDate = async (event) => {
    event.preventDefault();
    try {
      await createPeakDate(peakForm);
      setPeakForm({ date: "", label: "" });
      notify("success", "Peak date added.");
      await load({ silent: true });
    } catch (err) {
      notify("danger", err.response?.data?.message || "Failed to add peak date.");
    }
  };

  const removePeakDate = async (id) => {
    try {
      await deletePeakDate(id);
      notify("success", "Peak date removed.");
      await load({ silent: true });
    } catch (err) {
      notify("danger", err.response?.data?.message || "Failed to remove peak date.");
    }
  };

  const saveOperatorOverride = async (event) => {
    event.preventDefault();
    if (!overrideForm.operatorId) {
      notify("danger", "Choose an operator for the override.");
      return;
    }
    try {
      await updateFeatureFlag({
        key: overrideForm.key,
        enabled: overrideForm.enabled,
        operatorId: Number(overrideForm.operatorId),
      });
      notify("success", "Operator feature override saved.");
      await load({ silent: true });
    } catch (err) {
      notify("danger", err.response?.data?.message || "Failed to save the operator override.");
    }
  };

  const toggleOverride = async (row) => {
    try {
      await updateFeatureFlag({ key: row.key, enabled: !row.enabled, operatorId: row.operatorId });
      await load({ silent: true });
    } catch (err) {
      notify("danger", err.response?.data?.message || "Failed to update the override.");
    }
  };

  const removeOverride = async (row) => {
    try {
      await deleteFeatureFlagOverride({ key: row.key, operatorId: row.operatorId });
      notify("success", "Override removed. The operator now follows the global value.");
      await load({ silent: true });
    } catch (err) {
      notify("danger", err.response?.data?.message || "Failed to remove the override.");
    }
  };

  // ── Form handlers ───────────────────────────────────────────────────────────

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

  const setGlobalFlag = (key, enabled) => {
    setPlatformForm((prev) => ({ ...prev, featureFlags: { ...prev.featureFlags, [key]: enabled } }));
  };

  const handleSelect = (operatorId) => {
    const selected = configs.find((item) => String(item.operatorId) === String(operatorId));

    setSelectedOperatorId(String(operatorId));
    setForm(selected || null);
  };

  const handleOperatorChange = (name, value) => {
    setForm((prev) => ({ ...prev, [name]: value }));
  };

  // ── Saves. Each returns true when it succeeded so the panel can close. ─────

  const savePlatformSettings = async () => {
    setSaving(true);

    try {
      const creditTierThresholds = JSON.parse(platformForm.creditTierThresholds || "{}");
      const exposureLimits = JSON.parse(platformForm.exposureLimits || "{}");
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
      notify("success", "Platform settings saved.");
      await load({ silent: true });
      return true;
    } catch (err) {
      notify("danger", err.response?.data?.message || err.message || "Failed to update platform settings.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const saveDeadlinePolicy = async () => {
    const publishedTiers = [...new Set(tierInput.split(",").map((value) => Number(value.trim())).filter((value) => Number.isInteger(value) && value > 0))].sort((a, b) => a - b);
    const mostLenientDays = Number(deadlinePolicy.mostLenientDays);
    if (!publishedTiers.length || publishedTiers[publishedTiers.length - 1] !== mostLenientDays) {
      notify("danger", "The most lenient value must be the largest published tier.");
      return false;
    }

    setSaving(true);
    try {
      const res = await updatePlatformDeadlineSettings({ publishedTiers, mostLenientDays });
      const affected = res.data?.operatorsAffected || 0;
      notify(
        "success",
        affected
          ? `Deadline tiers published. ${affected} operator${affected === 1 ? "" : "s"} must choose another tier before accepting new bookings.`
          : "Platform deadline tiers published."
      );
      await load({ silent: true });
      return true;
    } catch (err) {
      notify("danger", err.response?.data?.message || "Failed to update platform deadline tiers.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const validateOperatorForm = () => {
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

  const saveOperatorConfig = async () => {
    if (!form?.operatorId) return false;

    const validationError = validateOperatorForm();
    if (validationError) {
      notify("danger", validationError);
      return false;
    }

    setSaving(true);
    try {
      await updateBNPLConfig(form.operatorId, {
        paymentDeadlineDays: Number(form.paymentDeadlineDays),
        allowReceiptUpload: Boolean(form.allowReceiptUpload),
        autoCancelOverdue: Boolean(form.autoCancelOverdue),
        invoiceLogoUrl: form.invoiceLogoUrl || "",
        invoiceFooterText: form.invoiceFooterText || "",
        manualPaymentNote: form.manualPaymentNote || "",
      });
      notify("success", "BNPL settings updated successfully.");
      await load({ silent: true });
      return true;
    } catch (err) {
      notify("danger", err.response?.data?.message || "Failed to update settings.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  // ── Panel control ───────────────────────────────────────────────────────────

  const SAVE_HANDLERS = {
    "commission-deadlines": savePlatformSettings,
    "deadline-tiers": saveDeadlinePolicy,
    "reminders-licence": savePlatformSettings,
    "credit-policy": savePlatformSettings,
    "subscription-tiers": savePlatformSettings,
    "feature-flags": savePlatformSettings,
    "operator-bnpl": saveOperatorConfig,
  };

  // Peak calendar changes save as they are made, so its panel only closes.
  const closeOnly = activeSection === "peak-calendar";

  // Closing without saving drops edits made in the panel.
  const discardDrafts = () => {
    if (serverSettings) setPlatformForm(settingsToForm(serverSettings, flagRows));
    setTierInput((deadlinePolicy.publishedTiers || []).join(", "));
    if (selectedOperatorId) handleSelect(selectedOperatorId);
  };

  const closePanel = () => {
    discardDrafts();
    setActiveSection(null);
  };

  const savePanel = async () => {
    const saved = await SAVE_HANDLERS[activeSection]();
    if (saved) setActiveSection(null);
  };

  // ── Menu card summaries, taken from the saved values ───────────────────────

  const summaries = useMemo(() => {
    const settings = serverSettings;
    if (!settings) return {};

    const flags = effectiveGlobalFlags(settings, flagRows);
    const tiers = { ...DEFAULT_SUBSCRIPTION_TIERS, ...(settings.subscriptionTiers || {}) };
    const timing = { ...DEFAULT_REMINDER_TIMING, ...(settings.reminderTiming || {}) };
    const globalOn = Object.values(flags).filter(Boolean).length;

    return {
      "commission-deadlines": { text: `${Number(settings.commissionRate)}% commission · ${settings.defaultPaymentDeadlineDays}-day default` },
      "deadline-tiers": { text: `${(deadlinePolicy.publishedTiers || []).join(" / ")} days` },
      "reminders-licence": { text: `Reminders ${timing.paymentFirstHours}h / ${timing.paymentFinalHours}h · Licence ${settings.licenceReuploadWindowHours}h` },
      "credit-policy": flags.creditTierPolicy
        ? { text: `Policy on · ${settings.downPaymentFloorPercent}% floor`, tone: "on" }
        : { text: "Policy off · values saved, not applied", tone: "off" },
      "subscription-tiers": { text: SUBSCRIPTION_PLANS.map((plan) => `${tiers[plan].label} ${tiers[plan].listingLimit}`).join(" · ") },
      "feature-flags": { text: `${globalOn} of ${Object.keys(flags).length} on · ${operatorOverrides.length} override${operatorOverrides.length === 1 ? "" : "s"}` },
      "peak-calendar": { text: `${peakDates.length} peak date${peakDates.length === 1 ? "" : "s"}` },
      "operator-bnpl": { text: `${configs.length} operator${configs.length === 1 ? "" : "s"}` },
    };
  }, [serverSettings, flagRows, deadlinePolicy, operatorOverrides, peakDates, configs]);

  if (loading) {
    return (
      <div className="operator-page">
        <div className="operator-card">Loading settings...</div>
      </div>
    );
  }

  const activeMenu = SETTINGS_MENU.find((item) => item.id === activeSection);

  const renderActiveSection = () => {
    switch (activeSection) {
      case "commission-deadlines":
        return (
          <SettingsSection
            icon={<Percent size={20} />}
            title="Commission & Default Deadline"
            description="Platform-wide money rules. A new commission rate applies to new checkouts only."
          >
            <div className="operator-settings-form-grid">
              <FormField label="Commission rate (%)" helper="Platform share of each payment. Default is 10%.">
                <input name="commissionRate" type="number" min="0" max="100" step="0.01" value={platformForm.commissionRate} onChange={handlePlatformChange} required />
              </FormField>

              <FormField label="Default payment deadline (days)" helper="Must be one of the published deadline tiers.">
                <input name="defaultPaymentDeadlineDays" type="number" min="1" value={platformForm.defaultPaymentDeadlineDays} onChange={handlePlatformChange} required />
              </FormField>
            </div>
          </SettingsSection>
        );

      case "deadline-tiers":
        return (
          <SettingsSection
            icon={<Clock size={20} />}
            title="Published Deadline Tiers"
            description="Operators may select only these payment deadline values. A tier removed from the list cannot be used for new acceptances until the operator selects another."
          >
            <div className="operator-settings-form-grid">
              <FormField label="Published tiers (days)" helper="Comma separated, for example 1, 3, 7.">
                <input value={tierInput} onChange={(event) => setTierInput(event.target.value)} placeholder="1, 3, 7" />
              </FormField>

              <FormField label="Most lenient selectable value" helper="Must equal the largest published tier.">
                <input type="number" min="1" value={deadlinePolicy.mostLenientDays} onChange={(event) => setDeadlinePolicy((prev) => ({ ...prev, mostLenientDays: event.target.value }))} />
              </FormField>
            </div>
          </SettingsSection>
        );

      case "reminders-licence":
        return (
          <SettingsSection
            icon={<Bell size={20} />}
            title="Reminders & Licence"
            description="When customers are reminded, and how long they have to re-upload a rejected licence."
          >
            <div className="operator-settings-form-grid">
              <FormField label="First payment reminder (hours before deadline)">
                <input name="paymentFirstHours" type="number" min="2" max="168" value={platformForm.reminderTiming.paymentFirstHours} onChange={handleReminderChange} required />
              </FormField>

              <FormField label="Final payment reminder (hours before deadline)" helper="Must be closer to the deadline than the first reminder.">
                <input name="paymentFinalHours" type="number" min="1" max="167" value={platformForm.reminderTiming.paymentFinalHours} onChange={handleReminderChange} required />
              </FormField>

              <FormField label="Licence re-upload window (hours)" helper="Counted from a rejected licence review. Default 24 hours.">
                <input name="licenceReuploadWindowHours" type="number" min="1" max="720" value={platformForm.licenceReuploadWindowHours} onChange={handlePlatformChange} required />
              </FormField>

              <FormField label="Licence reminder (hours before it is due)">
                <input name="licenceReminderHours" type="number" min="1" max="168" value={platformForm.reminderTiming.licenceReminderHours} onChange={handleReminderChange} required />
              </FormField>
            </div>
          </SettingsSection>
        );

      case "credit-policy":
        return (
          <SettingsSection
            icon={<Gauge size={20} />}
            title="Credit Tier Policy (E17)"
            description="These values are saved at any time but act only while the policy switch is on."
          >
            <div className="operator-settings-form-grid">
              <ToggleField
                label={FLAG_LABELS.creditTierPolicy}
                helper={FLAG_HELPERS.creditTierPolicy}
                checked={Boolean(platformForm.featureFlags.creditTierPolicy)}
                onChange={(checked) => setGlobalFlag("creditTierPolicy", checked)}
              />

              <FormField label="Platform down payment floor (%)" helper="An operator percentage below this is raised to the floor.">
                <input name="downPaymentFloorPercent" type="number" min="0" max="100" step="1" value={platformForm.downPaymentFloorPercent} onChange={handlePlatformChange} required />
              </FormField>

              <FormField wide label="Credit tier thresholds (JSON object)" helper="Tier names as keys and the maximum booking exposure in MYR as each value.">
                <textarea name="creditTierThresholds" value={platformForm.creditTierThresholds} onChange={handlePlatformChange} rows={4} placeholder={'{"Tier 1": 1000, "Tier 2": 5000}'} />
              </FormField>

              <FormField wide label="Exposure limits (JSON object)" helper="Maximum unpaid bookings a customer may hold per credit tier. Tiers left out use 2 / 5 / 1 / 0 (Normal / Trusted / Caution / High Risk).">
                <textarea name="exposureLimits" value={platformForm.exposureLimits} onChange={handlePlatformChange} rows={4} placeholder={'{"Normal": 2, "Caution": 1}'} />
              </FormField>
            </div>
          </SettingsSection>
        );

      case "subscription-tiers":
        return (
          <SettingsSection
            icon={<Layers size={20} />}
            title="Subscription Tiers"
            description="Listing limits apply at the next publish. Operators already above a lowered limit keep their published listings."
          >
            <div className="admin-settings-stack">
              {SUBSCRIPTION_PLANS.map((plan) => (
                <div className="admin-settings-subcard" key={plan}>
                  <h3>{plan}</h3>
                  <div className="operator-settings-form-grid">
                    <FormField label="Name">
                      <input value={platformForm.subscriptionTiers[plan].label} onChange={(event) => handleTierChange(plan, "label", event.target.value)} maxLength={40} required />
                    </FormField>

                    <FormField label="Listing limit">
                      <input type="number" min="0" max="1000" value={platformForm.subscriptionTiers[plan].listingLimit} onChange={(event) => handleTierChange(plan, "listingLimit", event.target.value)} required />
                    </FormField>

                    <FormField label="Monthly price (RM)" helper="Leave empty while the price is unconfirmed.">
                      <input type="number" min="0" step="0.01" value={platformForm.subscriptionTiers[plan].monthlyPriceRm} onChange={(event) => handleTierChange(plan, "monthlyPriceRm", event.target.value)} placeholder="Not confirmed" />
                    </FormField>

                    <FormField label="Term (days)" helper="Leave empty for an ongoing plan.">
                      <input type="number" min="1" value={platformForm.subscriptionTiers[plan].termDays} onChange={(event) => handleTierChange(plan, "termDays", event.target.value)} placeholder="Ongoing" />
                    </FormField>
                  </div>
                </div>
              ))}
            </div>
          </SettingsSection>
        );

      case "feature-flags":
        return (
          <div className="admin-settings-stack">
            <SettingsSection
              icon={<ToggleRight size={20} />}
              title="Global Switches"
              description="Apply platform-wide. Use Save Changes to apply them."
            >
              <div className="operator-settings-form-grid">
                {Object.keys(DEFAULT_FEATURE_FLAGS).map((key) => (
                  <ToggleField
                    key={key}
                    label={FLAG_LABELS[key]}
                    helper={FLAG_HELPERS[key]}
                    checked={Boolean(platformForm.featureFlags[key])}
                    onChange={(checked) => setGlobalFlag(key, checked)}
                  />
                ))}
              </div>
            </SettingsSection>

            <SettingsSection
              icon={<Building2 size={20} />}
              title="Operator Overrides"
              description="An override replaces the global value for one operator and applies immediately. Every change is written to the audit log."
            >
              <form className="operator-settings-form-grid" onSubmit={saveOperatorOverride}>
                <FormField label="Operator">
                  <select value={overrideForm.operatorId} onChange={(event) => setOverrideForm((prev) => ({ ...prev, operatorId: event.target.value }))} required>
                    <option value="">Select operator</option>
                    {configs.map((config) => (
                      <option key={config.operatorId} value={config.operatorId}>
                        {config.operator?.companyName || config.operator?.operatorCode || `Operator ${config.operatorId}`}
                      </option>
                    ))}
                  </select>
                </FormField>

                <FormField label="Feature">
                  <select value={overrideForm.key} onChange={(event) => setOverrideForm((prev) => ({ ...prev, key: event.target.value }))}>
                    {Object.keys(DEFAULT_FEATURE_FLAGS).map((key) => <option key={key} value={key}>{FLAG_LABELS[key]}</option>)}
                  </select>
                </FormField>

                <ToggleField
                  label="Enabled for this operator"
                  checked={overrideForm.enabled}
                  onChange={(checked) => setOverrideForm((prev) => ({ ...prev, enabled: checked }))}
                />

                <div className="admin-settings-inline-action">
                  <button className="operator-primary-btn" type="submit">Save override</button>
                </div>
              </form>

              {operatorOverrides.length === 0 ? (
                <p>No operator overrides are set.</p>
              ) : (
                <div className="admin-settings-list">
                  {operatorOverrides.map((row) => (
                    <div className="admin-settings-row" key={row.id}>
                      <div>
                        <strong>{row.operator?.companyName || row.operator?.operatorCode || row.operatorId}</strong>
                        <span>{FLAG_LABELS[row.key] || row.key} · {row.enabled ? "Enabled" : "Disabled"}</span>
                      </div>
                      <div className="admin-settings-row-actions">
                        <button className="operator-secondary-btn" type="button" onClick={() => toggleOverride(row)}>{row.enabled ? "Disable" : "Enable"}</button>
                        <button className="operator-danger-btn" type="button" onClick={() => removeOverride(row)}>Remove</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </SettingsSection>
          </div>
        );

      case "peak-calendar":
        return (
          <SettingsSection
            icon={<CalendarDays size={20} />}
            title="Peak Calendar"
            description="Platform-maintained dates when operators cannot elect the partial refund rule. Changes save as you make them."
          >
            <form className="operator-settings-form-grid" onSubmit={addPeakDate}>
              <FormField label="Date">
                <input type="date" value={peakForm.date} onChange={(event) => setPeakForm((prev) => ({ ...prev, date: event.target.value }))} required />
              </FormField>

              <FormField label="Label">
                <input value={peakForm.label} onChange={(event) => setPeakForm((prev) => ({ ...prev, label: event.target.value }))} placeholder="Public holiday" required />
              </FormField>

              <div className="admin-settings-inline-action">
                <button className="operator-primary-btn" type="submit">Add peak date</button>
              </div>
            </form>

            {peakDates.length === 0 ? (
              <p>No platform peak dates configured.</p>
            ) : (
              <div className="admin-settings-list">
                {peakDates.map((date) => (
                  <div className="admin-settings-row" key={date.id}>
                    <div>
                      <strong>{String(date.peakDate).slice(0, 10)}</strong>
                      <span>{date.label}</span>
                    </div>
                    <div className="admin-settings-row-actions">
                      <button className="operator-danger-btn" type="button" onClick={() => removePeakDate(date.id)} aria-label={`Remove ${String(date.peakDate).slice(0, 10)}`}>
                        <Trash2 size={15} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </SettingsSection>
        );

      case "operator-bnpl":
        return (
          <div className="admin-settings-stack">
            <div className="admin-settings-stats">
              <div><span>Configured operators</span><strong>{configs.length}</strong></div>
              <div><span>Receipt upload on</span><strong>{configs.filter((c) => c.allowReceiptUpload).length}</strong></div>
              <div><span>Auto overdue on</span><strong>{configs.filter((c) => c.autoCancelOverdue).length}</strong></div>
              <div><span>Average deadline (days)</span><strong>{averageDeadline(configs)}</strong></div>
            </div>

            <SettingsSection
              icon={<Building2 size={20} />}
              title="Operator BNPL Settings"
              description="Choose an operator, then adjust its payment deadline, receipt upload and invoice branding."
            >
              <div className="operator-settings-form-grid">
                <FormField label="Search operators">
                  <input placeholder="Search operator code, company, email..." value={query} onChange={(event) => setQuery(event.target.value)} />
                </FormField>

                <FormField label="Operator">
                  <select value={selectedOperatorId} onChange={(event) => handleSelect(event.target.value)}>
                    {filteredConfigs.map((config) => (
                      <option key={config.operatorId} value={config.operatorId}>
                        {config.operator?.companyName || `Operator ${config.operatorId}`}
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              {!form ? (
                <p>No BNPL config found.</p>
              ) : (
                <div className="operator-settings-form-grid">
                  <FormField label="Operator email">
                    <input value={form.operator?.email || "-"} disabled />
                  </FormField>

                  <FormField label="Payment deadline (days)" helper="Days after acceptance before the payment deadline. Must be a published tier.">
                    <select value={form.paymentDeadlineDays || 3} onChange={(event) => handleOperatorChange("paymentDeadlineDays", Number(event.target.value))}>
                      {[...new Set([...(deadlinePolicy.publishedTiers || []), Number(form.paymentDeadlineDays || 3)])]
                        .sort((a, b) => a - b)
                        .map((days) => (
                          <option key={days} value={days}>
                            {days} {days === 1 ? "day" : "days"}{(deadlinePolicy.publishedTiers || []).includes(days) ? "" : " (withdrawn)"}
                          </option>
                        ))}
                    </select>
                  </FormField>

                  <ToggleField
                    label="Manual receipt upload"
                    helper="Per-operator feature flag."
                    checked={Boolean(form.allowReceiptUpload)}
                    onChange={(checked) => handleOperatorChange("allowReceiptUpload", checked)}
                  />

                  <ToggleField
                    label="Automatic overdue processing"
                    helper="Per-operator feature flag."
                    checked={Boolean(form.autoCancelOverdue)}
                    onChange={(checked) => handleOperatorChange("autoCancelOverdue", checked)}
                  />

                  <FormField wide label="Invoice logo URL" helper="Appears on invoices sent to customers. Operators can also set this from their own portal.">
                    <input value={form.invoiceLogoUrl || ""} onChange={(event) => handleOperatorChange("invoiceLogoUrl", event.target.value)} placeholder="https://..." />
                  </FormField>

                  <FormField wide label="Invoice footer text">
                    <textarea rows={3} value={form.invoiceFooterText || ""} onChange={(event) => handleOperatorChange("invoiceFooterText", event.target.value)} placeholder="Thank you for your booking." />
                  </FormField>

                  <FormField wide label="Manual payment note" helper="Required when manual receipt upload is enabled.">
                    <textarea rows={3} value={form.manualPaymentNote || ""} onChange={(event) => handleOperatorChange("manualPaymentNote", event.target.value)} placeholder="DuitNow/SPay payment instructions shown to customers" />
                  </FormField>
                </div>
              )}
            </SettingsSection>

            <SettingsSection
              icon={<Clock size={20} />}
              title="System-Managed Behaviour"
              description="These run automatically and follow the platform settings."
            >
              <div className="admin-settings-list">
                <div className="admin-settings-row">
                  <div><strong>Payment reminder emails</strong><span>Sent {platformForm.reminderTiming.paymentFirstHours} h and {platformForm.reminderTiming.paymentFinalHours} h before the deadline</span></div>
                </div>
                <div className="admin-settings-row">
                  <div><strong>No operator response</strong><span>Booking auto-rejected after the operator response window</span></div>
                </div>
                <div className="admin-settings-row">
                  <div><strong>Overdue check</strong><span>Unpaid bookings marked overdue after the payment deadline</span></div>
                </div>
                <div className="admin-settings-row">
                  <div><strong>Auto completion</strong><span>Paid bookings marked completed after the service end date</span></div>
                </div>
                <div className="admin-settings-row">
                  <div><strong>Last updated</strong><span>{dateTime(form?.updatedAt)}</span></div>
                </div>
              </div>
            </SettingsSection>
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <p className="operator-eyebrow">Platform Control Centre</p>
          <h1>Administrator Settings</h1>
          <p>
            Choose a settings category below. Each category opens in a focused
            side panel so the page stays clean and easy to manage. Every change
            is written to the audit log.
          </p>
        </div>

        <button type="button" className="operator-secondary-btn" onClick={() => load({ silent: true })}>
          <RefreshCw size={16} />
          &nbsp;Refresh
        </button>
      </section>

      {loadError && (
        <div className="operator-alert danger">
          {loadError}
          <button type="button" onClick={() => load()}>Retry</button>
        </div>
      )}

      {toast && (
        <div className={`operator-toast ${toast.type}`} role="status" aria-live="polite">
          <strong>{toast.type === "danger" ? "Something went wrong" : "Success"}</strong>
          <span>{toast.text}</span>
        </div>
      )}

      <div className="operator-settings-menu-grid">
        {SETTINGS_MENU.map((item) => (
          <SettingsMenuCard
            key={item.id}
            icon={item.icon}
            title={item.title}
            description={item.description}
            summary={summaries[item.id]?.text}
            tone={summaries[item.id]?.tone}
            onOpen={() => setActiveSection(item.id)}
          />
        ))}
      </div>

      {activeSection && activeMenu && (
        <SettingsDrawer
          eyebrow="Administrator Settings"
          title={activeMenu.title}
          description={activeMenu.description}
          onClose={closePanel}
          footer={
            <>
              <button type="button" className="operator-secondary-btn" onClick={closePanel}>
                {closeOnly ? "Close" : "Cancel"}
              </button>

              {!closeOnly && (
                <button type="button" className="operator-primary-btn" disabled={saving} onClick={savePanel}>
                  <Save size={16} />
                  &nbsp;{saving ? "Saving..." : "Save Changes"}
                </button>
              )}
            </>
          }
        >
          {renderActiveSection()}
        </SettingsDrawer>
      )}
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
