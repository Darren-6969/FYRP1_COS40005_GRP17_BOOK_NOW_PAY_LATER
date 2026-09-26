import { useCallback, useEffect, useId, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useSearchParams } from "react-router-dom";
import { X } from "lucide-react";
import { searchCars } from "../../services/listing_public_service";
import { PICKUP_CITIES } from "../../services/mock/listings.mock";
import {
  FACET_GROUPS,
  SORTS,
  hasDates,
  parseCarSearch,
  toCarSearchParams,
  tripParams,
} from "../../utils/carSearchParams";
import { formatShortDateTime, klDateTimeToIso, klToday } from "../../utils/formatPublic";
import FilterPanel from "../../components/public/FilterPanel";
import ResultCard from "../../components/public/ResultCard";
import Notice from "../../components/public/Notice";
import useSavedListings from "../../hooks/useSavedListings";
import styles from "../../assets/styles/public/CarResults.module.css";

const NARROW_QUERY = "(max-width: 899px)";

const WHY_TEXT =
  "Recommended shows live cars from approved operators that are free within the next fourteen days, ordered by the smallest amount payable now per day, with no more than two cars from the same operator in a row.";

function useMediaQuery(query) {
  const subscribe = useCallback(
    (cb) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", cb);
      return () => mq.removeEventListener("change", cb);
    },
    [query]
  );
  return useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false);
}

function plural(n, word) {
  return `${n} ${word}${n === 1 ? "" : "s"}`;
}

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

