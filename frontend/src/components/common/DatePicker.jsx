import { useEffect, useId, useImperativeHandle, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { CalendarDays, ChevronDown, ChevronLeft, ChevronRight, ChevronUp } from "lucide-react";
import { klToday } from "../../utils/formatPublic";
import styles from "../../assets/styles/DatePicker.module.css";

// The date picker used across the site in place of <input type="date">:
// a button showing the date, and a calendar with month and year lists, so a
// far-off date (a date of birth) is two picks instead of fifty clicks.
//
// Values are plain "YYYY-MM-DD" strings, as with the native input, and
// onChange receives { target: { value, name } }, so callers written for
// e.target.value keep working. All date maths is on calendar days (UTC
// arithmetic, no time zone); "today" is today in Malaysia.

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const WEEKDAYS = ["Mo", "Tu", "We", "Th", "Fr", "Sa", "Su"];
const POPOVER_WIDTH = 320;
const GAP = 6;

const pad = (n) => String(n).padStart(2, "0");

function parse(iso) {
  if (typeof iso !== "string" || !/^\d{4}-\d{2}-\d{2}/.test(iso)) return null;
  return { y: Number(iso.slice(0, 4)), m: Number(iso.slice(5, 7)) - 1, d: Number(iso.slice(8, 10)) };
}

function iso(y, m, d) {
  const t = new Date(Date.UTC(y, m, d));
  return `${t.getUTCFullYear()}-${pad(t.getUTCMonth() + 1)}-${pad(t.getUTCDate())}`;
}

function daysIn(y, m) {
  return new Date(Date.UTC(y, m + 1, 0)).getUTCDate();
}

function addDays(value, n) {
  const p = parse(value);
  return iso(p.y, p.m, p.d + n);
}

function addMonths(value, n) {
  const p = parse(value);
  const first = new Date(Date.UTC(p.y, p.m + n, 1));
  const y = first.getUTCFullYear();
  const m = first.getUTCMonth();
  return iso(y, m, Math.min(p.d, daysIn(y, m)));
}

// Monday = 0.
function weekday(value) {
  const p = parse(value);
  return (new Date(Date.UTC(p.y, p.m, p.d)).getUTCDay() + 6) % 7;
}

function formatLong(value) {
  const p = parse(value);
  if (!p) return "";
  return new Date(Date.UTC(p.y, p.m, p.d)).toLocaleDateString("en-GB", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  });
}

function clampToRange(value, min, max) {
  if (min && value < min) return min;
  if (max && value > max) return max;
  return value;
}

/** 42 days (six weeks) starting on the Monday on or before the 1st. */
function monthGrid(y, m) {
  const first = iso(y, m, 1);
  const start = addDays(first, -weekday(first));
  return Array.from({ length: 42 }, (_, i) => addDays(start, i));
}

