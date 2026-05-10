import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import {
  Bell,
  Clock,
  CreditCard,
  Eye,
  ImagePlus,
  KeyRound,
  Mail,
  MonitorSmartphone,
  Save,
  ShieldCheck,
  Upload,
} from "lucide-react";
import { operatorService } from "../../services/operator_service";

const SETTINGS_STORAGE_KEY = "bnpl_operator_settings_v1";

const EMAIL_TEMPLATES = [
  {
    value: "booking_received",
    label: "Booking Received",
    subject: "We have received your booking request",
  },
  {
    value: "booking_accepted",
    label: "Booking Accepted",
    subject: "Your booking has been accepted",
  },
  {
    value: "booking_rejected",
    label: "Booking Rejected",
    subject: "Your booking request was rejected",
  },
  {
    value: "alternative_suggested",
    label: "Alternative Suggested",
    subject: "An alternative option is available for your booking",
  },
  {
    value: "payment_confirmed",
    label: "Payment Confirmed",
    subject: "Your payment has been confirmed",
  },
  {
  value: "payment_receipt",
  label: "Booking Confirmed & Official Receipt",
  subject: "Your booking is confirmed and your receipt is ready",
  },
  {
    value: "auto_rejected",
    label: "Auto-Rejected Booking",
    subject: "Your booking request has expired",
  },
];

const DEFAULT_SETTINGS = {
  bookingResponseDeadlineMinutes: 120,
  autoRejectInactiveBooking: true,
  reminderBeforeAutoRejectMinutes: 30,

  acceptedPaymentMethods: {
    stripe: true,
    paypal: false,
    duitnow: true,
    manualTransfer: true,
  },
  manualPaymentInstructions:
    "Please complete payment using the provided account details and upload your proof of payment before the deadline.",

  operatorReminderBeforeAutoRejectMinutes: 30,
  enableOperatorReminderAlerts: true,

  selectedEmailTemplate: "booking_accepted",
  companyLogo: "",

  bookingRejectedEmailText: "",
  autoRejectedEmailText: "",

  mfaEnabled: false,
  apiKeyVisible: false,
};

