import { useEffect, useState } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { submitCustomerReceipt } from "../../hooks/useReceipts";
import { refreshNotifications } from "../../utils/notifyRefresh";
import { useCustomerBooking } from "../../hooks/useBookings";
import { useFeatureFlag } from "../../hooks/useFeatureFlag";
import { getCustomerManualPaymentOptions } from "../../services/customer_service";
import { formatCustomerDate, formatMoney } from "../../utils/customerUtils";

function compressImageToDataUrl(file, maxWidth = 900, quality = 0.72) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = () => {
      const image = new Image();

      image.onload = () => {
        const scale = Math.min(1, maxWidth / image.width);
        const canvas = document.createElement("canvas");

        canvas.width = Math.round(image.width * scale);
        canvas.height = Math.round(image.height * scale);

        const ctx = canvas.getContext("2d");
        ctx.drawImage(image, 0, 0, canvas.width, canvas.height);

        const compressedDataUrl = canvas.toDataURL("image/jpeg", quality);
        resolve(compressedDataUrl);
      };

      image.onerror = () => reject(new Error("Failed to load receipt image."));
      image.src = reader.result;
    };

    reader.onerror = () => reject(new Error("Failed to read receipt image."));
    reader.readAsDataURL(file);
  });
}

export default function UploadReceipt() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { booking, loading: bookingLoading } = useCustomerBooking(id);
  const { enabled: receiptUploadEnabled, loading: flagLoading } = useFeatureFlag(
    "allowReceiptUpload",
    booking?.operatorId
  );

  const [form, setForm] = useState({
    method: "DUITNOW",
    // Filled in from the payment schedule once it has loaded.
    paymentType: searchParams.get("paymentType") || "",
    imageUrl: "",
    remarks: "",
  });

  const [preview, setPreview] = useState("");
  const [fileName, setFileName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!bookingLoading && !flagLoading && !receiptUploadEnabled) {
      navigate(`/customer/bookings/${id}`, { replace: true });
    }
  }, [bookingLoading, flagLoading, receiptUploadEnabled, navigate, id]);

  const [due, setDue] = useState(null);

  // The amount, reference and due date come from the payment schedule, so the
  // customer pays the exact figure the operator will check the receipt against.
  useEffect(() => {
    let cancelled = false;
    getCustomerManualPaymentOptions(id)
      .then((res) => {
        if (cancelled) return;
        setDue(res.data);
        setForm((prev) => {
          const wanted = res.data.options.find(
            (item) => item.paymentType === prev.paymentType && item.available
          );
          return {
            ...prev,
            paymentType: wanted ? wanted.paymentType : res.data.defaultPaymentType || "",
          };
        });
      })
      .catch((err) => {
        if (!cancelled) setError(err.response?.data?.message || "Could not load the amount to pay.");
      });
    return () => {
      cancelled = true;
    };
  }, [id]);

  if (bookingLoading || flagLoading || !receiptUploadEnabled) return null;

  const availableOptions = due ? due.options.filter((item) => item.available) : [];
  const selected = availableOptions.find((item) => item.paymentType === form.paymentType);

const handleFileChange = async (event) => {
  const file = event.target.files?.[0];

  setError("");

  if (!file) {
    setPreview("");
    setFileName("");
    setForm((prev) => ({ ...prev, imageUrl: "" }));
    return;
  }

  if (!file.type.startsWith("image/")) {
    setError("Please upload an image file such as JPG, PNG, or WEBP.");
    return;
  }

  const maxSizeMb = 5;
  const maxSizeBytes = maxSizeMb * 1024 * 1024;

  if (file.size > maxSizeBytes) {
    setError(`Receipt image must be smaller than ${maxSizeMb}MB.`);
    return;
  }

  try {
    const compressed = await compressImageToDataUrl(file);

    setPreview(compressed);
    setFileName(file.name);
    setForm((prev) => ({
      ...prev,
      imageUrl: compressed,
    }));
  } catch (err) {
    setError(err.message || "Failed to process receipt image.");
  }
};

  const handleSubmit = async (event) => {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      if (!form.paymentType) {
        setError("There is nothing to pay by receipt for this booking right now.");
        return;
      }

      if (!form.imageUrl) {
        setError("Please upload a receipt image before submitting.");
        return;
      }

      await submitCustomerReceipt(id, form);
      refreshNotifications();
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
        <form className="customer-glass-card customer-receipt-form" onSubmit={handleSubmit}>
          <p className="customer-eyebrow">Manual Payment</p>
          <h1>Upload Receipt</h1>
          <p className="customer-muted">
            For DuitNow/SPay, the host will verify your proof of payment before confirmation.
          </p>

          {error && <div className="customer-alert customer-alert-danger">{error}</div>}

          {due && selected && (
            <div className="customer-manual-payment-panel">
              {availableOptions.length > 1 && (
                <label className="customer-field">
                  <span>What are you paying?</span>
                  <select
                    value={form.paymentType}
                    onChange={(event) =>
                      setForm({ ...form, paymentType: event.target.value })
                    }
                  >
                    {availableOptions.map((item) => (
                      <option key={item.paymentType} value={item.paymentType}>
                        {item.label} - {formatMoney(item.amount)}
                      </option>
                    ))}
                  </select>
                </label>
              )}

              <div className="customer-info-list compact">
                <div>
                  <span>Amount to pay</span>
                  <strong>{formatMoney(selected.amount)}</strong>
                </div>
                <div>
                  <span>Payment reference</span>
                  <strong>{due.reference}</strong>
                </div>
                <div>
                  <span>Pay by</span>
                  <strong>{formatCustomerDate(selected.dueDate)}</strong>
                </div>
              </div>

              <p className="customer-payment-note">
                Pay exactly this amount and put the reference in your payment
                remarks, so the operator can match your receipt.
                {due.note ? ` ${due.note}` : ""}
              </p>

              {selected.replacesPendingReceipt && (
                <p className="customer-payment-note">
                  A receipt for this payment is already waiting to be verified.
                  Uploading again replaces it.
                </p>
              )}
            </div>
          )}

          {due && !selected && (
            <div className="customer-alert customer-alert-danger">
              There is nothing to pay by receipt for this booking right now.
            </div>
          )}

          <label className="customer-field">
            <span>Payment Method</span>
            <select
              value={form.method}
              onChange={(event) =>
                setForm({
                  ...form,
                  method: event.target.value,
                })
              }
            >
              <option value="DUITNOW">DuitNow</option>
              <option value="SPAY">SPay</option>
            </select>
          </label>

          <label className="customer-field">
            <span>Receipt Image</span>

            <div className="customer-upload-box">
              <input
                id="receipt-upload"
                type="file"
                accept="image/*"
                onChange={handleFileChange}
              />

              <label htmlFor="receipt-upload" className="customer-upload-dropzone">
                {preview ? (
                  <img src={preview} alt="Receipt preview" />
                ) : (
                  <div>
                    <strong>Click to upload receipt image</strong>
                    <small>JPG, PNG, or WEBP. Max 3MB.</small>
                  </div>
                )}
              </label>

              {fileName && <p className="customer-upload-file-name">{fileName}</p>}
            </div>
          </label>

          <label className="customer-field">
            <span>Remarks</span>
            <textarea
              placeholder="Optional remarks"
              value={form.remarks}
              onChange={(event) =>
                setForm({
                  ...form,
                  remarks: event.target.value,
                })
              }
            />
          </label>

          <button className="customer-primary-btn full" disabled={loading || !selected}>
            {loading ? "Submitting..." : "Submit Receipt"}
          </button>
        </form>
      </section>
    </div>
  );
}