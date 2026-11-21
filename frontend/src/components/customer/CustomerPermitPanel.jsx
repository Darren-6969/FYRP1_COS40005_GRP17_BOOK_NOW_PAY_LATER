
import { useEffect, useState } from "react";
import {
  FileCheck2,
  UploadCloud,
  ShieldCheck,
  Clock3,
} from "lucide-react";

import {
  getCustomerBookings,
  getMyPermit,
  submitPermitDocument,
} from "../../services/customer_service";

import "../../assets/styles/customer-lists.css";
import DatePicker from "../common/DatePicker";
import { klToday } from "../../utils/formatPublic";

const MAX_FILE_SIZE = 5 * 1024 * 1024;
const ACCEPTED_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/png",
];

const TERMINAL_STATUSES = [
  "COMPLETED",
  "CANCELLED",
  "EXPIRED",
  "REJECTED",
  "NO_SHOW",
  "NO_SHOW_UNPAID",
];

const STATUS_LABELS = {
  APPROVED: "Approved",
  UNDER_REVIEW: "Under review",
  REUPLOAD_REQUIRED: "Re-upload required",
  REJECTED: "Rejected",
  NOT_SUBMITTED: "Not submitted",
};

function formatDate(value) {
  if (!value) return "-";
  return String(value).slice(0, 10);
}

