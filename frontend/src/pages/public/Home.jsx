import { useEffect, useId, useRef, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { getRole, getToken } from "../../utils/session";
import { formatRinggit, formatSen, klToday } from "../../utils/formatPublic";
import {
  getAnnouncements,
  getFeaturedCars,
  getFeaturedOperators,
  getFeaturedTours,
  operatorHref,
} from "../../services/listing_public_service";
import { PICKUP_CITIES, PICKUP_SHORTCUTS } from "../../services/mock/listings.mock";
import { parseCarSearch, toCarSearchParams } from "../../utils/carSearchParams";
import styles from "../../assets/styles/public/Home.module.css";

// The hero photo is optional: until src/assets/public/hero-road.png is added,
// the hero falls back to the design's animated gradient.
const heroModules = import.meta.glob("../../assets/public/hero-road.png", { eager: true, import: "default" });
const HERO_SRC = Object.values(heroModules)[0] || null;

const DEP_MIN = 50;
const DEP_MAX = 500;

const TRUST = ["Verified operators only", "Nothing charged to request", "No credit card at booking", "No hidden charges"];

const STEPS = [
  { n: "1", title: "Send a booking request", desc: "It's free, and nothing is charged." },
  { n: "2", title: "The operator confirms", desc: "Usually within 2 hours." },
  { n: "3", title: "Pay the down payment", desc: "This secures the car." },
  { n: "4", title: "Pay the balance before pickup, then collect", desc: "Staff check your original licence at handover." },
];

const PROMPTS = ["Automatic, 7 seats, Kuching", "Cheapest deposit this weekend", "Mulu trip, refundable deposit"];

const FAQS = [
  { q: "How does Book Now Pay Later work here?", a: "Every booking starts as a request. Sending it is free and nothing is charged. Once the operator confirms, usually within 2 hours, you pay a deposit set by the operator, typically 20-30%, to secure the car. The balance is due by a deadline that defaults to 24 hours before your travel starts. You are shown both amounts, the deadline, and what happens if you miss it before you pay anything." },
  { q: "Why does the operator need to confirm?", a: "Operators accept each booking manually. They check that the car is available and ready for your dates before you pay anything." },
  { q: "What happens if my request is declined?", a: "Nothing is charged, and we show you similar cars." },
  { q: "What happens if I miss the balance deadline?", a: "The deposit is forfeited in full. That is the default and it is not negotiable after the cutoff. Individual car rental operators may elect a partial refund rule instead, available only on standard listings outside the platform's peak calendar; where they have, the listing and the payment screen say so before you commit." },
  { q: "When do I submit my driving licence?", a: "After your booking is confirmed, not during checkout. You upload it against that specific order, not once for your account, and it shares the same deadline as the balance. The check is preliminary: rental staff still inspect the original document at handover." },
  { q: "What is the rolling return hold?", a: "It is an inventory rule, not a charge. A booking keeps holding its vehicle past the stated return date until the operator confirms the car is back and ready. That is what stops a car that came back late, damaged or went for servicing from being shown to you as available." },
  { q: "Are the operators verified?", a: "Every operator submits their SSM business registration and relevant transport or tourism licences, and the platform team reviews the application before any listing goes live. Each operator has a public page showing verified status, branch count, completed bookings and how long they have been active." },
  { q: "Is my data protected?", a: "The platform operates under Malaysia's Personal Data Protection Act 2010. Your details are shared with the operator you book with and only to the extent needed to fulfil the booking. You can access, correct, and withdraw consent from your personal centre." },
];

const SEAT_OPTIONS = [
  { value: "", label: "Any" },
  { value: "4", label: "4+ seats" },
  { value: "5", label: "5+ seats" },
  { value: "7", label: "7+ seats" },
];

const AGE_OPTIONS = [
  { value: "18-20", label: "18-20" },
  { value: "21-24", label: "21-24" },
  { value: "25-29", label: "25-29" },
  { value: "30-64", label: "30-64" },
  { value: "65+", label: "65+" },
];

function prefersReducedMotion() {
  return typeof window !== "undefined" && window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
}

// Fades [data-reveal] elements in as they scroll into view. Re-scans whenever
// `deps` change so cards that arrive after a fetch are picked up too.
function useReveal(rootRef, deps) {
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return undefined;
    const els = Array.from(root.querySelectorAll("[data-reveal]:not([data-shown])"));
    const showAll = () => els.forEach((el) => el.setAttribute("data-shown", ""));
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") {
      showAll();
      return undefined;
    }
    root.setAttribute("data-motion", "");
    const io = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.setAttribute("data-shown", "");
          io.unobserve(entry.target);
        });
      },
      { threshold: 0.18, rootMargin: "0px 0px -8% 0px" }
    );
    els.forEach((el, i) => {
      el.style.transitionDelay = `${(i % 4) * 0.06}s`;
      io.observe(el);
    });
    // Never leave content hidden if the observer misbehaves.
    const safety = setTimeout(showAll, 2600);
    return () => {
      io.disconnect();
      clearTimeout(safety);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, deps);
}

