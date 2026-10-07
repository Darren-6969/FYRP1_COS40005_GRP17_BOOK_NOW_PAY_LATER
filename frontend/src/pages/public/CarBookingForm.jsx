import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { AlertCircle, Check, CircleAlert, Info, TriangleAlert, X } from "lucide-react";
import { getCarListing, quoteCarBooking } from "../../services/listing_public_service";
import { requestCarBooking } from "../../services/car_booking_service";
import { parseBookingSelection, toBookingParams, tripParams } from "../../utils/carSearchParams";
import { formatDateList, formatSen, formatShortDateTime } from "../../utils/formatPublic";
import { getUser } from "../../utils/session";
import { BRAND } from "../../constants/brand";
import PaymentSchedule from "../../components/public/PaymentSchedule";
import RefundBox from "../../components/public/RefundBox";
import BookingSummary from "../../components/public/BookingSummary";
import Notice from "../../components/public/Notice";
import styles from "../../assets/styles/public/CarBookingForm.module.css";

const FIELD_ID = {
  name: "bf-name",
  phone: "bf-phone",
  driverName: "bf-driver",
  location: "bf-location",
  chauffeurNote: "bf-chauffeur-note",
  agree: "bf-agree",
  forfeit: "bf-forfeit",
};
const ORDER = ["name", "phone", "driverName", "location", "chauffeurNote", "agree", "forfeit"];
const MAX_NOTE = 500;
const DRAFT_PREFIX = "bnpl_booking_draft:";

// ── validation ───────────────────────────────────────────────────────

function phoneDigits(phone) {
  return phone.replace(/[\s-]/g, "").replace(/^\+?60/, "").replace(/^0/, "");
}

function validate(key, f, agreed, forfeitAgreed) {
  if (key === "name") return f.name.trim() ? "" : "Enter your full name.";
  if (key === "phone") {
    const n = phoneDigits(f.phone);
    if (!n) return "Enter your phone number.";
    return /^1\d{8,9}$/.test(n) ? "" : "Enter a Malaysian mobile number, for example 12-345 6789.";
  }
  if (key === "driverName") return f.isDriver || f.driverName.trim() ? "" : "Enter the driver's full name.";
  if (key === "location") {
    if (!f.requestOther) return "";
    return f.requestedLocation.trim().length >= 3 ? "" : "Enter the place you'd like to pick up from, for example a hotel name.";
  }
  if (key === "chauffeurNote") return f.chauffeurNote.length <= MAX_NOTE ? "" : `Keep the note under ${MAX_NOTE} characters.`;
  if (key === "agree") return agreed ? "" : "Tick to agree to the Terms of Service and rental terms.";
  if (key === "forfeit") return forfeitAgreed ? "" : "Tick to confirm you understand what happens if a payment or your licence is late.";
  return "";
}

function validateAll(f, agreed, forfeitAgreed) {
  const errors = {};
  ORDER.forEach((k) => {
    const msg = validate(k, f, agreed, forfeitAgreed);
    if (msg) errors[k] = msg;
  });
  return errors;
}

// ── draft (survives refresh and a sign-in round trip) ────────────────

function readDraft(listingId) {
  try {
    return JSON.parse(sessionStorage.getItem(DRAFT_PREFIX + listingId) || "null");
  } catch {
    return null;
  }
}

function writeDraft(listingId, form) {
  try {
    sessionStorage.setItem(DRAFT_PREFIX + listingId, JSON.stringify(form));
  } catch {
    // Storage unavailable: the form still works, it just isn't restored.
  }
}

function clearDraft(listingId) {
  try {
    sessionStorage.removeItem(DRAFT_PREFIX + listingId);
  } catch {
    // Nothing to clear.
  }
}

function initialForm(listingId) {
  const user = getUser() || {};
  const blank = {
    name: user.name || user.fullName || "",
    phone: user.phone ? phoneDigits(String(user.phone)) : "",
    isDriver: true,
    driverName: "",
    licence: "MY",
    requestOther: false,
    requestedLocation: "",
    chauffeur: false,
    chauffeurNote: "",
  };
  // Drafts saved before the V2.9 fields existed still restore.
  const draft = readDraft(listingId);
  return draft ? { ...blank, ...draft } : blank;
}