function Popover({ anchorRef, value, min, max, required, onSelect, onClose, labelId }) {
  const today = klToday();
  const initial = clampToRange(value || today, min, max);
  const [draft, setDraft] = useState(value || null);
  const [focus, setFocus] = useState(initial);
  const [menu, setMenu] = useState(null); // null | "month" | "year"
  const popRef = useRef(null);
  const gridRef = useRef(null);
  const menuRef = useRef(null);

  const view = parse(focus);
  const minY = parse(min)?.y ?? parse(today).y - 100;
  const maxY = parse(max)?.y ?? parse(today).y + 10;
  const years = [];
  for (let y = minY; y <= maxY; y += 1) years.push(y);
  const inRange = (d) => (!min || d >= min) && (!max || d <= max);
  // A month can be picked when any of its days is in range.
  const monthOpen = (y, m) => (!max || iso(y, m, 1) <= max) && (!min || iso(y, m, daysIn(y, m)) >= min);

  // Place it under the field, or above when there is no room below, and keep
  // it on screen. Written to the element directly so scrolling never re-renders.
  useLayoutEffect(() => {
    const place = () => {
      const anchor = anchorRef.current;
      const pop = popRef.current;
      if (!anchor || !pop) return;
      const r = anchor.getBoundingClientRect();
      const width = Math.min(POPOVER_WIDTH, window.innerWidth - 16);
      const height = pop.offsetHeight;
      const below = window.innerHeight - r.bottom - GAP;
      const top = below >= height || r.top < height ? r.bottom + GAP : r.top - GAP - height;
      const left = Math.min(Math.max(8, r.left), window.innerWidth - width - 8);
      pop.style.width = `${width}px`;
      pop.style.top = `${Math.max(8, Math.min(top, window.innerHeight - height - 8))}px`;
      pop.style.left = `${left}px`;
    };
    place();
    window.addEventListener("resize", place);
    window.addEventListener("scroll", place, true);
    return () => {
      window.removeEventListener("resize", place);
      window.removeEventListener("scroll", place, true);
    };
  }, [anchorRef]);

  // Click outside or Escape closes without changing the value.
  useEffect(() => {
    const onDown = (e) => {
      if (popRef.current?.contains(e.target) || anchorRef.current?.contains(e.target)) return;
      onClose(false);
    };
    const onKey = (e) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      onClose(true);
    };
    document.addEventListener("pointerdown", onDown, true);
    document.addEventListener("keydown", onKey, true);
    return () => {
      document.removeEventListener("pointerdown", onDown, true);
      document.removeEventListener("keydown", onKey, true);
    };
  }, [anchorRef, onClose]);

  // Keyboard focus follows the focused day; the open list shows its choice.
  useEffect(() => {
    if (menu) {
      // Scroll only the list (scrollIntoView would also scroll the page).
      const list = menuRef.current;
      const item = list?.querySelector("[aria-selected='true']");
      if (list && item) {
        list.scrollTop = item.offsetTop - list.clientHeight / 2 + item.offsetHeight / 2;
        item.focus({ preventScroll: true });
      }
    } else {
      gridRef.current?.querySelector(`[data-day="${focus}"]`)?.focus({ preventScroll: true });
    }
  }, [focus, menu]);

  const move = (next) => setFocus(clampToRange(next, min, max));

  const onGridKey = (e) => {
    const map = {
      ArrowLeft: () => addDays(focus, -1),
      ArrowRight: () => addDays(focus, 1),
      ArrowUp: () => addDays(focus, -7),
      ArrowDown: () => addDays(focus, 7),
      Home: () => addDays(focus, -weekday(focus)),
      End: () => addDays(focus, 6 - weekday(focus)),
      PageUp: () => addMonths(focus, e.shiftKey ? -12 : -1),
      PageDown: () => addMonths(focus, e.shiftKey ? 12 : 1),
    };
    if (map[e.key]) {
      e.preventDefault();
      move(map[e.key]());
    }
  };

  const pickMonth = (m) => {
    move(iso(view.y, m, Math.min(view.d, daysIn(view.y, m))));
    setMenu(null);
  };

  const pickYear = (y) => {
    move(iso(y, view.m, Math.min(view.d, daysIn(y, view.m))));
    setMenu(null);
  };

  const prevMonth = iso(view.y, view.m, 0);
  const nextMonth = iso(view.y, view.m + 1, 1);
  const days = monthGrid(view.y, view.m);
  const toggle = (which) => setMenu((open) => (open === which ? null : which));

  return (
    <div ref={popRef} className={styles.popover} role="dialog" aria-modal="false" aria-labelledby={labelId}>
      <div className={styles.head}>
        <div className={styles.headPickers}>
          <button
            type="button"
            className={styles.headButton}
            aria-expanded={menu === "month"}
            aria-haspopup="listbox"
            onClick={() => toggle("month")}
          >
            {MONTHS[view.m]}
            {menu === "month" ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </button>
          <button
            type="button"
            className={styles.headButton}
            aria-expanded={menu === "year"}
            aria-haspopup="listbox"
            onClick={() => toggle("year")}
          >
            {view.y}
            {menu === "year" ? <ChevronUp size={16} aria-hidden="true" /> : <ChevronDown size={16} aria-hidden="true" />}
          </button>
        </div>
        <div className={styles.headNav}>
          <button
            type="button"
            className={styles.navButton}
            aria-label="Previous month"
            disabled={Boolean(min) && prevMonth < min}
            onClick={() => move(addMonths(focus, -1))}
          >
            <ChevronLeft size={18} aria-hidden="true" />
          </button>
          <button
            type="button"
            className={styles.navButton}
            aria-label="Next month"
            disabled={Boolean(max) && nextMonth > max}
            onClick={() => move(addMonths(focus, 1))}
          >
            <ChevronRight size={18} aria-hidden="true" />
          </button>
        </div>
      </div>

      <div className={styles.body}>
        <div ref={gridRef} role="grid" aria-label={`${MONTHS[view.m]} ${view.y}`} className={styles.grid} onKeyDown={onGridKey}>
          <div role="row" className={styles.weekRow}>
            {WEEKDAYS.map((w) => (
              <span key={w} role="columnheader" className={styles.weekday}>
                {w}
              </span>
            ))}
          </div>
          {Array.from({ length: 6 }, (_, row) => (
            <div key={row} role="row" className={styles.weekRow}>
              {days.slice(row * 7, row * 7 + 7).map((d) => {
                const p = parse(d);
                const outside = p.m !== view.m;
                const disabled = !inRange(d);
                return (
                  <span key={d} role="gridcell" aria-selected={d === draft}>
                    <button
                      type="button"
                      data-day={d}
                      tabIndex={d === focus ? 0 : -1}
                      className={styles.day}
                      data-outside={outside ? "" : undefined}
                      data-today={d === today ? "" : undefined}
                      data-selected={d === draft ? "" : undefined}
                      disabled={disabled}
                      aria-label={formatLong(d)}
                      aria-current={d === today ? "date" : undefined}
                      onClick={() => {
                        setDraft(d);
                        setFocus(d);
                      }}
                      onDoubleClick={() => onSelect(d)}
                    >
                      {p.d}
                    </button>
                  </span>
                );
              })}
            </div>
          ))}
        </div>

        {menu && (
          <div ref={menuRef} className={styles.menu} role="listbox" aria-label={menu === "month" ? "Month" : "Year"}>
            <p className={styles.menuTitle}>{menu === "month" ? "Month" : "Year"}</p>
            {menu === "month"
              ? MONTHS.map((name, m) => (
                  <button
                    key={name}
                    type="button"
                    role="option"
                    aria-selected={m === view.m}
                    className={styles.menuItem}
                    disabled={!monthOpen(view.y, m)}
                    onClick={() => pickMonth(m)}
                  >
                    {name}
                  </button>
                ))
              : years.map((y) => (
                  <button key={y} type="button" role="option" aria-selected={y === view.y} className={styles.menuItem} onClick={() => pickYear(y)}>
                    {y}
                  </button>
                ))}
          </div>
        )}
      </div>

      <div className={styles.foot}>
        {!required && value ? (
          <button type="button" className={styles.linkButton} onClick={() => onSelect("")}>
            Clear
          </button>
        ) : inRange(today) ? (
          <button
            type="button"
            className={styles.linkButton}
            onClick={() => {
              setDraft(today);
              setFocus(today);
            }}
          >
            Today
          </button>
        ) : (
          <span />
        )}
        <div className={styles.footActions}>
          <button type="button" className={styles.cancel} onClick={() => onClose(true)}>
            Cancel
          </button>
          <button type="button" className={styles.select} disabled={!draft} onClick={() => onSelect(draft)}>
            Select
          </button>
        </div>
      </div>
    </div>
  );
}