export default function OperatorSettings() {
  const [settings, setSettings] = useState(null);
  const [form, setForm] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [successMessage, setSuccessMessage] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

  const loadSettings = async () => {
    try {
      setLoading(true);
      setError("");

      const savedSettings = localStorage.getItem(SETTINGS_STORAGE_KEY);

      if (savedSettings) {
        setForm({
          ...DEFAULT_SETTINGS,
          ...JSON.parse(savedSettings),
          acceptedPaymentMethods: {
            ...DEFAULT_SETTINGS.acceptedPaymentMethods,
            ...JSON.parse(savedSettings).acceptedPaymentMethods,
          },
        });
      }

      const res = await operatorService.getSettings();
      setSettings(res.data);

        const config = res.data.config;
        const operator = res.data.operator;

        setForm((prev) => ({
          ...prev,

          bookingResponseDeadlineMinutes:
            config?.bookingResponseDeadlineMinutes ?? prev.bookingResponseDeadlineMinutes,

          autoRejectInactiveBooking:
            config?.autoRejectInactiveBooking ?? prev.autoRejectInactiveBooking,

          reminderBeforeAutoRejectMinutes:
            config?.reminderBeforeAutoRejectMinutes ?? prev.reminderBeforeAutoRejectMinutes,

          acceptedPaymentMethods:
            config?.acceptedPaymentMethods ?? prev.acceptedPaymentMethods,

          manualPaymentInstructions:
            config?.manualPaymentNote ?? prev.manualPaymentInstructions,

          operatorReminderBeforeAutoRejectMinutes:
            config?.operatorReminderBeforeAutoRejectMinutes ??
            prev.operatorReminderBeforeAutoRejectMinutes,

          enableOperatorReminderAlerts:
            config?.enableOperatorReminderAlerts ?? prev.enableOperatorReminderAlerts,

          companyLogo:
            operator?.logoUrl || config?.invoiceLogoUrl || prev.companyLogo || "",

          bookingRejectedEmailText:
            config?.bookingRejectedEmailText || "",

          autoRejectedEmailText:
            config?.autoRejectedEmailText || "",
        }));
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Settings backend is not available yet. Demo settings are loaded locally."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadSettings();
  }, []);

  // Strip the ?stripe= param from the URL after reading it once
  const stripeReturn = searchParams.get("stripe");

  useEffect(() => {
    if (stripeReturn) {
      const t = setTimeout(() => setSearchParams({}, { replace: true }), 4000);
      return () => clearTimeout(t);
    }
  }, [stripeReturn, setSearchParams]);

  const user = settings?.user;
  const operator = settings?.operator;

  const selectedTemplate = useMemo(() => {
    return (
      EMAIL_TEMPLATES.find(
        (template) => template.value === form.selectedEmailTemplate
      ) || EMAIL_TEMPLATES[0]
    );
  }, [form.selectedEmailTemplate]);

  const updateField = (field, value) => {
    setForm((prev) => ({
      ...prev,
      [field]: value,
    }));
  };

  const updatePaymentMethod = (method, checked) => {
    setForm((prev) => ({
      ...prev,
      acceptedPaymentMethods: {
        ...prev.acceptedPaymentMethods,
        [method]: checked,
      },
    }));
  };

  const handleLogoUpload = (event) => {
    const file = event.target.files?.[0];

    if (!file) return;

    if (!file.type.startsWith("image/")) {
      setError("Please upload an image file only.");
      return;
    }

    const reader = new FileReader();

    reader.onload = () => {
      updateField("companyLogo", reader.result);
      setError("");
    };

    reader.readAsDataURL(file);
  };

const handleSave = async () => {
  setSaving(true);
  setSuccessMessage("");
  setError("");

  try {
    const res = await operatorService.updateSettings({
      bookingResponseDeadlineMinutes: form.bookingResponseDeadlineMinutes,
      autoRejectInactiveBooking: form.autoRejectInactiveBooking,
      reminderBeforeAutoRejectMinutes: form.reminderBeforeAutoRejectMinutes,
      acceptedPaymentMethods: form.acceptedPaymentMethods,
      manualPaymentNote: form.manualPaymentInstructions,
      operatorReminderBeforeAutoRejectMinutes:
        form.operatorReminderBeforeAutoRejectMinutes,
      enableOperatorReminderAlerts: form.enableOperatorReminderAlerts,
      companyLogo: form.companyLogo,
      invoiceFooterText: form.invoiceFooterText || null,
      bookingRejectedEmailText: form.bookingRejectedEmailText,
      autoRejectedEmailText: form.autoRejectedEmailText,
    });

    setSettings((prev) => ({
      ...prev,
      operator: res.data.operator,
      config: res.data.config,
    }));

    setSuccessMessage("Operator settings saved successfully.");
    setTimeout(() => {
    setSuccessMessage("");
    }, 3500);
  } catch (err) {
    setError(err.response?.data?.message || "Failed to save operator settings.");
  } finally {
    setSaving(false);
  }
};

  if (loading) {
    return (
      <div className="operator-page">
        <div className="operator-card">Loading settings...</div>
      </div>
    );
  }

  return (
    <div className="operator-page">
      <section className="operator-page-head">
        <div>
          <p className="operator-eyebrow">Operator Control Centre</p>
          <h1>Operator Settings</h1>
          <p>
            Configure booking response rules, payment options, operator alerts,
            email branding, and security settings.
          </p>
        </div>

        <button
          type="button"
          className="operator-primary-btn"
          onClick={handleSave}
          disabled={saving}
        >
          <Save size={16} />
          {saving ? "Saving..." : "Save Settings"}
        </button>
      </section>

      {error && (
        <div className="operator-alert warning">
          {error}
          <button type="button" onClick={loadSettings}>
            Retry
          </button>
        </div>
      )}

      {successMessage && (
        <div className="operator-toast success" role="status" aria-live="polite">
          <strong>Success</strong>
          <span>{successMessage}</span>
        </div>
      )}

      {/* Stripe return banners */}
      {stripeReturn === "connected" && (
        <div className="operator-alert success">
          Stripe onboarding completed. Your account restrictions should now be
          lifted.
        </div>
      )}

      {stripeReturn === "refresh" && (
        <div className="operator-alert warning">
          The onboarding link expired. Click "Complete Stripe Onboarding" below
          to get a new one.
        </div>
      )}

      <div className="operator-settings-layout">
        <main className="operator-settings-content">
          <SettingsSection
            id="booking-rules"
            icon={<Clock size={20} />}
            title="Booking Action Rule Settings"
            description="Control how long an operator can leave a booking request without action."
          >
            <div className="operator-settings-form-grid">
              <FormField
                label="Booking response deadline"
                helper="Time allowed for operator to accept, reject, or suggest an alternative."
              >
                <select
                  value={form.bookingResponseDeadlineMinutes}
                  onChange={(event) =>
                    updateField(
                      "bookingResponseDeadlineMinutes",
                      Number(event.target.value)
                    )
                  }
                >
                  <option value={30}>30 minutes</option>
                  <option value={60}>1 hour</option>
                  <option value={120}>2 hours</option>
                  <option value={360}>6 hours</option>
                  <option value={720}>12 hours</option>
                  <option value={1440}>24 hours</option>
                </select>
              </FormField>

              <ToggleField
                label="Auto-reject inactive booking"
                helper="Automatically reject the booking if no operator action is taken before the response deadline."
                checked={form.autoRejectInactiveBooking}
                onChange={(checked) =>
                  updateField("autoRejectInactiveBooking", checked)
                }
              />

              <FormField
                label="Reminder before auto-reject"
                helper="Send reminder before the inactive booking is automatically rejected."
              >
                <select
                  value={form.reminderBeforeAutoRejectMinutes}
                  onChange={(event) =>
                    updateField(
                      "reminderBeforeAutoRejectMinutes",
                      Number(event.target.value)
                    )
                  }
                  disabled={!form.autoRejectInactiveBooking}
                >
                  <option value={10}>10 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                </select>
              </FormField>
            </div>
          </SettingsSection>

          <SettingsSection
            id="payment-settings"
            icon={<CreditCard size={20} />}
            title="Payment Settings"
            description="Choose which payment methods are available to customers."
          >
            <div className="operator-payment-methods">
              <CheckboxField
                label="Stripe"
                checked={form.acceptedPaymentMethods.stripe}
                onChange={(checked) => updatePaymentMethod("stripe", checked)}
              />

              <CheckboxField
                label="PayPal"
                checked={form.acceptedPaymentMethods.paypal}
                onChange={(checked) => updatePaymentMethod("paypal", checked)}
              />

              <CheckboxField
                label="DuitNow / SPay"
                checked={form.acceptedPaymentMethods.duitnow}
                onChange={(checked) => updatePaymentMethod("duitnow", checked)}
              />

              <CheckboxField
                label="Manual transfer"
                checked={form.acceptedPaymentMethods.manualTransfer}
                onChange={(checked) =>
                  updatePaymentMethod("manualTransfer", checked)
                }
              />
            </div>

            {form.acceptedPaymentMethods.manualTransfer && (
              <FormField
                label="Manual payment instructions"
                helper="Shown to customers when manual transfer is available."
              >
                <textarea
                  rows={5}
                  value={form.manualPaymentInstructions}
                  onChange={(event) =>
                    updateField("manualPaymentInstructions", event.target.value)
                  }
                  placeholder="Enter manual payment instructions..."
                />
              </FormField>
            )}
          </SettingsSection>

          <SettingsSection
            id="notification-settings"
            icon={<Bell size={20} />}
            title="Notification Settings"
            description="Control operator reminders before a booking is auto-rejected."
          >
            <div className="operator-settings-form-grid">
              <FormField
                label="Operator reminder before auto-reject"
                helper="This reminder is for operators only, not customer payment deadline reminders."
              >
                <select
                  value={form.operatorReminderBeforeAutoRejectMinutes}
                  onChange={(event) =>
                    updateField(
                      "operatorReminderBeforeAutoRejectMinutes",
                      Number(event.target.value)
                    )
                  }
                >
                  <option value={10}>10 minutes before</option>
                  <option value={15}>15 minutes before</option>
                  <option value={30}>30 minutes before</option>
                  <option value={60}>1 hour before</option>
                </select>
              </FormField>

              <ToggleField
                label="Enable operator reminder alerts"
                helper="Notify the operator before pending booking requests are automatically rejected."
                checked={form.enableOperatorReminderAlerts}
                onChange={(checked) =>
                  updateField("enableOperatorReminderAlerts", checked)
                }
              />
            </div>
          </SettingsSection>

          <SettingsSection
            id="email-template-settings"
            icon={<Mail size={20} />}
            title="Email Template Settings"
            description="Preview default system emails and upload a company logo for email branding."
          >
            <div className="operator-email-template-grid">
              <div>
                <FormField
                  label="Select email template"
                  helper="The email content remains default. Only the company logo is customizable for now."
                >
                  <select
                    value={form.selectedEmailTemplate}
                    onChange={(event) =>
                      updateField("selectedEmailTemplate", event.target.value)
                    }
                  >
                    {EMAIL_TEMPLATES.map((template) => (
                      <option key={template.value} value={template.value}>
                        {template.label}
                      </option>
                    ))}
                  </select>
                </FormField>

                <div className="operator-logo-upload-box">
                  <div className="operator-logo-preview">
                    {form.companyLogo ? (
                      <img src={form.companyLogo} alt="Company logo preview" />
                    ) : (
                      <ImagePlus size={34} />
                    )}
                  </div>

                  <div>
                    <h3>Company logo</h3>
                    <p>
                      Upload the logo that will appear at the top of operator
                      email templates.
                    </p>

                    <label className="operator-upload-btn">
                      <Upload size={16} />
                      Upload logo
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleLogoUpload}
                      />
                    </label>

                    {form.companyLogo && (
                      <button
                        type="button"
                        className="operator-muted-btn"
                        onClick={() => updateField("companyLogo", "")}
                      >
                        Remove logo
                      </button>
                    )}
                  </div>
                </div>

                {form.selectedEmailTemplate === "booking_rejected" && (
                  <FormField
                    label="Custom booking rejected message"
                    helper="This text is only used when an operator manually rejects a booking."
                  >
                    <textarea
                      rows={5}
                      value={form.bookingRejectedEmailText}
                      onChange={(event) =>
                        updateField("bookingRejectedEmailText", event.target.value)
                      }
                      placeholder="Example: Unfortunately, your requested booking is unavailable. Please contact us for further assistance."
                    />
                  </FormField>
                )}

                {form.selectedEmailTemplate === "auto_rejected" && (
                  <FormField
                    label="Custom auto-rejected message"
                    helper="This text is only used when a booking is automatically rejected because no operator action was taken."
                  >
                    <textarea
                      rows={5}
                      value={form.autoRejectedEmailText}
                      onChange={(event) =>
                        updateField("autoRejectedEmailText", event.target.value)
                      }
                      placeholder="Example: Your booking request has expired because no operator response was made before the deadline."
                    />
                  </FormField>
                )}
              </div>

              <BackendEmailPreview template={form.selectedEmailTemplate} />
            </div>
          </SettingsSection>

          <SettingsSection
            id="security-settings"
            icon={<ShieldCheck size={20} />}
            title="Security Settings"
            description="Manage advanced security options and access visibility."
          >
            <div className="operator-security-grid">
              <ToggleField
                label="Enable 2FA / MFA"
                helper="Add an extra verification step when signing in."
                checked={form.mfaEnabled}
                onChange={(checked) => updateField("mfaEnabled", checked)}
              />

              <SecurityInfoCard
                icon={<MonitorSmartphone size={18} />}
                title="Active sessions"
                value="Current browser session"
                description="Session management backend can be connected later."
              />

              <SecurityInfoCard
                icon={<Clock size={18} />}
                title="Login activity"
                value="Latest login shown here"
                description="Login audit history can be displayed when backend records are available."
              />

              <div className="operator-security-card">
                <div className="operator-security-card-head">
                  <KeyRound size={18} />
                  <div>
                    <h3>API key visibility / request</h3>
                    <p>
                      Allow operator to view or request an API key for future
                      host integration.
                    </p>
                  </div>
                </div>

                <div className="operator-api-key-row">
                  <code>
                    {form.apiKeyVisible
                      ? "bnpl_test_operator_123456789"
                      : "••••••••••••••••••••••••"}
                  </code>

                  <button
                    type="button"
                    className="operator-secondary-btn"
                    onClick={() =>
                      updateField("apiKeyVisible", !form.apiKeyVisible)
                    }
                  >
                    <Eye size={15} />
                    {form.apiKeyVisible ? "Hide" : "Show"}
                  </button>
                </div>
              </div>
            </div>
          </SettingsSection>

          {/*
            SANDBOX BYPASS — Stripe Express Onboarding Card
            ------------------------------------------------
            This card lets the merchant complete (or "fake") Stripe's identity
            verification in test mode. Clicking the button generates a Stripe Express
            Account Link that opens Stripe's hosted onboarding form. In sandbox, Stripe
            accepts dummy data (SSN 000-00-0000, any address / DOB) to immediately lift
            the RESTRICTED status on the connected account — no real documents needed.
            In live mode this would collect genuine KYC information.
          */}
          <StripeConnectCard />
        </main>

        <aside className="operator-settings-toc">
          <strong>Settings Menu</strong>
          <a href="#booking-rules">Booking Action Rules</a>
          <a href="#payment-settings">Payment Settings</a>
          <a href="#notification-settings">Notification Settings</a>
          <a href="#email-template-settings">Email Templates</a>
          <a href="#security-settings">Security</a>
        </aside>
      </div>
    </div>
  );
}

