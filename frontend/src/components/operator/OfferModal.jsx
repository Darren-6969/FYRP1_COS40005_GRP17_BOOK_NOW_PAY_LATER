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
// Make an offer (car bookings, Modules 3 and 4)
//
// One reply to a waiting request. The operator ticks what changes:
// - a charge for each place the customer asked for (ticked by default)
// - another of their cars
// - other pick-up or return times
// and sends it as one offer, which the customer accepts or declines
// as a whole. A booking gets one offer.
//
// Desktop: split view, the form on the left and the live price on
// the right. Mobile (720px and below): a bottom sheet with the price
// in the flow and a sticky footer.
//
// The price always comes from the server quote. It refreshes when
// anything ticked changes, and Send only works once there is a
// current quote with no problems.
// ===========================================================

const MOBILE_QUERY = "(max-width: 720px)";
const AMOUNT_PATTERN = /^\d+(\.\d{1,2})?$/;

const CAR_REASONS = [
  "The requested car is in for servicing on these dates.",
  "The requested car is already booked for these dates.",
  "This car is a similar size at a better price.",
];

const DATE_REASONS = [
  "The car is already booked at the times you asked for.",
  "We can't hand over or collect the car at that time.",
];

// What the customer sees, by the offer's kind (car_requote_service OFFER_KIND).
const KIND_TEXT = {
  ALTERNATIVE_CAR: "an alternative car",
  NEW_DATES: "new dates for the same car",
  LOCATION_CHARGE: "a charge for the place they asked for",
};

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

