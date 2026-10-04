import { useEffect, useId, useMemo, useRef, useState } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Check, ChevronLeft, ChevronRight, Heart, Minus, Plus } from "lucide-react";
import { getCarListing, quoteCarBooking } from "../../services/listing_public_service";
import { parseBookingSelection, toBookingParams, tripParams } from "../../utils/carSearchParams";
import {
  formatDateList,
  formatSen,
  formatShortDate,
  formatShortDateTime,
  klDateTimeToIso,
  klToday,
} from "../../utils/formatPublic";
import { getToken } from "../../utils/session";
import { durationText, rateLinesText } from "../../utils/carPricing";
import useSavedListings from "../../hooks/useSavedListings";
import PaymentSchedule from "../../components/public/PaymentSchedule";
import RefundBox from "../../components/public/RefundBox";
import OperatorStrip from "../../components/public/OperatorStrip";
import BookingBar from "../../components/public/BookingBar";
import styles from "../../assets/styles/public/CarDetail.module.css";

const TRANSMISSION = { AUTOMATIC: "Automatic", MANUAL: "Manual" };

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

function photoCaptions(listing) {
  return [
    "Exterior, front three-quarter",
    "Exterior, rear",
    "Dashboard and controls",
    "Front seats",
    "Rear seats",
    `Boot, ${plural(listing.luggageCapacity, "bag")}`,
  ];
}

// Client-side checks on the trip fields; the server re-validates everything.
function tripErrors(sel) {
  const errors = {};
  if (sel.from && sel.from < klToday()) errors.from = "Pick-up date can't be in the past.";
  if (sel.from && sel.to && !errors.from) {
    const start = klDateTimeToIso(sel.from, sel.ft);
    const end = klDateTimeToIso(sel.to, sel.tt);
    if (start && end && end <= start) errors.to = "Return must be after pick-up.";
  }
  return errors;
}

// ── Gallery ──────────────────────────────────────────────────────────

