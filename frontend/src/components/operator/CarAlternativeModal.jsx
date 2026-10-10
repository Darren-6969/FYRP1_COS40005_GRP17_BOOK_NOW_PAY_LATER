import { useEffect, useId, useRef, useState } from "react";

import {
  operatorService,
  formatOperatorDateTime,
} from "../../services/operator_service";

import {
  carTitle,
  depositLabel,
  formatSen,
  priceBreakdownRows,
} from "../booking/carBookingParts";

import "../../assets/styles/car-alternative-modal.css";

// ===========================================================
// Suggest another car (car bookings, Module 3)
//
// Desktop: split view. The form (car list, dates, message) on the
// left and the live price the customer will pay on the right.
// Mobile (720px and below): a compact bottom sheet with a car
// picker, the price card in the flow and a sticky footer.
//
// The price always comes from the server quote. It refreshes by
// itself when the car or dates change, and Send only works once
// there is a current quote with no problems.
// ===========================================================

const MOBILE_QUERY = "(max-width: 720px)";

const REASON_PRESETS = [
  "The requested car is in for servicing on these dates.",
  "The requested car is already booked for these dates.",
  "This car is a similar size at a better price.",
];

function useIsMobile() {
  const [isMobile, setIsMobile] = useState(
    () =>
      typeof window !== "undefined" &&
      window.matchMedia(MOBILE_QUERY).matches
  );

  useEffect(() => {
    const media = window.matchMedia(MOBILE_QUERY);
    const update = () => setIsMobile(media.matches);

    media.addEventListener("change", update);
    return () => media.removeEventListener("change", update);
  }, []);

  return isMobile;
}

// <input type="datetime-local"> value in the viewer's local time.
function toLocalInputValue(value) {
  if (!value) return "";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";

  const pad = (n) => String(n).padStart(2, "0");

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(
    date.getDate()
  )}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

// "18 Oct" from a plain date "2026-10-18".
function shortPlainDate(plain) {
  const date = new Date(`${plain}T00:00:00Z`);

  return new Intl.DateTimeFormat("en-MY", {
    day: "numeric",
    month: "short",
    timeZone: "UTC",
  }).format(date);
}

function unavailableText(dates) {
  if (!dates?.length) return "Not free on these dates";

  const first = shortPlainDate(dates[0]);

  if (dates.length === 1) return `Booked ${first}`;

  return `Booked ${first} – ${shortPlainDate(dates[dates.length - 1])}`;
}

function optionTitle(option) {
  return (
    [option.make, option.model, option.modelYear]
      .filter(Boolean)
      .join(" ") || option.name
  );
}

function optionMeta(option) {
  return [
    option.branchName,
    option.transmission,
    option.seats ? `${option.seats} seats` : null,
  ]
    .filter(Boolean)
    .join(" · ");
}

function CarIcon() {
  return (
    <svg
      aria-hidden="true"
      width="26"
      height="26"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.6"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M3 13l2-5a2 2 0 0 1 2-1.3h10A2 2 0 0 1 19 8l2 5v4h-2" />
      <path d="M5 17H3v-4h18" />
      <circle cx="7.5" cy="17" r="1.8" />
      <circle cx="16.5" cy="17" r="1.8" />
    </svg>
  );
}

function CloseIcon() {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
    >
      <path d="M6 6l12 12M18 6L6 18" />
    </svg>
  );
}

function Chevron({ up }) {
  return (
    <svg
      aria-hidden="true"
      width="18"
      height="18"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2.2"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d={up ? "M6 15l6-6 6 6" : "M6 9l6 6 6-6"} />
    </svg>
  );
}

function Availability({ option }) {
  if (option.available === null) return null;

  return option.available ? (
    <span className="cam-chip cam-chip-free">Free on these dates</span>
  ) : (
    <span className="cam-chip cam-chip-busy">
      {unavailableText(option.unavailableDates)}
    </span>
  );
}

