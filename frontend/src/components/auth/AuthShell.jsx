import { useEffect, useId, useRef, useState } from "react";
import { Link, useOutletContext } from "react-router-dom";
import AuthPanel, { ArrowLeft } from "./AuthPanels";
import { PASSWORD_RULES } from "./authForm";
import { BRAND } from "../../constants/brand";
import styles from "../../assets/styles/public/Auth.module.css";

// `promo` lets an admin image replace the default panel. Only Sign in and
// Create account pass it: password pages and operator register always keep
// their own panel. `joinStep` marks how far an operator has got (0 to 3).
// `split` gives a long form room for two columns on wide screens.
export default function AuthShell({ surface = "customer", back, topRight, after, wide = false, split = false, promo = false, joinStep = 0, children }) {
  const { panels } = useOutletContext() || {};
  const backLink = back || { to: "/", label: "Back to the site" };
  let panel = panels ? panels[surface] || { mode: "default" } : null;
  if (panel && !promo) panel = { mode: "default" };

  return (
    <div className={styles.frame}>
      <AuthPanel surface={surface} panel={panel} back={backLink} joinStep={joinStep} />
      <main className={styles.card}>
        <div className={styles.cardTop}>
          <Link to={backLink.to} className={styles.back}>
            <ArrowLeft />
            {backLink.label}
          </Link>
          {topRight && <p className={styles.topRight}>{topRight}</p>}
        </div>
        <div className={`${styles.body} ${wide ? styles.bodyWide : ""} ${split ? styles.bodySplit : ""}`}>
          {children}
          {/* On phones the switch to the other form sits right under the form,
              before anything secondary. */}
          {topRight && <p className={styles.switchInline}>{topRight}</p>}
          {after && <p className={styles.after}>{after}</p>}
        </div>
        <div className={styles.foot}>
          <span>
            {BRAND.name}
            {BRAND.suffix} pilot · PDPA 2010
          </span>
          <span className={styles.footLinks}>
            <Link to="/info/terms">Terms</Link>
            <Link to="/info/privacy">Privacy</Link>
            <Link to="/info/contact">Contact</Link>
          </span>
        </div>
      </main>
    </div>
  );
}

// `payLater` adds the one-line explainer that stands in for the panel's steps
// on phones, where the panel is only a band.
export function AuthTitle({ title, lede, payLater = false }) {
  useEffect(() => {
    document.title = `${title} · ${BRAND.name}${BRAND.suffix}`;
  }, [title]);

  return (
    <>
      <h1 className={styles.title}>{title}</h1>
      {lede && <p className={styles.lede}>{lede}</p>}
      {payLater && (
        <p className={styles.payLater}>
          Request a car, pay a deposit once the operator accepts, and the balance before pickup.
        </p>
      )}
    </>
  );
}

function describedBy(...ids) {
  return ids.filter(Boolean).join(" ") || undefined;
}

export function FieldError({ id, children }) {
  if (!children) return null;
  return (
    <p id={id} className={styles.fieldError}>
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS.error}
      </svg>
      <span>{children}</span>
    </p>
  );
}

export function AuthField({ label, helper, aside, error, optional = false, multiline = false, className = "", ...input }) {
  const id = useId();
  const helpId = helper ? `${id}-help` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const Tag = multiline ? "textarea" : "input";
  return (
    <div className={`${styles.field} ${className}`}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
          {optional && <span className={styles.optional}> (optional)</span>}
        </label>
        {aside}
      </div>
      <Tag
        id={id}
        aria-describedby={describedBy(errorId, helpId)}
        aria-invalid={error ? true : undefined}
        className={`${styles.input} ${multiline ? styles.textarea : ""}`}
        {...input}
      />
      <FieldError id={errorId}>{error}</FieldError>
      {helper && (
        <p id={helpId} className={styles.helper}>
          {helper}
        </p>
      )}
    </div>
  );
}

