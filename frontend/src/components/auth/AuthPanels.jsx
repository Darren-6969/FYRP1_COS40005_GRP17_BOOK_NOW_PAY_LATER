import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { BRAND } from "../../constants/brand";
import styles from "../../assets/styles/public/Auth.module.css";

const REDUCE_QUERY = "(prefers-reduced-motion: reduce)";

function useReducedMotion() {
  const [reduce, setReduce] = useState(
    () => typeof window !== "undefined" && Boolean(window.matchMedia?.(REDUCE_QUERY).matches)
  );
  useEffect(() => {
    const mq = window.matchMedia?.(REDUCE_QUERY);
    if (!mq) return undefined;
    const onChange = (e) => setReduce(e.matches);
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, []);
  return reduce;
}

// Each panel plays its intro once per visit. Moving between Sign in and
// Create account remounts the panel, and replaying it then would only distract
// from the form, so later mounts start in the finished state.
const introPlayed = new Set();

function useIntro(name) {
  const reduce = useReducedMotion();
  const [play] = useState(() => !introPlayed.has(name));
  useEffect(() => {
    introPlayed.add(name);
  }, [name]);
  return play && !reduce;
}

function Brand() {
  return (
    <span className={styles.brand}>
      <span className={styles.brandTile} aria-hidden="true">
        {BRAND.initial}
      </span>
      <span className={styles.brandName}>
        {BRAND.name}
        <span className={styles.brandSuffix}>{BRAND.suffix}</span>
      </span>
    </span>
  );
}

function ArrowLeft() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

// On phones the panel is the top band and carries the way back to the site.
function PanelTop({ back, aside }) {
  return (
    <div className={styles.panelTop}>
      {back && (
        <Link to={back.to} className={styles.panelBack}>
          <ArrowLeft />
          {back.label}
        </Link>
      )}
      <Brand />
      {aside}
    </div>
  );
}

// The road and the car share one path, drawn in a fixed 640 x 760 box that
// covers the panel at any size.
const ROAD = "M -40 700 C 128 650, 179 502, 307 471 S 538 365, 563 213 S 608 40, 700 -40";
// Where the car parks: just short of the orange pin at (307, 471), which stays
// clear of the card at every width. As a share of the path, and the same spot
// and heading as a fixed transform.
const PARK_AT = 0.3493;
const PARKED = "translate(274.7 481.8) rotate(-23.3)";

// The car drives in once and parks at the pin. No loop: the panel sits beside
// a form, and motion that never stops pulls the eye away from it.
function Road({ play }) {
  return (
    <svg className={styles.road} viewBox="0 0 640 760" preserveAspectRatio="xMidYMid slice" aria-hidden="true" focusable="false">
      <path d={ROAD} fill="none" className={styles.roadBed} strokeWidth="72" strokeLinecap="round" />
      <path d={ROAD} fill="none" className={styles.roadDash} strokeWidth="2" strokeDasharray="16 14" />
      <circle cx="307" cy="471" r="6" fill="#f0a063" />
      {play && <circle className={styles.ping} cx="307" cy="471" r="6" fill="none" stroke="#f0a063" strokeWidth="2" />}
      <circle cx="563" cy="213" r="6" fill="#ffffff" />
      <g transform={play ? undefined : PARKED}>
        <rect x="-15" y="-8" width="30" height="16" rx="6" fill="#f0a063" />
        <rect x="-19" y="-12" width="38" height="24" rx="9" fill="none" stroke="#f0a063" strokeOpacity="0.25" strokeWidth="4" />
        <rect x="6" y="-5" width="6" height="10" rx="2" fill="#14231f" fillOpacity="0.55" />
        {play && (
          <animateMotion
            dur="3.2s"
            fill="freeze"
            rotate="auto"
            path={ROAD}
            calcMode="spline"
            keyTimes="0;1"
            keyPoints={`0;${PARK_AT}`}
            keySplines="0.16 1 0.3 1"
          />
        )}
      </g>
    </svg>
  );
}

// Default panel for customers: the road, the headline and how paying later works.
// The headline is not a heading: the page's own h1 comes first for screen readers.
function RoadPanel({ back }) {
  const play = useIntro("road");
  const rise = play ? styles.rise : "";
  return (
    <>
      <Road play={play} />
      <div className={styles.panelInner}>
        <PanelTop back={back} aside={<p className={styles.tagline}>Rental cars across Sarawak, paid your way.</p>} />
        <div className={styles.panelBottom}>
          <p className={`${styles.panelHeadline} ${rise}`}>
            Book the car.
            <br />
            Pay for it later.
          </p>
          <ol className={`${styles.steps} ${rise} ${play ? styles.riseLate : ""}`} aria-label="How paying later works">
            <li>
              <span className={styles.stepName}>Request</span>
              <span>The operator confirms the car.</span>
            </li>
            <li>
              <span className={styles.stepName}>Deposit</span>
              <span>Pay the share the operator sets.</span>
            </li>
            <li>
              <span className={styles.stepName}>Balance</span>
              <span>Pay the rest before pickup.</span>
            </li>
          </ol>
        </div>
      </div>
    </>
  );
}

const JOIN_STEPS = [
  ["Apply with your business documents", "Registration, licence and owner ID."],
  ["We verify your business", "You hear back by email."],
  ["Set up branches, points and cars", "Set your rates and deposit."],
  ["Accept booking requests", "Get paid through the platform."],
];

function CheckMark() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M20 6 9 17l-5-5" />
    </svg>
  );
}

