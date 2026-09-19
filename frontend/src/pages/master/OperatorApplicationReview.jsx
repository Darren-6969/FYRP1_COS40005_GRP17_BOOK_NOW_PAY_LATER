import { useEffect, useState } from "react";
import {
  getOperatorApplications,
  getOperatorDocument,
  reviewOperatorApplication,
} from "../../services/admin_service";

export default function OperatorApplicationReview() {
  const [applications, setApplications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const res = await getOperatorApplications();
      setApplications(res.data || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load operator applications.");
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
      const response = await getOperatorDocument(document.id);
      const url = URL.createObjectURL(response.data);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to open document.");
    }
  };

  const review = async (application, decision) => {
    const reason = window.prompt(`${decision === "APPROVED" ? "Approval" : "Rejection"} reason (required):`);
    if (!reason || reason.trim().length < 5) return;
    try {
      setError("");
      setMessage("");
      await reviewOperatorApplication(application.id, decision, reason.trim());
      setMessage(`Application ${decision.toLowerCase()} successfully.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to review operator application.");
    }
  };

  if (loading) return <section className="card">Loading operator applications...</section>;

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Operator Application Review</h3>
            <p>Check the submitted business licence and company information before approval creates the organisation and first manager account.</p>
          </div>
          <button className="btn" type="button" onClick={load}>Refresh</button>
        </div>
        {error && <div className="alert danger">{error}</div>}
        {message && <div className="alert">{message}</div>}
        {applications.length === 0 && <p>No operator applications are waiting for review.</p>}
        {applications.map((application) => (
          <div className="list-row" key={application.id}>
            <div>
              <strong>{application.operator?.companyName}</strong>
              <p>{application.operator?.email} · {application.businessRegistrationNumber}</p>
              <p>Status: {application.status} · Submitted: {new Date(application.submittedAt).toLocaleString()}</p>
              {(application.documents || []).map((document) => (
                <button className="btn link" key={document.id} type="button" onClick={() => viewDocument(document)}>
                  {document.documentType}: {document.originalName}
                </button>
              ))}
            </div>
            <div className="actions">
              <button className="btn primary" type="button" onClick={() => review(application, "APPROVED")}>Approve</button>
              <button className="btn danger" type="button" onClick={() => review(application, "REJECTED")}>Reject</button>
            </div>
          </div>
        ))}
      </section>
    </div>
  );
}