/**
 * Props, as on <input type="date">: id, name, value, onChange, min, max,
 * disabled, required, placeholder, className (replaces the default field
 * look), onBlur (called when the calendar closes), and aria-* attributes.
 * A ref gets { focus() }.
 */
export default function DatePicker({
  id,
  name,
  value = "",
  onChange,
  min,
  max,
  disabled = false,
  required = false,
  placeholder = "Select date",
  className,
  onBlur,
  ref,
  ...rest
}) {
  // The calendar renders into the public page root when there is one, so it
  // keeps the page's theme tokens; elsewhere into <body>.
  const [portalRoot, setPortalRoot] = useState(null);
  const open = Boolean(portalRoot);
  const buttonRef = useRef(null);
  const labelId = useId();

  const show = () => setPortalRoot(buttonRef.current?.closest("[data-public-root]") || document.body);
  const setOpen = (next) => (next ? show() : setPortalRoot(null));

  useImperativeHandle(ref, () => ({
    focus: (options) => buttonRef.current?.focus(options),
    showPicker: show,
  }));

  const close = (refocus) => {
    setOpen(false);
    if (refocus) buttonRef.current?.focus({ preventScroll: true });
    onBlur?.({ target: { value, name } });
  };

  const select = (next) => {
    onChange?.({ target: { value: next, name } });
    setOpen(false);
    buttonRef.current?.focus({ preventScroll: true });
    onBlur?.({ target: { value: next, name } });
  };

  return (
    <span className={styles.wrap}>
      <button
        {...rest}
        ref={buttonRef}
        id={id}
        type="button"
        className={className || styles.trigger}
        disabled={disabled}
        aria-haspopup="dialog"
        aria-expanded={open}
        onClick={() => setOpen(!open)}
        onKeyDown={(e) => {
          if (e.key === "ArrowDown" && !open) {
            e.preventDefault();
            setOpen(true);
          }
        }}
      >
        <span id={labelId} className={value ? styles.value : styles.placeholder}>
          {value ? formatLong(value) : placeholder}
        </span>
        <CalendarDays size={16} aria-hidden="true" className={styles.icon} />
      </button>
      {/* Keeps native form checks (required) and form posts (name) working. */}
      <input className={styles.hidden} tabIndex={-1} aria-hidden="true" name={name} value={value} required={required} onChange={() => {}} />
      {open &&
        createPortal(
          <Popover
            anchorRef={buttonRef}
            value={value}
            min={min}
            max={max}
            required={required}
            labelId={labelId}
            onSelect={select}
            onClose={close}
          />,
          portalRoot
        )}
    </span>
  );
}

/**
 * For <input type="datetime-local">: the calendar for the day and a time
 * field, combined into "YYYY-MM-DDTHH:mm".
 */
export function DateTimePicker({ value = "", onChange, min, max, defaultTime = "10:00", name, disabled, required, className, timeClassName, id, ...rest }) {
  const date = value ? value.slice(0, 10) : "";
  const time = value ? value.slice(11, 16) || defaultTime : defaultTime;
  const emit = (d, t) => onChange?.({ target: { value: d ? `${d}T${t}` : "", name } });
  return (
    <span className={styles.dateTime}>
      <DatePicker
        {...rest}
        id={id}
        value={date}
        min={min ? min.slice(0, 10) : undefined}
        max={max ? max.slice(0, 10) : undefined}
        disabled={disabled}
        required={required}
        className={className}
        onChange={(e) => emit(e.target.value, time)}
      />
      <input
        type="time"
        className={timeClassName || styles.time}
        value={date ? time : ""}
        disabled={disabled || !date}
        aria-label="Time"
        onChange={(e) => emit(date, e.target.value || defaultTime)}
      />
    </span>
  );
}
