import { useEffect, useRef, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  durationText,
  getTour,
  quoteBody,
  quoteTour,
  requestTourBooking,
  selectionFromParams,
} from "../../services/tour_service";
import { formatSen, formatShortDateTime } from "../../utils/formatPublic";
import { getUser } from "../../utils/session";
import { BRAND } from "../../constants/brand";
import { PriceLines } from "./TourDetail";
import styles from "../../assets/styles/public/Tours.module.css";

const MAX_NOTE = 500;

function phoneDigits(phone) {
  return phone.replace(/[\s-]/g, "").replace(/^\+?60/, "").replace(/^0/, "");
}

function newIdempotencyKey() {
  if (typeof crypto !== "undefined" && crypto.randomUUID) return crypto.randomUUID();
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function problemsOf(form) {
  const out = {};
  if (!form.name.trim()) out.name = "Enter your full name.";
  const digits = phoneDigits(form.phone);
  if (!digits) out.phone = "Enter your phone number.";
  else if (!/^1\d{8,9}$/.test(digits)) out.phone = "Enter a Malaysian mobile number, for example 12-345 6789.";
  if (form.note.length > MAX_NOTE) out.note = `Keep the note under ${MAX_NOTE} characters.`;
  if (!form.agree) out.agree = "Accept the terms to send the request.";
  if (!form.forfeit) out.forfeit = "Confirm you understand what happens to the down payment.";
  return out;
}

// The last page of the public flow: contact details and agreements, then the
// request goes to the operator. Nothing is paid here.
export default function TourBookingForm() {
  const { tourId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const sel = selectionFromParams(params);
  const user = getUser() || {};

  const [tour, setTour] = useState(null);
  const [quote, setQuote] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [form, setForm] = useState({
    name: user.name || user.fullName || "",
    phone: user.phone ? phoneDigits(String(user.phone)) : "",
    note: "",
    agree: false,
    forfeit: false,
  });
  const [errors, setErrors] = useState({});
  const [submitError, setSubmitError] = useState("");
  const [sending, setSending] = useState(false);
  const idemKey = useRef(null);
  const body = JSON.stringify(quoteBody(sel));

  useEffect(() => {
    let live = true;
    Promise.all([getTour(tourId), quoteTour(tourId, JSON.parse(body))])
      .then(([tourRes, quoteRes]) => {
        if (!live) return;
        setTour(tourRes.data);
        setQuote(quoteRes.data);
        document.title = `Book ${tourRes.data.name} · ${BRAND.name}${BRAND.suffix}`;
      })
      .catch(() => live && setLoadError("We couldn't load this tour. Go back and choose your date again."));
    return () => {
      live = false;
    };
  }, [tourId, body]);

  const change = (field, value) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: "" }));
  };

  const submit = async (event) => {
    event.preventDefault();
    const found = problemsOf(form);
    setErrors(found);
    if (Object.keys(found).length) return;

    if (!idemKey.current) idemKey.current = newIdempotencyKey();
    const agreedAt = new Date().toISOString();
    setSending(true);
    setSubmitError("");
    try {
      const res = await requestTourBooking(
        {
          listingId: Number(tourId),
          ...quoteBody(sel),
          bookingDetails: {
            contact: { fullName: form.name.trim(), email: user.email || null, phone: `+60${phoneDigits(form.phone)}` },
            note: form.note.trim() || null,
            agreements: {
              termsOfServiceAcceptedAt: agreedAt,
              tourTermsAcceptedAt: agreedAt,
              forfeitureAcceptedAt: agreedAt,
            },
          },
        },
        idemKey.current
      );
      navigate(`/customer/bookings/${res.data.id}`);
    } catch (err) {
      const status = err.response?.status;
      // A different selection needs a new key; a network error keeps it for the retry.
      if (status && status < 500) idemKey.current = null;
      setSubmitError(err.response?.data?.message || "We couldn't send your request. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const backHref = `/tours/${tourId}?${params}`;
  if (loadError) {
    return (
      <main className={styles.page}>
        <Link to={backHref} className={styles.back}>
          <ArrowLeft size={18} aria-hidden="true" /> Back to the tour
        </Link>
        <p className={styles.notice}>{loadError}</p>
      </main>
    );
  }
  if (!tour || !quote) return <main className={styles.page}>Loading...</main>;

  const blocked = quote.problems?.length ? quote.problems[0].message : "";
  const q = quote.quote;
  const op = tour.operator.name;

  return (
    <main className={styles.page}>
      <Link to={backHref} className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" /> Back to the tour
      </Link>
      <h1 className={styles.h1}>Request this tour</h1>
      <p className={styles.lede}>
        {op} has to accept your request first. You pay the down payment only after that.
      </p>

      <form className={styles.form} onSubmit={submit} noValidate>
        <div className={styles.formCard}>
          <h2 className={styles.h2}>Your details</h2>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="tb-name">
              Full name
            </label>
            <input
              id="tb-name"
              className={styles.input}
              value={form.name}
              autoComplete="name"
              onChange={(e) => change("name", e.target.value)}
              aria-invalid={Boolean(errors.name) || undefined}
              aria-describedby={errors.name ? "tb-name-err" : undefined}
            />
            {errors.name && (
              <p id="tb-name-err" className={styles.error}>
                {errors.name}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="tb-phone">
              Phone number
            </label>
            <span className={styles.phoneWrap}>
              <span className={styles.phonePrefix} aria-hidden="true">
                +60
              </span>
              <input
                id="tb-phone"
                className={styles.input}
                type="tel"
                inputMode="tel"
                autoComplete="tel-national"
                value={form.phone}
                onChange={(e) => change("phone", e.target.value)}
                aria-invalid={Boolean(errors.phone) || undefined}
                aria-describedby={`tb-phone-hint${errors.phone ? " tb-phone-err" : ""}`}
              />
            </span>
            <p id="tb-phone-hint" className={styles.hint}>
              Malaysian number, country code +60. {op} uses it to reach you on the day.
            </p>
            {errors.phone && (
              <p id="tb-phone-err" className={styles.error}>
                {errors.phone}
              </p>
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="tb-note">
              Note for {op} (optional)
            </label>
            <textarea
              id="tb-note"
              className={`${styles.input} ${styles.textarea}`}
              maxLength={MAX_NOTE}
              placeholder="Hotel name, children in the group, anything that helps"
              value={form.note}
              onChange={(e) => change("note", e.target.value)}
            />
          </div>

          <h2 className={styles.h2}>Before you send</h2>
          <label className={styles.check}>
            <input type="checkbox" checked={form.agree} onChange={(e) => change("agree", e.target.checked)} />
            <span>
              I accept the <Link to="/info/terms">terms of service</Link> and {op}&apos;s tour terms.
            </span>
          </label>
          {errors.agree && <p className={styles.error}>{errors.agree}</p>}
          {(tour.policies.terms || tour.policies.cancellation) && (
            <details>
              <summary>Read {op}&apos;s tour terms</summary>
              {tour.policies.cancellation && <p className={styles.prose}>{tour.policies.cancellation}</p>}
              {tour.policies.terms && <p className={styles.prose}>{tour.policies.terms}</p>}
            </details>
          )}
          <label className={styles.check}>
            <input type="checkbox" checked={form.forfeit} onChange={(e) => change("forfeit", e.target.checked)} />
            <span>
              If I cancel, or the balance is not paid by its deadline, the booking is cancelled and {op} keeps my{" "}
              {formatSen(q.depositSen)} down payment.
            </span>
          </label>
          {errors.forfeit && <p className={styles.error}>{errors.forfeit}</p>}

          {submitError && (
            <p className={styles.notice} role="alert">
              {submitError}
            </p>
          )}
          {blocked && (
            <p className={styles.notice} role="alert">
              {blocked} <Link to={backHref}>Change your selection</Link>.
            </p>
          )}

          <button type="submit" className={styles.button} disabled={sending || Boolean(blocked)}>
            {sending ? "Sending..." : "Send booking request"}
          </button>
        </div>

        <aside className={styles.panel} aria-label="Your tour">
          <h2 className={styles.h2}>{tour.name}</h2>
          <dl className={styles.lines}>
            <div className={styles.line}>
              <dt>Starts</dt>
              <dd>{q.pickupAt ? formatShortDateTime(q.pickupAt) : `${sel.date} ${sel.pickupTime}`}</dd>
            </div>
            <div className={styles.line}>
              <dt>Duration</dt>
              <dd>{durationText(tour.durationDays)}</dd>
            </div>
            <div className={styles.line}>
              <dt>Passengers</dt>
              <dd>{sel.passengers}</dd>
            </div>
            {q.pickupPoint && (
              <div className={styles.line}>
                <dt>Pickup</dt>
                <dd>{q.pickupPoint.label}</dd>
              </div>
            )}
          </dl>
          <PriceLines quote={q} unitLabel={tour.priceUnitLabel} />
        </aside>
      </form>
    </main>
  );
}