export default function CustomerPermitPanel() {
  const [bookings, setBookings] = useState([]);
  const [bookingId, setBookingId] = useState("");
  const [document, setDocument] = useState(null);
  const [canReupload, setCanReupload] = useState(true);

  const [file, setFile] = useState(null);
  const [expiryDate, setExpiryDate] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  // Load customer bookings
  useEffect(() => {
    let active = true;

    async function loadBookings() {
      try {
        const response = await getCustomerBookings();

        if (!active) return;

        const records = Array.isArray(response.data)
          ? response.data
          : [];

        const carBookings = records.filter(
          (booking) =>
            booking.serviceType === "CAR_RENTAL" &&
            !TERMINAL_STATUSES.includes(booking.status)
        );

        setBookings(carBookings);

        if (carBookings.length) {
          setBookingId(String(carBookings[0].id));
        }
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              "Unable to load your bookings."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadBookings();

    return () => {
      active = false;
    };
  }, []);

  // Load the permit for the selected booking
  useEffect(() => {
    if (!bookingId) {
      setDocument(null);
      return;
    }

    let active = true;

    async function loadPermit() {
      setLoading(true);
      setError("");
      setDocument(null);

      try {
        const response = await getMyPermit(bookingId);

        if (!active) return;

        setDocument(response.data.document || null);
        setCanReupload(
          response.data.canReupload ?? true
        );
      } catch (err) {
        if (active) {
          setError(
            err.response?.data?.message ||
              "Unable to load permit status."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    }

    loadPermit();

    return () => {
      active = false;
    };
  }, [bookingId]);

  const handleFileChange = (event) => {
    const selected = event.target.files?.[0] || null;

    setError("");
    setFile(null);

    if (!selected) return;

    if (!ACCEPTED_TYPES.includes(selected.type)) {
      setError("Please choose a PDF, JPG or PNG file.");
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setError("The file must not exceed 5 MB.");
      return;
    }

    setFile(selected);
  };

  const handleSubmit = async (event) => {
    event.preventDefault();

    if (!bookingId || !file || !expiryDate) {
      setError("Complete all required fields.");
      return;
    }

    const selectedBooking = bookings.find(
      (booking) => String(booking.id) === bookingId
    );

    const today = new Date().toLocaleDateString(
      "en-CA",
      { timeZone: "Asia/Kuching" }
    );

    if (expiryDate < today) {
      setError("The permit has already expired.");
      return;
    }

    const returnDate = formatDate(
      selectedBooking?.returnDate
    );

    if (returnDate !== "-" && expiryDate < returnDate) {
      setError(
        "Your permit must be valid through the rental return date."
      );
      return;
    }

    try {
      setSaving(true);
      setError("");
      setMessage("");

      await submitPermitDocument(
        bookingId,
        file,
        expiryDate
      );

      const response = await getMyPermit(bookingId);

      setDocument(response.data.document || null);
      setCanReupload(
        response.data.canReupload ?? false
      );

      setFile(null);
      setExpiryDate("");

      setMessage(
        "International permit submitted successfully. " +
        "The operator will review your document."
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to upload your permit."
      );
    } finally {
      setSaving(false);
    }
  };

  const status = document?.status || "NOT_SUBMITTED";

  const isApproved = status === "APPROVED";
  const isUnderReview = status === "UNDER_REVIEW";

  return (
    <section className="card customer-licence-card">
      <div className="licence-card-header">
        <div className="licence-heading">
          <div className="licence-heading-icon">
            <ShieldCheck size={28} />
          </div>

          <div>
            <h2>International Driving Permit</h2>
            <p>
              Upload your International Driving Permit
              for operator verification when required
              for your rental.
            </p>
          </div>
        </div>

        <span
          className={`licence-status-badge ${status
            .toLowerCase()
            .replaceAll("_", "-")}`}
        >
          {isApproved && "✓ "}
          {STATUS_LABELS[status] || status}
        </span>
      </div>

      {message && (
        <div className="licence-alert success">
          {message}
        </div>
      )}

      {error && (
        <div className="licence-alert danger">
          {error}
        </div>
      )}

      {/* Label above the picker, with space before the status box.
          It used the upload panel's two-column grid before, which put the
          picker against the box below. */}
      <div className="permit-booking-picker">
        <label htmlFor="permit-booking">
          Booking this permit is for
        </label>

        <select
          id="permit-booking"
          className="form-input"
          value={bookingId}
          onChange={(event) => {
            setBookingId(event.target.value);
            setFile(null);
            setExpiryDate("");
            setMessage("");
          }}
          disabled={loading || saving}
        >
          {!bookingId && (
            <option value="">Select a booking</option>
          )}

          {bookings.map((booking) => (
            <option key={booking.id} value={booking.id}>
              {booking.bookingCode || `BNPL-${booking.id}`}
              {" — "}
              {booking.serviceName ||
                booking.listing?.name ||
                "Car Rental"}
            </option>
          ))}
        </select>
      </div>

      {!loading && bookings.length === 0 && (
        <div className="licence-info-box pending">
          No active car rental booking is available
          for permit submission.
        </div>
      )}

      {loading && (
        <p>Loading permit information...</p>
      )}

      {!loading && bookingId && (
        <>
          {isApproved && (
            <div className="licence-info-box approved">
              <FileCheck2 size={24} />
              <div>
                <strong>Permit verified</strong>
                <p>
                  Your International Driving Permit
                  has been approved.
                </p>
                <p>
                  Expiry:{" "}
                  {formatDate(document.permitExpiryDate)}
                </p>
              </div>
            </div>
          )}

          {isUnderReview && (
            <div className="licence-info-box pending">
              <Clock3 size={24} />
              <div>
                <strong>Verification in progress</strong>
                <p>
                  Your permit is waiting for
                  operator approval.
                </p>
              </div>
            </div>
          )}

          {document?.rejectionReason && (
            <div className="licence-alert danger">
              Rejection reason:{" "}
              {document.rejectionReason
                .replaceAll("_", " ")
                .toLowerCase()}
            </div>
          )}

          {canReupload && (
            <form onSubmit={handleSubmit}>
              {/* The site's own date picker, stacked above the upload row
                  like the booking picker. */}
              <div className="permit-booking-picker">
                <label htmlFor="permit-expiry">
                  Permit valid until
                </label>

                <DatePicker
                  id="permit-expiry"
                  value={expiryDate}
                  min={klToday()}
                  placeholder="Choose the date"
                  onChange={(event) =>
                    setExpiryDate(event.target.value)
                  }
                  required
                />
              </div>

              <div className="licence-upload-panel">
              <label className="licence-upload-area">
                <input
                  key={`${bookingId}-${document?.id || "new"}`}
                  type="file"
                  accept=".pdf,.png,.jpg,.jpeg"
                  onChange={handleFileChange}
                />

                <div className="licence-upload-icon">
                  <UploadCloud size={30} />
                </div>

                <div className="licence-upload-text">
                  <strong>
                    {file
                      ? file.name
                      : "Choose your permit file"}
                  </strong>

                  <span>
                    PDF, PNG, JPG or JPEG · Maximum 5 MB
                  </span>
                </div>
              </label>

              <button
                className="btn primary licence-upload-button"
                type="submit"
                disabled={saving || !file || !expiryDate}
              >
                {saving
                  ? "Uploading..."
                  : "Submit permit"}
              </button>
              </div>
            </form>
          )}
        </>
      )}

      <div className="licence-footer-note">
        The original permit and driving licence
        may also need to be presented during
        vehicle pickup.
      </div>
    </section>
  );
}
