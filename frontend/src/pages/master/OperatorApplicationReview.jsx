import { useEffect, useState } from "react";
import {
  getOperatorApplications,
  getOperatorDocument,
  reviewOperatorApplication,
} from "../../services/admin_service";

const TYPE_LABELS = {
  CAR_RENTAL: "Car rental company",
  TOUR_GUIDE: "Tour guide",
  DRIVER: "Driver",
};

// Same names as DOCUMENT_LABELS in backend/src/services/operator_type_rules.js.
const DOCUMENT_LABELS = {
  BUSINESS_REGISTRATION: "Business registration (SSM)",
  BUSINESS_LICENSE: "Business licence",
  OWNER_IDENTITY: "Identity card or passport",
  TOURIST_GUIDE_LICENCE: "Tourist guide licence (MOTAC)",
  DRIVING_LICENCE: "Driving licence",
  PSV_LICENCE: "PSV licence",
};

// The documents to check before approving each type.
const APPROVAL_CHECK = {
  CAR_RENTAL: "Check the business licence and every submitted document.",
  TOUR_GUIDE: "Check the MOTAC tourist guide licence is valid and matches the ID.",
  DRIVER: "Check the driving licence and PSV licence are valid and match the ID.",
};

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
      const response = await reviewOperatorApplication(application.id, decision, reason.trim());
      setMessage(response.data.message || `Application ${decision.toLowerCase()} successfully.`);
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
            <p>Check the documents for the applicant's type before approval creates the organisation and first manager account.</p>
            <p className="text-danger">Approval publishes every listing this operator holds.</p>
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
              <p>
                <span className="badge">{TYPE_LABELS[application.operator?.operatorType] || TYPE_LABELS.CAR_RENTAL}</span>{" "}
                {APPROVAL_CHECK[application.operator?.operatorType] || APPROVAL_CHECK.CAR_RENTAL}
              </p>
              <p>
                {application.operator?.email}
                {application.businessRegistrationNumber ? ` · ${application.businessRegistrationNumber}` : " · No registration number"}
              </p>
              <p>Status: {application.status} · Submitted: {new Date(application.submittedAt).toLocaleString()}</p>
              {(application.documents || []).map((document) => (
                <div key={document.id}>
                  <button className="btn link" type="button" onClick={() => viewDocument(document)}>
                    {DOCUMENT_LABELS[document.documentType] || document.documentType}: {document.originalName}
                  </button>
                  <span> ({document.status})</span>
                </div>
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
