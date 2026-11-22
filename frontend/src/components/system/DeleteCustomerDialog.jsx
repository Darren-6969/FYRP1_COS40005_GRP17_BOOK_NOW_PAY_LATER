import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { deleteCustomerAccount, getCustomerDeletionPreview } from "../../services/admin_service";
import styles from "../../assets/styles/master/Customers.module.css";

// Deleting a customer account on the customer's request. Shows what is
// removed and what is kept, lists anything that must be finished first, and
// asks the admin to type the account's email before the button works.
export default function DeleteCustomerDialog({ customerId, onClose, onDeleted }) {
  const [preview, setPreview] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [typed, setTyped] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [serverBlockers, setServerBlockers] = useState(null);
  const inputRef = useRef(null);

  useEffect(() => {
    let current = true;
    getCustomerDeletionPreview(customerId)
      .then((res) => current && setPreview(res.data))
      .catch((err) => current && setLoadError(err.response?.data?.message || "Could not check this account."));
    return () => {
      current = false;
    };
  }, [customerId]);

  useEffect(() => {
    if (preview?.canDelete) inputRef.current?.focus();
  }, [preview]);

  useEffect(() => {
    const onKey = (event) => {
      if (event.key === "Escape" && !busy) onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [busy, onClose]);

  const email = preview?.customer?.email || "";
  const matches = typed.trim().toLowerCase() === email.toLowerCase() && email !== "";
  const blockers = serverBlockers || preview?.blockers || [];
  const canDelete = Boolean(preview?.canDelete) && !serverBlockers;

  const confirm = async (event) => {
    event.preventDefault();
    if (!matches || !canDelete || busy) return;
    setBusy(true);
    setError("");
    try {
      const res = await deleteCustomerAccount(customerId, typed.trim());
      await onDeleted(res.data);
    } catch (err) {
      const data = err.response?.data;
      if (data?.code === "ACCOUNT_DELETION_BLOCKED" && data.details?.blockers) {
        setServerBlockers(data.details.blockers);
      } else {
        setError(data?.message || "The account could not be deleted. Nothing was changed.");
      }
      setBusy(false);
    }
  };

  return (
    <div className="admin-modal-backdrop" onClick={() => !busy && onClose()}>
      <div
        className={`admin-document-modal ${styles.dialog}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="delete-customer-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="section-header">
          <div>
            <h3 id="delete-customer-title">Delete account</h3>
            <p>
              {preview?.customer ? `${preview.customer.name} · ${preview.customer.userCode}` : "Checking the account..."}
            </p>
          </div>
          <button className="btn" type="button" disabled={busy} onClick={onClose}>
            Close
          </button>
        </div>

        {loadError && (
          <div className="alert danger" role="alert">
            {loadError}
          </div>
        )}

        {!preview && !loadError && <p className="master-muted">Checking what this account still has open...</p>}

        {preview?.alreadyDeleted && <div className="alert">This account has already been deleted.</div>}

        {preview && !preview.alreadyDeleted && (
          <form onSubmit={confirm}>
            {blockers.length > 0 && (
              <div className={styles.blockers} role="alert">
                <h5>This account cannot be deleted yet</h5>
                <ul>
                  {blockers.map((blocker, index) => (
                    <li key={`${blocker.code}-${blocker.bookingId || blocker.refundId || index}`}>
                      {blocker.message}{" "}
                      {blocker.code === "BOOKING_NOT_FINISHED" && blocker.bookingCode && (
                        <Link to={`/master/bookings?q=${encodeURIComponent(blocker.bookingCode)}`}>Open booking</Link>
                      )}
                      {blocker.code === "REFUND_OPEN" && <Link to="/master/refunds">Open refunds</Link>}
                      {blocker.code === "CREDIT_APPEAL_OPEN" && <Link to="/master/credit-appeals">Open appeals</Link>}
                    </li>
                  ))}
                </ul>
                <p className="master-muted">Tell the customer what needs to finish first, then try again.</p>
              </div>
            )}

            {preview.summary && (
              <div className={styles.lists}>
                <div className={`${styles.listBox} ${styles.removed}`}>
                  <h5>Removed</h5>
                  <ul>
                    {preview.summary.removed.map((item) => (
                      <li key={item.key}>
                        {item.label}
                        {item.count != null ? ` (${item.count})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
                <div className={`${styles.listBox} ${styles.kept}`}>
                  <h5>Kept as financial records</h5>
                  <ul>
                    {preview.summary.kept.map((item) => (
                      <li key={item.key}>
                        {item.label}
                        {item.count != null ? ` (${item.count})` : ""}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {canDelete && (
              <>
                <p className="master-muted">
                  This cannot be undone. The customer is signed out everywhere and gets a confirmation email.
                  Only do this when the customer asked, from the email address on the account.
                </p>
                <label className={styles.confirmField}>
                  <span>
                    Type <strong>{email}</strong> to confirm
                  </span>
                  <input
                    ref={inputRef}
                    type="email"
                    autoComplete="off"
                    spellCheck={false}
                    value={typed}
                    onChange={(event) => setTyped(event.target.value)}
                    disabled={busy}
                    aria-describedby="delete-customer-hint"
                  />
                  <span id="delete-customer-hint" className="master-muted">
                    The Delete button works once the email matches.
                  </span>
                </label>
              </>
            )}

            {error && (
              <div className="alert danger" role="alert">
                {error}
              </div>
            )}

            <div className={styles.dialogActions}>
              <button className="btn" type="button" disabled={busy} onClick={onClose}>
                Keep account
              </button>
              {canDelete && (
                <button className="btn danger" type="submit" disabled={!matches || busy}>
                  {busy ? "Deleting..." : "Delete account"}
                </button>
              )}
            </div>
          </form>
        )}
      </div>
    </div>
  );
}
