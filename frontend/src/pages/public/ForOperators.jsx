import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, CarFront, Check, Map as MapIcon, Plus, UserRound } from "lucide-react";
import RequestDemo from "../../components/public/recruit/RequestDemo";
import DashboardShowcase from "../../components/public/recruit/DashboardShowcase";
import { getRecruitPlans } from "../../services/platform_public_service";
import { BRAND } from "../../constants/brand";
import styles from "../../assets/styles/public/ForOperators.module.css";
import disclosure from "../../assets/styles/public/Disclosure.module.css";
import useReveal from "../../hooks/useReveal";
import useHeaderOverlay from "../../hooks/useHeaderOverlay";

// Operator recruitment page, /for-operators (SRS 4.2.8, FR-CUST-010, BNPLB-126).
// Sells the platform to the three kinds of operator: car rental companies,
// licensed tour guides and licensed drivers. Every apply button opens the
// existing application form, on the right type where the button names one. Tiers, commission and the activity rule come
// from the server, so an admin change shows here with no frontend deploy.

const APPLY_PATH = "/operator-register";

function ApplyButton({ className = "" }) {
  return (
    <Link to={APPLY_PATH} className={`${styles.btn} ${styles.btnCta} ${className}`}>
      Apply to join
      <ArrowRight size={18} className={styles.arrow} aria-hidden="true" />
    </Link>
  );
}

/* ── who can join ────────────────────────────────────────────────── */

// Must match OPERATOR_TYPES in pages/auth/OperatorRegister.jsx (the slugs)
// and APPLICATION_RULES in backend/src/services/operator_type_rules.js.
const OPERATOR_KINDS = [
  {
    slug: "car-rental",
    Icon: CarFront,
    title: "Car rental companies",
    lead: "Rent out the cars you can spare, and run charter tours with your own cars and drivers.",
    list: [
      "Cars with hourly, daily, weekly and monthly rates",
      "Charter tours: one price per car, with the car named",
      "Your own branches, pickup points and deposit split",
      "Choose which cars an independent driver may drive",
    ],
    docs: "Business registration (SSM), owner identity, and a business licence if you have one.",
    cta: "Apply as a car rental company",
  },
  {
    slug: "tour-guide",
    Icon: MapIcon,
    title: "Tour guides",
    lead: "Sell private tour packages as a licensed guide. One price for the group, never per person.",
    list: [
      "Tour packages with itinerary, inclusions and duration",
      "Pickup times and pickup points you choose",
      "A passenger limit for each package",
      "No business registration needed",
    ],
    docs: "Your MOTAC tourist guide licence and your IC or passport.",
    cta: "Apply as a tour guide",
  },
  {
    slug: "driver",
    Icon: UserRound,
    title: "Drivers",
    lead: "Drive the cars customers rent on the platform. You don't need a car of your own.",
    list: [
      "One driver profile: languages and the towns you cover",
      "Your hourly and daily rates",
      "Customers add you on the car booking form",
      "Paid through the platform, separately from the car",
    ],
    docs: "Your driving licence, PSV permit, and IC or passport.",
    cta: "Apply as a driver",
  },
];

