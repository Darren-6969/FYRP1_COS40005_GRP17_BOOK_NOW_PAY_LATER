import { useState } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { submitCustomerReceipt } from "../../hooks/useReceipts";

export default function UploadReceipt() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [form, setForm] = useState({
    method: "DUITNOW",
    imageUrl: "",
    remarks: "",
  });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      await submitCustomerReceipt(id, form);
      navigate(`/customer/payment-status/${id}`);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to upload receipt");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="customer-page">
      <section className="customer-form-wrap">
        <form className="customer-glass-card" onSubmit={handleSubmit}>
          <p className="customer-eyebrow">Manual Payment</p>
          <h1>Upload Receipt</h1>
          <p className="customer-muted">For DuitNow/SPay, the host will verify your proof of payment before confirmation.</p>

          {error && <div className="customer-alert customer-alert-danger">{error}</div>}

          <label className="customer-field">
            <span>Payment Method</span>
            <select value={form.method} onChange={(e) => setForm({ ...form, method: e.target.value })}>
              <option value="DUITNOW">DuitNow</option>
              <option value="SPAY">SPay</option>
            </select>
          </label>

          <label className="customer-field">
            <span>Receipt Image URL</span>
            <input
              placeholder="https://example.com/receipt.jpg"
              value={form.imageUrl}
              onChange={(e) => setForm({ ...form, imageUrl: e.target.value })}
            />
          </label>

          <label className="customer-field">
            <span>Remarks</span>
            <textarea
              placeholder="Optional remarks"
              value={form.remarks}
              onChange={(e) => setForm({ ...form, remarks: e.target.value })}
            />
          </label>

          <button className="customer-primary-btn full" disabled={loading}>
            {loading ? "Uploading..." : "Submit Receipt"}
          </button>
        </form>
      </section>
    </div>
  );
}