function CarOption({ option, name, selected, onSelect, compact }) {
  const disabled = option.available === false;

  return (
    <label
      className={`cam-option${selected ? " is-selected" : ""}${
        disabled ? " is-disabled" : ""
      }`}
    >
      <input
        className="cam-sr-only"
        type="radio"
        name={name}
        value={option.id}
        checked={selected}
        disabled={disabled}
        onChange={() => onSelect(option.id)}
      />

      {!compact && (
        <span className="cam-thumb" aria-hidden="true">
          {option.imageUrl ? (
            <img src={option.imageUrl} alt="" />
          ) : (
            <CarIcon />
          )}
        </span>
      )}

      <span className="cam-option-text">
        <span className="cam-option-title">{optionTitle(option)}</span>
        <span className="cam-option-meta">{optionMeta(option)}</span>
        {compact && <Availability option={option} />}
      </span>

      <span className="cam-option-side">
        <span className="cam-rate">
          {formatSen(option.dailyRateSen)}
          <span>/day</span>
        </span>
        {!compact && <Availability option={option} />}
      </span>

      <span
        className={`cam-radio${selected ? " is-on" : ""}`}
        aria-hidden="true"
      />
    </label>
  );
}

function PriceSummary({ quote, quoting, originalTotalSen, compact }) {
  const pricing = quote?.pricing;
  const problems = quote?.problems || [];

  if (!quote && !quoting) {
    return (
      <p className="cam-price-empty">
        Choose a car to see what the customer will pay.
      </p>
    );
  }

  const difference =
    pricing && Number.isFinite(originalTotalSen)
      ? pricing.totalSen - originalTotalSen
      : 0;

  return (
    <div className={`cam-price${quoting ? " is-updating" : ""}`} aria-live="polite">
      <div className="cam-price-head">
        <span className="cam-label">Customer will pay</span>
        <span className="cam-total">
          {pricing ? formatSen(pricing.totalSen) : "-"}
        </span>

        {pricing && difference !== 0 && (
          <span
            className={`cam-chip ${
              difference < 0 ? "cam-chip-free" : "cam-chip-busy"
            }`}
          >
            {difference < 0
              ? `${formatSen(-difference)} less than requested`
              : `${formatSen(difference)} more than requested`}
          </span>
        )}

        {quoting && <span className="cam-updating">Updating price…</span>}
      </div>

      {problems.length > 0 && (
        <ul className="cam-problems">
          {problems.map((item) => (
            <li key={item.code}>{item.message}</li>
          ))}
        </ul>
      )}

      {pricing && (
        <dl className={`cam-lines${compact ? " is-compact" : ""}`}>
          {priceBreakdownRows(pricing).map((row) => (
            <div key={row.label}>
              <dt>{row.label}</dt>
              <dd>{formatSen(row.amountSen)}</dd>
            </div>
          ))}

          <div className="cam-lines-split">
            <dt>{depositLabel(pricing)}, after acceptance</dt>
            <dd>{formatSen(pricing.depositSen)}</dd>
          </div>

          <div>
            <dt>Balance</dt>
            <dd>{formatSen(pricing.balanceSen)}</dd>
          </div>
        </dl>
      )}

      {quote?.pointsChanged && (
        <p className="cam-note">
          This car is at another branch, so pick-up and drop-off move to{" "}
          {pricing?.pickupPoint?.label || "that branch"}.
        </p>
      )}

      {quote?.droppedAddons?.length > 0 && (
        <p className="cam-note">
          Not offered on this car, so left out:{" "}
          {quote.droppedAddons.join(", ")}.
        </p>
      )}
    </div>
  );
}