function Gallery({ listing, saved, onSave, signedIn }) {
  const captions = photoCaptions(listing);
  const photos = listing.images.length
    ? listing.images.map((img, i) => ({ src: img.imageUrl, caption: captions[i] || `Photo ${i + 1}` }))
    : captions.map((caption) => ({ src: null, caption }));
  const [index, setIndex] = useState(0);
  const [signinOpen, setSigninOpen] = useState(false);
  const mainRef = useRef(null);
  const signinRef = useRef(null);
  const saveRef = useRef(null);
  const location = useLocation();
  const n = photos.length;
  const current = photos[index];
  const tiles = [1, 2, 3, 4].filter((i) => i < n);
  const title = `${listing.vehicleMake} ${listing.vehicleModel}`;

  useEffect(() => {
    if (!signinOpen) return undefined;
    signinRef.current?.querySelector("a")?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") {
        setSigninOpen(false);
        saveRef.current?.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [signinOpen]);

  const onSaveClick = () => {
    if (signedIn) onSave();
    else setSigninOpen((v) => !v);
  };

  return (
    <section className={styles.gallery} aria-label="Photos">
      <div className={styles.main} ref={mainRef} tabIndex={-1}>
        {current.src ? (
          <img src={current.src} alt={`${title}: ${current.caption}`} className={styles.photoImg} />
        ) : (
          <span className={styles.photoSlot}>
            Photo {index + 1} · {current.caption}
          </span>
        )}
        <span className={styles.photoTag}>{listing.vehicleType}</span>
        <button
          type="button"
          className={`${styles.photoNav} ${styles.photoPrev}`}
          aria-label="Previous photo"
          onClick={() => setIndex((index + n - 1) % n)}
        >
          <ChevronLeft size={18} aria-hidden="true" />
        </button>
        <button
          type="button"
          className={`${styles.photoNav} ${styles.photoNext}`}
          aria-label="Next photo"
          onClick={() => setIndex((index + 1) % n)}
        >
          <ChevronRight size={18} aria-hidden="true" />
        </button>
        <span className={styles.photoCounter} aria-live="polite">
          {index + 1} / {n}
        </span>
      </div>
      {tiles.map((i, j) => (
        <button
          key={i}
          type="button"
          className={`${styles.tile} ${styles[`tile${j}`]} ${i === index ? styles.tileCurrent : ""}`}
          aria-label={`Show photo ${i + 1}: ${photos[i].caption}`}
          aria-current={i === index ? "true" : undefined}
          onClick={() => setIndex(i)}
        >
          {photos[i].src ? <img src={photos[i].src} alt="" className={styles.photoImg} /> : photos[i].caption}
        </button>
      ))}
      <button
        type="button"
        className={styles.showAll}
        onClick={() => {
          setIndex(0);
          mainRef.current?.focus();
        }}
      >
        Show all {n} photos
      </button>
      <div className={styles.saveWrap}>
        <button
          ref={saveRef}
          type="button"
          className={`${styles.save} ${saved ? styles.saveOn : ""}`}
          aria-label="Save to favourites"
          aria-pressed={signedIn ? saved : undefined}
          aria-expanded={signedIn ? undefined : signinOpen}
          onClick={onSaveClick}
        >
          <Heart size={18} aria-hidden="true" fill={saved ? "currentColor" : "none"} />
        </button>
        {signinOpen && (
          <div ref={signinRef} role="dialog" aria-label="Sign in to save" className={styles.signin}>
            <p className={styles.signinText}>Sign in to save this car to your favourites.</p>
            <div className={styles.signinActions}>
              <Link
                to={`/login?redirect=${encodeURIComponent(location.pathname + location.search)}`}
                className={styles.signinLink}
              >
                Sign in
              </Link>
              <button
                type="button"
                className={styles.signinClose}
                onClick={() => {
                  setSigninOpen(false);
                  saveRef.current?.focus();
                }}
              >
                Not now
              </button>
            </div>
          </div>
        )}
      </div>
    </section>
  );
}

// ── Trip fields ──────────────────────────────────────────────────────

// Shows "12 Oct" over a transparent native picker, so the whole box opens it.
function PickerField({ id, label, type, value, display, onChange, min, error, errorId, inputRef }) {
  return (
    <div className={styles.pickerField}>
      <label htmlFor={id} className={styles.tripLabel}>
        {label}
      </label>
      <span className={`${styles.picker} ${error ? styles.pickerInvalid : ""}`}>
        <span aria-hidden="true" className={value ? styles.pickerValue : styles.pickerEmpty}>
          {display}
        </span>
        <input
          id={id}
          ref={inputRef}
          type={type}
          value={value}
          min={min}
          onChange={onChange}
          className={styles.pickerInput}
          aria-invalid={Boolean(error)}
          aria-describedby={error ? errorId : undefined}
        />
      </span>
      {error && (
        <p id={errorId} className={styles.fieldError}>
          {error}
        </p>
      )}
    </div>
  );
}

function ageHelpText(e, surchargeSen) {
  if (e.underage) return `Below the minimum age of ${e.minAge} for this car.`;
  if (e.young) {
    const range = e.minAge === 24 ? "Aged 24" : e.minAge === 23 ? "Aged 23 or 24" : `Aged ${e.minAge} to 24`;
    return `${range}: ${formatSen(surchargeSen)} / day young driver surcharge applies.`;
  }
  return e.minAge >= 25 ? `Minimum age ${e.minAge}.` : `Minimum age ${e.minAge}. Under 25 pays a young driver surcharge.`;
}

// ── Page ─────────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className={styles.page} aria-busy="true" aria-label="Loading car details">
      <div className={styles.skelRow}>
        <span className={styles.skelLine} />
      </div>
      <div className={styles.skelGallery} />
      <span className={`${styles.skelLine} ${styles.skelTitle}`} />
      <span className={styles.skelLine} />
      <div className={styles.skelBlock} />
      <div className={styles.skelBlock} />
    </div>
  );
}