// Counts a sen amount up from zero once visible. Screen readers get the final value.
function CountUp({ sen }) {
  const ref = useRef(null);
  const [shown, setShown] = useState(() => (prefersReducedMotion() ? sen : 0));

  useEffect(() => {
    if (prefersReducedMotion() || typeof IntersectionObserver === "undefined") return undefined;
    let raf = null;
    const io = new IntersectionObserver((entries) => {
      if (!entries[0].isIntersecting) return;
      io.disconnect();
      const start = performance.now();
      const tick = (now) => {
        const p = Math.min(1, (now - start) / 520);
        const eased = 1 - Math.pow(1 - p, 3);
        setShown(Math.round((sen / 100) * eased) * 100);
        if (p < 1) raf = requestAnimationFrame(tick);
      };
      raf = requestAnimationFrame(tick);
    });
    if (ref.current) io.observe(ref.current);
    return () => {
      io.disconnect();
      if (raf) cancelAnimationFrame(raf);
    };
  }, [sen]);

  return (
    <span ref={ref}>
      <span aria-hidden="true">{formatSen(shown)}</span>
      <span className={styles.srOnly}>{formatSen(sen)}</span>
    </span>
  );
}

function RefundBadge({ rule }) {
  const partial = rule?.type === "PARTIAL";
  return (
    <span className={`${styles.refund} ${partial ? styles.refundOk : styles.refundWarn}`}>
      {partial ? `${rule.refundPct}% refundable` : "Deposit forfeited"}
    </span>
  );
}

function CarCard({ listing, quote }) {
  const primary = listing.images.find((img) => img.isPrimary) || listing.images[0];
  return (
    <article data-reveal className={styles.card}>
      <div className={styles.cardMedia}>
        {primary ? (
          <img src={primary.imageUrl} alt={listing.name} className={styles.cardImg} />
        ) : (
          <span className={styles.slot} aria-hidden="true">
            vehicle photo
            <br />
            {listing.vehicleMake} {listing.vehicleModel}
          </span>
        )}
        <span className={styles.cardTag}>{listing.vehicleType}</span>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardOperator}>
          <Link to={operatorHref(listing.operator)} className={styles.operatorLink}>
            {listing.operator.companyName}
          </Link>
          {listing.operator.verified && <span className={styles.verified}>Verified</span>}
        </div>
        <h3 className={styles.cardTitle}>
          <Link to={`/cars/${listing.id}`} className={styles.cardTitleLink}>
            {listing.vehicleMake} {listing.vehicleModel}
          </Link>
        </h3>
        <p className={styles.cardMeta}>
          {listing.vehicleType}, {listing.seats} seats, {listing.transmission === "MANUAL" ? "manual" : "automatic"} · {listing.branch.city}
        </p>
        <div className={styles.cardFoot}>
          <div>
            <div className={styles.monoLabel}>Deposit</div>
            <div className={styles.deposit}>
              <CountUp sen={quote.depositSen} />
            </div>
            <div className={styles.balance}>then {formatSen(quote.balanceSen)} before travel</div>
          </div>
          <RefundBadge rule={listing.booking.refundRule} />
        </div>
      </div>
    </article>
  );
}