// Default operator panel: what happens after applying. `step` is the one the
// visitor is on (0 to 3). On operator register (step 0) the steps light in
// turn on a loop, to show the journey ahead. Further on (password setup) the
// steps already behind them are ticked off instead, and nothing loops.
function JoinPanel({ back, step }) {
  const play = useIntro("join");
  const cycle = step === 0;
  const reach = Math.min(Math.max(step, 0), JOIN_STEPS.length - 1) / (JOIN_STEPS.length - 1);
  let fillClass = play ? styles.trackFillPlay : "";
  if (cycle) fillClass = styles.trackFillCycle;
  return (
    <>
      <div className={styles.ring} aria-hidden="true" />
      <div className={styles.panelInner}>
        <PanelTop back={back} aside={<p className={styles.eyebrow}>For rental companies</p>} />
        <div className={styles.panelBottom}>
          <p className={`${styles.panelHeadline} ${play ? styles.rise : ""}`}>
            Put your cars
            <br />
            in front of renters.
          </p>
          <div className={styles.timeline}>
            <div className={styles.track} aria-hidden="true">
              <div className={`${styles.trackFill} ${fillClass}`} style={{ "--reach": reach }} />
            </div>
            <ol className={styles.joinSteps} aria-label="How joining works">
              {JOIN_STEPS.map(([title, detail], index) => {
                if (cycle) {
                  return (
                    <li key={title}>
                      <span className={`${styles.stepDot} ${styles.stepDotCycle}`} style={{ animationDelay: `${index * 2}s` }} aria-hidden="true">
                        0{index + 1}
                      </span>
                      <span className={styles.joinText}>
                        <strong>{title}</strong>
                        <span>{detail}</span>
                      </span>
                    </li>
                  );
                }
                const state = index < step ? "done" : index === step ? "current" : "next";
                return (
                  <li key={title} className={styles[`join_${state}`]} aria-current={state === "current" ? "step" : undefined}>
                    <span className={styles.stepDot} aria-hidden="true">
                      {state === "done" ? <CheckMark /> : `0${index + 1}`}
                    </span>
                    <span className={styles.joinText}>
                      <strong>
                        {title}
                        {state === "done" && <span className={styles.srOnly}>, done</span>}
                      </strong>
                      <span>{detail}</span>
                    </span>
                  </li>
                );
              })}
            </ol>
          </div>
        </div>
        <p className={styles.panelNote}>
          Plans and commission are on the <Link to="/for-operators">For operators</Link> page.
        </p>
      </div>
    </>
  );
}

// An admin promotion from System settings, beside Sign in and Create account
// only. A link to a page on this site stays in the tab; an https link opens a
// new one.
function PromoLink({ href }) {
  if (href.startsWith("/")) {
    return (
      <Link className={styles.learnMore} to={href}>
        Learn more
      </Link>
    );
  }
  return (
    <a className={styles.learnMore} href={href} target="_blank" rel="noopener noreferrer">
      Learn more
      <span className={styles.srOnly}> (opens in a new tab)</span>
    </a>
  );
}

function ImagePanel({ panel, back }) {
  const play = useIntro("image");
  return (
    <>
      <img className={styles.panelImage} src={panel.imageUrl} alt={panel.imageAlt || ""} />
      <div className={styles.panelScrim} aria-hidden="true" />
      <div className={styles.panelInner}>
        <PanelTop back={back} />
        {(panel.headline || panel.linkUrl) && (
          <div className={`${styles.imageBottom} ${play ? styles.rise : ""}`}>
            {panel.headline && <p className={styles.imageHeadline}>{panel.headline}</p>}
            {panel.linkUrl && <PromoLink href={panel.linkUrl} />}
          </div>
        )}
      </div>
    </>
  );
}

// `panel` is null while the setting loads: the panel's colour shows alone, so
// an admin image never replaces an illustration that has already appeared.
export default function AuthPanel({ surface, panel, back, joinStep = 0 }) {
  const operator = surface === "operator";
  const label = operator ? "How joining works" : `${BRAND.name}${BRAND.suffix}`;

  let content = null;
  if (panel?.mode === "image" && panel.imageUrl) content = <ImagePanel panel={panel} back={back} />;
  else if (panel) content = operator ? <JoinPanel back={back} step={joinStep} /> : <RoadPanel back={back} />;

  return (
    <aside className={`${styles.panel} ${operator && panel?.mode !== "image" ? styles.panelOperator : ""}`} aria-label={label}>
      {content}
    </aside>
  );
}

export { ArrowLeft };