function WhoCanJoin() {
  return (
    <section id="who" className={styles.section} aria-labelledby="who-title">
      <div className={styles.wrap}>
        <div data-reveal className={styles.sectionHead}>
          <div>
            <p className={styles.kicker}>Who can join</p>
            <h2 id="who-title" className={styles.h2}>
              Three ways to earn on the platform.
            </h2>
          </div>
          <p className={styles.headText}>
            Pick the one that fits you when you apply. Each type lists different things and sends different
            documents, and every application is checked before anything goes live.
          </p>
        </div>
        <div className={styles.kinds}>
          {OPERATOR_KINDS.map(({ slug, Icon, title, lead, list, docs, cta }) => (
            <article key={slug} data-reveal className={styles.kind} aria-labelledby={`kind-${slug}`}>
              <span className={styles.kindIcon} aria-hidden="true">
                <Icon size={22} />
              </span>
              <h3 id={`kind-${slug}`} className={styles.kindTitle}>
                {title}
              </h3>
              <p className={styles.kindLead}>{lead}</p>
              <ul className={styles.feats}>
                {list.map((item) => (
                  <li key={item} className={styles.feat}>
                    <Check size={18} className={styles.featIcon} aria-hidden="true" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>
              <p className={styles.kindDocs}>
                <strong>You send:</strong> {docs}
              </p>
              <Link to={`${APPLY_PATH}?type=${slug}`} className={styles.kindLink}>
                {cta}
                <ArrowRight size={16} className={styles.arrow} aria-hidden="true" />
              </Link>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
}

/* ── how joining works ───────────────────────────────────────────── */

const STEPS = [
  {
    title: "Apply",
    short: "Choose your type and send your documents.",
    why: "Tell us who you are, what you offer and where you operate.",
    points: [
      "Car rental company, tour guide or driver",
      "Car rental: business registration document and number",
      "Tour guides: MOTAC guide licence. Drivers: driving licence and PSV permit",
      "Owner identity document, for every type",
    ],
  },
  {
    title: "We verify",
    short: "The platform checks your documents.",
    why: "Every application is reviewed by the platform before anything goes live.",
    points: [
      "We check your documents and contact you if something is missing",
      "On approval you set your account password",
      "Car rental companies and guides get a seller page with a Verified badge",
      "Your listings go live as soon as you publish them",
    ],
  },
  {
    title: "Set up",
    short: "Your base, prices and listings.",
    why: "Put up only what you want on the platform. The rest of your business stays yours.",
    points: [
      "Add your branch or base location, and pick-up points with their own charges",
      "Car rental: cars with hourly, daily, weekly and monthly rates, and charter tours",
      "Tour guides: packages with pickup times. Drivers: one profile with hourly and daily rates",
      "Choose your deposit split and payment deadline",
    ],
  },
  {
    title: "Take requests",
    short: "Accept or reject each request.",
    why: "Nothing is confirmed until you say so. Customers pay through the platform once you accept.",
    points: [
      "Each request shows a countdown to your response deadline",
      "Car rental: offer another car, new dates or a charge for a requested place",
      "The customer pays the deposit, then the balance, online",
      "Car rental: check the driving licence, or the driver's, before handover",
    ],
  },
];

function JoiningSteps() {
  const [active, setActive] = useState(0);
  const step = STEPS[active];

  return (
    <section className={styles.section} aria-labelledby="join-title">
      <div className={styles.wrap}>
        <div data-reveal className={styles.sectionHead}>
          <div>
            <p className={styles.kicker}>How joining works</p>
            <h2 id="join-title" className={styles.h2}>
              From application to your first booking in four steps.
            </h2>
          </div>
          <p className={styles.headText}>
            You decide what goes on the platform and keep the rest for your counter, other sites and regular
            customers.
          </p>
        </div>

        <div className={styles.track} aria-hidden="true">
          <i className={styles.trackFill} style={{ transform: `scaleX(${(active + 1) / STEPS.length})` }} />
        </div>
        <div className={styles.steps}>
          {STEPS.map((s, i) => (
            <button
              key={s.title}
              type="button"
              className={`${styles.step} ${i === active ? styles.stepOn : ""}`}
              aria-pressed={i === active}
              aria-controls="join-detail"
              onClick={() => setActive(i)}
              onMouseEnter={() => setActive(i)}
            >
              <span className={styles.stepNum}>0{i + 1}</span>
              <span className={styles.stepTitle}>{s.title}</span>
              <span className={styles.stepShort}>{s.short}</span>
            </button>
          ))}
        </div>

        <div id="join-detail" className={styles.detail} aria-live="polite">
          <div>
            <p className={styles.kicker}>Step 0{active + 1}</p>
            <h3 className={styles.detailTitle}>{step.title}</h3>
            <p className={styles.detailWhy}>{step.why}</p>
          </div>
          {/* key replays the list entrance when the step changes */}
          <ul key={step.title} className={styles.points}>
            {step.points.map((p) => (
              <li key={p} className={styles.point}>
                <Check size={20} className={styles.pointIcon} aria-hidden="true" />
                <span>{p}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </section>
  );
}

/* ── plans ───────────────────────────────────────────────────────── */

function formatRm(n) {
  return `RM ${Number.isInteger(n) ? n : n.toFixed(2)}`;
}

// Turns a tier from the server into what a plan card shows.
function describePlan(plan, previous) {
  const { monthlyPriceRm: price, termDays, listingLimit, label } = plan;
  let priceText;
  let perText;
  if (price === null) {
    priceText = "Contact us";
    perText = "price set with the platform";
  } else if (price === 0) {
    priceText = "Free";
    perText = termDays ? `for ${termDays} days` : "no monthly fee";
  } else {
    priceText = formatRm(price);
    perText = "per month";
  }

  const feats = [`Up to ${listingLimit} live listings`];
  if (termDays) feats.push(`${termDays}-day term, renewable when it ends`);
  else if (price && price > 0) feats.push("Billed monthly, no fixed term");
  else feats.push("No fixed term");
  feats.push(
    previous ? `${listingLimit - previous.listingLimit} more listings than ${previous.label}` : "Full dashboard and seller page"
  );

  return { ...plan, label, priceText, perText, feats };
}

function PlanSkeletons() {
  return (
    <div className={styles.plans} aria-hidden="true">
      <div className={styles.skeleton} />
      <div className={styles.skeleton} />
      <div className={styles.skeleton} />
    </div>
  );
}

function Plans({ status, data, onRetry }) {
  const [cars, setCars] = useState(7);
  const sliderId = useId();

  if (status === "loading") {
    return (
      <div aria-busy="true">
        <p className={styles.srOnly}>Loading plans</p>
        <PlanSkeletons />
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className={styles.loadError} role="alert">
        <span>The plans could not be loaded.</span>
        <button type="button" className={styles.retry} onClick={onRetry}>
          Try again
        </button>
      </div>
    );
  }

  const plans = [...data.plans]
    .sort((a, b) => a.listingLimit - b.listingLimit)
    .map((p, i, all) => describePlan(p, all[i - 1]));
  const maxLimit = Math.max(...plans.map((p) => p.listingLimit), 1);
  const sliderMax = maxLimit + 5;
  const unit = cars === 1 ? "listing" : "listings";
  const fitIndex = plans.findIndex((p) => cars <= p.listingLimit);
  const fitMsg =
    fitIndex >= 0
      ? `${plans[fitIndex].label} covers ${cars} ${unit}.`
      : `${plans[plans.length - 1].label} holds up to ${maxLimit} listings. Mention a larger business when you apply.`;
  const sliderPct = ((cars - 1) / (sliderMax - 1)) * 100;
  const markerPct = (Math.min(cars, maxLimit) / maxLimit) * 100;
  const ticks = [...new Set([1, ...plans.map((p) => p.listingLimit), sliderMax])];

  return (
    <>
      <div className={styles.sizer}>
        <div>
          <label htmlFor={sliderId} className={styles.sizerLabel}>
            How many listings will you put on the platform?
          </label>
          <input
            id={sliderId}
            className={styles.range}
            type="range"
            min={1}
            max={sliderMax}
            step={1}
            value={cars}
            onChange={(e) => setCars(Number(e.target.value))}
            aria-valuetext={`${cars} ${unit}`}
            style={{ backgroundSize: `${sliderPct}% 100%` }}
          />
          <div className={styles.ticks} aria-hidden="true">
            {ticks.map((t) => (
              <span key={t} className={styles.tickMark} style={{ left: `${((t - 1) / (sliderMax - 1)) * 100}%` }}>
                {t}
              </span>
            ))}
          </div>
          <p className={styles.fitMsg} aria-live="polite">
            {fitMsg}
          </p>
        </div>
        <div className={styles.count} aria-hidden="true">
          <span className={styles.countNum}>{cars}</span>
          <span className={styles.countUnit}>{unit}</span>
        </div>
      </div>

      <div className={styles.plans}>
        {plans.map((p, i) => {
          const fit = i === fitIndex;
          const short = cars > p.listingLimit;
          return (
            <article
              key={p.plan}
              className={`${styles.plan} ${fit ? styles.planFit : ""} ${short ? styles.planShort : ""}`}
              aria-label={`${p.label} plan`}
            >
              {fit && (
                <span className={styles.planTag}>
                  Fits your {cars} {unit}
                </span>
              )}
              <h3 className={styles.planName}>{p.label}</h3>
              <div className={styles.price}>
                <span className={styles.priceVal}>{p.priceText}</span>
                <span className={styles.pricePer}>{p.perText}</span>
              </div>
              <div className={styles.cap}>
                <div className={styles.capTop}>
                  <span>Live listings</span>
                  <b>Up to {p.listingLimit}</b>
                </div>
                <div className={styles.bar} aria-hidden="true">
                  <i className={styles.barFill} style={{ transform: `scaleX(${p.listingLimit / maxLimit})` }} />
                  <u className={styles.barMarker} style={{ left: `${markerPct}%` }} />
                </div>
              </div>
              <ul className={styles.feats}>
                {p.feats.map((f) => (
                  <li key={f} className={styles.feat}>
                    <Check size={18} className={styles.featIcon} aria-hidden="true" />
                    <span>{f}</span>
                  </li>
                ))}
              </ul>
            </article>
          );
        })}
      </div>

      <div className={styles.plansFoot}>
        <p>
          Every operator starts on {plans[0].label} once approved. You can upgrade from your dashboard at any time, and
          the platform confirms the change.
        </p>
        <ApplyButton />
      </div>
    </>
  );
}

/* ── faq ─────────────────────────────────────────────────────────── */

function buildFaqs(data) {
  const rate = data?.commissionRate;
  const days = data?.inactivityDays ?? 90;
  const grace = data?.inactivityGraceDays ?? 14;
  return [
    {
      q: "What does the platform charge?",
      a:
        rate !== null && rate !== undefined
          ? `A commission of ${rate}% on each booking paid through the platform, on top of your plan. The rate is the same on every plan and is shown in your dashboard.`
          : "A commission on each booking paid through the platform, on top of your plan. The rate is the same on every plan and is shown in your dashboard.",
    },
    {
      q: "Do I have to list my whole fleet?",
      a: "No. You choose how many cars of each model go on the platform and can block dates in the calendar. The rest of your fleet stays free for walk-in customers, other sites and regulars.",
    },
    {
      q: "What documents do I need to apply?",
      a: "It depends on your type. Car rental companies send the business registration number and document, an owner identity document, and a business licence if they need one. Tour guides send their MOTAC tourist guide licence and IC or passport. Drivers send their driving licence, PSV permit and IC or passport.",
    },
    {
      q: "Do drivers need their own car?",
      a: "No. A driver drives a car the customer rents on the platform, from a car rental company that allows independent drivers on that car. The driver's job is its own booking: the customer pays the driver through the platform, separately from the car, and the car rental company checks the driver's licence before handover.",
    },
    {
      q: "Can tour guides and drivers join without a registered business?",
      a: "Yes. Business registration is optional for tour guides and drivers. Your licence and identity document are what we check.",
    },
    {
      q: "How do customer payments reach me?",
      a: "Customers pay the deposit and the balance online, by card through Stripe or by DuitNow. Card payments go to the bank account you connect during setup. DuitNow receipts appear in your dashboard for you to check.",
    },
    {
      q: "Can I turn down a booking?",
      a: "Yes. You accept or reject every request yourself, or make an offer with another car, new dates or a charge for a place the customer asked for. If you set a response time, unanswered requests close when it runs out.",
    },
    {
      q: "What happens if my account goes quiet?",
      a: `Any change you save in the dashboard keeps your account active. After ${days} days with no activity we send a warning and give you ${grace} days. If nothing happens, the account is suspended, never deleted: listings are hidden, bookings you already accepted still go ahead, and you can ask to reactivate.`,
    },
  ];
}

function Faq({ data }) {
  const [open, setOpen] = useState(0);
  const baseId = useId();
  const faqs = buildFaqs(data);

  return (
    <section id="faq" className={styles.section} aria-labelledby="ops-faq-title">
      <div className={`${styles.wrap} ${styles.faqWrap}`}>
        <div>
          <p className={styles.kicker}>Common questions</p>
          <h2 id="ops-faq-title" className={styles.h2}>
            What operators ask before they apply.
          </h2>
        </div>
        <div className={styles.faqs}>
          {faqs.map((f, i) => {
            const isOpen = i === open;
            const btnId = `${baseId}-q${i}`;
            const panelId = `${baseId}-a${i}`;
            return (
              <div key={f.q} data-reveal className={`${styles.faq} ${isOpen ? styles.faqOpen : ""}`}>
                <h3 style={{ margin: 0 }}>
                  <button
                    id={btnId}
                    type="button"
                    className={styles.faqBtn}
                    aria-expanded={isOpen}
                    aria-controls={panelId}
                    onClick={() => setOpen(isOpen ? -1 : i)}
                  >
                    <span>{f.q}</span>
                    <span className={`${styles.faqIcon} ${disclosure.icon} ${isOpen ? disclosure.iconOpen : ""}`} aria-hidden="true">
                      <Plus size={14} strokeWidth={2.2} />
                    </span>
                  </button>
                </h3>
                <div
                  id={panelId}
                  role="region"
                  aria-labelledby={btnId}
                  className={`${disclosure.panel} ${isOpen ? disclosure.panelOpen : ""}`}
                >
                  <div className={disclosure.panelInner}>
                    <p className={styles.answerText}>{f.a}</p>
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

/* ── page ────────────────────────────────────────────────────────── */

export default function ForOperators() {
  const rootRef = useRef(null);
  useHeaderOverlay();
  const [plans, setPlans] = useState({ status: "loading", data: null });

  const fetchPlans = useCallback(() => {
    getRecruitPlans()
      .then((data) => setPlans({ status: "ready", data }))
      .catch(() => setPlans({ status: "error", data: null }));
  }, []);

  useEffect(() => {
    fetchPlans();
  }, [fetchPlans]);

  const retry = () => {
    setPlans({ status: "loading", data: null });
    fetchPlans();
  };

  // Sections below the hero fade in as they scroll into view (marketing page).
  useReveal(rootRef, [plans.status]);

  useEffect(() => {
    document.title = `Join as an operator · ${BRAND.name}${BRAND.suffix}`;
  }, []);

  return (
    <div ref={rootRef} className={styles.page}>
      <section className={styles.hero} aria-labelledby="ops-hero-title">
        <div className={styles.road} aria-hidden="true" />
        <div className={`${styles.wrap} ${styles.heroInner}`}>
          <div>
            <p className={`${styles.eyebrow} ${styles.rise}`}>
              <span className={styles.pulse} aria-hidden="true" />
              For car rental companies, tour guides and drivers
            </p>
            <h1 id="ops-hero-title" className={`${styles.h1} ${styles.rise} ${styles.d1}`}>
              Reach more customers <span className={styles.h1Accent}>on your own terms.</span>
            </h1>
            <p className={`${styles.lede} ${styles.rise} ${styles.d2}`}>
              Rent out your cars, sell tour packages or drive the cars customers rent. Set your own rates, and accept
              each booking request yourself. Payments come through the platform.
            </p>
            <div className={`${styles.heroCtas} ${styles.rise} ${styles.d3}`}>
              <ApplyButton />
              <a href="#who" className={`${styles.btn} ${styles.btnGhost}`}>
                Who can join
              </a>
            </div>
          </div>
          <RequestDemo />
        </div>
      </section>

      <WhoCanJoin />

      <JoiningSteps />

      <section id="plans" className={`${styles.section} ${styles.plansBand}`} aria-labelledby="plans-title">
        <div className={styles.wrap}>
          <div data-reveal className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Plans</p>
              <h2 id="plans-title" className={styles.h2}>
                Start free. Move up as you list more.
              </h2>
            </div>
            <p className={styles.headText}>
              Plans differ only in how many listings you can have live. Every plan gets the full dashboard and the same
              commission, whichever type you are.
            </p>
          </div>
          <Plans status={plans.status} data={plans.data} onRetry={retry} />
        </div>
      </section>

      <section className={`${styles.section} ${styles.showBand}`} aria-labelledby="dash-title">
        <div className={styles.wrap}>
          <div data-reveal className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Your dashboard</p>
              <h2 id="dash-title" className={styles.h2}>
                Everything you need to run rentals on the platform.
              </h2>
            </div>
            <p className={styles.headText}>One place for requests, availability, payments and pricing, on desktop or your phone.</p>
          </div>
          <DashboardShowcase />
        </div>
      </section>

      <Faq data={plans.data} />

      <section className={styles.ctaSection} aria-labelledby="ops-cta-title">
        <div className={styles.wrap}>
          <div data-reveal className={styles.cta}>
            <div>
              <h2 id="ops-cta-title" className={styles.ctaTitle}>
                Ready to take your first booking?
              </h2>
              <p className={styles.ctaText}>
                The application takes a few minutes. We review every operator before their listings go live.
              </p>
            </div>
            <ApplyButton />
          </div>
        </div>
      </section>
    </div>
  );
}
