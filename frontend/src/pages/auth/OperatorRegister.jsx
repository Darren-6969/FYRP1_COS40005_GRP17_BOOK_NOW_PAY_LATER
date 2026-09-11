import { useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../../services/api";
import "../../assets/styles/global.css";

const initialForm = {
  companyName: "",
  applicantName: "",
  email: "",
  phone: "",
  businessRegistrationNumber: "",
  businessAddress: "",
};

export default function OperatorRegister() {
  const navigate = useNavigate();
  const [form, setForm] = useState(initialForm);
  const [documents, setDocuments] = useState({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleChange = (event) => {
    setForm((current) => ({ ...current, [event.target.name]: event.target.value }));
    setError("");
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const payload = new FormData();
      Object.entries(form).forEach(([key, value]) => payload.append(key, value.trim()));
      Object.entries(documents).forEach(([type, file]) => {
        if (file) payload.append(`document_${type}`, file);
      });
      await api.post("/operator-applications", payload, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      setSubmitted(true);
    } catch (err) {
      setError(err.response?.data?.message || "Unable to submit your application.");
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <div className="bnpl-auth-page operator-register-page">
        <section className="bnpl-auth-shell operator-register-shell">
          <div className="bnpl-auth-panel">
            <div className="bnpl-auth-form">
              <h1>Application<br />submitted</h1>
              <p className="bnpl-auth-subtitle">An administrator will review your business documents. You will receive a password setup email only after approval.</p>
              <button className="bnpl-auth-submit" onClick={() => navigate("/login")}>Return to sign in</button>
            </div>
          </div>
        </section>
      </div>
    );
  }

  return (
    <div className="bnpl-auth-page operator-register-page">
      <section className="bnpl-auth-shell operator-register-shell">
        <div className="bnpl-auth-panel">
          <form onSubmit={handleSubmit} className="bnpl-auth-form">
            <h1>Apply to<br />sell</h1>
            <p className="bnpl-auth-subtitle">Submit your operator details for administrator review.</p>
            {error && <p className="bnpl-auth-error">{error}</p>}
            <input name="companyName" placeholder="Business name" value={form.companyName} onChange={handleChange} required disabled={loading} />
            <input name="applicantName" placeholder="Owner full name" value={form.applicantName} onChange={handleChange} required disabled={loading} />
            <input name="email" type="email" placeholder="Business email" value={form.email} onChange={handleChange} required disabled={loading} />
            <input name="phone" placeholder="Phone number" value={form.phone} onChange={handleChange} disabled={loading} />
            <input name="businessRegistrationNumber" placeholder="Business registration number" value={form.businessRegistrationNumber} onChange={handleChange} required disabled={loading} />
            <textarea name="businessAddress" placeholder="Business address" value={form.businessAddress} onChange={handleChange} required disabled={loading} rows={3} />
            <label>Business registration document<input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setDocuments((current) => ({ ...current, BUSINESS_REGISTRATION: event.target.files[0] }))} required disabled={loading} /></label>
            <label>Business licence, if applicable<input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setDocuments((current) => ({ ...current, BUSINESS_LICENSE: event.target.files[0] }))} disabled={loading} /></label>
            <label>Owner identity document<input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setDocuments((current) => ({ ...current, OWNER_IDENTITY: event.target.files[0] }))} required disabled={loading} /></label>
            <button className="bnpl-auth-submit" disabled={loading}>{loading ? "Submitting..." : "Submit application"}</button>
            <p className="bnpl-auth-switch"><button type="button" onClick={() => navigate("/login")}>Return to sign in</button></p>
          </form>
        </div>
      </section>
    </div>
  );
}
