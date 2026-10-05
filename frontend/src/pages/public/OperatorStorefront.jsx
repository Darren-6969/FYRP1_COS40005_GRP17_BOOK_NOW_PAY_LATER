import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { Link, useLocation, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { Check, Clock, MapPin, Phone, Share2, X } from "lucide-react";
import { getOperatorStorefront, searchFleet } from "../../services/listing_public_service";
import {
  FACET_GROUPS,
  SORTS,
  hasDates,
  parseCarSearch,
  toCarSearchParams,
  tripParams,
} from "../../utils/carSearchParams";
import { formatMonthYear, formatResponseTime, formatSen, formatShortDateTime, klDateTimeToIso } from "../../utils/formatPublic";
import FilterPanel from "../../components/public/FilterPanel";
import { FilterSheet, ResultsSkeleton, SearchWidget } from "../../components/public/ResultsParts";
import ResultCard from "../../components/public/ResultCard";
import Notice from "../../components/public/Notice";
import useSavedListings from "../../hooks/useSavedListings";
import { BRAND } from "../../constants/brand";
import results from "../../assets/styles/public/CarResults.module.css";
import styles from "../../assets/styles/public/OperatorStorefront.module.css";

// Operator seller page (SRS 4.2.7, FR-CUST-007). Built first as the
// operator's own shop front: the link they share on WhatsApp and social
// media. Filters, sort and trip dates live in the URL like the results page,
// so a shared link opens on the same view.

const NARROW_QUERY = "(max-width: 899px)";
// Every car here is from one operator, so these facets would offer one value.
const HIDDEN_FACETS = new Set(["operator", "refund"]);

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

function initials(name) {
  return String(name || "")
    .replace(/Sdn\.? Bhd\.?/i, "")
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0])
    .join("")
    .toUpperCase();
}

function todayInKuching() {
  return new Date().toLocaleDateString("en-US", { timeZone: "Asia/Kuching", weekday: "long" });
}

// "08:00" -> "8:00 am"
function time12(hhmm) {
  if (!hhmm) return "";
  const [h, m] = hhmm.split(":").map(Number);
  const suffix = h >= 12 ? "pm" : "am";
  return `${((h + 11) % 12) + 1}:${String(m).padStart(2, "0")} ${suffix}`;
}

// Collapse runs of identical days: "Mon–Fri 8:00 am – 6:00 pm".
function hoursSummary(hours) {
  const label = (d) => (d.closed ? "Closed" : d.open ? `${time12(d.open)} – ${time12(d.close)}` : "Hours not listed");
  const runs = [];
  hours.forEach((d) => {
    const text = label(d);
    const last = runs[runs.length - 1];
    if (last && last.text === text) last.to = d.day;
    else runs.push({ from: d.day, to: d.day, text });
  });
  return runs.map((r) => ({
    days: r.from === r.to ? r.from.slice(0, 3) : `${r.from.slice(0, 3)}–${r.to.slice(0, 3)}`,
    text: r.text,
    allWeek: r.from === "Monday" && r.to === "Sunday",
  }));
}