function SettingsSection({ id, icon, title, description, children }) {
  return (
    <section id={id} className="operator-card operator-settings-section">
      <div className="operator-settings-section-head">
        <div className="operator-settings-section-icon">{icon}</div>
        <div>
          <h2>{title}</h2>
          <p>{description}</p>
        </div>
      </div>

      {children}
    </section>
  );
}

function FormField({ label, helper, children }) {
  return (
    <label className="operator-settings-field">
      <span>{label}</span>
      {children}
      {helper && <small>{helper}</small>}
    </label>
  );
}

function ToggleField({ label, helper, checked, onChange }) {
  return (
    <div className="operator-toggle-row">
      <div>
        <strong>{label}</strong>
        {helper && <p>{helper}</p>}
      </div>

      <button
        type="button"
        className={`operator-toggle ${checked ? "active" : ""}`}
        onClick={() => onChange(!checked)}
        aria-pressed={checked}
      >
        <span />
      </button>
    </div>
  );
}

function CheckboxField({ label, checked, onChange }) {
  return (
    <label className="operator-checkbox-card">
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>{label}</span>
    </label>
  );
}

function BackendEmailPreview({ template }) {
  const [preview, setPreview] = useState(null);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [previewError, setPreviewError] = useState("");

  useEffect(() => {
    const loadPreview = async () => {
      setLoadingPreview(true);
      setPreviewError("");

      try {
        const res = await operatorService.previewEmailTemplate(template);
        setPreview(res.data);
      } catch (err) {
        setPreviewError(
          err.response?.data?.message || "Failed to load email preview."
        );
      } finally {
        setLoadingPreview(false);
      }
    };

    loadPreview();
  }, [template]);

  return (
    <div className="operator-email-preview">
      <div className="operator-email-preview-toolbar">
        <span>Actual Sent Email Preview</span>
        <strong>{preview?.subject || template}</strong>
      </div>

      {loadingPreview ? (
        <div className="operator-email-preview-placeholder">
          Loading actual email preview...
        </div>
      ) : previewError ? (
        <div className="operator-alert danger">{previewError}</div>
      ) : (
        <iframe
          title="Actual email preview"
          className="operator-email-preview-frame"
          srcDoc={preview?.html || ""}
        />
      )}
    </div>
  );
}