// What the customer accepts if the balance or the licence is late (4.2.5).
function forfeitText(rule, depositSen, op) {
  if (!depositSen) return "If a payment or my driving licence is not in by its deadline, the booking is cancelled.";
  if (rule?.type === "PARTIAL")
    return `If a payment or my driving licence is not in by its deadline, the booking is cancelled and ${op} refunds ${rule.refundPct}% of my ${formatSen(
      depositSen
    )} deposit and keeps the rest.`;
  return `If a payment or my driving licence is not in by its deadline, the booking is cancelled and ${op} keeps my ${formatSen(
    depositSen
  )} deposit.`;
}

// "Andaman Motors'", "Borneo Wheels Sdn. Bhd.'s"
function possessive(name) {
  return /s$/i.test(name) ? `${name}'` : `${name}'s`;
}

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

// ── small pieces ─────────────────────────────────────────────────────

function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className={styles.fieldError}>
      <CircleAlert size={16} aria-hidden="true" className={styles.inlineIcon} />
      {children}
    </p>
  );
}

function Progress() {
  const steps = ["Choose car", "Your details", "Request sent", "Pay deposit"];
  return (
    <nav aria-label="Booking progress" className={styles.progress}>
      <ol className={styles.progressList}>
        {steps.map((label, i) => (
          <li
            key={label}
            className={`${styles.progressStep} ${i === 0 ? styles.stepDone : ""} ${i === 1 ? styles.stepCurrent : ""}`}
            aria-current={i === 1 ? "step" : undefined}
          >
            <span className={styles.progressDot} aria-hidden="true">
              {i === 0 ? <Check size={14} /> : i + 1}
            </span>
            <span className={styles.progressLabel}>{label}</span>
            {i === 0 && <span className={styles.srOnly}>, completed</span>}
          </li>
        ))}
      </ol>
    </nav>
  );
}

function TermsDialog({ open, onClose, title, terms }) {
  const closeRef = useRef(null);
  const doneRef = useRef(null);

  useEffect(() => {
    if (open) closeRef.current?.focus();
  }, [open]);

  if (!open) return null;

  const onKeyDown = (e) => {
    if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
    if (e.key === "Tab") {
      if (e.shiftKey && document.activeElement === closeRef.current) {
        e.preventDefault();
        doneRef.current?.focus();
      } else if (!e.shiftKey && document.activeElement === doneRef.current) {
        e.preventDefault();
        closeRef.current?.focus();
      }
    }
  };

  return (
    <div className={styles.scrim} onClick={onClose} onKeyDown={onKeyDown}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="terms-dialog-h"
        className={styles.dialog}
        onClick={(e) => e.stopPropagation()}
      >
        <div className={styles.dialogHead}>
          <h2 id="terms-dialog-h" className={styles.h2}>
            {title}
          </h2>
          <button ref={closeRef} type="button" className={styles.iconButton} onClick={onClose} aria-label="Close rental terms">
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <dl className={styles.dialogTerms}>
          {terms.map((t) => (
            <div key={t.k} className={styles.dialogTerm}>
              <dt>{t.k}</dt>
              <dd>{t.v}</dd>
            </div>
          ))}
        </dl>
        <button ref={doneRef} type="button" className={styles.secondaryButton} onClick={onClose}>
          Close
        </button>
      </div>
    </div>
  );
}

// ── page ─────────────────────────────────────────────────────────────