function directionsUrl(branch) {
  const q = [branch.address, branch.city, branch.state].filter(Boolean).join(", ");
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`;
}

function telHref(phone) {
  return `tel:${String(phone).replace(/[^\d+]/g, "")}`;
}

function refundText(rule) {
  return rule?.type === "PARTIAL"
    ? `If a booking is cancelled for a missed payment or licence, ${rule.refundPct}% of the deposit is refunded.`
    : "If a booking is cancelled for a missed payment or licence, the deposit is kept.";
}

// ── Header ───────────────────────────────────────────────────────────

function ShareButton({ name }) {
  const [state, setState] = useState("idle");

  const share = async () => {
    const url = window.location.href.split("?")[0];
    try {
      if (navigator.share) {
        await navigator.share({ title: `${name} on ${BRAND.name}${BRAND.suffix}`, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setState("copied");
      setTimeout(() => setState("idle"), 2500);
    } catch (err) {
      // Closing the share sheet is not an error worth showing.
      if (err?.name !== "AbortError") setState("failed");
    }
  };

  return (
    <>
      <button type="button" className={styles.shareButton} onClick={share}>
        {state === "copied" ? <Check size={18} aria-hidden="true" /> : <Share2 size={18} aria-hidden="true" />}
        {state === "copied" ? "Link copied" : "Share"}
      </button>
      <span role="status" className={styles.srOnly}>
        {state === "copied" ? "Link copied to the clipboard" : state === "failed" ? "Couldn't copy the link" : ""}
      </span>
    </>
  );
}

function Hero({ operator, carCount, cities }) {
  const stats = [
    operator.completedBookings > 0 && plural(operator.completedBookings, "completed booking"),
    plural(operator.branchCount, "branch").replace("branchs", "branches"),
    `On ${BRAND.name}${BRAND.suffix} since ${formatMonthYear(operator.activeSince)}`,
    formatResponseTime(operator.responseTimeMins),
    operator.acceptanceRate !== null && operator.acceptanceRate !== undefined && `Accepts ${operator.acceptanceRate}% of requests`,
  ].filter(Boolean);

  return (
    <header className={styles.hero}>
      <div className={styles.cover} aria-hidden="true">
        {operator.coverImageUrl && <img src={operator.coverImageUrl} alt="" className={styles.coverImg} />}
      </div>
      <div className={styles.heroInner}>
        {operator.logoUrl ? (
          <img src={operator.logoUrl} alt={`${operator.companyName} logo`} className={styles.logo} />
        ) : (
          <span className={styles.logo} aria-hidden="true">
            {initials(operator.companyName)}
          </span>
        )}
        <div className={styles.identity}>
          <div className={styles.nameRow}>
            <h1 className={styles.name}>{operator.companyName}</h1>
            {operator.verified && (
              <span className={styles.verified} title="Business registration and licence checked by the platform">
                <Check size={14} aria-hidden="true" /> Verified business
              </span>
            )}
          </div>
          {cities.length > 0 && (
            <p className={styles.cities}>
              <MapPin size={16} aria-hidden="true" /> {cities.join(" · ")}
            </p>
          )}
          <ul className={styles.stats}>
            {stats.map((s) => (
              <li key={s}>{s}</li>
            ))}
          </ul>
        </div>
        <div className={styles.heroActions}>
          {operator.takingBookings && carCount > 0 && (
            <a href="#cars" className={results.primaryButton}>
              See {plural(carCount, "car")}
            </a>
          )}
          <ShareButton name={operator.companyName} />
        </div>
      </div>
    </header>
  );
}

function SectionNav({ items }) {
  return (
    <nav className={styles.sectionNav} aria-label="On this page">
      <ul>
        {items.map((it) => (
          <li key={it.id}>
            <a href={`#${it.id}`}>{it.label}</a>
          </li>
        ))}
      </ul>
    </nav>
  );
}

// ── Branches, about, terms ───────────────────────────────────────────

