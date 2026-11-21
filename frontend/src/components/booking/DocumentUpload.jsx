import { useId, useState } from "react";
import { FileText, UploadCloud, X } from "lucide-react";

import DatePicker from "../common/DatePicker";

// Upload area for a driving licence or international driving permit.
// The real file input sits inside the label (visually hidden), so clicking,
// keyboard and screen readers work; dragging a file onto the area works too.

const ACCEPTED = ["application/pdf", "image/jpeg", "image/png"];
const MAX_BYTES = 5 * 1024 * 1024;

function fileSize(bytes) {
  return bytes < 1024 * 1024
    ? `${Math.max(1, Math.round(bytes / 1024))} KB`
    : `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocumentUpload({
  buttonLabel,
  needsExpiry = false,
  minExpiry,
  onUpload,
}) {
  const inputId = useId();
  const expiryId = useId();
  const [file, setFile] = useState(null);
  const [expiry, setExpiry] = useState("");
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const choose = (selected) => {
    setError("");
    if (!selected) return;
    if (!ACCEPTED.includes(selected.type)) {
      setError("Choose a PDF, JPG or PNG file.");
      return;
    }
    if (selected.size > MAX_BYTES) {
      setError("The file is larger than 5 MB. Choose a smaller one.");
      return;
    }
    setFile(selected);
  };

  const submit = async (event) => {
    event.preventDefault();
    if (!file) {
      setError("Choose a file first.");
      return;
    }
    if (needsExpiry && !expiry) {
      setError("Enter the date the permit is valid until.");
      return;
    }
    try {
      setBusy(true);
      setError("");
      await onUpload(file, expiry);
      setFile(null);
      setExpiry("");
    } catch (err) {
      setError(err.response?.data?.message || "The upload didn't work. Try again.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <form className="doc-upload" onSubmit={submit} noValidate>
      <div className="doc-upload-main">
      {file ? (
        <div className="doc-upload-file">
          <FileText size={20} aria-hidden="true" />
          <div>
            <strong>{file.name}</strong>
            <span>{fileSize(file.size)}</span>
          </div>
          <button
            type="button"
            className="doc-upload-remove"
            onClick={() => setFile(null)}
            disabled={busy}
            aria-label={`Remove ${file.name}`}
          >
            <X size={16} aria-hidden="true" />
          </button>
        </div>
      ) : (
        <label
          htmlFor={inputId}
          className={`doc-upload-drop ${dragging ? "dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDragging(true);
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            choose(event.dataTransfer.files?.[0]);
          }}
        >
          <UploadCloud size={24} aria-hidden="true" />
          <span>
            <strong>Choose a file</strong> or drop it here
          </span>
          <small>PDF, JPG or PNG, up to 5 MB</small>
          <input
            id={inputId}
            type="file"
            className="doc-upload-input"
            accept=".pdf,image/jpeg,image/png"
            onChange={(event) => {
              choose(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </label>
      )}
      </div>

      {/* Date (permit only) and the upload button sit beside the drop area
          on wide screens and below it on phones. */}
      <div className="doc-upload-side">
        {needsExpiry && (
          <div className="doc-upload-field">
            <label htmlFor={expiryId}>Permit valid until</label>
            <DatePicker
              id={expiryId}
              value={expiry}
              min={minExpiry}
              placeholder="Choose the date"
              onChange={(event) => {
                setExpiry(event.target.value);
                setError("");
              }}
            />
          </div>
        )}

        <button type="submit" className="customer-primary-btn doc-upload-submit" disabled={busy}>
          {busy ? "Uploading..." : buttonLabel}
        </button>
      </div>

      {error && (
        <p className="doc-upload-error" role="alert">
          {error}
        </p>
      )}
    </form>
  );
}