function SearchWidget({ criteria, onApply, fromRef }) {
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
        {field(
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
          Search cars
        </button>
      </div>
    </form>
  );
}

// ── Mobile filter sheet ──────────────────────────────────────────────

function FilterSheet({ open, onClose, onClearAll, applyLabel, children }) {
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

function Skeleton() {
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

export default function CarResults() {
  const [params, setParams] = useSearchParams();
  const key = params.toString();
  const criteria = useMemo(() => parseCarSearch(new URLSearchParams(key)), [key]);
  const dates = hasDates(criteria);
  const narrow = useMediaQuery(NARROW_QUERY);

  const [retry, setRetry] = useState(0);
  const [res, setRes] = useState({ key: null, data: null, error: false });
  const [editing, setEditing] = useState(false);
  const [whyOpen, setWhyOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [saved, toggleSaved] = useSavedListings();
  const fromRef = useRef(null);
  const filtersButtonRef = useRef(null);
  const requestKey = `${key}#${retry}`;

  useEffect(() => {
    let alive = true;
    searchCars(criteria)
      .then((r) => alive && setRes({ key: requestKey, data: r.data, error: false }))
      .catch(() => alive && setRes({ key: requestKey, data: null, error: true }));
    return () => {
      alive = false;
    };
  }, [criteria, requestKey]);

  const loading = res.key !== requestKey;
  const data = res.data;
  const widgetOpen = editing || !dates;

  const update = (changes, { replace = false } = {}) => {
    setParams(toCarSearchParams({ ...criteria, ...changes }), { replace });
  };

  const toggleFacet = (group, value) => {
    const list = criteria.sel[group];
    const next = list.includes(value) ? list.filter((v) => v !== value) : [...list, value];
    update({ sel: { ...criteria.sel, [group]: next } });
  };

  const setRange = (kind, lo, hi) => {
    if (kind === "price") update({ pmin: lo, pmax: hi }, { replace: true });
    else update({ dmin: lo, dmax: hi }, { replace: true });
  };

  const clearAll = () => {
    const sel = Object.fromEntries(FACET_GROUPS.map((g) => [g, []]));
    update({ city: "", sel, pmin: null, pmax: null, dmin: null, dmax: null });
  };

  const clearKey = (k) => {
    if (k === "city") update({ city: "" });
    else if (k === "price") update({ pmin: null, pmax: null });
    else if (k === "dep") update({ dmin: null, dmax: null });
    else update({ sel: { ...criteria.sel, [k]: [] } });
  };

  const applySearch = (trip) => {
    setEditing(false);
    update(trip);
  };

  const openWidget = () => {
    setEditing(true);
    // Focus after the widget renders.
    setTimeout(() => fromRef.current?.focus(), 0);
  };

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    filtersButtonRef.current?.focus();
  }, []);

  // ── derived view data ──────────────────────────────────────────────
  const labelFor = (group, value) =>
    data?.facets.find((f) => f.group === group)?.options.find((o) => o.value === value)?.label || value;

  const chips = [];
  if (criteria.city) chips.push({ key: "city", label: criteria.city, clear: () => update({ city: "" }) });
  FACET_GROUPS.forEach((g) =>
    criteria.sel[g].forEach((v) =>
      chips.push({
        key: `${g}-${v}`,
        label: g === "seats" ? `${v} seats or more` : labelFor(g, v),
        clear: () => toggleFacet(g, v),
      })
    )
  );
  if (criteria.pmin !== null || criteria.pmax !== null) {
    const b = data?.bounds.price;
    chips.push({
      key: "price",
      label: `RM${criteria.pmin ?? b?.min ?? 0} - RM${criteria.pmax ?? b?.max ?? ""} per day`,
      clear: () => update({ pmin: null, pmax: null }),
    });
  }
  if (dates && (criteria.dmin !== null || criteria.dmax !== null)) {
    const b = data?.bounds.deposit;
    chips.push({
      key: "dep",
      label: `RM${criteria.dmin ?? b?.min ?? 0} - RM${criteria.dmax ?? b?.max ?? ""} now`,
      clear: () => update({ dmin: null, dmax: null }),
    });
  }

  const sortLabel = (SORTS.find((s) => s.value === criteria.sort) || SORTS[0]).label;
  const days = data?.days || 0;
  const headlineNote = days
    ? plural(days, "day")
    : criteria.city
      ? `Showing ${criteria.city}, no dates set`
      : "Showing every city, no dates set";

  const resultLine = !data
    ? "Loading cars…"
    : data.total === 0
      ? "No cars match"
      : `${plural(data.total, "car")}${
          data.anyFilter ? " matching your filters" : ` across ${data.cities} ${data.cities === 1 ? "city" : "cities"}`
        }, sorted by ${sortLabel.toLowerCase()}`;

  const summary = [
    criteria.city || "Any city",
    dates
      ? `${formatShortDateTime(klDateTimeToIso(criteria.from, criteria.ft))} to ${formatShortDateTime(
          klDateTimeToIso(criteria.to, criteria.tt)
        )}`
      : "No dates",
  ].join("  ·  ");

  const trip = tripParams(criteria).toString();
  const hrefFor = (id) => `/cars/${id}${trip ? `?${trip}` : ""}`;

  const filterPanel = (prefix) =>
    data && (
      <FilterPanel data={data} criteria={criteria} onToggle={toggleFacet} onRange={setRange} idPrefix={prefix} />
    );

  return (
    <div className={styles.page}>
      <section className={styles.band} aria-labelledby="results-title">
        <div className={styles.bandInner}>
          <div className={styles.headline}>
            <h1 id="results-title" className={styles.h1}>
              Car rental
            </h1>
            <span className={styles.headlineNote}>{headlineNote}</span>
          </div>
          {widgetOpen ? (
            <SearchWidget
              key={`${criteria.city}|${criteria.from}|${criteria.ft}|${criteria.to}|${criteria.tt}`}
              criteria={criteria}
              onApply={applySearch}
              fromRef={fromRef}
            />
          ) : (
            <button type="button" className={styles.summary} onClick={openWidget}>
              <span className={styles.summaryText}>{summary}</span>
              <span className={styles.summaryAction}>Change search</span>
            </button>
          )}
        </div>
      </section>

      {!dates && (
        <div className={styles.needsDates}>
          <Notice
            tone="warn"
            className={styles.needsDatesNotice}
            action={
              <button type="button" className={styles.outlineAccent} onClick={openWidget}>
                Set dates
              </button>
            }
          >
            Set your dates to see exact deposits and filter by the amount payable now. Prices below are indicative.
          </Notice>
        </div>
      )}

      <div className={styles.shell}>
        {!narrow && (
          <aside className={styles.rail} aria-labelledby="rail-title">
            <div className={styles.railHead}>
              <h2 id="rail-title" className={styles.railTitle}>
                Filters
              </h2>
              <button
                type="button"
                className={`${styles.clearAll} ${data?.anyFilter ? styles.clearAllActive : ""}`}
                onClick={clearAll}
              >
                Clear all
              </button>
            </div>
            {filterPanel("rail")}
          </aside>
        )}

        <div className={styles.results}>
          <div className={styles.toolbar}>
            <p className={styles.resultLine} aria-live="polite">
              {resultLine}
            </p>
            <div className={styles.tools}>
              {narrow && (
                <button
                  ref={filtersButtonRef}
                  type="button"
                  className={styles.filtersButton}
                  onClick={() => setSheetOpen(true)}
                  aria-haspopup="dialog"
                >
                  Filters{chips.length ? ` (${chips.length})` : ""}
                </button>
              )}
              <button
                type="button"
                className={styles.whyButton}
                aria-expanded={whyOpen}
                aria-controls="why-panel"
                onClick={() => setWhyOpen((v) => !v)}
              >
                Why these first?
              </button>
              <label className={styles.sort}>
                <span className={styles.sortLabel}>Sort</span>
                <select
                  className={styles.sortSelect}
                  value={criteria.sort}
                  onChange={(e) => update({ sort: e.target.value })}
                >
                  {SORTS.map((s) => (
                    <option key={s.value} value={s.value}>
                      {s.label}
                    </option>
                  ))}
                </select>
              </label>
            </div>
          </div>

          <p className={styles.intro}>
            Send a request for free. Pay a deposit once the operator confirms, and the balance before pickup. Each
            operator sets its own deposit rate.
          </p>

          {whyOpen && (
            <div id="why-panel" className={styles.why}>
              <p className={styles.whyText}>{WHY_TEXT}</p>
              <button type="button" className={styles.whyClose} onClick={() => setWhyOpen(false)} aria-label="Close">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          )}

          {chips.length > 0 && (
            <ul className={styles.chips} aria-label="Active filters">
              {chips.map((c) => (
                <li key={c.key}>
                  <button type="button" className={styles.chip} onClick={c.clear} aria-label={`Remove filter: ${c.label}`}>
                    {c.label} <X size={14} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          )}

          {res.error && !loading && (
            <Notice
              tone="error"
              role="alert"
              title="Results could not be loaded"
              action={
                <button type="button" className={styles.outlineAccent} onClick={() => setRetry((n) => n + 1)}>
                  Try again
                </button>
              }
            >
              Check your connection and try again.
            </Notice>
          )}

          {!data && loading && <Skeleton />}

          {data && (
            <div className={`${styles.list} ${loading ? styles.listBusy : ""}`} aria-busy={loading}>
              {data.total === 0 && (
                <div className={styles.empty}>
                  <h2 className={styles.emptyTitle}>No cars match all your filters</h2>
                  <p className={styles.emptyText}>
                    {data.tightest
                      ? `Your ${data.tightest.label.toLowerCase()} filter is the tightest one. Clearing it brings back ${plural(
                          data.tightest.gain,
                          "car"
                        )}.`
                      : "No cars are listed yet."}
                  </p>
                  {data.anyFilter && (
                    <div className={styles.emptyActions}>
                      {data.tightest && (
                        <button type="button" className={styles.primaryButton} onClick={() => clearKey(data.tightest.key)}>
                          Clear {data.tightest.label.toLowerCase()}
                        </button>
                      )}
                      <button type="button" className={styles.secondaryButton} onClick={clearAll}>
                        Clear all filters
                      </button>
                    </div>
                  )}
                </div>
              )}

              {data.groups.map((g) => (
                <section key={g.key} className={styles.group} aria-labelledby={g.title ? `group-${g.key}` : undefined}>
                  {g.title && (
                    <div className={styles.groupHead}>
                      <h2 id={`group-${g.key}`} className={styles.groupTitle}>
                        {g.title}
                      </h2>
                      <span className={styles.groupCount}>{plural(g.items.length, "car")}</span>
                    </div>
                  )}
                  {g.note && <p className={styles.groupNote}>{g.note}</p>}
                  <div className={styles.cards}>
                    {g.items.map((r) => (
                      <ResultCard
                        key={r.listing.id}
                        result={r}
                        href={hrefFor(r.listing.id)}
                        linkState={{ backTo: `/cars${key ? `?${key}` : ""}` }}
                        saved={saved.has(r.listing.id)}
                        onToggleSave={() => toggleSaved(r.listing.id)}
                      />
                    ))}
                  </div>
                </section>
              ))}
            </div>
          )}
        </div>
      </div>

      {narrow && (
        <FilterSheet
          open={sheetOpen}
          onClose={closeSheet}
          onClearAll={clearAll}
          applyLabel={data ? `Show ${plural(data.total, "car")}` : "Show cars"}
        >
          {filterPanel("sheet")}
        </FilterSheet>
      )}
    </div>
  );
}