export default function CarDetail() {
  const { listingId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const location = useLocation();
  const uid = useId();
  const key = params.toString();
  const sel = useMemo(() => parseBookingSelection(new URLSearchParams(key)), [key]);
  const [saved, toggleSaved] = useSavedListings();
  const signedIn = Boolean(getToken());
  const tripRef = useRef(null);
  const fromRef = useRef(null);
  const [openFaq, setOpenFaq] = useState(-1);

  const [listingRes, setListingRes] = useState({ id: null, data: null, error: null });
  const [quoteRes, setQuoteRes] = useState({ key: null, data: null });

  useEffect(() => {
    let alive = true;
    getCarListing(listingId)
      .then((r) => alive && setListingRes({ id: listingId, data: r.data, error: null }))
      .catch((err) => alive && setListingRes({ id: listingId, data: null, error: err }));
    return () => {
      alive = false;
    };
  }, [listingId]);

  const errors = tripErrors(sel);
  const tripValid = Boolean(sel.from && sel.to) && !errors.from && !errors.to;
  const quoteKey = `${listingId}?${key}`;

  useEffect(() => {
    let alive = true;
    const s = parseBookingSelection(new URLSearchParams(key));
    const valid = Boolean(s.from && s.to) && !Object.keys(tripErrors(s)).length;
    quoteCarBooking(listingId, valid ? s : { ...s, from: "", to: "" })
      .then((r) => alive && setQuoteRes({ key: quoteKey, data: r.data }))
      .catch(() => alive && setQuoteRes({ key: quoteKey, data: null }));
    return () => {
      alive = false;
    };
  }, [listingId, key, quoteKey]);

  const loading = listingRes.id !== listingId;
  const listing = listingRes.data;

  if (loading) return <DetailSkeleton />;

  if (!listing) {
    return (
      <div className={styles.page}>
        <section className={styles.notFound} aria-labelledby="nf-title">
          <h1 id="nf-title" className={styles.h2}>
            We can&apos;t find that car
          </h1>
          <p className={styles.text}>It may have been withdrawn by the operator, or the link may be out of date.</p>
          <Link to="/cars" className={styles.primaryLink}>
            Browse cars
          </Link>
        </section>
      </div>
    );
  }

  const b = listing.booking;
  const q = quoteRes.data;
  const quote = tripValid ? q?.quote : null;
  const availability = tripValid ? q?.availability : null;
  const eligibility = q?.eligibility;
  const title = `${listing.vehicleMake} ${listing.vehicleModel}`;
  const pickupPointId = sel.pickupPointId || b.pickupPoints[0]?.id || "";
  const pickupServesDropoff = b.dropoffPoints.some((p) => p.id === pickupPointId);
  const dropoffPointId = sel.dropoffPointId || (pickupServesDropoff ? pickupPointId : b.dropoffPoints[0]?.id) || "";
  const days = quote?.days || 0;
  const daysText = plural(days, "day");
  const lengthText = quote ? durationText(quote.hours) : "";
  const problems = tripValid ? q?.problems || [] : [];

  const update = (changes) => {
    setParams(toBookingParams({ ...sel, pickupPointId, ...changes }), { replace: true });
  };
  const setAddOn = (id, qty) => update({ addOns: { ...sel.addOns, [id]: qty } });

  // Why the request button is off, in priority order.
  let reason = "";
  if (!tripValid) reason = "Pick your pick-up and return dates in Your trip to see the deposit.";
  else if (sel.age === null) reason = "Enter the driver's age in Your trip to check eligibility.";
  else if (eligibility?.underage)
    reason = `The minimum driver age for this car is ${eligibility.minAge}. The driver you entered is ${sel.age}.`;
  else if (problems.some((p) => p.code === "NIGHT_HANDOVER_BLOCKED"))
    reason = `${listing.operator.companyName} doesn't hand over or receive cars between ${b.overtime.window.from} and ${b.overtime.window.to}. Change the pickup or return time.`;
  else if (availability && !availability.available)
    reason = `This car is already booked on ${formatDateList(availability.blockedDates)}. Pick another option above.`;
  // Hold the button while a fresh quote for the current selection is loading.
  const quoting = quoteRes.key !== quoteKey;

  const lowStock = Boolean(quote && availability?.available && availability.remaining <= 2);
  const lowStockText = lowStock ? `Only ${availability.remaining} left for these dates` : "";
  const backTo = location.state?.backTo || `/cars${tripParams(sel).toString() ? `?${tripParams(sel)}` : ""}`;
  const cityHref = `/cars?${new URLSearchParams({ city: listing.branch.city, ...Object.fromEntries(tripParams(sel)) })}`;

  const requestBooking = () => {
    if (reason || quoting) return;
    navigate(`/cars/${listing.id}/book?${toBookingParams({ ...sel, pickupPointId, dropoffPointId })}`);
  };

  const quickChips = [
    listing.seats && `${listing.seats} seats`,
    TRANSMISSION[listing.transmission],
    listing.luggageCapacity !== null && plural(listing.luggageCapacity, "bag"),
    ...(listing.policy.unlimitedMileage ? ["Unlimited mileage"] : []),
  ].filter(Boolean);

  const terms = [
    { k: "Fuel policy", ...listing.policy.fuel },
    { k: "Mileage", ...listing.policy.mileage },
    { k: "Insurance", ...listing.policy.insurance },
    { k: "Roadside assistance", ...listing.policy.roadside },
    {
      k: "Drivers",
      value: "Self-drive · 1 authorised driver (you)",
      note:
        b.additionalDriverSen !== null
          ? `Additional drivers: ${formatSen(b.additionalDriverSen)} / day`
          : "Ask the operator about additional drivers",
    },
    { k: "Minimum driver age", value: String(b.minDriverAge), note: "Younger drivers cannot book this car." },
    ...(b.minDriverAge <= b.youngDriver.maxAge
      ? [
          {
            k: "Young driver surcharge",
            value: `${formatSen(b.youngDriver.surchargeSen)} / day`,
            note: `For drivers aged ${b.minDriverAge}–${b.youngDriver.maxAge}. Added to the balance.`,
          },
        ]
      : []),
  ];

  // Operators may leave some specs blank; those rows are left out.
  const specs = [
    ["Make", listing.vehicleMake],
    ["Model", listing.vehicleModel],
    ["Year", listing.modelYear && String(listing.modelYear)],
    ["Type", listing.vehicleType],
    ["Seats", listing.seats && String(listing.seats)],
    ["Transmission", TRANSMISSION[listing.transmission]],
    ["Powertrain", listing.fuelType],
    ["Drivetrain", listing.driveType === "4WD" ? "4WD or AWD" : listing.driveType],
    ["Luggage", listing.luggageCapacity !== null && plural(listing.luggageCapacity, "bag")],
  ].filter(([, v]) => Boolean(v));

  const rateLine = quote
    ? `Your ${lengthText} is charged as ${rateLinesText(quote.rateLines)}, so the rental is ${formatSen(quote.rentalSen)}.`
    : "Set dates to see how your rental is charged.";

  // Rates the operator has set, shortest period first. Weekly and monthly are
  // optional; when empty, longer rentals use the next shorter rate.
  const rateRows = [
    ["Per hour", b.rateCard.hourlySen, "Rentals under 6 hours, and leftover hours under 6"],
    ["Per day", b.rateCard.dailySen, "6 to 24 hours counts as one day"],
    ["Per week", b.rateCard.weeklySen, "Each full 7 days"],
    ["Per month", b.rateCard.monthlySen, "Each full 30 days"],
  ].filter(([, v]) => Number.isInteger(v) && v > 0);

  const ind = q?.indicative;
  const bar = quote?.payInFull
    ? {
        label: "Full amount",
        figure: formatSen(quote.totalSen),
        rate: "after confirmation",
        sub: `Nothing left to pay later · ${lengthText} · pickup is within the balance window`,
      }
    : quote
    ? {
        label: "Deposit",
        figure: formatSen(quote.depositSen),
        rate: "after confirmation",
        sub: quote.balanceSen
          ? `Balance ${formatSen(quote.balanceSen)} by ${formatShortDateTime(quote.balanceDueAt)} · Total ${formatSen(
              quote.totalSen
            )} · ${lengthText}`
          : `Nothing left to pay later · ${lengthText}`,
      }
    : {
        label: "Deposit from · indicative",
        figure: ind ? `${formatSen(ind.depositPerDaySen)} / day` : "…",
        rate: ind ? `${ind.depositPct}% of the daily rate` : "",
        sub: ind
          ? `From ${formatSen(ind.fromDailySen)} / day · exact amounts appear once you pick dates`
          : "Exact amounts appear once you pick dates",
      };

  const alternatives = availability?.alternatives;

  return (
    <div className={styles.page}>
      <div className={styles.topRow}>
        <Link to={backTo} className={styles.back}>
          <ChevronLeft size={18} aria-hidden="true" />
          Back to results
        </Link>
        <nav aria-label="Breadcrumb">
          <ol className={styles.crumbs}>
            <li>
              <Link to="/cars">Car rental</Link>
            </li>
            <li>
              <Link to={cityHref}>{listing.branch.city}</Link>
            </li>
            <li aria-current="page">{title}</li>
          </ol>
        </nav>
      </div>

      <Gallery listing={listing} saved={saved.has(listing.id)} onSave={() => toggleSaved(listing.id)} signedIn={signedIn} />

      <header className={styles.header}>
        <div className={styles.titleRow}>
          <h1 className={styles.h1}>{title}</h1>
          {lowStock && <span className={styles.lowStock}>{lowStockText}</span>}
        </div>
        <p className={styles.subtitle}>
          {listing.vehicleType} · {listing.branch.name}
        </p>
        <ul className={styles.chips}>
          {quickChips.map((c) => (
            <li key={c} className={styles.chip}>
              <Check size={14} aria-hidden="true" />
              {c}
            </li>
          ))}
        </ul>
      </header>

      <OperatorStrip operator={listing.operator} branch={listing.branch} stats={listing.operatorStats} />

      <section id="trip" ref={tripRef} className={styles.card} aria-labelledby="trip-h">
        <div className={styles.cardHead}>
          <h2 id="trip-h" className={styles.h2}>
            Your trip
          </h2>
          <span className={styles.cardHeadNote}>
            {listing.branch.name} · <strong>{quote ? lengthText : "dates not set"}</strong>
          </span>
        </div>
        <div className={styles.tripGrid}>
          <div className={styles.tripPair}>
            <PickerField
              id={`${uid}-from`}
              inputRef={fromRef}
              label="Pick-up date"
              type="date"
              value={sel.from}
              display={sel.from ? formatShortDate(sel.from) : "Add date"}
              min={klToday()}
              onChange={(e) => update({ from: e.target.value })}
              error={errors.from}
              errorId={`${uid}-from-err`}
            />
            <PickerField
              id={`${uid}-ft`}
              label="Pick-up time"
              type="time"
              value={sel.ft}
              display={sel.ft}
              onChange={(e) => update({ ft: e.target.value })}
            />
          </div>
          <div className={styles.tripPair}>
            <PickerField
              id={`${uid}-to`}
              label="Return date"
              type="date"
              value={sel.to}
              display={sel.to ? formatShortDate(sel.to) : "Add date"}
              min={sel.from || klToday()}
              onChange={(e) => update({ to: e.target.value })}
              error={errors.to}
              errorId={`${uid}-to-err`}
            />
            <PickerField
              id={`${uid}-tt`}
              label="Return time"
              type="time"
              value={sel.tt}
              display={sel.tt}
              onChange={(e) => update({ tt: e.target.value })}
            />
          </div>
          <div className={styles.ageField}>
            <label htmlFor={`${uid}-age`} className={styles.tripLabel}>
              Driver age
            </label>
            <input
              id={`${uid}-age`}
              type="number"
              inputMode="numeric"
              min={17}
              max={99}
              value={sel.age ?? ""}
              onChange={(e) => update({ age: e.target.value === "" ? null : parseInt(e.target.value, 10) })}
              aria-describedby={`${uid}-age-help`}
              aria-invalid={Boolean(eligibility?.underage)}
              className={`${styles.ageInput} ${eligibility?.underage ? styles.pickerInvalid : ""}`}
            />
            <p
              id={`${uid}-age-help`}
              className={`${styles.ageHelp} ${eligibility?.underage ? styles.ageHelpError : ""}`}
            >
              {eligibility ? ageHelpText(eligibility, b.youngDriver.surchargeSen) : " "}
            </p>
          </div>
        </div>

        <fieldset className={styles.points}>
          <legend className={styles.pointsLegend}>Pick-up point</legend>
          <p className={styles.pointsNote}>
            Set by {listing.operator.companyName} for this car. A paid point is added to the balance, not to the deposit.
          </p>
          <div className={styles.pointList}>
            {b.pickupPoints.map((p) => {
              const checked = p.id === pickupPointId;
              return (
                <label key={p.id} className={`${styles.point} ${checked ? styles.pointOn : ""}`}>
                  <input
                    type="radio"
                    name={`${uid}-point`}
                    checked={checked}
                    onChange={() => update({ pickupPointId: p.id, dropoffPointId: sel.dropoffPointId })}
                    className={styles.radio}
                  />
                  <span className={styles.pointText}>
                    <span className={styles.pointLabel}>{p.label}</span>
                    <span className={styles.pointNote}>{p.address || p.note}</span>
                  </span>
                  <span className={p.pickupFeeSen ? styles.pointPrice : styles.pointFree}>
                    {p.pickupFeeSen ? `+ ${formatSen(p.pickupFeeSen)}` : "Free"}
                  </span>
                </label>
              );
            })}
          </div>
        </fieldset>

        <fieldset className={styles.points}>
          <legend className={styles.pointsLegend}>Drop-off point</legend>
          <p className={styles.pointsNote}>You can return the car to a different point. Its charge is added to the balance.</p>
          <div className={styles.pointList}>
            {b.dropoffPoints.map((p) => {
              const checked = p.id === dropoffPointId;
              return (
                <label key={p.id} className={`${styles.point} ${checked ? styles.pointOn : ""}`}>
                  <input
                    type="radio"
                    name={`${uid}-dropoff`}
                    checked={checked}
                    onChange={() => update({ dropoffPointId: p.id })}
                    className={styles.radio}
                  />
                  <span className={styles.pointText}>
                    <span className={styles.pointLabel}>
                      {p.label}
                      {p.id === pickupPointId ? " (same as pickup)" : ""}
                    </span>
                    <span className={styles.pointNote}>{p.address || p.note}</span>
                  </span>
                  <span className={p.dropoffFeeSen ? styles.pointPrice : styles.pointFree}>
                    {p.dropoffFeeSen ? `+ ${formatSen(p.dropoffFeeSen)}` : "Free"}
                  </span>
                </label>
              );
            })}
          </div>
          <p className={styles.pointsNote}>Need a place that isn&apos;t listed? You can request one on the next page.</p>
        </fieldset>
      </section>

      {availability && !availability.available && (
        <section className={styles.unavailable} aria-labelledby="unavail-h">
          <h2 id="unavail-h" className={styles.h2}>
            Not available for your dates
          </h2>
          <p className={styles.text}>
            {`${formatDateList(availability.blockedDates)} ${
              availability.blockedDates.length === 1 ? "is" : "are"
            } already booked for this car. Choose one of these instead:`}
          </p>
          <div className={styles.altList}>
            {alternatives?.nearby && (
              <button
                type="button"
                className={styles.alt}
                onClick={() => update({ from: alternatives.nearby.from, to: alternatives.nearby.to })}
              >
                <span className={styles.altText}>
                  <span className={styles.altTitle}>
                    Nearby dates: {formatShortDateTime(klDateTimeToIso(alternatives.nearby.from, sel.ft))} to{" "}
                    {formatShortDateTime(klDateTimeToIso(alternatives.nearby.to, sel.tt))}
                  </span>
                  <span className={styles.altNote}>Same car, same branch, {daysText}</span>
                </span>
                <span className={styles.altAction}>Use these dates</span>
              </button>
            )}
            <Link
              className={styles.alt}
              to={`/cars?${new URLSearchParams({
                city: listing.branch.city,
                type: listing.vehicleType,
                ...Object.fromEntries(tripParams(sel)),
              })}`}
            >
              <span className={styles.altText}>
                <span className={styles.altTitle}>Similar cars in {listing.branch.city}</span>
                <span className={styles.altNote}>
                  {alternatives?.similarCount
                    ? `${plural(alternatives.similarCount, `${listing.vehicleType.toLowerCase()} car`)} free on your dates`
                    : "See what else is free on your dates"}
                </span>
              </span>
              <span className={styles.altAction}>See cars</span>
            </Link>
          </div>
        </section>
      )}

      <section className={styles.card} aria-labelledby="pay-h">
        <h2 id="pay-h" className={`${styles.h2} ${styles.cardTitle}`}>
          Payment schedule
        </h2>
        {quote ? (
          <PaymentSchedule
            quote={quote}
            operatorName={listing.operator.companyName}
            responseWindowHours={b.responseWindowHours}
            refundRule={b.refundRule}
          />
        ) : (
          <div className={styles.scheduleEmpty}>
            <p className={styles.text}>Pick your dates to see the deposit, what is due before pickup, and the deadlines.</p>
            <button
              type="button"
              className={styles.outlineButton}
              onClick={() => {
                tripRef.current?.scrollIntoView({ block: "start" });
                fromRef.current?.focus({ preventScroll: true });
              }}
            >
              Pick dates
            </button>
          </div>
        )}
      </section>

      <RefundBox rule={b.refundRule} />

      <section className={styles.card} aria-labelledby="terms-h">
        <h2 id="terms-h" className={`${styles.h2} ${styles.cardTitle}`}>
          What&apos;s included and rental terms
        </h2>
        <dl className={styles.terms}>
          {terms.map((t) => (
            <div key={t.k} className={styles.term}>
              <dt className={styles.termKey}>{t.k}</dt>
              <dd className={styles.termValue}>{t.value}</dd>
              <dd className={styles.termNote}>{t.note}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.card} aria-labelledby="rules-h">
        <h2 id="rules-h" className={`${styles.h2} ${styles.cardTitle}`}>
          How the price is set
        </h2>
        <p className={styles.text}>
          The rate is the same on every date. Your rental is charged in whole months, then weeks, then days, with leftover
          hours charged by the hour. A weekly or monthly rate only covers its own period.
        </p>
        <div className={styles.rates}>
          {rateRows.map(([k, v, note]) => (
            <div key={k} className={styles.rate}>
              <div className={styles.rateKey}>{k}</div>
              <div className={styles.rateValue}>{formatSen(v)}</div>
              <div className={styles.rateKey}>{note}</div>
            </div>
          ))}
        </div>
        <p className={styles.rateLine}>{rateLine}</p>
        <dl className={styles.terms}>
          <div className={styles.term}>
            <dt className={styles.termKey}>Night pickup and return</dt>
            <dd className={styles.termValue}>
              {b.overtime.nightBlocked
                ? `Not available ${b.overtime.window.from} to ${b.overtime.window.to}`
                : b.overtime.feeSen
                ? `${formatSen(b.overtime.feeSen)} each`
                : "No extra charge"}
            </dd>
            <dd className={styles.termNote}>
              {b.overtime.nightBlocked
                ? `${listing.operator.companyName} only hands over and receives cars between ${b.overtime.window.to} and ${b.overtime.window.from}.`
                : `A flat charge for a pickup or return between ${b.overtime.window.from} and ${b.overtime.window.to}, added to the balance.`}
            </dd>
          </div>
          <div className={styles.term}>
            <dt className={styles.termKey}>Late return</dt>
            <dd className={styles.termValue}>Charged by the hour at the counter</dd>
            <dd className={styles.termNote}>
              Not part of your booking total. {listing.operator.companyName} records the return time and you pay any late
              hours when you hand the car back.
            </dd>
          </div>
        </dl>
      </section>

      <section className={styles.card} aria-labelledby="add-h">
        <h2 id="add-h" className={`${styles.h2} ${styles.cardTitle}`}>
          Add-ons
        </h2>
        <p className={styles.text}>Add-ons are paid with the balance. Your deposit stays the same.</p>
        <ul className={styles.addons}>
          {b.cdw && (
            <li className={`${styles.addon} ${sel.cdw ? styles.addonOn : ""}`}>
              <div className={styles.addonText}>
                <div className={styles.addonName}>{b.cdw.label}</div>
                <div className={styles.addonDesc}>{b.cdw.description}</div>
              </div>
              <span className={styles.addonPrice}>{formatSen(b.cdw.priceSen)} / day</span>
              <button
                type="button"
                className={`${styles.addToggle} ${sel.cdw ? styles.addToggleOn : ""}`}
                aria-pressed={sel.cdw}
                aria-label={`${sel.cdw ? "Remove" : "Add"} collision damage waiver`}
                onClick={() => update({ cdw: !sel.cdw })}
              >
                {sel.cdw ? "Added" : "Add"}
              </button>
            </li>
          )}
          {b.addOns.map((a) => {
            const qty = sel.addOns[a.id] || 0;
            const on = qty > 0;
            return (
              <li key={a.id} className={`${styles.addon} ${on ? styles.addonOn : ""}`}>
                <div className={styles.addonText}>
                  <div className={styles.addonName}>{a.label}</div>
                  <div className={styles.addonDesc}>{a.description}</div>
                </div>
                <span className={styles.addonPrice}>
                  {formatSen(a.priceSen)} / {a.unit === "per_day" ? "day" : "booking"}
                </span>
                {a.maxQty > 1 ? (
                  <div role="group" aria-label={`${a.label} quantity`} className={styles.stepper}>
                    <button
                      type="button"
                      className={styles.stepButton}
                      aria-label={`Remove one ${a.label.toLowerCase()}`}
                      disabled={qty === 0}
                      onClick={() => setAddOn(a.id, Math.max(0, qty - 1))}
                    >
                      <Minus size={16} aria-hidden="true" />
                    </button>
                    <span className={styles.stepValue} aria-live="polite">
                      {qty}
                    </span>
                    <button
                      type="button"
                      className={styles.stepButton}
                      aria-label={`Add one ${a.label.toLowerCase()}`}
                      disabled={qty >= a.maxQty}
                      onClick={() => setAddOn(a.id, Math.min(a.maxQty, qty + 1))}
                    >
                      <Plus size={16} aria-hidden="true" />
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    className={`${styles.addToggle} ${on ? styles.addToggleOn : ""}`}
                    aria-pressed={on}
                    aria-label={`${on ? "Remove" : "Add"} ${a.label.toLowerCase()}`}
                    onClick={() => setAddOn(a.id, on ? 0 : 1)}
                  >
                    {on ? "Added" : "Add"}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className={styles.card} aria-labelledby="spec-h">
        <h2 id="spec-h" className={`${styles.h2} ${styles.cardTitle}`}>
          Vehicle specifications
        </h2>
        <dl className={styles.specs}>
          {specs.map(([k, v]) => (
            <div key={k} className={styles.spec}>
              <dt className={styles.specKey}>{k}</dt>
              <dd className={styles.specValue}>{v}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className={styles.card} aria-labelledby="faq-h">
        <h2 id="faq-h" className={`${styles.h2} ${styles.cardTitle}`}>
          Questions about this car
        </h2>
        {listing.faqs.map((f, i) => {
          const open = openFaq === i;
          return (
            <div key={f.q} className={styles.faqItem}>
              <h3 className={styles.faqQ}>
                <button
                  type="button"
                  className={styles.faqButton}
                  aria-expanded={open}
                  aria-controls={`${uid}-faq-${i}`}
                  onClick={() => setOpenFaq(open ? -1 : i)}
                >
                  {f.q}
                  <Plus size={18} aria-hidden="true" className={`${styles.faqIcon} ${open ? styles.faqIconOpen : ""}`} />
                </button>
              </h3>
              <p id={`${uid}-faq-${i}`} className={styles.faqA} hidden={!open}>
                {f.a}
              </p>
            </div>
          );
        })}
      </section>

      <BookingBar
        {...bar}
        surchargeLine={
          quote && quote.surchargeSen
            ? `incl. young driver surcharge, ${formatSen(b.youngDriver.surchargeSen)} × ${daysText} · ${formatSen(
                quote.surchargeSen
              )}`
            : ""
        }
        lowStockText={lowStockText}
        reason={reason}
        afterHoursText={
          q?.hours && !q.hours.openNow
            ? `Requests sent after ${q.hours.close} are answered from ${q.hours.open}.`
            : ""
        }
        note={`Free to request. You won't be charged until ${listing.operator.companyName} accepts.`}
        onRequest={requestBooking}
      />
    </div>
  );
}
