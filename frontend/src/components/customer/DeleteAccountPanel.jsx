import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { getAccountDeletionRequest, requestAccountDeletion } from "../../services/customer_service";

// Profile > Delete Account. The signed-in customer confirms, and the request
// goes straight to the platform team (no chat). If a request is already open
// it shows that instead of the button.

function formatDate(value) {
  if (!value) return "";
  return new Intl.DateTimeFormat("en-MY", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kuala_Lumpur" }).format(
    new Date(value)
  );
}

export default function DeleteAccountPanel() {
  const [status, setStatus] = useState(null); // { request, blockers }
  const [loadError, setLoadError] = useState("");
  const [confirming, setConfirming] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState("");
  const [justSent, setJustSent] = useState(false);
  const confirmRef = useRef(null);
  const resultRef = useRef(null);

  useEffect(() => {
    let current = true;
    getAccountDeletionRequest()
      .then((res) => current && setStatus(res.data))
      .catch(() => current && setLoadError("We could not check your account just now. Please try again."));
    return () => {
      current = false;
    };
  }, []);

  // Move focus to the confirmation, then to the result, so keyboard and
  // screen reader users follow along.
  useEffect(() => {
    if (confirming) confirmRef.current?.focus();
  }, [confirming]);
  useEffect(() => {
    if (justSent) resultRef.current?.focus();
  }, [justSent]);

  const send = async () => {
    setSending(true);
    setError("");
    try {
      const res = await requestAccountDeletion();
      setStatus({ request: res.data.request, blockers: res.data.blockers || [] });
      setConfirming(false);
      setJustSent(true);
    } catch (err) {
      setError(err.response?.data?.message || "Your request could not be sent. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const request = status?.request;
  const blockers = status?.blockers || [];

  return (
    <div className="customer-profile-form">
      <div>
        <p className="customer-eyebrow">Your data</p>
        <h2>Delete your account</h2>
        <p className="customer-muted">
          Ask us to delete your account and the personal data linked to it. Our team checks the request, deletes the
          account within 30 days and emails you when it is done.
        </p>
      </div>

      <div className="customer-help-list">
        <InfoCard
          title="What we delete"
          text="Your email, phone number, profile photo and password, your driving licence and permits, saved cars, notifications, and your Assistant chats."
        />
        <InfoCard
          title="What we keep"
          text="Records of past bookings, payments, refunds and invoices, with your name on them, for 7 years, as Malaysian tax and accounting law requires. They are not used for anything else."
        />
        <InfoCard
          title="Before you ask"
          text="Finish or cancel any booking that is still going on, and wait for any refund to reach you. Download the invoices you want to keep."
        />
        <InfoCard
          title="After it is deleted"
          text="You can no longer sign in on the website or the app. You can sign up again later with the same email, as a new account."
        />
      </div>

      {loadError && <div className="customer-alert customer-alert-danger">{loadError}</div>}

      {blockers.length > 0 && (
        <div className="customer-alert customer-delete-blockers" role="note">
          <strong>Finish these first, or we will ask you to before deleting:</strong>
          <ul>
            {blockers.map((text) => (
              <li key={text}>{text}</li>
            ))}
          </ul>
        </div>
      )}

      {request ? (
        <div
          className="customer-alert customer-alert-success"
          role="status"
          tabIndex={-1}
          ref={resultRef}
        >
          <strong>{justSent ? "Request sent." : "Your request has been sent."}</strong> Reference {request.reference},
          sent {formatDate(request.requestedAt)}. We will email you when your account has been deleted, or if we need
          anything from you first.
        </div>
      ) : (
        status &&
        (confirming ? (
          <div className="customer-delete-confirm" role="group" aria-labelledby="delete-confirm-title" tabIndex={-1} ref={confirmRef}>
            <strong id="delete-confirm-title">Send a request to delete your account?</strong>
            <p>
              Once your account is deleted it cannot be brought back. You can still change your mind before then by
              contacting us.
            </p>
            {error && <div className="customer-alert customer-alert-danger">{error}</div>}
            <div className="customer-profile-delete-actions">
              <button type="button" className="customer-primary-btn customer-danger-btn" onClick={send} disabled={sending}>
                {sending ? "Sending..." : "Yes, send request"}
              </button>
              <button type="button" className="customer-secondary-btn" onClick={() => setConfirming(false)} disabled={sending}>
                Cancel
              </button>
            </div>
          </div>
        ) : (
          <div className="customer-profile-delete-actions">
            <button type="button" className="customer-primary-btn customer-danger-btn" onClick={() => setConfirming(true)}>
              Request account deletion
            </button>
            <Link to="/info/delete-account" className="customer-secondary-btn">
              Read the full details
            </Link>
          </div>
        ))
      )}
    </div>
  );
}

function InfoCard({ title, text }) {
  return (
    <div className="customer-help-card">
      <strong>{title}</strong>
      <p>{text}</p>
    </div>
  );
}
