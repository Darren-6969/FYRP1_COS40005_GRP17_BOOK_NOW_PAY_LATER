import { useRef, useState } from "react";
import { Link } from "react-router-dom";
import { formatCustomerDate, formatMoney, statusLabel } from "../../utils/customerUtils";
import {
  addBookingDriver,
  getBookingDriverOptions,
  getDriverDocument,
  reviewDriverLicence,
} from "../../services/driver_service";
import DriverPicker from "./DriverPicker";

// Independent drivers on the booking detail pages (operator types plan,
// Phase 4). A driver's job is its own booking, linked to the car booking it
// serves; both pages show the other side.

const sen = (n) => formatMoney((n || 0) / 100);

const ACCEPTED = ["PENDING_PAYMENT", "CONFIRMED", "PAID", "READY_FOR_PICKUP", "IN_PROGRESS"];

// True once an independent driver has accepted this car booking: the car
// operator then checks the driver's licence, not the customer's.
// eslint-disable-next-line react-refresh/only-export-components
export function hasAcceptedDriver(booking) {
  return ACCEPTED.includes(booking?.car?.independentDriver?.current?.status);
}

function newKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function hoursText(pricing) {
  if (!pricing?.lines?.length) return "-";
  return pricing.lines
    .map((line) => `${line.count} ${line.period}${line.count === 1 ? "" : "s"} × ${sen(line.rateSen)}`)
    .join(" + ");
}

// ── A driver's job ──────────────────────────────────────────────────