function TourCard({ tour }) {
  return (
    <article data-reveal className={`${styles.card} ${styles.cardTour}`}>
      <div className={`${styles.cardMedia} ${styles.cardMediaTour}`}>
        <span className={`${styles.slot} ${styles.slotTour}`} aria-hidden="true">
          tour photo
          <br />
          {tour.title.split(" ")[0]}
        </span>
        <span className={`${styles.cardTag} ${styles.cardTagTour}`}>{tour.duration}</span>
      </div>
      <div className={styles.cardBody}>
        <div className={styles.cardOperator}>
          <Link to="/tours" className={styles.operatorLink}>
            {tour.operator}
          </Link>
          <span className={styles.verified}>Verified</span>
        </div>
        <h3 className={styles.cardTitle}>
          <Link to={`/tours/${tour.id}`} className={styles.cardTitleLink}>
            {tour.title}
          </Link>
        </h3>
        <p className={styles.cardMeta}>{tour.meta}</p>
        <div className={styles.cardFootPlain}>
          <div className={styles.monoLabel}>Deposit</div>
          <div className={styles.deposit}>
            <CountUp sen={tour.depositSen} />
          </div>
          <div className={styles.balance}>then {formatSen(tour.balanceSen)} before travel</div>
        </div>
      </div>
    </article>
  );
}

function CardSkeletons() {
  return [0, 1, 2].map((i) => (
    <div key={i} className={`${styles.card} ${styles.skeleton}`} aria-hidden="true">
      <div className={styles.cardMedia} />
      <div className={styles.cardBody}>
        <span className={styles.skelLine} />
        <span className={`${styles.skelLine} ${styles.skelWide}`} />
        <span className={styles.skelLine} />
      </div>
    </div>
  ));
}

