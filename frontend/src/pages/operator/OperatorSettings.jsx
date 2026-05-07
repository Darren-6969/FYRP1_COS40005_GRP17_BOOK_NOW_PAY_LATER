import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { operatorService } from "../../services/operator_service";

export default function OperatorSettings() {
  const [settings, setSettings] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [searchParams, setSearchParams] = useSearchParams();

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

  // Strip the ?stripe= param from the URL after reading it once
  const stripeReturn = searchParams.get("stripe");
  useEffect(() => {
    if (stripeReturn) {
      const t = setTimeout(() => setSearchParams({}, { replace: true }), 4000);
      return () => clearTimeout(t);
    }
  }, [stripeReturn, setSearchParams]);

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

      {/* Stripe return banners */}
      {stripeReturn === "connected" && (
        <div className="operator-alert success">
          Stripe onboarding completed. Your account restrictions should now be lifted.
        </div>
      )}
      {stripeReturn === "refresh" && (
        <div className="operator-alert warning">
          The onboarding link expired. Click "Complete Stripe Onboarding" below to get a new one.
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
    </div>
  );
}

// ── Stripe Connect onboarding card ────────────────────────────────────────────
function StripeConnectCard() {
  const [status, setStatus] = useState(null);   // null = not loaded yet
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
      setStatusError(err.response?.data?.message || "Could not load Stripe account status.");
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
      setStatusError(err.response?.data?.message || "Failed to generate onboarding link.");
      setLaunching(false);
    }
  };

  const isRestricted =
    status?.configured &&
    (!status.chargesEnabled || !status.payoutsEnabled);

  const isReady =
    status?.configured && status.chargesEnabled && status.payoutsEnabled;

  return (
    <div className="operator-card" style={{ marginTop: "1.5rem" }}>
      <div style={{ marginBottom: "0.75rem" }}>
        <h2 style={{ marginBottom: "0.25rem" }}>Stripe Connect</h2>
        <p style={{ fontSize: "0.875rem", opacity: 0.7 }}>
          Your merchant payout account. Complete onboarding so Stripe can transfer
          your share of each payment.
        </p>
      </div>

      {/* ── Sandbox bypass notice ────────────────────────────────────────── */}
      <div
        className="operator-alert warning"
        style={{ fontSize: "0.8rem", marginBottom: "1rem" }}
      >
        <strong>Sandbox mode:</strong> Use fake test data on the Stripe form — SSN{" "}
        <code>000-00-0000</code>, any address, any date of birth. This bypasses real
        KYC verification and lifts account restrictions instantly.
      </div>

      {statusError && (
        <div className="operator-alert danger" style={{ marginBottom: "0.75rem" }}>
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
          <StatusPill
            label="Charges"
            active={status.chargesEnabled}
          />
          <StatusPill
            label="Payouts"
            active={status.payoutsEnabled}
          />
          <StatusPill
            label="Details Submitted"
            active={status.detailsSubmitted}
          />
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
        border: `1px solid ${active ? "rgba(34,197,94,0.3)" : "rgba(239,68,68,0.3)"}`,
        fontSize: "0.8rem",
      }}
    >
      <span style={{ marginRight: "0.35rem" }}>{active ? "✓" : "✗"}</span>
      <span>{label}</span>
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