// The places the customer asked for, read from the booking's pricing
// snapshot the way the server reads them. One place for both ends takes
// one charge, on the pickup.
function requestedEnds(booking) {
  const car = booking.car || {};
  const pricing = car.pricing || {};
  const pickup = pricing.requestedLocation || car.requestedLocation || "";
  const dropoff =
    pricing.requestedDropoffLocation || car.requestedDropoffLocation || "";
  const samePlace =
    Boolean(pickup) &&
    !dropoff &&
    (pricing.dropoffPoint
      ? pricing.dropoffPoint.id === "requested"
      : !car.dropoffPoint);

  return { pickup, dropoff, samePlace };
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

function CheckIcon() {
  return (
    <svg
      aria-hidden="true"
      width="14"
      height="14"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="3"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M5 12l5 5 9-10" />
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

// One tick box in "What do you want to change?".
function ChangeOption({ checked, onChange, title, hint }) {
  return (
    <label className={`cam-change${checked ? " is-on" : ""}`}>
      <input
        className="cam-sr-only"
        type="checkbox"
        checked={checked}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span className="cam-check" aria-hidden="true">
        {checked && <CheckIcon />}
      </span>
      <span className="cam-change-text">
        <span className="cam-change-title">{title}</span>
        <span className="cam-change-hint">{hint}</span>
      </span>
    </label>
  );
}

function PriceSummary({ quote, quoting, originalTotalSen, compact }) {
  const pricing = quote?.pricing;
  const problems = quote?.problems || [];

  if (!quote && !quoting) {
    return (
      <p className="cam-price-empty">
        Choose what to change to see what the customer will pay.
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

      {pricing && quote?.kind && KIND_TEXT[quote.kind] && (
        <p className="cam-kind">
          Customer sees {KIND_TEXT[quote.kind]}
          {quote.kind !== "LOCATION_CHARGE" && pricing.quote?.locationChargeSen
            ? ", with the place charges"
            : ""}
          .
        </p>
      )}
    </div>
  );
}

export default function OfferModal({ booking, onClose, onDone }) {
  const isMobile = useIsMobile();
  const titleId = useId();
  const radioName = useId();
  const dialogRef = useRef(null);
  const quoteRequest = useRef(0);
  const optionsRequest = useRef(0);

  const ends = requestedEnds(booking);
  const hasRequestedPlace = Boolean(ends.pickup || ends.dropoff);

  const bookedPickup = toLocalInputValue(booking.pickupDate);
  const bookedReturn = toLocalInputValue(booking.returnDate);

  // What changes. The charge is ticked by default when the customer asked
  // for their own place, since pricing it is the usual reason to reply.
  const [wantCharge, setWantCharge] = useState(hasRequestedPlace);
  const [wantCar, setWantCar] = useState(false);
  const [wantDates, setWantDates] = useState(false);

  const [pickupCharge, setPickupCharge] = useState("");
  const [dropoffCharge, setDropoffCharge] = useState("");
  const [pickup, setPickup] = useState(bookedPickup);
  const [dropoff, setDropoff] = useState(bookedReturn);
  const [selectedId, setSelectedId] = useState(null);
  const [reason, setReason] = useState("");

  const [options, setOptions] = useState([]);
  const [optionsKey, setOptionsKey] = useState(null);
  const [optionsError, setOptionsError] = useState("");

  const [quote, setQuote] = useState(null);
  const [quotedKey, setQuotedKey] = useState("");

  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState("");

  const original = booking.car;
  const originalTotalSen = original?.pricing?.totalSen;

  // ── What the offer sends, from what is ticked ───────────────────────
  const pickupText = wantCharge && ends.pickup ? pickupCharge.trim() : "";
  const dropoffText = wantCharge && ends.dropoff ? dropoffCharge.trim() : "";
  const amountOk = (text) => !text || AMOUNT_PATTERN.test(text);
  const chargesValid = amountOk(pickupText) && amountOk(dropoffText);
  const anyCharge = Number(pickupText || 0) + Number(dropoffText || 0) > 0;

  const offerPickup = wantDates ? pickup : bookedPickup;
  const offerReturn = wantDates ? dropoff : bookedReturn;
  const datesMoved =
    wantDates && (pickup !== bookedPickup || dropoff !== bookedReturn);

  const carChosen = wantCar && Boolean(selectedId);
  const changesSomething = carChosen || datesMoved || (wantCharge && anyCharge);
  const reasonNeeded = wantCar || datesMoved;

  const offerBody = {
    ...(carChosen ? { alternativeListingId: selectedId } : {}),
    ...(wantDates
      ? { alternativePickupDate: pickup || null, alternativeReturnDate: dropoff || null }
      : {}),
    ...(pickupText ? { pickupLocationCharge: pickupText } : {}),
    ...(dropoffText ? { dropoffLocationCharge: dropoffText } : {}),
  };

  // A quote belongs to the inputs it was fetched for; anything else is
  // still on its way.
  const canQuote = chargesValid && changesSomething && !(wantCar && !selectedId);
  const currentKey = JSON.stringify(offerBody);
  const quoting = canQuote && quotedKey !== currentKey;
  const quoteIsCurrent = canQuote && Boolean(quote) && !quoting;

  const datesKey = `${offerPickup}|${offerReturn}`;
  const optionsLoading = wantCar && optionsKey !== datesKey;

  const selected = options.find((option) => option.id === selectedId) || null;

  // Lock the page behind the dialog.
  useEffect(() => {
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    dialogRef.current?.focus();

    return () => {
      document.body.style.overflow = previous;
    };
  }, []);

  // The operator's other cars and their availability for the offer's dates.
  useEffect(() => {
    if (!wantCar) return undefined;

    const request = ++optionsRequest.current;
    const key = `${offerPickup}|${offerReturn}`;

    const timer = setTimeout(async () => {
      try {
        const res = await operatorService.getAlternativeOptions(booking.id, {
          alternativePickupDate: offerPickup || null,
          alternativeReturnDate: offerReturn || null,
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
  }, [booking.id, wantCar, offerPickup, offerReturn]);

  // Live price for whatever is ticked.
  useEffect(() => {
    if (!canQuote) return undefined;

    const request = ++quoteRequest.current;
    const key = currentKey;
    const body = JSON.parse(currentKey);

    const timer = setTimeout(async () => {
      try {
        const res = await operatorService.quoteAlternative(booking.id, body);

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
                err.response?.data?.message || "Failed to price this offer",
            },
          ],
        });
        setQuotedKey(key);
      }
    }, 350);

    return () => clearTimeout(timer);
  }, [booking.id, canQuote, currentKey]);

  const problems = quoteIsCurrent ? quote?.problems || [] : [];
  const canSend =
    quoteIsCurrent &&
    problems.length === 0 &&
    Boolean(quote?.pricing) &&
    (!reasonNeeded || reason.trim().length > 0) &&
    !sending;

  const nothingTicked = !wantCharge && !wantCar && !wantDates;

  const sendHint = nothingTicked
    ? "Tick what you want to change."
    : !chargesValid
      ? "Enter charges in RM, with at most two decimal places."
      : wantCar && !selectedId
        ? "Choose a car."
        : wantDates && !datesMoved && !wantCar && !(wantCharge && anyCharge)
          ? "Change the pick-up or return time."
          : wantCharge && !anyCharge && !wantCar && !datesMoved
            ? "Enter a charge, or untick it."
            : !quoteIsCurrent
              ? "Waiting for the price."
              : problems.length
                ? "This offer can't be sent. See the price panel."
                : reasonNeeded && !reason.trim()
                  ? "Add a message for the customer."
                  : "";

  const handleSend = async () => {
    if (!canSend) return;

    try {
      setSending(true);
      setSendError("");

      await operatorService.suggestAlternative(booking.id, {
        ...offerBody,
        reason: reason.trim(),
      });

      await onDone();
      onClose();
    } catch (err) {
      setSendError(err.response?.data?.message || "Failed to send the offer");
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

  const clearError = () => setSendError("");

  // ── Sections ─────────────────────────────────────────────────────────
  const chargeTitle = [
    ends.pickup &&
      `${ends.samePlace ? "pickup and return at" : "pickup at"} ${ends.pickup}`,
    ends.dropoff && `drop-off at ${ends.dropoff}`,
  ]
    .filter(Boolean)
    .join(" and ");

  const whatChanges = (
    <fieldset className="cam-fieldset">
      <legend className="cam-label">
        {isMobile ? "What changes" : "1 · What do you want to change?"}
      </legend>

      <div className="cam-changes">
        {hasRequestedPlace && (
          <ChangeOption
            checked={wantCharge}
            onChange={(on) => {
              setWantCharge(on);
              clearError();
            }}
            title={`Charge for ${chargeTitle}`}
            hint="The customer asked for a place that isn't on your list."
          />
        )}

        <ChangeOption
          checked={wantCar}
          onChange={(on) => {
            setWantCar(on);
            clearError();
          }}
          title="Offer a different car"
          hint="The requested car isn't free or isn't the best fit."
        />

        <ChangeOption
          checked={wantDates}
          onChange={(on) => {
            setWantDates(on);
            clearError();
          }}
          title="Change the dates"
          hint="Offer other pick-up or return times."
        />
      </div>
    </fieldset>
  );

  const chargeInput = (id, label, value, setValue, placeholder) => (
    <label className="cam-field" htmlFor={id}>
      <span>{label}</span>
      <input
        id={id}
        type="text"
        inputMode="decimal"
        autoComplete="off"
        placeholder={placeholder}
        value={value}
        onChange={(e) => {
          setValue(e.target.value);
          clearError();
        }}
      />
    </label>
  );

  const chargeSection = wantCharge && hasRequestedPlace && (
    <fieldset className="cam-fieldset">
      <legend className="cam-label">Charge for the requested place</legend>

      {ends.pickup &&
        chargeInput(
          `${titleId}-pickup-charge`,
          `${ends.samePlace ? "Pickup and return at" : "Pickup at"} ${ends.pickup} (RM)`,
          pickupCharge,
          setPickupCharge,
          "For example 30"
        )}

      {ends.dropoff &&
        chargeInput(
          `${titleId}-dropoff-charge`,
          `Drop-off at ${ends.dropoff} (RM)`,
          dropoffCharge,
          setDropoffCharge,
          "For example 20"
        )}

      <span className="cam-field-hint">
        Leave a charge empty to provide that place free.
        {ends.samePlace ? " One charge covers handing over and collecting the car there." : ""}
      </span>
    </fieldset>
  );

  const carSection = wantCar && (
    <fieldset className="cam-fieldset">
      <legend className="cam-label">Choose a car</legend>

      <div className="cam-options" role="radiogroup" aria-label="Your cars">
        {optionsLoading && options.length === 0 && (
          <p className="cam-muted">Loading your cars…</p>
        )}

        {optionsError && <p className="cam-error">{optionsError}</p>}

        {!optionsLoading && !optionsError && options.length === 0 && (
          <p className="cam-muted">
            You have no other published cars to offer. Publish another car
            first, or untick this.
          </p>
        )}

        {options.map((option) => (
          <CarOption
            key={option.id}
            option={option}
            name={radioName}
            selected={option.id === selectedId}
            onSelect={(id) => {
              setSelectedId(id);
              clearError();
            }}
            compact={isMobile}
          />
        ))}
      </div>
    </fieldset>
  );

  const datesSection = wantDates && (
    <fieldset className="cam-fieldset">
      <legend className="cam-label">Dates</legend>

      <div className="cam-dates">
        <label className="cam-field">
          <span>Pick-up</span>
          <input
            type="datetime-local"
            value={pickup}
            onChange={(e) => {
              setPickup(e.target.value);
              clearError();
            }}
          />
        </label>

        <label className="cam-field">
          <span>Return</span>
          <input
            type="datetime-local"
            value={dropoff}
            onChange={(e) => {
              setDropoff(e.target.value);
              clearError();
            }}
          />
        </label>
      </div>
    </fieldset>
  );

  const presets = wantCar ? CAR_REASONS : datesMoved ? DATE_REASONS : [];

  const message = (
    <div className="cam-fieldset">
      <label className="cam-label" htmlFor={`${titleId}-reason`}>
        Message to the customer{reasonNeeded ? "" : " (optional)"}
      </label>

      {presets.length > 0 && (
        <div className="cam-presets">
          {presets.map((preset) => (
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
      )}

      <textarea
        id={`${titleId}-reason`}
        className="cam-textarea"
        rows={isMobile ? 2 : 3}
        placeholder={
          reasonNeeded
            ? "Why this offer? The customer sees this message."
            : "For example: covers delivery and collection at the airport."
        }
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

  const form = (
    <>
      {whatChanges}
      {chargeSection}
      {carSection}
      {datesSection}
    </>
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
            <h2 id={titleId}>Make an offer</h2>
            <p>
              {isMobile ? "" : `${booking.bookingCode || ""} · requested `}
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
            {form}
            {price}
            {message}
          </div>
        ) : (
          <div className="cam-split">
            <div className="cam-body">
              {form}
              {message}
            </div>

            <aside className="cam-aside" aria-label="Price the customer will see">
              {price}

              <p className="cam-note cam-aside-foot">
                Worked out by the platform from the car's rates and your shop
                settings. It updates as you change the offer.
              </p>
            </aside>
          </div>
        )}

        <footer className="cam-footer">
          {!isMobile && (
            <p className="cam-muted">
              {carChosen && selected
                ? `The ${optionTitle(selected)} is held for this customer while they decide. `
                : ""}
              One offer per booking. The customer accepts or declines all of
              it, and nothing is charged until they accept.
            </p>
          )}

          {(sendError || (sendHint && !nothingTicked)) && (
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
              {sending ? "Sending…" : "Send offer"}
            </button>
          </div>
        </footer>
      </section>
    </div>
  );
}