export function DriverJobPanel({ booking, variant = "customer" }) {
  const job = booking.driverJob;
  if (!job) return null;
  const car = job.car;
  const tripRows = [
    ["Starts", formatCustomerDate(job.startAt)],
    ["Ends", formatCustomerDate(job.endAt)],
    ["Pickup place", job.location || "-"],
  ];

  if (variant === "operator") {
    return (
      <div className="booking-clean-section">
        <h3>Driving job</h3>
        <div className="booking-clean-trip-grid">
          {tripRows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          {car && (
            <>
              <div>
                <span>Car</span>
                <strong>{car.name}</strong>
              </div>
              <div>
                <span>Car rented from</span>
                <strong>
                  {car.operator?.name || "-"}
                  {car.operator?.phone ? ` · ${car.operator.phone}` : ""}
                </strong>
              </div>
              <div>
                <span>Car booking</span>
                <strong>
                  {car.bookingCode} · {statusLabel(car.status)}
                </strong>
              </div>
            </>
          )}
          {job.contact?.phone && (
            <div>
              <span>Customer phone</span>
              <strong>{job.contact.phone}</strong>
            </div>
          )}
          <div>
            <span>Charged as</span>
            <strong>{hoursText(job.pricing)}</strong>
          </div>
        </div>
        <p className="booking-clean-location-note">
          You drive the customer&apos;s rented car. The car operator checks your driving licence and PSV permit
          from your approved application before handover.
        </p>
      </div>
    );
  }

  return (
    <>
      <article className="customer-glass-card">
        <h2>Your driver</h2>
        <div className="customer-info-list">
          <div>
            <span>Driver</span>
            <strong>{job.driver?.name || booking.serviceName}</strong>
          </div>
          {job.driver?.languages?.length > 0 && (
            <div>
              <span>Languages</span>
              <strong>{job.driver.languages.join(", ")}</strong>
            </div>
          )}
          {tripRows.map(([label, value]) => (
            <div key={label}>
              <span>{label}</span>
              <strong>{value}</strong>
            </div>
          ))}
          {car && (
            <div>
              <span>For your car booking</span>
              <strong>
                <Link to={`/customer/bookings/${car.id}`}>
                  {car.name} ({car.bookingCode})
                </Link>
              </strong>
            </div>
          )}
          {booking.paymentDeadline && (
            <div>
              <span>Pay by</span>
              <strong>{formatCustomerDate(booking.paymentDeadline)}</strong>
            </div>
          )}
        </div>
      </article>
      {job.pricing && (
        <article className="customer-glass-card">
          <h2>Price breakdown</h2>
          <div className="customer-info-list">
            <div>
              <span>Driving ({hoursText(job.pricing)})</span>
              <strong>{sen(job.pricing.rentalSen)}</strong>
            </div>
            <div>
              <span>Down payment ({job.pricing.depositPct}%)</span>
              <strong>{sen(job.pricing.depositSen)}</strong>
            </div>
            <div>
              <span>Balance</span>
              <strong>{sen(job.pricing.balanceSen)}</strong>
            </div>
            <div className="car-booking-total">
              <span>Total</span>
              <strong>{sen(job.pricing.totalSen)}</strong>
            </div>
          </div>
          <p className="customer-muted">
            Paid to the driver, separately from the car. If you cancel, the driver keeps the down payment and any
            balance you have paid is refunded in full. If the car booking is rejected, expires or is cancelled by
            the operator, everything you paid the driver is refunded.
          </p>
        </article>
      )}
    </>
  );
}

// ── The driver on a car booking: customer ───────────────────────────

function DriverSummary({ driver, linkTo }) {
  return (
    <div className="customer-info-list">
      <div>
        <span>Driver</span>
        <strong>{linkTo ? <Link to={linkTo}>{driver.name}</Link> : driver.name}</strong>
      </div>
      <div>
        <span>Driver booking</span>
        <strong>
          {driver.bookingCode} · {statusLabel(driver.status)}
        </strong>
      </div>
      {driver.operator?.phone && (
        <div>
          <span>Phone</span>
          <strong>{driver.operator.phone}</strong>
        </div>
      )}
      {driver.totalAmount != null && (
        <div>
          <span>Driver&apos;s charge</span>
          <strong>{formatMoney(driver.totalAmount)}</strong>
        </div>
      )}
    </div>
  );
}

export function CarDriverCard({ booking, onChanged }) {
  const info = booking.car?.independentDriver;
  const [options, setOptions] = useState(null);
  const [choiceId, setChoiceId] = useState(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState(null);
  const key = useRef(null);

  if (!info || (!info.allowed && !info.current && !info.requested)) return null;

  const openPicker = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await getBookingDriverOptions(booking.id);
      setOptions(data);
    } catch (err) {
      setMessage({ tone: "danger", text: err.response?.data?.message || "Drivers could not be loaded." });
    } finally {
      setBusy(false);
    }
  };

  const confirm = async () => {
    if (!choiceId) return;
    if (!key.current) key.current = newKey();
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await addBookingDriver(booking.id, choiceId, key.current);
      key.current = null;
      setOptions(null);
      setChoiceId(null);
      setMessage({ tone: "success", text: data.message });
      await onChanged?.();
    } catch (err) {
      key.current = null;
      setMessage({ tone: "danger", text: err.response?.data?.message || "The driver could not be added." });
    } finally {
      setBusy(false);
    }
  };

  const current = info.current;
  const requested = info.requested;
  const waitingForCar = requested && !requested.outcome && !current;

  return (
    <article className="customer-glass-card">
      <h2>Independent driver</h2>

      {current && (
        <>
          <DriverSummary driver={current} linkTo={`/customer/bookings/${current.id}`} />
          <p className="customer-muted">
            {current.status === "PENDING"
              ? "Waiting for the driver to accept. Once they do, pay the driver from their booking."
              : "Your driver drives this car. The car operator checks the driver's licence, so you do not need to upload yours."}
          </p>
        </>
      )}

      {!current && waitingForCar && (
        <p className="customer-muted">
          You chose <strong>{requested.name}</strong>. The request goes to them when the operator accepts your car.
        </p>
      )}

      {!current && requested?.outcome === "UNAVAILABLE" && (
        <div className="customer-alert customer-alert-warning">
          {requested.name} cannot take this booking{requested.reason ? `: ${requested.reason}` : "."} Choose another
          driver, or drive yourself.
        </div>
      )}

      {message && <div className={`customer-alert customer-alert-${message.tone}`}>{message.text}</div>}

      {!current && info.allowed && !options && (
        <button type="button" className="customer-secondary-btn" onClick={openPicker} disabled={busy}>
          {busy ? "Loading drivers..." : waitingForCar ? "Choose a different driver" : "Add a driver"}
        </button>
      )}

      {options && (
        <div className="booking-driver-picker">
          {!options.canAdd ? (
            <p className="customer-muted">{options.reason}</p>
          ) : options.drivers.length ? (
            <>
              <DriverPicker
                drivers={options.drivers}
                selectedId={choiceId}
                onSelect={(driver) => setChoiceId(driver?.id ?? null)}
                name={`driver-${booking.id}`}
              />
              <p className="customer-muted">
                {options.sendsOnAcceptance
                  ? "Your choice is saved and sent to the driver when the operator accepts your car."
                  : "The driver gets your request now. You pay them once they accept."}
              </p>
            </>
          ) : (
            <p className="customer-muted">No drivers cover this pickup place for these dates yet.</p>
          )}
          <div className="customer-action-row">
            <button type="button" className="customer-secondary-btn" onClick={() => setOptions(null)} disabled={busy}>
              Close
            </button>
            {options.canAdd && options.drivers.length > 0 && (
              <button type="button" className="customer-primary-btn" onClick={confirm} disabled={busy || !choiceId}>
                {busy ? "Saving..." : "Book this driver"}
              </button>
            )}
          </div>
        </div>
      )}
    </article>
  );
}