export default function CarAlternativeModal({ booking, onClose, onDone }) {
  const isMobile = useIsMobile();
  const titleId = useId();
  const radioName = useId();
  const dialogRef = useRef(null);
  const quoteRequest = useRef(0);
  const optionsRequest = useRef(0);

  const [pickup, setPickup] = useState(() =>
    toLocalInputValue(booking.pickupDate)
  );
  const [dropoff, setDropoff] = useState(() =>
    toLocalInputValue(booking.returnDate)
  );
  const [selectedId, setSelectedId] = useState(null);
  const [reason, setReason] = useState("");

  const [options, setOptions] = useState([]);
  const [optionsKey, setOptionsKey] = useState(null);
  const [optionsError, setOptionsError] = useState("");

  const [quote, setQuote] = useState(null);
  const [quotedKey, setQuotedKey] = useState("");

  const [pickerOpen, setPickerOpen] = useState(false);
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const original = booking.car;
  const originalTotalSen = original?.pricing?.totalSen;
  const selected = options.find((option) => option.id === selectedId) || null;
  const datesKey = `${pickup}|${dropoff}`;
  const currentKey = `${selectedId}|${datesKey}`;
  // Loading states are derived: a result belongs to the inputs it was
  // fetched for, so anything else is still on its way.
  const optionsLoading = optionsKey !== datesKey;
  const quoting = Boolean(selectedId) && quotedKey !== currentKey;
  const quoteIsCurrent = Boolean(quote) && !quoting;

  // Lock the page behind the dialog and close on Escape.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // Cars and their availability for the chosen dates.
  useEffect(() => {
    const request = ++optionsRequest.current;
    const key = `${pickup}|${dropoff}`;

    const timer = setTimeout(async () => {
      try {
        const res = await operatorService.getAlternativeOptions(booking.id, {
          alternativePickupDate: pickup || null,
          alternativeReturnDate: dropoff || null,
        });

        if (request !== optionsRequest.current) return;

        setOptions(res.data?.options || []);
        setOptionsError("");
        setOptionsKey(key);
      } catch (err) {
        if (request !== optionsRequest.current) return;
        setOptionsError(
          err.response?.data?.message || "Failed to load your cars"
        );
        setOptionsKey(key);
      }
    }, 300);

    return () => clearTimeout(timer);
  }, [booking.id, pickup, dropoff]);

  // Live price for the selected car and dates.
  useEffect(() => {
    if (!selectedId) return undefined;

    const request = ++quoteRequest.current;
    const key = `${selectedId}|${pickup}|${dropoff}`;

    const timer = setTimeout(async () => {
      try {
        const res = await operatorService.quoteAlternative(booking.id, {
          alternativeListingId: selectedId,
          alternativePickupDate: pickup || null,
          alternativeReturnDate: dropoff || null,
        });

        if (request !== quoteRequest.current) return;

        setQuote(res.data?.quote || null);
        setQuotedKey(key);
      } catch (err) {
        if (request !== quoteRequest.current) return;

        setQuote({
          problems: [
            {
              code: "QUOTE_FAILED",
              message:
                err.response?.data?.message || "Failed to price this car",
            },
          ],
        });
        setQuotedKey(key);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [booking.id, selectedId, pickup, dropoff]);

  const problems = quote?.problems || [];
  const canSend =
    quoteIsCurrent &&
    problems.length === 0 &&
    Boolean(quote?.pricing) &&
    reason.trim().length > 0 &&
    !sending;

  const sendHint = !selectedId
    ? "Choose a car first."
    : !quoteIsCurrent
      ? "Waiting for the price."
      : problems.length
        ? "This car can't be suggested for these dates."
        : !reason.trim()
          ? "Add a message for the customer."
          : "";

  const handleSelect = (id) => {
    setSelectedId(id);
    setSendError("");
    setPickerOpen(false);
  };

  const handleSend = async () => {
    if (!canSend) return;

    try {
      setSending(true);
      setSendError("");

      await operatorService.suggestAlternative(booking.id, {
        alternativeListingId: selectedId,
        alternativePickupDate: pickup || null,
        alternativeReturnDate: dropoff || null,
        reason: reason.trim(),
      });

      await onDone();
      onClose();
    } catch (err) {
      setSendError(
        err.response?.data?.message || "Failed to suggest alternative"
      );
    } finally {
      setSending(false);
    }
  };

  const handleKeyDown = (event) => {
    if (event.key === "Escape" && !sending) {
      event.stopPropagation();
      onClose();
    }
  };

  const carList = (
    <div className="cam-options" role="radiogroup" aria-label="Your cars">
      {optionsLoading && options.length === 0 && (
        <p className="cam-muted">Loading your cars…</p>
      )}

      {optionsError && <p className="cam-error">{optionsError}</p>}

      {!optionsLoading && !optionsError && options.length === 0 && (
        <p className="cam-muted">
          You have no other published cars to suggest. Publish another car
          first, or reject this request.
        </p>
      )}

      {options.map((option) => (
        <CarOption
          key={option.id}
          option={option}
          name={radioName}
          selected={option.id === selectedId}
          onSelect={handleSelect}
          compact={isMobile}
        />
      ))}
    </div>
  );

  const dates = (
    <fieldset className="cam-fieldset">
      <legend className="cam-label">
        {isMobile ? "Dates" : "2 · Dates"}
      </legend>

      <div className="cam-dates">
        <label className="cam-field">
          <span>Pick-up</span>
          <input
            type="datetime-local"
            value={pickup}
            onChange={(e) => setPickup(e.target.value)}
          />
        </label>

        <label className="cam-field">
          <span>Return</span>
          <input
            type="datetime-local"
            value={dropoff}
            onChange={(e) => setDropoff(e.target.value)}
          />
        </label>
      </div>
    </fieldset>
  );

  const message = (
    <div className="cam-fieldset">
      <label className="cam-label" htmlFor={`${titleId}-reason`}>
        {isMobile ? "Message to the customer" : "3 · Message to the customer"}
      </label>

      <div className="cam-presets">
        {REASON_PRESETS.map((preset) => (
          <button
            key={preset}
            type="button"
            className="cam-preset"
            onClick={() => setReason(preset)}
          >
            {preset.replace(/\.$/, "")}
          </button>
        ))}
      </div>

      <textarea
        id={`${titleId}-reason`}
        className="cam-textarea"
        rows={isMobile ? 2 : 3}
        placeholder="Why this car? The customer sees this message."
        value={reason}
        onChange={(e) => setReason(e.target.value)}
      />
    </div>
  );

  const price = (
    <PriceSummary
      quote={quoteIsCurrent || quoting ? quote : null}
      quoting={quoting}
      originalTotalSen={originalTotalSen}
      compact={isMobile}
    />
  );

  return (
    <div
      className={`cam-backdrop${isMobile ? " is-sheet" : ""}`}
      onMouseDown={(e) => {
        if (e.target === e.currentTarget && !sending) onClose();
      }}
    >
      <section
        ref={dialogRef}
        className={`cam-dialog${isMobile ? " is-sheet" : ""}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId}
        tabIndex={-1}
        onKeyDown={handleKeyDown}
      >
        {isMobile && <span className="cam-handle" aria-hidden="true" />}

        <header className="cam-header">
          <div>
            <h2 id={titleId}>Suggest another car</h2>
            <p>
              {isMobile ? "Instead of " : `${booking.bookingCode || ""} · requested `}
              <strong>
                {carTitle(original?.listing) || booking.serviceName}
              </strong>
              {isMobile
                ? ` · ${formatSen(originalTotalSen)}`
                : `, ${formatOperatorDateTime(
                    booking.pickupDate
                  )} → ${formatOperatorDateTime(
                    booking.returnDate
                  )}, ${formatSen(originalTotalSen)}`}
            </p>
          </div>

          <button
            type="button"
            className="cam-close"
            aria-label="Close"
            onClick={onClose}
            disabled={sending}
          >
            <CloseIcon />
          </button>
        </header>

        {isMobile ? (
          <div className="cam-body">
            <div className="cam-fieldset">
              <span className="cam-label">Car</span>

              <button
                type="button"
                className={`cam-picker${pickerOpen ? " is-open" : ""}`}
                aria-expanded={pickerOpen}
                onClick={() => setPickerOpen((open) => !open)}
              >
                <span className="cam-picker-text">
                  <span className="cam-option-title">
                    {selected ? optionTitle(selected) : "Choose a car"}
                  </span>
                  <span className="cam-option-meta">
                    {selected
                      ? `${selected.branchName || ""} · ${formatSen(
                          selected.dailyRateSen
                        )}/day`
                      : `${options.length} of your cars`}
                  </span>
                </span>
                <Chevron up={pickerOpen} />
              </button>

              {pickerOpen && carList}
            </div>

            {dates}
            {price}
            {message}
          </div>
        ) : (
          <div className="cam-split">
            <div className="cam-body">
              <fieldset className="cam-fieldset">
                <legend className="cam-label">1 · Choose a car</legend>
                {carList}
              </fieldset>

              {dates}
              {message}
            </div>

            <aside className="cam-aside" aria-label="Price the customer will see">
              {price}

              <p className="cam-note cam-aside-foot">
                Worked out by the platform from this car's rates and your
                shop settings. It updates as you change the car or dates.
              </p>
            </aside>
          </div>
        )}

        <footer className="cam-footer">
          {!isMobile && (
            <p className="cam-muted">
              {selected
                ? `The ${optionTitle(selected)} is held for this customer while they decide. If they decline, the booking closes.`
                : "The customer can accept or decline. Nothing is charged until they accept."}
            </p>
          )}

          {(sendError || (sendHint && selectedId)) && (
            <p className={sendError ? "cam-error" : "cam-muted"} role="status">
              {sendError || sendHint}
            </p>
          )}

          <div className="cam-actions">
            <button
              type="button"
              className="cam-btn cam-btn-secondary"
              onClick={onClose}
              disabled={sending}
            >
              Cancel
            </button>

            <button
              type="button"
              className="cam-btn cam-btn-primary"
              onClick={handleSend}
              disabled={!canSend}
              title={sendHint}
            >
              {sending ? "Sending…" : "Send to customer"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
