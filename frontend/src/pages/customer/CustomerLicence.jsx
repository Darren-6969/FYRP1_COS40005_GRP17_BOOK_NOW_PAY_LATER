import { useEffect, useState } from "react";
import { getMyLicenceDocument, submitLicenceDocument } from "../../services/customer_service";

export default function CustomerLicence() {
  const [document, setDocument] = useState(null);
  const [canReupload, setCanReupload] = useState(true);
  const [file, setFile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const res = await getMyLicenceDocument();
      setDocument(res.data.document);
      setCanReupload(res.data.canReupload);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load licence status.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const submit = async (event) => {
    event.preventDefault();
    if (!file) return;
    try {
      setSaving(true);
      setError("");
      await submitLicenceDocument(file);
      setFile(null);
      setMessage("Licence submitted for preliminary review.");
      await load();
    } catch (err) {
      setError(err.response?.data?.message || "Failed to submit licence.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) return <section className="card">Loading licence status...</section>;

  return (
    <div className="page-stack">
      <section className="card">
        <h3>Driving Licence</h3>
        <p>Staff verify the original licence at pickup. This upload is only a preliminary document check.</p>
        {message && <div className="alert">{message}</div>}
        {error && <div className="alert danger">{error}</div>}
        {document && <p>Status: <strong>{document.status}</strong>{document.rejectionReason ? ` · ${document.rejectionReason.replaceAll("_", " ")}` : ""}</p>}
        {canReupload && (
          <form className="admin-form-grid" onSubmit={submit}>
            <label>
              <span>Licence image or PDF</span>
              <input type="file" accept=".pdf,.png,.jpg,.jpeg" onChange={(event) => setFile(event.target.files?.[0] || null)} required />
            </label>
            <button className="btn primary" type="submit" disabled={saving}>{saving ? "Submitting..." : "Submit licence"}</button>
          </form>
        )}
      </section>
    </div>
  );
}