export default function CarBookingForm() {
  const { listingId } = useParams();
  const [params, setParams] = useSearchParams();
  const navigate = useNavigate();
  const key = params.toString();
  const sel = useMemo(() => parseBookingSelection(new URLSearchParams(key)), [key]);
  const user = getUser() || {};

  const [form, setForm] = useState(() => initialForm(listingId));
  const [agreedAt, setAgreedAt] = useState(null);
  const [forfeitAt, setForfeitAt] = useState(null);
  const [errors, setErrors] = useState({});
  const [summaryTick, setSummaryTick] = useState(0);
  const [status, setStatus] = useState({ kind: "idle" });
  const [termsOpen, setTermsOpen] = useState(false);
  const [listingRes, setListingRes] = useState({ id: null, data: null });
  const [quoteRes, setQuoteRes] = useState({ key: null, data: null });
  const summaryRef = useRef(null);
  const bannerRef = useRef(null);
  const termsButtonRef = useRef(null);
  const idemKey = useRef(null);

  const agreed = Boolean(agreedAt);
  const forfeitAgreed = Boolean(forfeitAt);
  // A requested location is quoted once it is complete, not on every keystroke.
  const [quotedLocation, setQuotedLocation] = useState(() =>
    form.requestOther && form.requestedLocation.trim().length >= 3 ? form.requestedLocation.trim() : ""
  );
  const quoteKey = `${listingId}?${key}&rl=${quotedLocation}`;

  useEffect(() => {
    let alive = true;
    getCarListing(listingId)
      .then((r) => alive && setListingRes({ id: listingId, data: r.data }))
      .catch(() => alive && setListingRes({ id: listingId, data: null }));
    return () => {
      alive = false;
    };
  }, [listingId]);

  useEffect(() => {
    let alive = true;
    const s = parseBookingSelection(new URLSearchParams(key));
    quoteCarBooking(listingId, { ...s, requestedLocation: quotedLocation })
      .then((r) => alive && setQuoteRes({ key: quoteKey, data: r.data }))
      .catch(() => alive && setQuoteRes({ key: quoteKey, data: null }));
    return () => {
      alive = false;
    };
  }, [listingId, key, quotedLocation, quoteKey]);

  useEffect(() => {
    writeDraft(listingId, form);
  }, [listingId, form]);

  useEffect(() => {
    if (summaryTick) summaryRef.current?.focus();
  }, [summaryTick]);

  useEffect(() => {
    if (status.kind === "failed" || status.kind === "unavailable" || status.kind === "refused") bannerRef.current?.focus();
  }, [status]);

  if (listingRes.id !== listingId) {
    return (
      <div className={styles.page} aria-busy="true">
        <p className={styles.loading}>Loading your booking…</p>
      </div>
    );
  }

  const listing = listingRes.data;
  if (!listing) {
    return (
      <div className={styles.page}>
        <Notice tone="error" role="alert" title="We can't find that car">
          It may have been withdrawn by the operator. <Link to="/cars">Browse cars</Link>
        </Notice>
      </div>
    );
  }

  const b = listing.booking;
  const op = listing.operator.companyName;
  const q = quoteRes.data;
  const quote = q?.quote || null;
  const sending = status.kind === "sending";
  const pickupPointId = sel.pickupPointId || b.pickupPoints[0]?.id || "";
  const dropoffPointId = sel.dropoffPointId || "";
  const detailHref = `/cars/${listing.id}?${toBookingParams({ ...sel, pickupPointId })}`;
  const setSel = (changes) => setParams(toBookingParams({ ...sel, pickupPointId, ...changes }), { replace: true });
  const problems = q?.problems || [];
  const nightBlocked = problems.some((p) => p.code === "NIGHT_HANDOVER_BLOCKED");
  const similarHref = `/cars?${new URLSearchParams({
    city: listing.branch.city,
    type: listing.vehicleType,
    ...Object.fromEntries(tripParams(sel)),
  })}`;

  const unavailableOnLoad = q?.availability && !q.availability.available;
  const unavailableDates =
    status.kind === "unavailable" ? status.dates : unavailableOnLoad ? q.availability.blockedDates : [];
  const showUnavailable = status.kind === "unavailable" || unavailableOnLoad;

  let blockReason = "";
  if (!quote)
    blockReason = "Choose your pick-up and return dates on the car page before sending a request.";
  else if (nightBlocked)
    blockReason = `${op} doesn't hand over or receive cars between ${b.overtime.window.from} and ${b.overtime.window.to}. Change the times on the car page.`;
  else if (showUnavailable) blockReason = "You can't request these dates. Choose other dates or a similar car above.";

  // Once a field has shown an error, re-check it as the user types.
  const change = (field, errKey, value) => {
    const next = { ...form, [field]: value };
    setForm(next);
    if (errors[errKey]) setErrors((e) => ({ ...e, [errKey]: validate(errKey, next, agreed, forfeitAgreed) }));
  };

  const blur = (k) => setErrors((e) => ({ ...e, [k]: validate(k, form, agreed, forfeitAgreed) }));

  const commitLocation = (f = form) => {
    const value = f.requestOther ? f.requestedLocation.trim() : "";
    setQuotedLocation(value.length >= 3 ? value : "");
  };

  const toggleRequestOther = () => {
    const next = { ...form, requestOther: !form.requestOther };
    setForm(next);
    setErrors((e) => ({ ...e, location: "" }));
    commitLocation(next);
  };


  const toggleAgree = (e) => {
    const on = e.target.checked;
    setAgreedAt(on ? new Date().toISOString() : null);
    if (errors.agree) setErrors((er) => ({ ...er, agree: on ? "" : er.agree }));
  };

  const toggleForfeit = (e) => {
    const on = e.target.checked;
    setForfeitAt(on ? new Date().toISOString() : null);
    if (errors.forfeit) setErrors((er) => ({ ...er, forfeit: on ? "" : er.forfeit }));
  };

  const send = () => {
    if (!idemKey.current) idemKey.current = newIdempotencyKey();
    setStatus({ kind: "sending" });
    const digits = phoneDigits(form.phone);

    // Identifiers and choices only. The server prices the booking.
    const requested = form.requestOther ? form.requestedLocation.trim() : "";
    const payload = {
      listingId: listing.id,
      pickupAt: quote.pickupAt,
      returnAt: quote.returnAt,
      pickupPointId: requested ? null : pickupPointId,
      dropoffPointId: requested ? null : dropoffPointId || null,
      requestedLocation: requested || null,
      cdw: Boolean(sel.cdw),
      addOns: Object.entries(sel.addOns)
        .filter(([, n]) => n > 0)
        .map(([id, quantity]) => ({ id, quantity })),
      bookingDetails: {
        contact: { fullName: form.name.trim(), email: user.email || null, phone: `+60${digits}` },
        driver: {
          isBooker: form.isDriver,
          fullName: form.isDriver ? form.name.trim() : form.driverName.trim(),
          licenceIssuedIn: form.licence,
        },
        chauffeur: { requested: form.chauffeur, note: form.chauffeur ? form.chauffeurNote.trim() || null : null },
        agreements: {
          termsOfServiceAcceptedAt: agreedAt,
          rentalTermsAcceptedAt: agreedAt,
          forfeitureAcceptedAt: forfeitAt,
        },
      },
    };

    requestCarBooking(payload, idemKey.current)
      .then((res) => {
        clearDraft(listingId);
        navigate(`/customer/bookings/${res.data.id}`);
      })
      .catch((err) => {
        const data =
          err?.response?.data || {};

        if (
          data.code ===
          "LISTING_UNAVAILABLE"
        ) {
          setStatus({
            kind: "unavailable",
            dates:
              data.details?.dates ||
              [],
          });

        } else if (
          err?.response?.status ===
            422 ||
          data.code ===
            "OTP_REQUIRED" ||
          data.code ===
            "CONCURRENT_EXPOSURE_LIMIT"
        ) {
          setStatus({
            kind: "refused",
            message:
              data.message ||
              "This request can't be sent as it stands.",
          });

        } else if (
          data.code ===
          "REQUEST_IN_PROGRESS"
        ) {
          setStatus({
            kind: "refused",
            message:
              "This booking request is already being processed. Please wait a moment before trying again.",
          });

        } else {
          setStatus({
            kind: "failed",
          });
        }
      });
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (sending) return;
    const found = validateAll(form, agreed, forfeitAgreed);
    if (Object.keys(found).length) {
      setErrors(found);
      setStatus({ kind: "idle" });
      setSummaryTick((n) => n + 1);
      return;
    }
    setErrors({});
    if (blockReason) return;
    // A fresh attempt gets a fresh key; "Try again" reuses the last one.
    idemKey.current = null;
    send();
  };

  const errorList = ORDER.filter((k) => errors[k]).map((k) => ({ k, msg: errors[k], id: FIELD_ID[k] }));
  const describe = (...ids) => ids.filter(Boolean).join(" ") || undefined;
  const due = quote ? formatShortDateTime(quote.payInFull ? quote.licenceDueAt : quote.balanceDueAt) : "";

  const rentalTerms = [
    { k: "Fuel", v: `${listing.policy.fuel.value}. ${listing.policy.fuel.note}` },
    { k: "Mileage", v: `${listing.policy.mileage.value}. ${listing.policy.mileage.note}` },
    { k: "Insurance", v: `${listing.policy.insurance.value} cover. ${listing.policy.insurance.note}` },
    {
      k: "Drivers",
      v:
        b.additionalDriverSen !== null
          ? `One authorised driver. Additional drivers ${formatSen(b.additionalDriverSen)}/day, each with a valid licence.`
          : "One authorised driver. Ask the operator about additional drivers.",
    },
    { k: "Driving licence", v: "A valid driving licence for each driver. No minimum age." },
    {
      k: "Night pickup and return",
      v: b.overtime.nightBlocked
        ? `Not available between ${b.overtime.window.from} and ${b.overtime.window.to}.`
        : b.overtime.feeSen
        ? `${formatSen(b.overtime.feeSen)} for each pickup or return between ${b.overtime.window.from} and ${b.overtime.window.to}, added to the balance.`
        : "No extra charge.",
    },
    {
      k: "Late return",
      v: `${op} records the return time. Late hours are charged by the hour and paid at the counter; they are not part of the booking total.`,
    },
    { k: "Travel area", v: listing.policy.travelArea },
    { k: "Late pick-up", v: listing.policy.latePickup },
  ];

  const closeTerms = () => {
    setTermsOpen(false);
    termsButtonRef.current?.focus();
  };

  return (
    <div className={styles.page}>
      <Link to={detailHref} className={styles.back}>
        ← Back to car
      </Link>
      <Progress />

      <div className={styles.layout}>
        <form className={styles.form} onSubmit={onSubmit} noValidate aria-busy={sending}>
          <h1 className={styles.h1}>Send your booking request</h1>

          <div className={styles.statusSlot}>
            {errorList.length > 0 && summaryTick > 0 && (
              <div ref={summaryRef} tabIndex={-1} role="alert" aria-labelledby="err-h" className={styles.errorSummary}>
                <h2 id="err-h" className={styles.errorTitle}>
                  {errorList.length === 1
                    ? "There is 1 problem to fix before you send your request"
                    : `There are ${errorList.length} problems to fix before you send your request`}
                </h2>
                <ul className={styles.errorList}>
                  {errorList.map((er) => (
                    <li key={er.k}>
                      <a
                        href={`#${er.id}`}
                        onClick={(e) => {
                          e.preventDefault();
                          document.getElementById(er.id)?.focus();
                        }}
                      >
                        {er.msg}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {showUnavailable && (
              <div ref={bannerRef} tabIndex={-1} role="alert" className={`${styles.banner} ${styles.bannerWarn}`}>
                <TriangleAlert size={22} aria-hidden="true" className={styles.bannerIcon} />
                <div>
                  <h2 className={styles.bannerTitle}>
                    {unavailableDates.length
                      ? `This car was just booked for ${formatDateList(unavailableDates)}.`
                      : "This car is no longer available for your dates."}
                  </h2>
                  <p className={styles.bannerText}>
                    Another customer completed a booking that overlaps your dates. You haven&apos;t been charged.
                  </p>
                  <div className={styles.bannerActions}>
                    <Link to={`${detailHref}#trip`} className={styles.primaryLink}>
                      Choose other dates
                    </Link>
                    <Link to={similarHref} className={styles.secondaryLink}>
                      See similar cars
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {status.kind === "failed" && (
              <div ref={bannerRef} tabIndex={-1} role="alert" className={`${styles.banner} ${styles.bannerError}`}>
                <div className={styles.bannerBody}>
                  <AlertCircle size={22} aria-hidden="true" className={styles.bannerIcon} />
                  <div>
                    <h2 className={styles.bannerTitle}>Your request couldn&apos;t be sent. Nothing was charged.</h2>
                    <p className={styles.bannerText}>Your details are kept below.</p>
                  </div>
                </div>
                <button type="button" className={styles.secondaryButton} onClick={send}>
                  Try again
                </button>
              </div>
            )}

            {status.kind === "refused" && (
              <div ref={bannerRef} tabIndex={-1} role="alert" className={`${styles.banner} ${styles.bannerError}`}>
                <div className={styles.bannerBody}>
                  <AlertCircle size={22} aria-hidden="true" className={styles.bannerIcon} />
                  <div>
                    <h2 className={styles.bannerTitle}>Your request wasn&apos;t sent. Nothing was charged.</h2>
                    <p className={styles.bannerText}>{status.message}</p>
                  </div>
                </div>
                <Link to={`${detailHref}#trip`} className={styles.secondaryLink}>
                  Change your trip
                </Link>
              </div>
            )}

            {!quote && q && (
              <Notice tone="warn" title="Dates are missing">
                Choose your pick-up and return dates on the car page first.{" "}
                <Link to={`${detailHref}#trip`}>Back to the car</Link>
              </Notice>
            )}
          </div>

          <fieldset className={styles.lock} disabled={sending}>
            <section className={styles.card} aria-labelledby="s1-h">
              <h2 id="s1-h" className={styles.h2}>
                Contact details
              </h2>
              <div className={styles.field}>
                <label htmlFor={FIELD_ID.name} className={styles.label}>
                  Full name
                </label>
                <input
                  id={FIELD_ID.name}
                  type="text"
                  autoComplete="name"
                  value={form.name}
                  onChange={(e) => change("name", "name", e.target.value)}
                  onBlur={() => blur("name")}
                  aria-invalid={Boolean(errors.name)}
                  aria-describedby={describe(errors.name && "bf-name-err")}
                  className={`${styles.input} ${errors.name ? styles.inputInvalid : ""}`}
                />
                <FieldError id="bf-name-err">{errors.name}</FieldError>
              </div>
              <div className={styles.field}>
                <div className={styles.labelRow}>
                  <label htmlFor="bf-email" className={styles.label}>
                    Email
                  </label>
                  <Link to="/customer/profile" className={styles.smallLink}>
                    Change in account settings
                  </Link>
                </div>
                <input
                  id="bf-email"
                  type="email"
                  readOnly
                  value={user.email || ""}
                  aria-describedby="bf-email-hint"
                  className={`${styles.input} ${styles.inputReadonly}`}
                />
                <p id="bf-email-hint" className={styles.hint}>
                  Your booking confirmation and payment reminders go here.
                </p>
              </div>
              <div className={styles.field}>
                <label htmlFor={FIELD_ID.phone} className={styles.label}>
                  Phone
                </label>
                <span className={`${styles.phoneWrap} ${errors.phone ? styles.inputInvalid : ""}`}>
                  <span aria-hidden="true" className={styles.phonePrefix}>
                    +60
                  </span>
                  <input
                    id={FIELD_ID.phone}
                    type="tel"
                    inputMode="tel"
                    autoComplete="tel-national"
                    required
                    value={form.phone}
                    onChange={(e) => change("phone", "phone", e.target.value)}
                    onBlur={() => blur("phone")}
                    aria-invalid={Boolean(errors.phone)}
                    aria-describedby={describe("bf-phone-hint", errors.phone && "bf-phone-err")}
                    className={styles.phoneInput}
                  />
                </span>
                <p id="bf-phone-hint" className={styles.hint}>
                  Malaysian number, country code +60. {op} uses it to reach you at pick-up.
                </p>
                <FieldError id="bf-phone-err">{errors.phone}</FieldError>
              </div>
            </section>

            <section className={styles.card} aria-labelledby="s2-h">
              <h2 id="s2-h" className={styles.h2}>
                Driver details
              </h2>
              <div className={styles.switchRow}>
                <span id="bf-driver-switch" className={styles.label}>
                  I&apos;m the driver
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.isDriver}
                  aria-labelledby="bf-driver-switch"
                  className={`${styles.switch} ${form.isDriver ? styles.switchOn : ""}`}
                  onClick={() => {
                    setForm((f) => ({ ...f, isDriver: !f.isDriver }));
                    setErrors((e) => ({ ...e, driverName: "" }));
                  }}
                >
                  <span className={styles.switchKnob} />
                </button>
              </div>

              {!form.isDriver && (
                <div className={styles.field}>
                  <label htmlFor={FIELD_ID.driverName} className={styles.label}>
                    Driver full name
                  </label>
                  <input
                    id={FIELD_ID.driverName}
                    type="text"
                    autoComplete="off"
                    value={form.driverName}
                    onChange={(e) => change("driverName", "driverName", e.target.value)}
                    onBlur={() => blur("driverName")}
                    aria-invalid={Boolean(errors.driverName)}
                    aria-describedby={describe("bf-driver-hint", errors.driverName && "bf-driver-err")}
                    className={`${styles.input} ${errors.driverName ? styles.inputInvalid : ""}`}
                  />
                  <p id="bf-driver-hint" className={styles.hint}>
                    As shown on their driving licence.
                  </p>
                  <FieldError id="bf-driver-err">{errors.driverName}</FieldError>
                </div>
              )}

              <fieldset className={styles.group}>
                <legend className={styles.label}>Licence issued in</legend>
                <div className={styles.radioRow}>
                  {[
                    ["MY", "Malaysia"],
                    ["OTHER", "Another country"],
                  ].map(([k, label]) => (
                    <label key={k} className={`${styles.radioCard} ${form.licence === k ? styles.radioCardOn : ""}`}>
                      <input
                        type="radio"
                        name="bf-licence"
                        value={k}
                        checked={form.licence === k}
                        onChange={() => setForm((f) => ({ ...f, licence: k }))}
                        className={styles.radio}
                      />
                      <span>{label}</span>
                    </label>
                  ))}
                </div>
                {form.licence === "OTHER" && (
                  <p role="status" className={styles.noteInfo}>
                    <Info size={16} aria-hidden="true" className={styles.inlineIcon} />
                    <span>
                      You&apos;ll need to upload an international driving permit together with your licence after booking
                      {due ? `, by ${due}` : ""}.
                    </span>
                  </p>
                )}
              </fieldset>
            </section>

            <section className={styles.card} aria-labelledby="s3-h">
              <h2 id="s3-h" className={styles.h2}>
                Pickup, drop-off and extras
              </h2>

              {!form.requestOther && quote && (
                <dl className={styles.miniTerms}>
                  <div>
                    <dt>Pickup</dt>
                    <dd>{quote.pickupPoint.label}</dd>
                  </div>
                  <div>
                    <dt>Drop-off</dt>
                    <dd>
                      {quote.dropoffPoint && quote.dropoffPoint.id !== quote.pickupPoint.id
                        ? quote.dropoffPoint.label
                        : "Same as pickup"}
                    </dd>
                  </div>
                </dl>
              )}
              {!form.requestOther && (
                <p className={styles.hint}>
                  <Link to={`${detailHref}#trip`}>Change pickup or drop-off point</Link>
                </p>
              )}

              <div className={styles.switchRow}>
                <span id="bf-other-switch" className={styles.label}>
                  Request a location that isn&apos;t listed
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.requestOther}
                  aria-labelledby="bf-other-switch"
                  className={`${styles.switch} ${form.requestOther ? styles.switchOn : ""}`}
                  onClick={toggleRequestOther}
                >
                  <span className={styles.switchKnob} />
                </button>
              </div>
              {form.requestOther && (
                <div className={styles.field}>
                  <label htmlFor={FIELD_ID.location} className={styles.label}>
                    Where would you like to pick up and return the car?
                  </label>
                  <input
                    id={FIELD_ID.location}
                    type="text"
                    maxLength={300}
                    value={form.requestedLocation}
                    onChange={(e) => change("requestedLocation", "location", e.target.value)}
                    onBlur={() => {
                      blur("location");
                      commitLocation();
                    }}
                    aria-invalid={Boolean(errors.location)}
                    aria-describedby={describe("bf-location-hint", errors.location && "bf-location-err")}
                    className={`${styles.input} ${errors.location ? styles.inputInvalid : ""}`}
                  />
                  <p id="bf-location-hint" className={styles.hint}>
                    {op} replies with the charge for this location. You accept or decline it before paying anything.
                  </p>
                  <FieldError id="bf-location-err">{errors.location}</FieldError>
                </div>
              )}

              {b.cdw && (
                <div className={styles.switchRow}>
                  <span id="bf-cdw-switch" className={styles.label}>
                    {b.cdw.label}, {formatSen(b.cdw.priceSen)}/day
                  </span>
                  <button
                    type="button"
                    role="switch"
                    aria-checked={sel.cdw}
                    aria-labelledby="bf-cdw-switch"
                    aria-describedby="bf-cdw-hint"
                    className={`${styles.switch} ${sel.cdw ? styles.switchOn : ""}`}
                    onClick={() => setSel({ cdw: !sel.cdw })}
                  >
                    <span className={styles.switchKnob} />
                  </button>
                </div>
              )}
              {b.cdw && (
                <p id="bf-cdw-hint" className={styles.hint}>
                  Optional. {b.cdw.description} Added to the balance.
                </p>
              )}

              <div className={styles.switchRow}>
                <span id="bf-chauffeur-switch" className={styles.label}>
                  Ask about a chauffeur
                </span>
                <button
                  type="button"
                  role="switch"
                  aria-checked={form.chauffeur}
                  aria-labelledby="bf-chauffeur-switch"
                  className={`${styles.switch} ${form.chauffeur ? styles.switchOn : ""}`}
                  onClick={() => setForm((f) => ({ ...f, chauffeur: !f.chauffeur }))}
                >
                  <span className={styles.switchKnob} />
                </button>
              </div>
              {form.chauffeur && (
                <div className={styles.field}>
                  <label htmlFor={FIELD_ID.chauffeurNote} className={styles.label}>
                    Note for {op} (optional)
                  </label>
                  <textarea
                    id={FIELD_ID.chauffeurNote}
                    rows={3}
                    maxLength={MAX_NOTE}
                    value={form.chauffeurNote}
                    onChange={(e) => change("chauffeurNote", "chauffeurNote", e.target.value)}
                    onBlur={() => blur("chauffeurNote")}
                    aria-describedby="bf-chauffeur-hint"
                    className={styles.input}
                  />
                  <p id="bf-chauffeur-hint" className={styles.hint}>
                    Not included in the price. {op} arranges the chauffeur and any charge with you directly.
                  </p>
                  <FieldError id="bf-chauffeur-err">{errors.chauffeurNote}</FieldError>
                </div>
              )}
            </section>

            <section className={styles.card} aria-labelledby="s4-h">
              <h2 id="s4-h" className={styles.h2}>
                Review and agree
              </h2>

              {quote && (
                <div className={styles.subBlock}>
                  <h3 className={styles.h3}>Payment schedule</h3>
                  <PaymentSchedule
                    quote={quote}
                    operatorName={op}
                    responseWindowHours={b.responseWindowHours}
                    refundRule={b.refundRule}
                    showCountdown
                    licenceNote={
                      form.licence === "OTHER"
                        ? "Front and back, plus your international driving permit"
                        : "Photo of the front and back, from your booking page"
                    }
                  />
                </div>
              )}

              <div className={styles.subBlock}>
                <h3 className={styles.h3}>Rental terms</h3>
                <dl className={styles.miniTerms}>
                  <div>
                    <dt>Fuel</dt>
                    <dd>{listing.policy.fuel.value}</dd>
                  </div>
                  <div>
                    <dt>Mileage</dt>
                    <dd>{listing.policy.mileage.value}</dd>
                  </div>
                  <div>
                    <dt>Late return</dt>
                    <dd>Charged by the hour, paid at the counter</dd>
                  </div>
                </dl>
              </div>

              <RefundBox rule={b.refundRule} headingLevel={3} />

              <div className={styles.agree}>
                <div className={`${styles.agreeRow} ${errors.agree ? styles.agreeInvalid : ""}`}>
                  <input
                    id={FIELD_ID.agree}
                    type="checkbox"
                    checked={agreed}
                    onChange={toggleAgree}
                    aria-invalid={Boolean(errors.agree)}
                    aria-describedby={describe(errors.agree && "bf-agree-err")}
                    className={styles.checkbox}
                  />
                  <span className={styles.agreeText}>
                    <label htmlFor={FIELD_ID.agree}>I agree to the </label>
                    <a href="/info/terms" target="_blank" rel="noopener noreferrer" className={styles.agreeLink}>
                      {BRAND.name}
                      {BRAND.suffix} Terms of Service
                      <span className={styles.srOnly}> (opens in a new tab)</span>
                    </a>
                    <label htmlFor={FIELD_ID.agree}> and </label>
                    <button
                      ref={termsButtonRef}
                      type="button"
                      className={styles.agreeButton}
                      aria-haspopup="dialog"
                      onClick={() => setTermsOpen(true)}
                    >
                      {possessive(op)} rental terms
                    </button>
                  </span>
                </div>
                <FieldError id="bf-agree-err">{errors.agree}</FieldError>
                <div className={`${styles.agreeRow} ${errors.forfeit ? styles.agreeInvalid : ""}`}>
                  <input
                    id={FIELD_ID.forfeit}
                    type="checkbox"
                    checked={forfeitAgreed}
                    onChange={toggleForfeit}
                    aria-invalid={Boolean(errors.forfeit)}
                    aria-describedby={describe(errors.forfeit && "bf-forfeit-err")}
                    className={styles.checkbox}
                  />
                  <label htmlFor={FIELD_ID.forfeit} className={styles.agreeText}>
                    I understand: {forfeitText(b.refundRule, quote?.depositSen, op)}
                  </label>
                </div>
                <FieldError id="bf-forfeit-err">{errors.forfeit}</FieldError>
              </div>

              <div className={styles.submitBlock}>
                <button
                  type="submit"
                  className={styles.submit}
                  disabled={Boolean(blockReason) || sending}
                  aria-describedby={describe(blockReason && "bf-block-reason", "bf-submit-sub")}
                >
                  {sending && <span className={styles.spinner} aria-hidden="true" />}
                  <span>{sending ? "Sending request…" : "Send booking request"}</span>
                </button>
                {blockReason && (
                  <p id="bf-block-reason" className={styles.blockReason}>
                    <CircleAlert size={16} aria-hidden="true" className={styles.inlineIcon} />
                    <span>{blockReason}</span>
                  </p>
                )}
                <p id="bf-submit-sub" className={styles.submitSub} aria-live="polite">
                  {sending
                    ? `Sending your request to ${op}. Please don't close this page.`
                    : `Free to request. You won't be charged until ${op} accepts.`}
                </p>
              </div>
            </section>
          </fieldset>
        </form>

        <BookingSummary listing={listing} quote={quote} editHref={`${detailHref}#trip`} />
      </div>

      <TermsDialog open={termsOpen} onClose={closeTerms} title={`${possessive(op)} rental terms`} terms={rentalTerms} />
    </div>
  );
}