function BranchCard({ branch, today, onShowCars }) {
  const summary = hoursSummary(branch.hours);
  const todays = branch.hours.find((d) => d.day === today);
  return (
    <article className={styles.branchCard} aria-labelledby={`branch-${branch.id}-h`}>
      <div className={styles.branchHead}>
        <h3 id={`branch-${branch.id}-h`} className={styles.branchName}>
          {branch.name}
        </h3>
        {branch.carCount > 0 && (
          <button type="button" className={styles.textButton} onClick={() => onShowCars(branch.id)}>
            {plural(branch.carCount, "car")}
          </button>
        )}
      </div>

      <p className={styles.branchLine}>
        <MapPin size={16} aria-hidden="true" />
        <span>
          {branch.address}
          {branch.city ? `, ${branch.city}` : ""}
        </span>
      </p>

      <div className={styles.branchActions}>
        <a href={directionsUrl(branch)} target="_blank" rel="noopener noreferrer" className={styles.actionLink}>
          <MapPin size={16} aria-hidden="true" /> Get directions
        </a>
        {branch.phone && (
          <a href={telHref(branch.phone)} className={styles.actionLink}>
            <Phone size={16} aria-hidden="true" /> {branch.phone}
          </a>
        )}
      </div>

      <div className={styles.hours}>
        <p className={styles.hoursToday}>
          <Clock size={16} aria-hidden="true" />
          {!branch.hoursKnown
            ? "Opening hours not listed"
            : todays?.closed
            ? "Closed today"
            : `Open today ${time12(todays?.open)} – ${time12(todays?.close)}`}
        </p>
        {branch.hoursKnown && (
          <dl className={styles.hoursList}>
            {summary.map((r) => (
              <div key={r.days}>
                <dt>{r.allWeek ? "Every day" : r.days}</dt>
                <dd>{r.text}</dd>
              </div>
            ))}
          </dl>
        )}
      </div>

      {branch.pickupPoints.length > 0 && (
        <div className={styles.points}>
          <h4 className={styles.pointsTitle}>Pickup and drop-off points</h4>
          <ul>
            {branch.pickupPoints.map((p) => (
              <li key={p.id}>
                <span>{p.label}</span>
                <span className={styles.pointFee}>
                  {p.usage === "DROPOFF"
                    ? p.dropoffFeeSen
                      ? `Drop-off +${formatSen(p.dropoffFeeSen)}`
                      : "Drop-off, free"
                    : p.pickupFeeSen
                    ? `+${formatSen(p.pickupFeeSen)}`
                    : "Free"}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </article>
  );
}

function Terms({ terms, operatorName }) {
  const rows = [
    {
      k: "Sending a request",
      v: `Free. ${operatorName} replies within ${plural(terms.responseWindowHours, "hour")}${
        terms.autoRejectOnTimeout ? ", or the request closes automatically" : ""
      }.`,
    },
    {
      k: "Deposit",
      v: terms.downPaymentPct
        ? terms.downPaymentPct >= 100
          ? `The full amount, paid within ${terms.depositWindowHours} hours of acceptance.`
          : `${terms.downPaymentPct}% of the rental, paid within ${terms.depositWindowHours} hours of acceptance.`
        : "No deposit. Everything is paid as the balance.",
    },
    terms.downPaymentPct < 100 && {
      k: "Balance",
      v: `Due ${terms.balanceDueHoursBeforePickup} hours before pickup, with any add-ons and pickup or drop-off charges.`,
    },
    { k: "If a payment is missed", v: refundText(terms.refundRule) },
    { k: "Driving licence", v: "Upload it before the balance deadline. Bring the original to pickup." },
    { k: "Late return", v: "Charged by the hour and paid at the counter." },
    {
      k: "Ways to pay",
      v: [terms.paymentMethods.card && "Card (Stripe)", terms.paymentMethods.duitnow && "DuitNow"].filter(Boolean).join(", ") || "Card",
    },
  ].filter(Boolean);

  return (
    <dl className={styles.terms}>
      {rows.map((r) => (
        <div key={r.k} className={styles.termRow}>
          <dt>{r.k}</dt>
          <dd>{r.v}</dd>
        </div>
      ))}
    </dl>
  );
}

// ── Page ─────────────────────────────────────────────────────────────

export default function OperatorStorefront() {
  const { slug, handle } = useParams();
  const key = slug || handle;
  const navigate = useNavigate();
  const location = useLocation();
  const [params, setParams] = useSearchParams();
  const query = params.toString();
  const criteria = useMemo(() => parseCarSearch(new URLSearchParams(query)), [query]);
  const branchFilter = params.get("branch") || "";
  const dates = hasDates(criteria);
  const narrow = useMediaQuery(NARROW_QUERY);
  const [saved, toggleSaved] = useSavedListings();

  const [state, setState] = useState({ key: null, data: null, error: null });
  const [retry, setRetry] = useState(0);
  const [editing, setEditing] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const fromRef = useRef(null);
  const filtersButtonRef = useRef(null);
  const requestKey = `${key}#${retry}`;

  useEffect(() => {
    let alive = true;
    getOperatorStorefront(key)
      .then((r) => alive && setState({ key: requestKey, data: r.data, error: null }))
      .catch((err) => alive && setState({ key: requestKey, data: null, error: err?.response?.status === 404 ? "missing" : "failed" }));
    return () => {
      alive = false;
    };
  }, [key, requestKey]);

  const data = state.key === requestKey ? state.data : null;
  const loading = state.key !== requestKey;

  // Old /operators/:id links move to the shareable /o/:slug address.
  useEffect(() => {
    if (handle && data?.operator.slug) {
      navigate(`/o/${data.operator.slug}${location.search}${location.hash}`, { replace: true });
    }
  }, [handle, data, navigate, location.search, location.hash]);

  useEffect(() => {
    if (data) document.title = `${data.operator.companyName} · ${BRAND.name}${BRAND.suffix}`;
  }, [data]);

  const view = useMemo(() => {
    if (!data) return null;
    const fleet = branchFilter ? data.cars.filter((c) => String(c.branch.id) === branchFilter) : data.cars;
    const found = searchFleet(fleet, criteria, { groupBy: "branch" });
    return { ...found, facets: found.facets.filter((f) => !HIDDEN_FACETS.has(f.group)) };
  }, [data, criteria, branchFilter]);

  const update = (changes, { replace = false } = {}) => {
    const next = toCarSearchParams({ ...criteria, city: "", ...changes });
    const branch = changes.branch !== undefined ? changes.branch : branchFilter;
    if (branch) next.set("branch", branch);
    setParams(next, { replace });
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
    update({ sel, pmin: null, pmax: null, dmin: null, dmax: null, branch: "" });
  };

  const showBranch = (id) => {
    update({ branch: String(id) });
    const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    document.getElementById("cars")?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
  };

  const closeSheet = useCallback(() => {
    setSheetOpen(false);
    filtersButtonRef.current?.focus();
  }, []);

  if (state.error === "missing" && !loading) {
    return (
      <div className={styles.page}>
        <div className={styles.missing}>
          <h1 className={styles.missingTitle}>We couldn&apos;t find this operator</h1>
          <p>The link may be mistyped, or the operator is no longer on {BRAND.name}{BRAND.suffix}.</p>
          <Link to="/cars" className={results.primaryButton}>
            Browse all cars
          </Link>
        </div>
      </div>
    );
  }

  if (state.error === "failed" && !loading) {
    return (
      <div className={styles.page}>
        <div className={styles.missing}>
          <Notice
            tone="error"
            role="alert"
            title="This page could not be loaded"
            action={
              <button type="button" className={results.outlineAccent} onClick={() => setRetry((n) => n + 1)}>
                Try again
              </button>
            }
          >
            Check your connection and try again.
          </Notice>
        </div>
      </div>
    );
  }

  if (!data || !view) {
    return (
      <div className={styles.page} aria-busy="true">
        <div className={styles.heroSkeleton} />
        <div className={results.shell}>
          <div className={results.results}>
            <ResultsSkeleton />
          </div>
        </div>
      </div>
    );
  }

  const { operator, branches, terms } = data;
  const cities = [...new Set(branches.map((b) => b.city).filter(Boolean))];
  const today = todayInKuching();
  const trip = tripParams(criteria).toString();
  const hrefFor = (id) => `/cars/${id}${trip ? `?${trip}` : ""}`;
  const backTo = `${location.pathname}${query ? `?${query}` : ""}`;
  const multiBranch = branches.filter((b) => b.carCount > 0).length > 1;
  // Most booked keeps the server's order and ignores filters; it only takes
  // the trip dates so the cards show the same prices as the list below.
  const popularCars = data.mostBookedIds.map((id) => data.cars.find((c) => c.id === id)).filter(Boolean);
  const unfiltered = { ...criteria, sel: Object.fromEntries(FACET_GROUPS.map((g) => [g, []])), pmin: null, pmax: null, dmin: null, dmax: null };
  const popularByID = new Map(
    searchFleet(popularCars, unfiltered, { groupBy: "branch" })
      .groups.flatMap((g) => g.items)
      .map((r) => [r.listing.id, r])
  );
  const popularResults = data.mostBookedIds.map((id) => popularByID.get(id)).filter(Boolean);
  const anyFilter = view.anyFilter || Boolean(branchFilter);

  const sections = [
    operator.takingBookings && data.cars.length > 0 && { id: "cars", label: "Cars" },
    operator.about && { id: "about", label: "About" },
    { id: "contact", label: "Branches & contact" },
    operator.takingBookings && { id: "terms", label: "Booking terms" },
  ].filter(Boolean);

  const labelFor = (group, value) =>
    view.facets.find((f) => f.group === group)?.options.find((o) => o.value === value)?.label || value;
  const chips = [];
  if (branchFilter) {
    const b = branches.find((x) => String(x.id) === branchFilter);
    chips.push({ key: "branch", label: b ? b.name : "Branch", clear: () => update({ branch: "" }) });
  }
  FACET_GROUPS.filter((g) => !HIDDEN_FACETS.has(g)).forEach((g) =>
    criteria.sel[g].forEach((v) =>
      chips.push({ key: `${g}-${v}`, label: g === "seats" ? `${v} seats or more` : labelFor(g, v), clear: () => toggleFacet(g, v) })
    )
  );
  if (criteria.pmin !== null || criteria.pmax !== null) {
    chips.push({
      key: "price",
      label: `RM${criteria.pmin ?? view.bounds.price?.min ?? 0} - RM${criteria.pmax ?? view.bounds.price?.max ?? ""} per day`,
      clear: () => update({ pmin: null, pmax: null }),
    });
  }
  if (dates && (criteria.dmin !== null || criteria.dmax !== null)) {
    chips.push({
      key: "dep",
      label: `RM${criteria.dmin ?? view.bounds.deposit?.min ?? 0} - RM${criteria.dmax ?? view.bounds.deposit?.max ?? ""} now`,
      clear: () => update({ dmin: null, dmax: null }),
    });
  }

  const summary = dates
    ? `${formatShortDateTime(klDateTimeToIso(criteria.from, criteria.ft))} to ${formatShortDateTime(
        klDateTimeToIso(criteria.to, criteria.tt)
      )}`
    : "";

  const filterPanel = (prefix) => (
    <FilterPanel data={view} criteria={criteria} onToggle={toggleFacet} onRange={setRange} idPrefix={prefix} />
  );

  const card = (r) => (
    <ResultCard
      key={r.listing.id}
      result={r}
      href={hrefFor(r.listing.id)}
      linkState={{ backTo }}
      saved={saved.has(r.listing.id)}
      onToggleSave={() => toggleSaved(r.listing.id)}
    />
  );

  return (
    <div className={styles.page}>
      <Hero operator={operator} carCount={data.cars.length} cities={cities} />
      <SectionNav items={sections} />

      {!operator.takingBookings && (
        <div className={styles.narrowWrap}>
          <Notice tone="warn" title={`${operator.companyName} isn't taking bookings right now`}>
            Their cars are hidden until they're back.{" "}
            <Link to="/cars">Browse cars from other operators</Link>
          </Notice>
        </div>
      )}

      {operator.takingBookings && data.cars.length > 0 && (
        <section id="cars" className={styles.section} aria-labelledby="cars-h">
          <div className={styles.tripBand}>
            <div className={styles.tripInner}>
              <h2 id="cars-h" className={styles.tripTitle}>
                Cars from {operator.companyName}
              </h2>
              {editing || !dates ? (
                <SearchWidget
                  key={`${criteria.from}|${criteria.ft}|${criteria.to}|${criteria.tt}`}
                  criteria={criteria}
                  showCity={false}
                  submitLabel="Show prices"
                  fromRef={fromRef}
                  onApply={(t) => {
                    setEditing(false);
                    update({ from: t.from, ft: t.ft, to: t.to, tt: t.tt });
                  }}
                />
              ) : (
                <button
                  type="button"
                  className={results.summary}
                  onClick={() => {
                    setEditing(true);
                    setTimeout(() => fromRef.current?.focus(), 0);
                  }}
                >
                  <span className={results.summaryText}>{summary}</span>
                  <span className={results.summaryAction}>Change dates</span>
                </button>
              )}
            </div>
          </div>

          {popularResults.length > 0 && !anyFilter && (
            <div className={styles.popular}>
              <div className={results.groupHead}>
                <h3 className={results.groupTitle}>Most booked</h3>
                <span className={results.groupCount}>Last 90 days</span>
              </div>
              <div className={results.cards}>{popularResults.map(card)}</div>
            </div>
          )}

          <div className={results.shell}>
            {!narrow && (
              <aside className={results.rail} aria-labelledby="rail-title">
                <div className={results.railHead}>
                  <h3 id="rail-title" className={results.railTitle}>
                    Filters
                  </h3>
                  <button
                    type="button"
                    className={`${results.clearAll} ${anyFilter ? results.clearAllActive : ""}`}
                    onClick={clearAll}
                  >
                    Clear all
                  </button>
                </div>
                {filterPanel("rail")}
              </aside>
            )}

            <div className={results.results}>
              {multiBranch && (
                <div className={styles.branchTabs} role="group" aria-label="Branch">
                  <button
                    type="button"
                    className={`${styles.branchTab} ${!branchFilter ? styles.branchTabOn : ""}`}
                    aria-pressed={!branchFilter}
                    onClick={() => update({ branch: "" })}
                  >
                    All branches
                  </button>
                  {branches
                    .filter((b) => b.carCount > 0)
                    .map((b) => (
                      <button
                        key={b.id}
                        type="button"
                        className={`${styles.branchTab} ${branchFilter === String(b.id) ? styles.branchTabOn : ""}`}
                        aria-pressed={branchFilter === String(b.id)}
                        onClick={() => update({ branch: String(b.id) })}
                      >
                        {b.name}
                      </button>
                    ))}
                </div>
              )}

              <div className={results.toolbar}>
                <p className={results.resultLine} aria-live="polite">
                  {view.total === 0
                    ? "No cars match"
                    : `${plural(view.total, "car")}${anyFilter ? " matching your filters" : ""}`}
                </p>
                <div className={results.tools}>
                  {narrow && (
                    <button
                      ref={filtersButtonRef}
                      type="button"
                      className={results.filtersButton}
                      onClick={() => setSheetOpen(true)}
                      aria-haspopup="dialog"
                    >
                      Filters{chips.length ? ` (${chips.length})` : ""}
                    </button>
                  )}
                  <label className={results.sort}>
                    <span className={results.sortLabel}>Sort</span>
                    <select
                      className={results.sortSelect}
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

              {chips.length > 0 && (
                <ul className={results.chips} aria-label="Active filters">
                  {chips.map((c) => (
                    <li key={c.key}>
                      <button type="button" className={results.chip} onClick={c.clear} aria-label={`Remove filter: ${c.label}`}>
                        {c.label} <X size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}

              <div className={results.list}>
                {view.total === 0 && (
                  <div className={results.empty}>
                    <h3 className={results.emptyTitle}>No cars match all your filters</h3>
                    <p className={results.emptyText}>
                      {dates
                        ? `${operator.companyName} may be fully booked on these dates. Try other dates or clear a filter.`
                        : "Clear a filter to see more cars."}
                    </p>
                    <div className={results.emptyActions}>
                      <button type="button" className={results.secondaryButton} onClick={clearAll}>
                        Clear all filters
                      </button>
                    </div>
                  </div>
                )}

                {view.groups.map((g) => (
                  <section key={g.key} className={results.group} aria-labelledby={multiBranch ? `grp-${g.key}` : undefined}>
                    {multiBranch && !branchFilter && (
                      <div className={results.groupHead}>
                        <h3 id={`grp-${g.key}`} className={results.groupTitle}>
                          {g.title}
                        </h3>
                        <span className={results.groupCount}>{plural(g.items.length, "car")}</span>
                      </div>
                    )}
                    <div className={results.cards}>{g.items.map(card)}</div>
                  </section>
                ))}
              </div>
            </div>
          </div>
        </section>
      )}

      {operator.about && (
        <section id="about" className={`${styles.section} ${styles.narrowWrap}`} aria-labelledby="about-h">
          <h2 id="about-h" className={styles.h2}>
            About {operator.companyName}
          </h2>
          <div className={styles.aboutGrid}>
            <div className={styles.aboutText}>
              {operator.about.split(/\n{2,}/).map((para, i) => (
                <p key={i}>{para}</p>
              ))}
            </div>
            <dl className={styles.facts}>
              {operator.establishedYear && (
                <div>
                  <dt>In business since</dt>
                  <dd>{operator.establishedYear}</dd>
                </div>
              )}
              <div>
                <dt>
                  On {BRAND.name}
                  {BRAND.suffix} since
                </dt>
                <dd>{formatMonthYear(operator.activeSince)}</dd>
              </div>
              {operator.languages?.length > 0 && (
                <div>
                  <dt>Speaks</dt>
                  <dd>{operator.languages.join(", ")}</dd>
                </div>
              )}
            </dl>
          </div>
        </section>
      )}

      <section id="contact" className={`${styles.section} ${styles.narrowWrap}`} aria-labelledby="contact-h">
        <h2 id="contact-h" className={styles.h2}>
          Branches &amp; contact
        </h2>
        <div className={styles.branchGrid}>
          {branches.map((b) => (
            <BranchCard key={b.id} branch={b} today={today} onShowCars={showBranch} />
          ))}
        </div>
      </section>

      {operator.takingBookings && (
        <section id="terms" className={`${styles.section} ${styles.narrowWrap}`} aria-labelledby="terms-h">
          <h2 id="terms-h" className={styles.h2}>
            Booking with {operator.companyName}
          </h2>
          <p className={styles.lead}>
            Book here and nothing is charged until {operator.companyName} accepts. These terms apply to every car on
            this page.
          </p>
          <Terms terms={terms} operatorName={operator.companyName} />
        </section>
      )}

      {narrow && operator.takingBookings && (
        <FilterSheet
          open={sheetOpen}
          onClose={closeSheet}
          onClearAll={clearAll}
          applyLabel={`Show ${plural(view.total, "car")}`}
        >
          {filterPanel("sheet")}
        </FilterSheet>
      )}
    </div>
  );
}
