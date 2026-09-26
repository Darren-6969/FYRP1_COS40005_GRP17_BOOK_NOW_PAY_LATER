import { useEffect, useRef, useState } from "react";
import styles from "../../assets/styles/public/RangeSlider.module.css";

const COMMIT_DELAY_MS = 300;

// Two-handle range built from two native range inputs, so keyboard and screen
// reader support come for free. Values are committed after the user pauses,
// which keeps the URL and the search from updating on every pixel of a drag.
//
// onCommit(lo, hi): a handle resting on its bound is sent as null, so only
// the side the user actually moved is kept.
export default function RangeSlider({ label, min, max, lo, hi, step, disabled, note, format, onCommit }) {
  const [draft, setDraft] = useState(null);
  const timer = useRef(null);

  useEffect(() => () => clearTimeout(timer.current), []);

  const span = Math.max(1, max - min);
  const cur = draft || { lo: Math.max(min, lo ?? min), hi: Math.min(max, hi ?? max) };
  const isAny = draft ? draft.lo <= min && draft.hi >= max : lo === null && hi === null;
  const stepSize = step || (span > 400 ? 10 : 5);
  const pct = (v) => ((v - min) / span) * 100;

  const schedule = (next) => {
    setDraft(next);
    clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      onCommit(next.lo <= min ? null : next.lo, next.hi >= max ? null : next.hi);
      setDraft(null);
    }, COMMIT_DELAY_MS);
  };

  const onLo = (e) => schedule({ lo: Math.min(Number(e.target.value), cur.hi), hi: cur.hi });
  const onHi = (e) => schedule({ lo: cur.lo, hi: Math.max(Number(e.target.value), cur.lo) });

  const lower = label.toLowerCase();

  return (
    <fieldset className={styles.range} disabled={disabled}>
      <legend className={styles.head}>
        <span className={styles.label}>{label}</span>
        <output className={`${styles.value} ${disabled ? styles.valueMuted : ""}`} aria-live="polite">
          {format(cur.lo, cur.hi, isAny)}
        </output>
      </legend>
      <div
        className={styles.track}
        style={{ "--lo": `${pct(cur.lo)}%`, "--hi": `${pct(cur.hi)}%` }}
      >
        <input
          type="range"
          min={min}
          max={max}
          step={stepSize}
          value={cur.lo}
          onChange={onLo}
          aria-label={`Minimum ${lower}`}
          aria-valuetext={`RM${cur.lo}`}
          className={styles.input}
        />
        <input
          type="range"
          min={min}
          max={max}
          step={stepSize}
          value={cur.hi}
          onChange={onHi}
          aria-label={`Maximum ${lower}`}
          aria-valuetext={`RM${cur.hi}`}
          className={styles.input}
        />
      </div>
      {note && <p className={styles.note}>{note}</p>}
    </fieldset>
  );
}
