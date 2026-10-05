// Pieces shared by the car results page and the operator seller page: the
// trip widget, the mobile filter sheet and the loading skeleton.

import { useEffect, useId, useRef, useState } from "react";
import { PICKUP_CITIES } from "../../services/mock/listings.mock";
import { hasDates } from "../../utils/carSearchParams";
import { klDateTimeToIso, klToday } from "../../utils/formatPublic";
import styles from "../../assets/styles/public/CarResults.module.css";

// ── Search widget ────────────────────────────────────────────────────

function validateTrip(t) {
  const errors = {};
  if (t.from && t.from < klToday()) errors.from = "Pick-up date can't be in the past.";
  if (t.from && !t.to) errors.to = "Add a return date.";
  if (!t.from && t.to) errors.from = "Add a pick-up date.";
  if (t.from && t.to && !errors.from) {
    const start = klDateTimeToIso(t.from, t.ft);
    const end = klDateTimeToIso(t.to, t.tt);
    if (start && end && end <= start) errors.to = "Return must be after pick-up.";
  }
  return errors;
}

export function SearchWidget({ criteria, onApply, fromRef, showCity = true, submitLabel = "Search cars" }) {
  const uid = useId();
  const [draft, setDraft] = useState({
    city: criteria.city,
    from: criteria.from,
    ft: criteria.ft,
    to: criteria.to,
    tt: criteria.tt,
  });
  const [errors, setErrors] = useState({});
  const toRef = useRef(null);
  const dates = hasDates(draft);

  const update = (key) => (e) => {
    setDraft((d) => ({ ...d, [key]: e.target.value }));
    if (errors[key]) setErrors((er) => ({ ...er, [key]: undefined }));
  };

  const submit = (e) => {
    e.preventDefault();
    const found = validateTrip(draft);
    setErrors(found);
    if (found.from) {
      fromRef.current?.focus();
      return;
    }
    if (found.to) {
      toRef.current?.focus();
      return;
    }
    onApply(draft);
  };

  const field = (key, label, input) => (
    <div className={`${styles.field} ${errors[key] ? styles.fieldInvalid : ""}`}>
      <label htmlFor={`${uid}-${key}`} className={styles.fieldLabel}>
        {label}
      </label>
      {input}
      {errors[key] && (
        <p id={`${uid}-${key}-err`} className={styles.fieldError}>
          {errors[key]}
        </p>
      )}
    </div>
  );

  const errProps = (key) => ({
    "aria-invalid": Boolean(errors[key]),
    "aria-describedby": errors[key] ? `${uid}-${key}-err` : undefined,
  });

  return (
    <form className={styles.widget} onSubmit={submit} noValidate aria-label="Search cars">
      <div className={styles.fields}>
        {showCity &&
          field(
          "city",
          "Pick-up city",
          <select id={`${uid}-city`} className={styles.control} value={draft.city} onChange={update("city")}>
            <option value="">All cities</option>
            {PICKUP_CITIES.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>
        )}
        {field(
          "from",
          "Pick-up date",
          <input
            id={`${uid}-from`}
            ref={fromRef}
            type="date"
            className={styles.control}
            min={klToday()}
            value={draft.from}
            onChange={update("from")}
            {...errProps("from")}
          />
        )}
        {field(
          "ft",
          "Pick-up time",
          <input id={`${uid}-ft`} type="time" className={styles.control} value={draft.ft} onChange={update("ft")} />
        )}
        {field(
          "to",
          "Return date",
          <input
            id={`${uid}-to`}
            ref={toRef}
            type="date"
            className={styles.control}
            min={draft.from || klToday()}
            value={draft.to}
            onChange={update("to")}
            {...errProps("to")}
          />
        )}
        {field(
          "tt",
          "Return time",
          <input id={`${uid}-tt`} type="time" className={styles.control} value={draft.tt} onChange={update("tt")} />
        )}
      </div>
      <div className={styles.widgetFoot}>
        <span className={styles.widgetHint}>
          {dates
            ? "Deposits below are exact for these dates."
            : "Pick-up and return dates unlock exact deposits and the amount-payable-now filter."}
        </span>
        <button type="submit" className={styles.primaryButton}>
          {submitLabel}
        </button>
      </div>
    </form>
  );
}

// ── Mobile filter sheet ──────────────────────────────────────────────

export function FilterSheet({ open, onClose, onClearAll, applyLabel, children }) {
  const sheetRef = useRef(null);
  const headingId = useId();

  useEffect(() => {
    if (!open) return undefined;
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    sheetRef.current?.focus();
    const onKey = (e) => {
      if (e.key === "Escape") onClose();
      if (e.key !== "Tab" || !sheetRef.current) return;
      // Keep focus inside the sheet while it is open.
      const nodes = sheetRef.current.querySelectorAll("button, input, select, a[href]");
      const list = [...nodes].filter((n) => !n.disabled);
      if (!list.length) return;
      const first = list[0];
      const last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = prevOverflow;
      document.removeEventListener("keydown", onKey);
    };
  }, [open, onClose]);

  if (!open) return null;
  return (
    <>
      <div className={styles.scrim} onClick={onClose} aria-hidden="true" />
      <div
        ref={sheetRef}
        className={styles.sheet}
        role="dialog"
        aria-modal="true"
        aria-labelledby={headingId}
        tabIndex={-1}
      >
        <div className={styles.sheetHead}>
          <h2 id={headingId} className={styles.railTitle}>
            Filters
          </h2>
          <button type="button" className={styles.clearAll} onClick={onClearAll}>
            Clear all
          </button>
        </div>
        <div className={styles.sheetBody}>{children}</div>
        <div className={styles.sheetFoot}>
          <button type="button" className={styles.primaryButton} onClick={onClose}>
            {applyLabel}
          </button>
        </div>
      </div>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export function ResultsSkeleton() {
  return (
    <div className={styles.skeletons} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <div key={i} className={styles.skeleton}>
          <div className={styles.skelMedia} />
          <div className={styles.skelBody}>
            <span className={styles.skelLine} />
            <span className={`${styles.skelLine} ${styles.skelShort}`} />
            <span className={`${styles.skelLine} ${styles.skelWide}`} />
          </div>
        </div>
      ))}
    </div>
  );
}

