import { useEffect, useState } from "react";
import { Save } from "lucide-react";
import {
  getOperatorSubscriptionPayments,
  recordOperatorSubscriptionPayment,
} from "../../services/admin_service";
import { FormField, SettingsDrawer, SettingsSection } from "./SettingsParts";

const MALAYSIA = "Asia/Kuala_Lumpur";

function plainDate(date = new Date()) {
  return new Intl.DateTimeFormat("en-CA", { timeZone: MALAYSIA }).format(date);
}

function addOneMonth(plain) {
  const date = new Date(`${plain}T00:00:00Z`);
  date.setUTCMonth(date.getUTCMonth() + 1);
  return date.toISOString().slice(0, 10);
}

function show(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: MALAYSIA,
  }).format(new Date(value));
}

// Records a subscription payment arranged outside Stripe (FR-SUB-002).
// Recording a payment also reactivates an operator suspended for non-payment.
export default function SubscriptionPaymentDrawer({ operator, tier, onClose, onRecorded }) {
  const today = plainDate();
  const currentPaidUntil = operator.subscriptionPaidUntil ? plainDate(new Date(operator.subscriptionPaidUntil)) : null;
  const suspended = operator.subscriptionStatus === "SUSPENDED";

  const [form, setForm] = useState({
    amount: tier?.monthlyPriceRm != null ? String(tier.monthlyPriceRm) : "",
    paidOn: today,
    // One month on from the later of today and the date already paid to.
    paidUntil: addOneMonth(currentPaidUntil && currentPaidUntil > today ? currentPaidUntil : today),
    reference: "",
    note: "",
  });
  const [history, setHistory] = useState([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    getOperatorSubscriptionPayments(operator.id)
      .then((res) => !cancelled && setHistory(res.data || []))
      .catch(() => !cancelled && setHistory([]));
    return () => {
      cancelled = true;
    };
  }, [operator.id]);

  const update = (field) => (event) => setForm((prev) => ({ ...prev, [field]: event.target.value }));

  const submit = async () => {
    setSaving(true);
    setError("");
    try {
      const res = await recordOperatorSubscriptionPayment(operator.id, {
        amount: Number(form.amount),
        paidOn: form.paidOn || null,
        paidUntil: form.paidUntil,
        reference: form.reference,
        note: form.note,
      });
      onRecorded(res.data?.message || "Payment recorded.");
      onClose();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to record the payment.");
      setSaving(false);
    }
  };

  return (
    <SettingsDrawer
      eyebrow="Operator subscription"
      title="Record payment"
      description={`${operator.companyName} · ${tier?.label || operator.subscriptionPlan}`}
      onClose={onClose}
      footer={
        <>
          <button type="button" className="operator-secondary-btn" onClick={onClose}>
            Cancel
          </button>
          <button type="button" className="operator-primary-btn" disabled={saving} onClick={submit}>
            <Save size={16} />
            &nbsp;{saving ? "Saving..." : suspended ? "Record and reactivate" : "Record payment"}
          </button>
        </>
      }
    >
      <div className="admin-settings-stack">
        {error && <div className="operator-alert danger">{error}</div>}

        <div className="admin-settings-stats">
          <div><span>Plan</span><strong>{tier?.label || operator.subscriptionPlan}</strong></div>
          <div><span>Status</span><strong>{suspended ? "Suspended" : "Active"}</strong></div>
          <div><span>Paid until</span><strong>{show(operator.subscriptionPaidUntil)}</strong></div>
          <div><span>Monthly price</span><strong>{tier?.monthlyPriceRm != null ? `RM${tier.monthlyPriceRm}` : "-"}</strong></div>
        </div>

        {suspended && (
          <div className="operator-alert danger">
            This operator is suspended: their listings are hidden and customers cannot send new requests.
            Recording a payment reactivates the account at once.
          </div>
        )}

        <SettingsSection
          icon={<Save size={20} />}
          title="Payment details"
          description="Payments are arranged outside Stripe. Record what the operator paid and the date the subscription is now paid to."
        >
          <div className="operator-settings-form-grid">
            <FormField label="Amount received (RM)">
              <input type="number" min="0.01" step="0.01" value={form.amount} onChange={update("amount")} required />
            </FormField>

            <FormField label="Payment date">
              <input type="date" max={today} value={form.paidOn} onChange={update("paidOn")} />
            </FormField>

            <FormField label="Paid until" helper="The last day covered. An unpaid month after this date suspends the account.">
              <input type="date" min={addOneDay(today)} value={form.paidUntil} onChange={update("paidUntil")} required />
            </FormField>

            <FormField label="Reference" helper="Bank transfer or receipt number.">
              <input value={form.reference} maxLength={120} onChange={update("reference")} />
            </FormField>

            <FormField wide label="Note">
              <textarea rows={3} maxLength={1000} value={form.note} onChange={update("note")} />
            </FormField>
          </div>
        </SettingsSection>

        <SettingsSection icon={<Save size={20} />} title="Payment history" description="Most recent payments first.">
          {history.length === 0 ? (
            <p>No payments recorded yet.</p>
          ) : (
            <div className="admin-settings-list">
              {history.map((payment) => (
                <div className="admin-settings-row" key={payment.id}>
                  <div>
                    <strong>RM{Number(payment.amount).toFixed(2)} · {show(payment.paidOn)}</strong>
                    <span>
                      Paid until {show(payment.paidUntil)}
                      {payment.reference ? ` · ${payment.reference}` : ""}
                    </span>
                  </div>
                </div>
              ))}
            </div>
          )}
        </SettingsSection>
      </div>
    </SettingsDrawer>
  );
}

function addOneDay(plain) {
  const date = new Date(`${plain}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + 1);
  return date.toISOString().slice(0, 10);
}