function SecurityInfoCard({ icon, title, value, description }) {
  return (
    <div className="operator-security-card">
      <div className="operator-security-card-head">
        {icon}
        <div>
          <h3>{title}</h3>
          <p>{description}</p>
        </div>
      </div>

      <strong>{value}</strong>
    </div>
  );
}

// ── Stripe Connect onboarding card ────────────────────────────────────────────
// This part is kept from your existing code and should not be removed.
function StripeConnectCard() {
  const [status, setStatus] = useState(null); // null = not loaded yet
  const [loadingStatus, setLoadingStatus] = useState(true);
  const [launching, setLaunching] = useState(false);
  const [statusError, setStatusError] = useState("");

  const fetchStatus = async () => {
    setLoadingStatus(true);
    setStatusError("");

    try {
      const res = await operatorService.getStripeAccountStatus();
      setStatus(res.data);
    } catch (err) {
      setStatusError(
        err.response?.data?.message || "Could not load Stripe account status."
      );
    } finally {
      setLoadingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  // SANDBOX BYPASS: requests a Stripe Express Account Link and redirects the
  // merchant to Stripe's hosted onboarding form where fake test data is accepted.
  const handleStartOnboarding = async () => {
    setLaunching(true);
    setStatusError("");

    try {
      const res = await operatorService.createStripeOnboardingLink();
      window.location.href = res.data.url;
    } catch (err) {
      setStatusError(
        err.response?.data?.message || "Failed to generate onboarding link."
      );
      setLaunching(false);
    }
  };

  const transfersActive = status?.capabilities?.transfers === "active";

  const isRestricted =
    status?.configured &&
    (!status.chargesEnabled || !status.payoutsEnabled || !transfersActive);

  const isReady =
    status?.configured &&
    status.chargesEnabled &&
    status.payoutsEnabled &&
    transfersActive;

  return (
    <div className="operator-card" style={{ marginTop: "1.5rem" }}>
      <div style={{ marginBottom: "0.75rem" }}>
        <h2 style={{ marginBottom: "0.25rem" }}>Stripe Connect</h2>
        <p style={{ fontSize: "0.875rem", opacity: 0.7 }}>
          Your merchant payout account. Complete onboarding so Stripe can
          transfer your share of each payment.
        </p>
      </div>

      {/* ── Sandbox bypass notice ────────────────────────────────────────── */}
      <div
        className="operator-alert warning"
        style={{ fontSize: "0.8rem", marginBottom: "1rem" }}
      >
        <strong>Sandbox mode:</strong> Use fake test data on the Stripe form —
        SSN <code>000-00-0000</code>, any address, any date of birth. This
        bypasses real KYC verification and lifts account restrictions instantly.
      </div>

      {statusError && (
        <div
          className="operator-alert danger"
          style={{ marginBottom: "0.75rem" }}
        >
          {statusError}
        </div>
      )}

      {loadingStatus ? (
        <p style={{ opacity: 0.6 }}>Loading account status…</p>
      ) : !status?.configured ? (
        <p style={{ opacity: 0.6 }}>No connected account configured.</p>
      ) : (
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
            gap: "0.75rem",
            marginBottom: "1rem",
          }}
        >
          <StatusPill label="Charges" active={status.chargesEnabled} />
          <StatusPill label="Payouts" active={status.payoutsEnabled} />
          <StatusPill
            label="Details Submitted"
            active={status.detailsSubmitted}
          />
          <StatusPill
            label="Transfers capability"
            active={status.capabilities?.transfers === "active"}
          />
        </div>
      )}

      {/* Transfers capability is required for Destination Charges (the split payment model).
          If inactive, the customer checkout will throw a Stripe error. */}
      {status?.configured && status.capabilities?.transfers !== "active" && (
        <div
          className="operator-alert danger"
          style={{ fontSize: "0.8rem", marginBottom: "1rem" }}
        >
          <strong>Transfers capability inactive.</strong> Customers cannot pay
          until this is enabled. Click <em>Complete Stripe Onboarding</em> below
          — it will request the capability automatically. In sandbox mode it
          activates instantly.
        </div>
      )}

      {/* Requirements list — only shown when there are outstanding items */}
      {status?.requirements?.currentlyDue?.length > 0 && (
        <div style={{ marginBottom: "1rem", fontSize: "0.8rem" }}>
          <strong>Required by Stripe:</strong>
          <ul style={{ marginTop: "0.25rem", paddingLeft: "1.25rem" }}>
            {status.requirements.currentlyDue.map((item) => (
              <li key={item}>{item.replaceAll(".", " › ")}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Onboarding button — always shown so the merchant can re-enter the form */}
      {status?.configured && (
        <button
          className="operator-btn"
          onClick={handleStartOnboarding}
          disabled={launching}
          style={{ minWidth: "220px" }}
        >
          {launching
            ? "Redirecting to Stripe…"
            : isReady
            ? "Manage Stripe Account"
            : "Complete Stripe Onboarding"}
        </button>
      )}

      {isReady && (
        <p
          className="operator-status success"
          style={{ marginTop: "0.5rem", display: "inline-block" }}
        >
          Account active — charges and payouts enabled
        </p>
      )}

      {isRestricted && (
        <p
          className="operator-status danger"
          style={{ marginTop: "0.5rem", display: "inline-block" }}
        >
          Account restricted — complete onboarding to enable payouts
        </p>
      )}
    </div>
  );
}

function StatusPill({ label, active }) {
  return (
    <div
      style={{
        padding: "0.5rem 0.75rem",
        borderRadius: "0.5rem",
        background: active ? "rgba(34,197,94,0.12)" : "rgba(239,68,68,0.12)",
        border: `1px solid ${
          active ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"
        }`,
        fontSize: "0.8rem",
      }}
    >
      <span style={{ marginRight: "0.35rem" }}>{active ? "✓" : "✗"}</span>
      <span>{label}</span>
    </div>
  );
}
