import {
  useEffect,
  useState,
} from "react";

import {
  FileCheck2,
  UploadCloud,
  ShieldCheck,
  Clock3,
} from "lucide-react";

import {
  getMyLicenceDocument,
  submitLicenceDocument,
} from "../../services/customer_service";

import CustomerPermitPanel from "../../components/customer/CustomerPermitPanel";

export default function CustomerLicence() {
  const [document, setDocument] =
    useState(null);

  const [canReupload, setCanReupload] =
    useState(true);

  const [file, setFile] =
    useState(null);

  // BNPLB-180: entered with every licence upload.
  const [holderName, setHolderName] =
    useState("");
  const [expiresAt, setExpiresAt] =
    useState("");
  const [issuingCountry, setIssuingCountry] =
    useState("Malaysia");

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [error, setError] =
    useState("");

  const load = async () => {
    try {
      const res =
        await getMyLicenceDocument();

      setDocument(
        res.data.document
      );

      setCanReupload(
        res.data.canReupload
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load licence status."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const submit =
    async (event) => {
      event.preventDefault();

      if (!file) return;

      if (holderName.trim().length < 2 || !expiresAt || issuingCountry.trim().length < 2) {
        setError("Enter the name on the licence, its expiry date and the country that issued it.");
        return;
      }

      try {
        setSaving(true);
        setError("");
        setMessage("");

        await submitLicenceDocument(
          file,
          {
            holderName: holderName.trim(),
            expiresAt,
            issuingCountry: issuingCountry.trim(),
          }
        );

        setFile(null);
        setExpiresAt("");

        setMessage(
          document?.status ===
            "APPROVED"
            ? "Your renewed licence has been submitted for review."
            : "Licence submitted for preliminary review."
        );

        await load();
      } catch (err) {
        setError(
          err.response?.data?.message ||
            "Failed to submit licence."
        );
      } finally {
        setSaving(false);
      }
    };

  if (loading) {
    return (
      <section className="card">
        Loading licence status...
      </section>
    );
  }

  const status =
    document?.status ||
    "NOT_SUBMITTED";

  const isApproved =
    status === "APPROVED";

  const isUnderReview =
    status === "UNDER_REVIEW";

  const statusLabel = {
    APPROVED:
      "Approved",

    UNDER_REVIEW:
      "Under review",

    REUPLOAD_REQUIRED:
      "Re-upload required",

    REJECTED:
      "Rejected",

    NOT_SUBMITTED:
      "Not Submitted",
  }[status] || status;

  return (
    <div className="page-stack">
      <section className="card customer-licence-card">

        {/* Header */}
        <div className="licence-card-header">
          <div className="licence-heading">
            <div className="licence-heading-icon">
              <ShieldCheck
                size={28}
              />
            </div>

            <div>
              <h2>
                Driving Licence
              </h2>

              <p>
                Upload your driving
                licence for preliminary
                verification before
                vehicle pickup.
              </p>
            </div>
          </div>

          {document && (
            <span
              className={`licence-status-badge ${status
                .toLowerCase()
                .replaceAll(
                  "_",
                  "-"
                )}`}
            >
              {isApproved && "✓ "}
              {statusLabel}
            </span>
          )}
        </div>

        {/* Success Message */}
        {message && (
          <div className="licence-alert success">
            {message}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="licence-alert danger">
            {error}
          </div>
        )}

        {/* Approved Information */}
        {isApproved && (
          <div className="licence-info-box approved">
            <div className="licence-info-icon">
              <FileCheck2
                size={24}
              />
            </div>

            <div>
              <strong>
                Licence verified
              </strong>

              <p>
                Your current driving
                licence has been
                approved.
              </p>

              <p>
                Renewed or replaced
                your licence? Upload
                the latest version
                below.
              </p>
            </div>
          </div>
        )}

        {/* Under Review */}
        {isUnderReview && (
          <div className="licence-info-box pending">
            <div className="licence-info-icon">
              <Clock3
                size={24}
              />
            </div>

            <div>
              <strong>
                Verification in
                progress
              </strong>

              <p>
                Your licence has been
                submitted and is
                waiting for operator
                review.
              </p>
            </div>
          </div>
        )}

        {/* Rejection Reason */}
        {document?.rejectionReason && (
          <div className="licence-alert danger">
            Rejection reason:{" "}
            {document.rejectionReason
              .replaceAll(
                "_",
                " "
              )
              .toLowerCase()}
          </div>
        )}

        {/* Upload */}
        {canReupload && (
          <form
            className="licence-upload-panel"
            onSubmit={submit}
          >
            <label className="licence-upload-area">
              <input
                type="file"
                accept=".pdf,.png,.jpg,.jpeg"
                onChange={(
                  event
                ) =>
                  setFile(
                    event.target
                      .files?.[0] ||
                      null
                  )
                }
                required
              />

              <div className="licence-upload-icon">
                <UploadCloud
                  size={30}
                />
              </div>

              <div className="licence-upload-text">
                <strong>
                  {file
                    ? file.name
                    : "Choose licence file"}
                </strong>

                <span>
                  PDF, PNG, JPG or
                  JPEG · Maximum 5 MB
                </span>
              </div>
            </label>

            <div className="licence-details-fields">
              <label>
                Name on the licence
                <input
                  type="text"
                  maxLength={120}
                  value={holderName}
                  placeholder="As printed on the licence"
                  onChange={(event) => setHolderName(event.target.value)}
                  required
                />
              </label>
              <label>
                Expiry date
                <input
                  type="date"
                  value={expiresAt}
                  onChange={(event) => setExpiresAt(event.target.value)}
                  required
                />
              </label>
              <label>
                Issued in
                <input
                  type="text"
                  maxLength={60}
                  value={issuingCountry}
                  onChange={(event) => setIssuingCountry(event.target.value)}
                  required
                />
              </label>
            </div>

            <button
              className="btn primary licence-upload-button"
              type="submit"
              disabled={
                saving || !file
              }
            >
              {saving
                ? "Uploading..."
                : isApproved
                  ? "Upload renewed licence"
                  : "Submit licence"}
            </button>
          </form>
        )}

        <div className="licence-footer-note">
          The original driving
          licence will still be
          verified during vehicle
          pickup.
        </div>
      </section>

      {/* International Driving Permit */}
      <CustomerPermitPanel />
      
    </div>
  );
}