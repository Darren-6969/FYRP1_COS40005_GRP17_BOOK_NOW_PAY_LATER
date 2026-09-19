import { useEffect, useState } from "react";
import {
  downloadLicenceDocument,
  getLicenceQueue,
  reviewLicenceDocument,
} from "../../services/admin_service";

const reasons = [
  ["EXPIRED", "Expired document"],
  ["UNREADABLE", "Unreadable image"],
  ["NOT_A_LICENCE", "Not a driving licence"],
];

export default function LicenceVerification() {
  const [documents, setDocuments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getLicenceQueue();
      setDocuments(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load licence queue.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const viewDocument = async (document) => {
    try {
      const response = await downloadLicenceDocument(document.id);
      const url = URL.createObjectURL(response.data);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to open licence.");
    }
  };

  const review = async (document, decision) => {
    const reason = decision === "REJECTED"
      ? window.prompt(`Rejection reason: ${reasons.map(([, label]) => label).join(", ")}`)
      : "";
    if (decision === "REJECTED" && !reasons.some(([value]) => value === String(reason || "").toUpperCase())) return;

    try {
      setError("");
      setMessage("");
      await reviewLicenceDocument(document.id, decision, reason);
      setMessage(`Licence ${decision.toLowerCase()}. The customer was notified when re-upload was required.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to review licence.");
    }
  };

  if (loading) return <section className="card">Loading licence queue...</section>;

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Licence Verification Queue</h3>
            <p>Preliminary review only. Staff verify the original licence at pickup. Review the oldest SLA deadline first.</p>
          </div>
          <button className="btn" type="button" onClick={load}>Refresh</button>
        </div>
        {error && <div className="alert danger">{error}</div>}
        {message && <div className="alert">{message}</div>}
        {documents.length === 0 && <p>No licences are waiting for preliminary review.</p>}
        {documents.map((document) => (
          <div className="list-row" key={document.id}>
            <div>
              <strong>{document.customer?.name} · {document.originalName}</strong>
              <p>{document.customer?.email} · Submitted {new Date(document.submittedAt).toLocaleString()}</p>
              <p className={document.sla?.overdue ? "text-danger" : ""}>
                SLA: {document.sla?.overdue ? "OVERDUE" : `${document.sla?.hoursRemaining}h remaining`} · Due {new Date(document.reviewDueAt).toLocaleString()}
              </p>
              <button className="btn link" type="button" onClick={() => viewDocument(document)}>Open document</button>
            </div>
            <div className="actions">
              <button className="btn primary" type="button" onClick={() => review(document, "APPROVED")}>Preliminarily approve</button>
              <button className="btn danger" type="button" onClick={() => review(document, "REJECTED")}>Reject for re-upload</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