// ── The driver on a car booking: car operator ───────────────────────

export function OperatorCarDriverSection({ booking, onChanged }) {
  const info = booking.car?.independentDriver;
  const [busy, setBusy] = useState(false);
  const [note, setNote] = useState("");
  const [rejecting, setRejecting] = useState(false);
  const [message, setMessage] = useState(null);

  if (!info || (!info.current && !info.requested)) return null;
  const current = info.current;
  const accepted = current && !["PENDING"].includes(current.status);
  const check = info.licenceCheck;

  const open = async (kind) => {
    try {
      const response = await getDriverDocument(booking.id, kind);
      const url = URL.createObjectURL(response.data);
      window.open(url, "_blank", "noopener,noreferrer");
      window.setTimeout(() => URL.revokeObjectURL(url), 60_000);
    } catch (err) {
      setMessage({ tone: "danger", text: err.response?.data?.message || "The document could not be opened." });
    }
  };

  const decide = async (decision) => {
    setBusy(true);
    setMessage(null);
    try {
      const { data } = await reviewDriverLicence(booking.id, decision, note.trim());
      setMessage({ tone: decision === "APPROVED" ? "success" : "warning", text: data.message });
      setRejecting(false);
      setNote("");
      await onChanged?.();
    } catch (err) {
      setMessage({ tone: "danger", text: err.response?.data?.message || "The decision could not be saved." });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="booking-clean-section">
      <h3>Independent driver</h3>
      {current ? (
        <div className="booking-clean-trip-grid">
          <div>
            <span>Driver</span>
            <strong>{current.name}</strong>
          </div>
          <div>
            <span>Driver booking</span>
            <strong>
              {current.bookingCode} · {statusLabel(current.status)}
            </strong>
          </div>
          {current.operator?.phone && (
            <div>
              <span>Driver phone</span>
              <strong>{current.operator.phone}</strong>
            </div>
          )}
          <div>
            <span>Licence check</span>
            <strong>
              {check?.status === "APPROVED"
                ? "Approved"
                : accepted
                  ? "Waiting for your check"
                  : "After the driver accepts"}
            </strong>
          </div>
        </div>
      ) : (
        <p className="booking-clean-location-note">
          The customer chose {info.requested.name} as their driver. The request goes to the driver when you accept
          this booking.
        </p>
      )}

      {accepted && (
        <>
          <p className="booking-clean-location-note">
            This driver drives the car instead of the customer, so check their driving licence and PSV permit
            instead of the customer&apos;s. The driver is paid separately; nothing changes in your charges.
          </p>
          <div className="operator-action-row">
            <button type="button" className="operator-secondary-btn" onClick={() => open("licence")}>
              View driving licence
            </button>
            <button type="button" className="operator-secondary-btn" onClick={() => open("psv")}>
              View PSV permit
            </button>
            {check?.status !== "APPROVED" && !rejecting && (
              <>
                <button type="button" className="operator-primary-btn" onClick={() => decide("APPROVED")} disabled={busy}>
                  Approve driver
                </button>
                <button type="button" className="operator-danger-btn" onClick={() => setRejecting(true)} disabled={busy}>
                  Not approved
                </button>
              </>
            )}
          </div>
          {rejecting && (
            <div className="operator-field">
              <label htmlFor={`driver-reject-${booking.id}`}>Why can this driver not drive the car?</label>
              <textarea
                id={`driver-reject-${booking.id}`}
                rows={3}
                maxLength={500}
                value={note}
                onChange={(e) => setNote(e.target.value)}
              />
              <small>
                The driver booking is cancelled and the customer gets back what they paid the driver.
              </small>
              <div className="operator-action-row">
                <button type="button" className="operator-secondary-btn" onClick={() => setRejecting(false)} disabled={busy}>
                  Back
                </button>
                <button
                  type="button"
                  className="operator-danger-btn"
                  onClick={() => decide("REJECTED")}
                  disabled={busy || note.trim().length < 5}
                >
                  Confirm not approved
                </button>
              </div>
            </div>
          )}
        </>
      )}
      {message && <div className={`operator-alert ${message.tone}`}>{message.text}</div>}
    </div>
  );
}