function SearchPanel() {
  const navigate = useNavigate();
  const uid = useId();
  const [tab, setTab] = useState("car");
  const [dep, setDep] = useState(200);
  const [error, setError] = useState("");
  const [car, setCar] = useState(() => ({ city: "", from: klToday(7), to: klToday(10), seats: "", age: "25-29" }));
  const [tour, setTour] = useState(() => ({ destination: "Kuching", from: klToday(7), to: klToday(10), party: "2", group: "Family" }));
  const isCar = tab === "car";
  const values = isCar ? car : tour;
  const setValues = isCar ? setCar : setTour;

  const update = (key) => (e) => {
    setValues((prev) => ({ ...prev, [key]: e.target.value }));
    if (error) setError("");
  };

  const onTabKey = (e) => {
    if (e.key === "ArrowRight" || e.key === "ArrowLeft") {
      const next = isCar ? "tour" : "car";
      setTab(next);
      document.getElementById(`${uid}-tab-${next}`)?.focus();
    }
  };

  const onSubmit = (e) => {
    e.preventDefault();
    if (values.from && values.to && values.to <= values.from) {
      setError("Return date must be after the pick-up date.");
      document.getElementById(`${uid}-to`)?.focus();
      return;
    }
    if (isCar) {
      const criteria = parseCarSearch("");
      const p = toCarSearchParams({
        ...criteria,
        city: car.city,
        from: car.from,
        to: car.to,
        age: car.age,
        sel: { ...criteria.sel, seats: car.seats ? [car.seats] : [] },
        dmax: dep < DEP_MAX ? dep : null,
      });
      navigate(`/cars?${p.toString()}`);
    } else {
      const p = new URLSearchParams();
      p.set("destination", tour.destination);
      p.set("from", tour.from);
      p.set("to", tour.to);
      p.set("party", tour.party);
      if (dep < DEP_MAX) p.set("dmax", String(dep));
      navigate(`/tours?${p.toString()}`);
    }
  };

  const depLabel = dep >= DEP_MAX ? "RM500+" : formatRinggit(dep);
  const depPct = ((dep - DEP_MIN) / (DEP_MAX - DEP_MIN)) * 100;

  return (
    <div className={styles.searchWrap}>
      <div role="tablist" aria-label="What are you booking?" className={styles.tabs}>
        {[
          { key: "car", label: "Car rental" },
          { key: "tour", label: "Tour packages" },
        ].map((t) => (
          <button
            key={t.key}
            id={`${uid}-tab-${t.key}`}
            type="button"
            role="tab"
            aria-selected={tab === t.key}
            aria-controls={`${uid}-panel`}
            tabIndex={tab === t.key ? 0 : -1}
            className={`${styles.tab} ${tab === t.key ? styles.tabActive : ""}`}
            onClick={() => setTab(t.key)}
            onKeyDown={onTabKey}
          >
            {t.label}
          </button>
        ))}
      </div>

      <form
        id={`${uid}-panel`}
        role="tabpanel"
        aria-labelledby={`${uid}-tab-${tab}`}
        className={styles.searchCard}
        onSubmit={onSubmit}
        noValidate
      >
        <div className={styles.fields}>
          {isCar ? (
            <>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Pick-up location</span>
                <select className={styles.fieldControl} value={car.city} onChange={update("city")}>
                  <option value="">All cities</option>
                  {PICKUP_CITIES.map((c) => (
                    <option key={c} value={c}>
                      {c}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Pick-up date</span>
                <input type="date" className={styles.fieldControl} min={klToday()} value={car.from} onChange={update("from")} />
              </label>
              <label className={`${styles.field} ${error ? styles.fieldInvalid : ""}`}>
                <span className={styles.fieldLabel}>Return date</span>
                <input
                  id={`${uid}-to`}
                  type="date"
                  className={styles.fieldControl}
                  min={car.from || klToday()}
                  value={car.to}
                  onChange={update("to")}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${uid}-err` : undefined}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Seats needed</span>
                <select className={styles.fieldControl} value={car.seats} onChange={update("seats")}>
                  {SEAT_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Driver age</span>
                <select className={styles.fieldControl} value={car.age} onChange={update("age")}>
                  {AGE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </label>
            </>
          ) : (
            <>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Destination</span>
                <select className={styles.fieldControl} value={tour.destination} onChange={update("destination")}>
                  {["Kuching", "Miri", "Mulu", "Bako"].map((d) => (
                    <option key={d} value={d}>
                      {d}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Departure</span>
                <input type="date" className={styles.fieldControl} min={klToday()} value={tour.from} onChange={update("from")} />
              </label>
              <label className={`${styles.field} ${error ? styles.fieldInvalid : ""}`}>
                <span className={styles.fieldLabel}>Return</span>
                <input
                  id={`${uid}-to`}
                  type="date"
                  className={styles.fieldControl}
                  min={tour.from || klToday()}
                  value={tour.to}
                  onChange={update("to")}
                  aria-invalid={Boolean(error)}
                  aria-describedby={error ? `${uid}-err` : undefined}
                />
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Party size</span>
                <select className={styles.fieldControl} value={tour.party} onChange={update("party")}>
                  {["1", "2", "3", "4", "5", "6", "8", "10"].map((n) => (
                    <option key={n} value={n}>
                      {n} {n === "1" ? "person" : "people"}
                    </option>
                  ))}
                </select>
              </label>
              <label className={styles.field}>
                <span className={styles.fieldLabel}>Group type</span>
                <select className={styles.fieldControl} value={tour.group} onChange={update("group")}>
                  {["Family", "Couple", "Friends", "Solo", "Corporate"].map((g) => (
                    <option key={g} value={g}>
                      {g}
                    </option>
                  ))}
                </select>
              </label>
            </>
          )}
        </div>

        {error && (
          <p id={`${uid}-err`} role="alert" className={styles.searchError}>
            {error}
          </p>
        )}

        <div className={styles.searchFoot}>
          <div className={styles.depWrap}>
            <div className={styles.depHead}>
              <label htmlFor={`${uid}-dep`} className={styles.fieldLabel}>
                Max deposit
              </label>
              <span className={styles.depValue} aria-hidden="true">
                {depLabel}
              </span>
            </div>
            <input
              id={`${uid}-dep`}
              type="range"
              min={DEP_MIN}
              max={DEP_MAX}
              step={10}
              value={dep}
              onChange={(e) => setDep(Number(e.target.value))}
              aria-valuetext={dep >= DEP_MAX ? "RM500 or more" : depLabel}
              className={styles.depRange}
              style={{ "--dep-pct": `${depPct}%` }}
            />
            <div className={styles.depScale} aria-hidden="true">
              <span>RM50</span>
              <span>RM500+</span>
            </div>
          </div>
          <div className={styles.searchActions}>
            <a href="#assistant" className={styles.assistantLink}>
              Or just describe the car you want
            </a>
            <button type="submit" className={styles.searchButton}>
              Search {isCar ? "cars" : "tours"}
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

function Assistant() {
  const navigate = useNavigate();
  const [text, setText] = useState("");
  const onSubmit = (e) => {
    e.preventDefault();
    navigate(`/assistant?q=${encodeURIComponent(text.trim())}`);
  };
  return (
    <section id="assistant" className={styles.assistant} aria-labelledby="assistant-title">
      <div data-reveal className={styles.assistantInner}>
        <h2 id="assistant-title" className={styles.assistantTitle}>
          Say it in plain English.
        </h2>
        <p className={styles.assistantLead}>
          The assistant turns your sentence into search filters. It never invents a car. Every result comes from real,
          available stock.
        </p>
        <form className={styles.assistantForm} onSubmit={onSubmit}>
          <label htmlFor="assistant-input" className={styles.srOnly}>
            Describe the car you want
          </label>
          <input
            id="assistant-input"
            type="text"
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="A 4-seater in Kuching, 17-20 Oct, deposit under RM150"
            className={styles.assistantInput}
          />
          <button type="submit" className={styles.assistantButton}>
            Find it
          </button>
        </form>
        <div className={styles.prompts}>
          {PROMPTS.map((p) => (
            <button key={p} type="button" className={styles.prompt} onClick={() => setText(p)}>
              {p}
            </button>
          ))}
        </div>
      </div>
    </section>
  );
}

function Faq() {
  const [open, setOpen] = useState(0);
  return (
    <section id="faq" className={styles.faq} aria-labelledby="faq-title">
      <div className={styles.faqInner}>
        <h2 id="faq-title" className={styles.faqTitle}>
          Questions people actually ask
        </h2>
        <div>
          {FAQS.map((f, i) => {
            const isOpen = open === i;
            return (
              <div key={f.q} data-reveal className={styles.faqItem}>
                <h3 className={styles.faqQ}>
                  <button
                    type="button"
                    id={`faq-q-${i}`}
                    aria-expanded={isOpen}
                    aria-controls={`faq-a-${i}`}
                    className={styles.faqButton}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                  >
                    <span>{f.q}</span>
                    <span className={`${styles.faqIcon} ${isOpen ? styles.faqIconOpen : ""}`} aria-hidden="true">
                      +
                    </span>
                  </button>
                </h3>
                <div
                  id={`faq-a-${i}`}
                  role="region"
                  aria-labelledby={`faq-q-${i}`}
                  className={`${styles.faqPanel} ${isOpen ? styles.faqPanelOpen : ""}`}
                >
                  <div className={styles.faqPanelInner}>
                    <p className={styles.faqA}>{f.a}</p>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// Operators with live cars, verified and busiest first.
const loadOperators = () => getFeaturedOperators(6).then((r) => ({ data: r.data.items }));

function operatorInitials(name) {
  return String(name || "")
    .replace(/Sdn\.? Bhd\.?/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function OperatorCard({ operator }) {
  return (
    <Link to={operatorHref(operator)} className={styles.opCard}>
      {operator.logoUrl ? (
        <img src={operator.logoUrl} alt="" className={styles.opLogo} />
      ) : (
        <span className={styles.opLogo} aria-hidden="true">
          {operatorInitials(operator.companyName)}
        </span>
      )}
      <span className={styles.opText}>
        <span className={styles.opName}>{operator.companyName}</span>
        <span className={styles.opMeta}>
          {[operator.cities.join(", "), `${operator.carCount} ${operator.carCount === 1 ? "car" : "cars"}`].filter(Boolean).join(" · ")}
        </span>
        {operator.verified && <span className={styles.opVerified}>Verified business</span>}
      </span>
    </Link>
  );
}

function useFetch(fn) {
  const [state, setState] = useState({ status: "loading", data: null });
  useEffect(() => {
    let alive = true;
    fn()
      .then((res) => alive && setState({ status: "ready", data: res.data }))
      .catch(() => alive && setState({ status: "error", data: null }));
    return () => {
      alive = false;
    };
  }, [fn]);
  return state;
}

function Landing() {
  const rootRef = useRef(null);
  const cars = useFetch(getFeaturedCars);
  const tours = useFetch(getFeaturedTours);
  const news = useFetch(getAnnouncements);
  const operators = useFetch(loadOperators);

  useReveal(rootRef, [cars.status, tours.status, news.status]);

  return (
    <div ref={rootRef} className={styles.page}>
      <section id="top" className={styles.hero} aria-labelledby="hero-title">
        {HERO_SRC ? (
          <div className={styles.heroMedia}>
            <img src={HERO_SRC} alt="" className={styles.heroImg} />
          </div>
        ) : (
          <div className={`${styles.heroMedia} ${styles.heroGradient}`} aria-hidden="true" />
        )}
        <div className={styles.heroShade} aria-hidden="true" />

        <div className={styles.heroCopy}>
          <p className={styles.heroBadge}>Malaysia&apos;s BNPL travel platform, pilot launch 2026</p>
          <h1 id="hero-title" className={styles.heroTitle}>
            Book the trip. Pay for it later.
          </h1>
          <p className={styles.heroLead}>Request a car, pay a deposit once it&apos;s confirmed, and the balance later.</p>
        </div>

        <div className={styles.heroSearch}>
          <SearchPanel />
        </div>
      </section>

      <div className={styles.trust}>
        <ul className={styles.trustInner}>
          {TRUST.map((t) => (
            <li key={t} className={styles.trustItem}>
              {t}
            </li>
          ))}
        </ul>
      </div>

      <section id="how" className={styles.section} aria-labelledby="how-title">
        <div className={styles.howGrid}>
          <div>
            <p className={styles.eyebrow}>How it works</p>
            <h2 id="how-title" className={styles.h2Large}>
              Two payments, and you know both before you commit.
            </h2>
            <p className={styles.howLead}>
              Every booking splits into a deposit paid once the operator confirms and a balance paid before pickup. The
              operator sets the split; the platform sets the deadline.
            </p>
            <div className={styles.forfeitBox}>
              <h3 className={styles.forfeitTitle}>If you miss the balance deadline</h3>
              <p className={styles.forfeitBody}>
                The deposit is forfeited in full. Some car rental operators elect a partial refund instead, and where they
                have, it is stated on the listing and on the payment screen before you pay. There is nothing to find in the
                small print.
              </p>
            </div>
          </div>
          <ol className={styles.steps}>
            {STEPS.map((s) => (
              <li key={s.n} data-reveal className={styles.step}>
                <span className={styles.stepNum} aria-hidden="true">
                  {s.n}
                </span>
                <div>
                  <h3 className={styles.stepTitle}>{s.title}</h3>
                  <p className={styles.stepDesc}>{s.desc}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <Assistant />

      <section id="cars" className={`${styles.section} ${styles.sectionTight}`} aria-labelledby="cars-title">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <div>
              <p className={styles.eyebrow}>Car rental</p>
              <h2 id="cars-title" className={styles.h2}>
                Picked for a small deposit
              </h2>
            </div>
            <Link to="/cars" className={styles.headLink}>
              Browse all cars
            </Link>
          </div>
          {cars.status === "error" ? (
            <p className={styles.loadError} role="alert">
              Cars could not be loaded. Refresh the page to try again.
            </p>
          ) : (
            <div className={styles.cards} role="region" aria-label="Featured cars" tabIndex={0} aria-busy={cars.status === "loading"}>
              {cars.status === "loading" ? <CardSkeletons /> : cars.data.map((c) => <CarCard key={c.listing.id} {...c} />)}
            </div>
          )}
        </div>
      </section>

      {operators.status === "ready" && operators.data.length > 0 && (
        <section className={`${styles.section} ${styles.sectionTight}`} aria-labelledby="ops-title">
          <div className={styles.container}>
            <div className={styles.sectionHead}>
              <div>
                <p className={styles.eyebrow}>Operators</p>
                <h2 id="ops-title" className={styles.h2}>
                  Local rental companies on the platform
                </h2>
              </div>
            </div>
            <div className={styles.opGrid}>
              {operators.data.map((o) => (
                <OperatorCard key={o.id} operator={o} />
              ))}
            </div>
          </div>
        </section>
      )}

      <section id="tours" className={`${styles.section} ${styles.sectionTours}`} aria-labelledby="tours-title">
        <div className={styles.container}>
          <div className={styles.sectionHead}>
            <h2 id="tours-title" className={styles.h2}>
              Guided, with a local operator
            </h2>
            <Link to="/tours" className={styles.headLink}>
              Browse all tours
            </Link>
          </div>
          {tours.status === "error" ? (
            <p className={styles.loadError} role="alert">
              Tours could not be loaded. Refresh the page to try again.
            </p>
          ) : (
            <div className={styles.cards} role="region" aria-label="Featured tours" tabIndex={0} aria-busy={tours.status === "loading"}>
              {tours.status === "loading" ? <CardSkeletons /> : tours.data.map((t) => <TourCard key={t.id} tour={t} />)}
            </div>
          )}
        </div>
      </section>

      <section className={styles.pickups} aria-labelledby="pickups-title">
        <div className={styles.pickupsInner}>
          <h2 id="pickups-title" className={styles.pickupsTitle}>
            Pick up in
          </h2>
          <ul className={styles.pickupList}>
            {PICKUP_SHORTCUTS.map((l) => (
              <li key={l.label}>
                <Link to={`/cars?city=${encodeURIComponent(l.city)}`} className={styles.pickupChip}>
                  {l.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section id="operators" className={styles.operators} aria-label="For operators">
        <div className={styles.operatorsInner}>
          <p className={styles.operatorsText}>
            <strong className={styles.operatorsStrong}>Run a rental or tour business?</strong> List only the vehicles you
            can spare, set your own deposit split, and keep the rest of your yard on your own counter.
          </p>
          <Link to="/operator-register" className={styles.outlineButton}>
            List your fleet
          </Link>
        </div>
      </section>

      {news.status === "ready" && news.data.length > 0 && (
        <section className={styles.news} aria-labelledby="news-title">
          <div className={styles.container}>
            <h2 id="news-title" className={styles.newsTitle}>
              Latest from the platform
            </h2>
            <ul className={styles.newsRow} role="region" aria-label="Announcements" tabIndex={0}>
              {news.data.map((n) => (
                <li key={n.id} data-reveal className={styles.newsItem}>
                  <Link to={`/info/news-${n.id}`} className={styles.newsCard}>
                    <span className={styles.newsTag}>{n.tag}</span>
                    <span className={styles.newsHead}>{n.title}</span>
                    <span className={styles.newsBody}>{n.body}</span>
                  </Link>
                </li>
              ))}
            </ul>
          </div>
        </section>
      )}

      <Faq />

      <section className={styles.cta} aria-labelledby="cta-title">
        <div className={styles.ctaInner}>
          <div className={styles.ctaCopy}>
            <h2 id="cta-title" className={styles.ctaTitle}>
              Your next trip is one deposit away.
            </h2>
            <p className={styles.ctaLead}>Create an account first and the booking flow keeps every detail you enter.</p>
          </div>
          <div className={styles.ctaActions}>
            <Link to="/register" className={styles.ctaPrimary}>
              Create an account
            </Link>
            <Link to="/cars" className={styles.ctaSecondary}>
              Keep browsing
            </Link>
          </div>
        </div>
      </section>
    </div>
  );
}

// Operators and admins keep landing on their dashboards at "/", as before.
export default function Home() {
  const role = getToken() ? String(getRole() || "").toUpperCase() : "";
  if (role === "MASTER_SELLER") return <Navigate to="/master/dashboard" replace />;
  if (role === "NORMAL_SELLER") return <Navigate to="/operator/dashboard" replace />;
  return <Landing />;
}
