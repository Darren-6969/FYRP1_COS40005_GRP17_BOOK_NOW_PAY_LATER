import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Link } from "react-router-dom";
import { ArrowRight, Check, Plus } from "lucide-react";
import RequestDemo from "../../components/public/recruit/RequestDemo";
import DashboardShowcase from "../../components/public/recruit/DashboardShowcase";
import { getRecruitPlans } from "../../services/platform_public_service";
import { BRAND } from "../../constants/brand";
import styles from "../../assets/styles/public/ForOperators.module.css";
import disclosure from "../../assets/styles/public/Disclosure.module.css";
import useReveal from "../../hooks/useReveal";

// Operator recruitment page, /for-operators (SRS 4.2.8, FR-CUST-010, BNPLB-126).
// Sells the platform to rental companies; every apply button opens the
// existing application form. Tiers, commission and the activity rule come
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

/* ── how joining works ───────────────────────────────────────────── */

const STEPS = [
  {
    title: "Apply",
    short: "Send your business details and documents.",
    why: "Tell us who you are and where you operate.",
    points: [
      "Business registration number and address",
      "Business registration document",
      "Owner identity document",
      "Business licence, if your business needs one",
    ],
  },
  {
    title: "We verify",
    short: "The platform checks your business.",
    why: "Every application is reviewed by the platform before anything goes live.",
    points: [
      "We check your documents and contact you if something is missing",
      "On approval you set your account password",
      "Your seller page shows a Verified badge",
      "Your listings go live as soon as you publish them",
    ],
  },
  {
    title: "Set up",
    short: "Branches, handover points and cars.",
    why: "Put up only the cars you want on the platform. The rest of your fleet stays yours.",
    points: [
      "Add branches with opening hours and phone numbers",
      "Add pick-up and drop-off points, each with its own charge",
      "Set hourly, daily, weekly and monthly rates for each car",
      "Choose your deposit, overtime charge and night handover rule",
    ],
  },
  {
    title: "Take requests",
    short: "Accept, reject or make an offer.",
    why: "Nothing is confirmed until you say so. Customers pay through the platform once you accept.",
    points: [
      "Each request shows a countdown to your response deadline",
      "Offer another car, new dates or a charge for a requested place",
      "The customer pays the deposit, then the balance, online",
      "Check the driving licence before you hand over the keys",
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
            You decide which cars go on the platform and keep the rest for your counter, other sites and regular
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
  const unit = cars === 1 ? "car" : "cars";
  const fitIndex = plans.findIndex((p) => cars <= p.listingLimit);
  const fitMsg =
    fitIndex >= 0
      ? `${plans[fitIndex].label} covers ${cars} ${unit}.`
      : `${plans[plans.length - 1].label} holds up to ${maxLimit} listings. Mention a larger fleet when you apply.`;
  const sliderPct = ((cars - 1) / (sliderMax - 1)) * 100;
  const markerPct = (Math.min(cars, maxLimit) / maxLimit) * 100;
  const ticks = [...new Set([1, ...plans.map((p) => p.listingLimit), sliderMax])];

  return (
    <>
      <div className={styles.sizer}>
        <div>
          <label htmlFor={sliderId} className={styles.sizerLabel}>
            How many cars will you put on the platform?
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
      a: "Your business registration number and address, the business registration document, an identity document for the owner, and a business licence if your business needs one.",
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
    document.title = `List your cars · ${BRAND.name}${BRAND.suffix}`;
  }, []);

  return (
    <div ref={rootRef} className={styles.page}>
      <section className={styles.hero} aria-labelledby="ops-hero-title">
        <div className={styles.road} aria-hidden="true" />
        <div className={`${styles.wrap} ${styles.heroInner}`}>
          <div>
            <p className={`${styles.eyebrow} ${styles.rise}`}>
              <span className={styles.pulse} aria-hidden="true" />
              For car rental companies in Malaysia
            </p>
            <h1 id="ops-hero-title" className={`${styles.h1} ${styles.rise} ${styles.d1}`}>
              Rent out your spare cars <span className={styles.h1Accent}>to more customers.</span>
            </h1>
            <p className={`${styles.lede} ${styles.rise} ${styles.d2}`}>
              List the cars you choose, set your own rates, and accept each booking request yourself. Payments come
              through the platform.
            </p>
            <div className={`${styles.heroCtas} ${styles.rise} ${styles.d3}`}>
              <ApplyButton />
              <a href="#plans" className={`${styles.btn} ${styles.btnGhost}`}>
                See plans
              </a>
            </div>
          </div>
          <RequestDemo />
        </div>
      </section>

      <JoiningSteps />

      <section id="plans" className={`${styles.section} ${styles.plansBand}`} aria-labelledby="plans-title">
        <div className={styles.wrap}>
          <div data-reveal className={styles.sectionHead}>
            <div>
              <p className={styles.kicker}>Plans</p>
              <h2 id="plans-title" className={styles.h2}>
                Start free. Move up as you list more cars.
              </h2>
            </div>
            <p className={styles.headText}>
              Plans differ only in how many listings you can have live. Every plan gets the full dashboard and the same
              commission.
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
                Ready to list your first car?
              </h2>
              <p className={styles.ctaText}>
                The application takes a few minutes. We review every business before its listings go live.
              </p>
            </div>
            <ApplyButton />
          </div>
        </div>
      </section>
    </div>
  );
}
