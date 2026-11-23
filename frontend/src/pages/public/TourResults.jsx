import { useEffect, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { getTours, durationText } from "../../services/tour_service";
import { formatSen, klToday } from "../../utils/formatPublic";
import { BRAND } from "../../constants/brand";
import styles from "../../assets/styles/public/Tours.module.css";

// Tours: charter tours by car rental operators (priced per car) and private
// packages by licensed guides (priced per package). Never per person.

const KINDS = [
  { value: "", label: "All tours" },
  { value: "CHARTER", label: "Charter tours (with car)" },
  { value: "GUIDED", label: "Guided tours" },
];

const SORTS = [
  { value: "price", label: "Lowest price" },
  { value: "duration", label: "Shortest first" },
  { value: "newest", label: "Newest" },
];

// Also used on the operator seller page.
export function TourCard({ tour, tripQuery = "" }) {
  const image = tour.images[0]?.url;
  const guided = tour.kind === "GUIDED";
  return (
    <Link to={`/tours/${tour.id}${tripQuery}`} className={styles.card}>
      {image ? <img src={image} alt="" className={styles.photo} loading="lazy" /> : <div className={styles.photo} />}
      <div className={styles.cardBody}>
        <span className={`${styles.kind} ${guided ? styles.kindGuided : ""}`}>{tour.kindLabel}</span>
        <h2 className={styles.cardTitle}>{tour.name}</h2>
        <p className={styles.meta}>
          {tour.operator.name}
          {tour.operator.verified && <span className={styles.verified}>Verified</span>}
        </p>
        {tour.vehicle?.name && <p className={styles.meta}>With a {tour.vehicle.name}</p>}
        <p className={styles.meta}>
          {durationText(tour.durationDays)}
          {tour.maxPassengers ? ` · up to ${tour.maxPassengers} passengers` : ""}
          {tour.branch.city ? ` · ${tour.branch.city}` : ""}
        </p>
        <div className={styles.price}>
          <span className={styles.priceMain}>{formatSen(tour.priceSen)}</span>{" "}
          <span className={styles.priceUnit}>{tour.priceUnitLabel}</span>
          <span className={styles.secure}>
            Secure it with {formatSen(tour.depositSen)} ({tour.depositPct}% down payment)
          </span>
        </div>
      </div>
    </Link>
  );
}

export default function TourResults() {
  const [params, setParams] = useSearchParams();
  const [search, setSearch] = useState(params.get("q") || "");
  const [state, setState] = useState({ loading: true, error: "", items: [] });

  useEffect(() => {
    document.title = `Tours · ${BRAND.name}${BRAND.suffix}`;
  }, []);

  // Typing waits a moment before searching.
  useEffect(() => {
    const id = window.setTimeout(() => {
      if ((params.get("q") || "") !== search.trim()) update({ q: search.trim() });
    }, 350);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [search]);

  const query = params.toString();
  useEffect(() => {
    let live = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setState((s) => ({ ...s, loading: true, error: "" }));
    getTours(Object.fromEntries(new URLSearchParams(query)))
      .then((res) => live && setState({ loading: false, error: "", items: res.data.items || [] }))
      .catch(() => live && setState({ loading: false, error: "We couldn't load tours. Please try again.", items: [] }));
    return () => {
      live = false;
    };
  }, [query]);

  function update(changes) {
    const next = new URLSearchParams(params);
    Object.entries(changes).forEach(([key, value]) => (value ? next.set(key, value) : next.delete(key)));
    setParams(next, { replace: true });
  }

  // The date and passengers carry over to the detail page.
  const trip = new URLSearchParams();
  if (params.get("date")) trip.set("date", params.get("date"));
  if (params.get("passengers")) trip.set("passengers", params.get("passengers"));
  const tripQuery = trip.toString() ? `?${trip}` : "";

  return (
    <main className={styles.page}>
      <h1 className={styles.h1}>Tours</h1>
      <p className={styles.lede}>
        Private tours with a car and driver, or with a licensed guide. One price for your group, never per person.
      </p>

      <div className={styles.filters} role="search">
        <div className={styles.field}>
          <label className={styles.label} htmlFor="tour-q">
            Search
          </label>
          <input
            id="tour-q"
            className={styles.input}
            type="search"
            placeholder="Place or tour name"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="tour-date">
            Date
          </label>
          <input
            id="tour-date"
            className={styles.input}
            type="date"
            min={klToday()}
            value={params.get("date") || ""}
            onChange={(e) => update({ date: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="tour-pax">
            Passengers
          </label>
          <input
            id="tour-pax"
            className={styles.input}
            type="number"
            min="1"
            max="100"
            inputMode="numeric"
            value={params.get("passengers") || ""}
            onChange={(e) => update({ passengers: e.target.value })}
          />
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="tour-kind">
            Type
          </label>
          <select
            id="tour-kind"
            className={styles.input}
            value={params.get("kind") || ""}
            onChange={(e) => update({ kind: e.target.value })}
          >
            {KINDS.map((k) => (
              <option key={k.value} value={k.value}>
                {k.label}
              </option>
            ))}
          </select>
        </div>
        <div className={styles.field}>
          <label className={styles.label} htmlFor="tour-sort">
            Sort by
          </label>
          <select
            id="tour-sort"
            className={styles.input}
            value={params.get("sort") || "price"}
            onChange={(e) => update({ sort: e.target.value === "price" ? "" : e.target.value })}
          >
            {SORTS.map((s) => (
              <option key={s.value} value={s.value}>
                {s.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      {state.error && (
        <p className={styles.notice} role="alert">
          {state.error}
        </p>
      )}
      {!state.error && (
        <p className={styles.count} aria-live="polite">
          {state.loading ? "Loading tours..." : `${state.items.length} ${state.items.length === 1 ? "tour" : "tours"}`}
          {!state.loading && params.get("date") ? " available on that date" : ""}
        </p>
      )}

      {!state.loading && !state.error && state.items.length === 0 && (
        <div className={styles.empty}>No tours match. Try another date or clear the filters.</div>
      )}

      {state.items.length > 0 && (
        <ul className={styles.grid}>
          {state.items.map((tour) => (
            <li key={tour.id}>
              <TourCard tour={tour} tripQuery={tripQuery} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
