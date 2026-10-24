import { useId, useState } from "react";
import { Link } from "react-router-dom";
import api from "../../services/api";
import AuthShell, {
  AuthField,
  AuthMessage,
  AuthTitle,
  FieldError,
  SubmitButton,
} from "../../components/auth/AuthShell";
import { ArrowLeft } from "../../components/auth/AuthPanels";
import { emailProblem, requestError, useFormErrors } from "../../components/auth/authForm";
import styles from "../../assets/styles/public/Auth.module.css";

const initialForm = {
  companyName: "",
  applicantName: "",
  email: "",
  phone: "",
  businessRegistrationNumber: "",
  businessAddress: "",
};

// The server takes files up to 3 MB (operator_application_routes.js).
const MAX_FILE_BYTES = 3 * 1024 * 1024;

const DOCUMENTS = [
  {
    type: "BUSINESS_REGISTRATION",
    label: "Business registration document",
    required: true,
  },
  {
    type: "BUSINESS_LICENSE",
    label: "Business licence, if you have one",
    required: false,
  },
  { type: "OWNER_IDENTITY", label: "Owner identity document", required: true },
];

function FileIcon() {
  return (
    <svg
      width="20"
      height="20"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
      <path d="M14 2v6h6" />
    </svg>
  );
}

function DocumentUpload({ label, required, file, error, onChange, disabled }) {
  const id = useId();
  const status = file ? file.name : `${required ? "Required" : "Optional"} · PDF, PNG or JPG, up to 3 MB`;
  const rowClass = [styles.upload, file && !error ? styles.uploadChosen : "", error ? styles.uploadInvalid : ""].join(
    " "
  );
  return (
    <div className={styles.field}>
      <div className={rowClass}>
        <span className={styles.uploadIcon}>
          <FileIcon />
        </span>
        <span className={styles.uploadText}>
          <span className={styles.uploadName} id={`${id}-name`}>
            {label}
          </span>
          <span className={styles.uploadMeta} id={`${id}-meta`}>
            {status}
          </span>
        </span>
        <label className={styles.pick}>
          {file ? "Change file" : "Choose file"}
          <input
            type="file"
            accept=".pdf,.png,.jpg,.jpeg"
            onChange={(event) => onChange(event.target.files?.[0] || null)}
            aria-required={required}
            aria-invalid={error ? true : undefined}
            disabled={disabled}
            aria-labelledby={`${id}-name`}
            aria-describedby={[error ? `${id}-error` : "", `${id}-meta`].join(" ").trim()}
          />
        </label>
      </div>
      <FieldError id={`${id}-error`}>{error}</FieldError>
    </div>
  );
}

function documentProblem(doc, file) {
  if (!file) return doc.required ? `Add the ${doc.label.toLowerCase()}.` : "";
  if (file.size > MAX_FILE_BYTES) return "This file is over 3 MB. Upload a smaller scan or photo.";
  return "";
}

export default function OperatorRegister() {
  const [form, setForm] = useState(initialForm);
  const [documents, setDocuments] = useState({});
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const errors = useFormErrors();

  const handleChange = (event) => {
    setForm((current) => ({
      ...current,
      [event.target.name]: event.target.value,
    }));
    errors.clearField(event.target.name);
  };

  const required = (value, message) => (value.trim() ? "" : message);

  const handleSubmit = async (event) => {
    event.preventDefault();

    const valid = errors.check({
      companyName: required(form.companyName, "Enter the business name."),
      businessRegistrationNumber: required(form.businessRegistrationNumber, "Enter the registration number."),
      businessAddress: required(form.businessAddress, "Enter the business address."),
      applicantName: required(form.applicantName, "Enter the owner's full name."),
      email: emailProblem(form.email),
      ...Object.fromEntries(DOCUMENTS.map((doc) => [doc.type, documentProblem(doc, documents[doc.type])])),
    });
    if (!valid) return;

    setLoading(true);
    errors.clear();

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
      window.scrollTo(0, 0);
    } catch (err) {
      errors.fail(requestError(err, "We couldn't send your application. Your details are kept, please try again."));
    } finally {
      setLoading(false);
    }
  };

  if (submitted) {
    return (
      <AuthShell surface="operator" wide joinStep={1}>
        <span className={styles.doneIcon} aria-hidden="true">
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M20 6 9 17l-5-5" />
          </svg>
        </span>
        <AuthTitle title="Application sent" />
        <p className={styles.bodyText}>
          We check your business details and documents, then email {form.email.trim() || "you"} with the result. Once
          approved, that email has a link to set your password and open your dashboard.
        </p>
        <Link to="/" className={styles.back}>
          <ArrowLeft />
          Back to the site
        </Link>
      </AuthShell>
    );
  }

  return (
    <AuthShell
      surface="operator"
      wide
      split
      topRight={
        <>
          Already approved? <Link to="/login">Sign in</Link>
        </>
      }
    >
      <AuthTitle title="Apply to list your cars" lede="We review every business before it goes live." />
      {errors.message && (
        <AuthMessage tone="error" attempt={errors.attempt}>
          {errors.message}
        </AuthMessage>
      )}

      <form onSubmit={handleSubmit} className={`${styles.form} ${styles.formColumns}`} noValidate>
        <div className={styles.formColumn}>
          <h2 className={styles.section}>Business</h2>
          <div className={styles.pair}>
            <AuthField
              label="Business name"
              name="companyName"
              value={form.companyName}
              onChange={handleChange}
              autoComplete="organization"
              required
              disabled={loading}
              error={errors.fields.companyName}
            />
            <AuthField
              label="Registration number"
              name="businessRegistrationNumber"
              value={form.businessRegistrationNumber}
              onChange={handleChange}
              autoComplete="off"
              required
              disabled={loading}
              error={errors.fields.businessRegistrationNumber}
            />
          </div>
          <AuthField
            label="Business address"
            name="businessAddress"
            multiline
            rows={3}
            value={form.businessAddress}
            onChange={handleChange}
            autoComplete="street-address"
            required
            disabled={loading}
            error={errors.fields.businessAddress}
          />

          <h2 className={styles.section}>Owner and contact</h2>
          <div className={styles.pair}>
            <AuthField
              label="Owner full name"
              name="applicantName"
              value={form.applicantName}
              onChange={handleChange}
              autoComplete="name"
              required
              disabled={loading}
              error={errors.fields.applicantName}
            />
            <AuthField
              label="Phone number"
              name="phone"
              type="tel"
              value={form.phone}
              onChange={handleChange}
              autoComplete="tel"
              optional
              disabled={loading}
            />
          </div>
          <AuthField
            label="Business email"
            name="email"
            type="email"
            value={form.email}
            onChange={handleChange}
            autoComplete="email"
            required
            disabled={loading}
            error={errors.fields.email}
            helper="Once your business is approved, we send the approval email to this address, with a link to create your password."
          />
        </div>

        <div className={styles.formColumn}>
          <h2 className={styles.section}>Documents</h2>
          <p className={styles.sectionNote}>Stored privately. Only our review team opens them.</p>
          {DOCUMENTS.map((doc) => (
            <DocumentUpload
              key={doc.type}
              label={doc.label}
              required={doc.required}
              file={documents[doc.type]}
              error={errors.fields[doc.type]}
              disabled={loading}
              onChange={(file) => {
                setDocuments((current) => ({ ...current, [doc.type]: file }));
                errors.clearField(doc.type);
              }}
            />
          ))}

          <SubmitButton busy={loading} busyLabel="Submitting...">
            Submit application
          </SubmitButton>
        </div>
      </form>
    </AuthShell>
  );
}