// The rules a new password must meet, ticked off as the visitor types. Not a
// live region: it would read out on every keystroke. The field's error names
// what is still missing when they submit.
function PasswordRules({ id, value }) {
  return (
    <ul id={id} className={styles.rules} aria-label="Password rules">
      {PASSWORD_RULES.map((rule) => {
        const met = rule.test(value);
        return (
          <li key={rule.id} className={met ? styles.ruleMet : undefined}>
            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              {met ? <path d="M20 6 9 17l-5-5" /> : <circle cx="12" cy="12" r="4" />}
            </svg>
            {rule.label}
            <span className={styles.srOnly}>{met ? ", done" : ", not yet"}</span>
          </li>
        );
      })}
    </ul>
  );
}

export function PasswordField({ label = "Password", helper, aside, error, rules = false, ...input }) {
  const id = useId();
  const helpId = helper ? `${id}-help` : undefined;
  const rulesId = rules ? `${id}-rules` : undefined;
  const errorId = error ? `${id}-error` : undefined;
  const [show, setShow] = useState(false);
  return (
    <div className={styles.field}>
      <div className={styles.labelRow}>
        <label htmlFor={id} className={styles.label}>
          {label}
        </label>
        {aside}
      </div>
      <div className={styles.passwordWrap}>
        <input
          id={id}
          aria-describedby={describedBy(errorId, helpId, rulesId)}
          aria-invalid={error ? true : undefined}
          className={styles.input}
          type={show ? "text" : "password"}
          {...input}
        />
        <button
          type="button"
          className={styles.reveal}
          onClick={() => setShow((value) => !value)}
          aria-label={show ? `Hide ${label.toLowerCase()}` : `Show ${label.toLowerCase()}`}
          aria-pressed={show}
        >
          {show ? "Hide" : "Show"}
        </button>
      </div>
      <FieldError id={errorId}>{error}</FieldError>
      {rules && <PasswordRules id={rulesId} value={String(input.value || "")} />}
      {helper && (
        <p id={helpId} className={styles.helper}>
          {helper}
        </p>
      )}
    </div>
  );
}

export function Checkbox({ children, error, ...input }) {
  const id = useId();
  const errorId = error ? `${id}-error` : undefined;
  return (
    <div className={styles.field}>
      <label className={styles.check}>
        <input type="checkbox" aria-invalid={error ? true : undefined} aria-describedby={errorId} {...input} />
        <span>{children}</span>
      </label>
      <FieldError id={errorId}>{error}</FieldError>
    </div>
  );
}

export function SubmitButton({ busy, busyLabel, children, ...props }) {
  return (
    <button type="submit" className={styles.cta} disabled={busy} aria-busy={busy || undefined} {...props}>
      {busy ? busyLabel : children}
    </button>
  );
}

const ICONS = {
  error: <path d="M12 8v5m0 3h.01M10.3 3.9 1.8 18a2 2 0 0 0 1.7 3h17a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z" />,
  success: <path d="M20 6 9 17l-5-5" />,
  notice: (
    <>
      <circle cx="12" cy="12" r="9" />
      <path d="M12 11v5m0-8h.01" />
    </>
  ),
};

// An error takes focus and scrolls into view when it appears, so the visitor
// sees it even when they pressed submit at the bottom of a long form. `attempt`
// changes on every failed submit, so the same message is announced again.
export function AuthMessage({ tone = "notice", attempt, children }) {
  const ref = useRef(null);
  const role = tone === "error" ? "alert" : tone === "success" ? "status" : "note";

  useEffect(() => {
    if (tone !== "error" || !ref.current) return;
    const reduce = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches;
    ref.current.focus({ preventScroll: true });
    ref.current.scrollIntoView({ block: "center", behavior: reduce ? "auto" : "smooth" });
  }, [tone, attempt]);

  return (
    <div ref={ref} className={styles[tone]} role={role} tabIndex={tone === "error" ? -1 : undefined}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        {ICONS[tone]}
      </svg>
      <span>{children}</span>
    </div>
  );
}
