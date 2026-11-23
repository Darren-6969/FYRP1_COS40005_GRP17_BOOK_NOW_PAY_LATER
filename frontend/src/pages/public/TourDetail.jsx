import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import {
  durationText,
  getTour,
  quoteBody,
  quoteTour,
  selectionFromParams,
  selectionToParams,
} from "../../services/tour_service";
import { formatSen, klToday } from "../../utils/formatPublic";
import { BRAND } from "../../constants/brand";
import styles from "../../assets/styles/public/Tours.module.css";

function List({ items, ordered = false }) {
  if (!items.length) return null;
  const Tag = ordered ? "ol" : "ul";
  return (
    <Tag className={styles.list}>
      {items.map((item, i) => (
        <li key={`${i}-${item}`}>{item}</li>
      ))}
    </Tag>
  );
}

function selectionKey(sel) {
  return JSON.stringify(quoteBody(sel));
}

// Fills the time when the tour has only one, and the first pickup point.
function withDefaults(sel, tour) {
  return {
    ...sel,
    pickupTime: sel.pickupTime || (tour.pickupTimes.length === 1 ? tour.pickupTimes[0] : ""),
    pickupPointId: sel.pickupPointId || tour.pickupPoints[0]?.id || "",
  };
}

export function PriceLines({ quote, unitLabel }) {
  if (!quote) return null;
  return (
    <dl className={styles.lines}>
      <div className={styles.line}>
        <dt>Tour ({unitLabel})</dt>
        <dd>{formatSen(quote.rentalSen)}</dd>
      </div>
      {quote.pickupFeeSen > 0 && (
        <div className={styles.line}>
          <dt>Pickup charge</dt>
          <dd>{formatSen(quote.pickupFeeSen)}</dd>
        </div>
      )}
      <div className={styles.line}>
        <dt>Total</dt>
        <dd>{formatSen(quote.totalSen)}</dd>
      </div>
      <div className={`${styles.line} ${styles.lineStrong}`}>
        <dt>Down payment after the operator accepts</dt>
        <dd>{formatSen(quote.depositSen)}</dd>
      </div>
      <div className={styles.line}>
        <dt>Balance before the tour</dt>
        <dd>{formatSen(quote.balanceSen)}</dd>
      </div>
    </dl>
  );
}

export default function TourDetail() {
  const { tourId } = useParams();
  const [params] = useSearchParams();
  const navigate = useNavigate();
  const [tour, setTour] = useState(null);
  const [loadError, setLoadError] = useState("");
  const [photo, setPhoto] = useState(0);
  const [sel, setSel] = useState(() => selectionFromParams(params));
  const [quoteRes, setQuoteRes] = useState({ key: "", data: null, error: "" });

  useEffect(() => {
    let live = true;
    getTour(tourId)
      .then((res) => {
        if (!live) return;
        setTour(res.data);
        setSel((current) => withDefaults(current, res.data));
        document.title = `${res.data.name} · ${BRAND.name}${BRAND.suffix}`;
      })
      .catch((err) =>
        live && setLoadError(err.response?.status === 404 ? "This tour is not available." : "We couldn't load this tour.")
      );
    return () => {
      live = false;
    };
  }, [tourId]);

  const unavailable = useMemo(() => new Set(tour?.availability?.unavailableDates || []), [tour]);
  const ready = Boolean(tour && sel.date && sel.pickupTime && sel.passengers);
  const key = ready ? selectionKey(sel) : "";

  useEffect(() => {
    if (!key) return undefined;
    let live = true;
    const id = window.setTimeout(() => {
      quoteTour(tourId, JSON.parse(key))
        .then((res) => live && setQuoteRes({ key, data: res.data, error: "" }))
        .catch(() => live && setQuoteRes({ key, data: null, error: "We couldn't price this selection. Try again." }));
    }, 250);
    return () => {
      live = false;
      window.clearTimeout(id);
    };
  }, [key, tourId]);

  if (loadError) {
    return (
      <main className={styles.page}>
        <Link to="/tours" className={styles.back}>
          <ArrowLeft size={18} aria-hidden="true" /> All tours
        </Link>
        <p className={styles.notice}>{loadError}</p>
      </main>
    );
  }
  if (!tour) return <main className={styles.page}>Loading tour...</main>;

  const current = quoteRes.key === key ? quoteRes.data : null;
  const problems = current?.problems || [];
  const dateTaken = sel.date && unavailable.has(sel.date);

  let reason = "";
  if (!sel.date) reason = "Choose a date to see the price.";
  else if (dateTaken) reason = "This tour is fully booked on that date. Choose another date.";
  else if (!sel.pickupTime) reason = "Choose a pickup time.";
  else if (problems.length) reason = problems[0].message;
  else if (quoteRes.error && quoteRes.key === key) reason = quoteRes.error;

  const quoting = ready && quoteRes.key !== key;
  const change = (field) => (e) => setSel((s) => ({ ...s, [field]: e.target.value }));
  const images = tour.images.length ? tour.images : [{ id: "none", url: "" }];

  const reserve = () => {
    if (reason || quoting || !current) return;
    navigate(`/tours/${tour.id}/book?${selectionToParams(sel)}`);
  };

  return (
    <main className={styles.page}>
      <Link to={`/tours${params.toString() ? `?${params}` : ""}`} className={styles.back}>
        <ArrowLeft size={18} aria-hidden="true" /> All tours
      </Link>

      <div className={styles.detail}>
        <div>
          {images[photo].url ? (
            <img src={images[photo].url} alt={tour.name} className={styles.hero} />
          ) : (
            <div className={styles.hero} />
          )}
          {tour.images.length > 1 && (
            <div className={styles.thumbs}>
              {tour.images.map((image, i) => (
                <button
                  key={image.id}
                  type="button"
                  className={`${styles.thumb} ${i === photo ? styles.thumbOn : ""}`}
                  onClick={() => setPhoto(i)}
                  aria-label={`Photo ${i + 1} of ${tour.images.length}`}
                  aria-pressed={i === photo}
                >
                  <img src={image.url} alt="" />
                </button>
              ))}
            </div>
          )}

          <p style={{ marginTop: 20 }}>
            <span className={`${styles.kind} ${tour.kind === "GUIDED" ? styles.kindGuided : ""}`}>{tour.kindLabel}</span>
          </p>
          <h1 className={styles.h1}>{tour.name}</h1>

          <div className={styles.operator}>
            {tour.operator.logoUrl && <img src={tour.operator.logoUrl} alt="" className={styles.logo} />}
            <span>
              By{" "}
              {tour.operator.slug ? <Link to={`/o/${tour.operator.slug}`}>{tour.operator.name}</Link> : tour.operator.name}
              {tour.operator.verified && <span className={styles.verified}>Verified</span>}
            </span>
          </div>

          <ul className={styles.facts}>
            <li className={styles.fact}>{durationText(tour.durationDays)}</li>
            {tour.maxPassengers && <li className={styles.fact}>Up to {tour.maxPassengers} passengers</li>}
            {tour.vehicle && (
              <li className={styles.fact}>
                {[tour.vehicle.name, tour.vehicle.type, tour.vehicle.seats ? `${tour.vehicle.seats} seats` : null]
                  .filter(Boolean)
                  .join(", ")}
              </li>
            )}
            {tour.operator.languages.length > 0 && <li className={styles.fact}>{tour.operator.languages.join(", ")}</li>}
            {tour.branch.city && <li className={styles.fact}>{tour.branch.city}</li>}
          </ul>

          {tour.description && (
            <section className={styles.section}>
              <h2 className={styles.h2}>About this tour</h2>
              <p className={styles.prose}>{tour.description}</p>
            </section>
          )}

          {tour.highlights.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.h2}>Highlights</h2>
              <List items={tour.highlights} />
            </section>
          )}

          {tour.itinerary.length > 0 && (
            <section className={styles.section}>
              <h2 className={styles.h2}>Itinerary</h2>
              <List items={tour.itinerary} ordered />
            </section>
          )}

          {(tour.inclusions.length > 0 || tour.exclusions.length > 0) && (
            <section className={`${styles.section} ${styles.twoCol}`}>
              {tour.inclusions.length > 0 && (
                <div>
                  <h2 className={styles.h2}>Included</h2>
                  <List items={tour.inclusions} />
                </div>
              )}
              {tour.exclusions.length > 0 && (
                <div>
                  <h2 className={styles.h2}>Not included</h2>
                  <List items={tour.exclusions} />
                </div>
              )}
            </section>
          )}

          <section className={styles.section}>
            <h2 className={styles.h2}>Pickup</h2>
            {tour.meetingPoint && <p className={styles.prose}>{tour.meetingPoint}</p>}
            <List
              items={tour.pickupPoints.map(
                (p) => `${p.label}${p.address ? `, ${p.address}` : ""}${p.feeSen ? ` (${formatSen(p.feeSen)})` : ""}`
              )}
            />
          </section>

          <section className={styles.section}>
            <h2 className={styles.h2}>Cancellation</h2>
            <p className={styles.prose}>
              You can cancel up to the start of the tour. The operator keeps the down payment; any balance you have paid is
              refunded in full.
            </p>
            {tour.policies.cancellation && <p className={styles.prose}>{tour.policies.cancellation}</p>}
          </section>
        </div>

        <aside className={styles.panel} aria-label="Book this tour">
          <p className={styles.panelPrice}>
            {formatSen(tour.priceSen)} <span className={styles.priceUnit}>{tour.priceUnitLabel}</span>
          </p>
          <p className={styles.hint}>
            One price for your group{tour.maxPassengers ? ` of up to ${tour.maxPassengers}` : ""}. Nothing to pay until
            the operator accepts.
          </p>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="td-date">
              Date
            </label>
            <input
              id="td-date"
              className={styles.input}
              type="date"
              min={klToday()}
              value={sel.date}
              onChange={change("date")}
              aria-invalid={dateTaken || undefined}
            />
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="td-time">
              Pickup time
            </label>
            {tour.pickupTimes.length ? (
              <select id="td-time" className={styles.input} value={sel.pickupTime} onChange={change("pickupTime")}>
                <option value="">Choose a time</option>
                {tour.pickupTimes.map((time) => (
                  <option key={time} value={time}>
                    {time}
                  </option>
                ))}
              </select>
            ) : (
              <input id="td-time" className={styles.input} type="time" value={sel.pickupTime} onChange={change("pickupTime")} />
            )}
          </div>

          <div className={styles.field}>
            <label className={styles.label} htmlFor="td-pax">
              Passengers
            </label>
            <input
              id="td-pax"
              className={styles.input}
              type="number"
              min="1"
              max={tour.maxPassengers || 100}
              inputMode="numeric"
              value={sel.passengers}
              onChange={change("passengers")}
            />
          </div>

          {tour.pickupPoints.length > 1 && (
            <div className={styles.field}>
              <label className={styles.label} htmlFor="td-point">
                Pickup point
              </label>
              <select id="td-point" className={styles.input} value={sel.pickupPointId} onChange={change("pickupPointId")}>
                {tour.pickupPoints.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.label}
                    {p.feeSen ? ` (+${formatSen(p.feeSen)})` : ""}
                  </option>
                ))}
              </select>
            </div>
          )}

          <PriceLines quote={current?.quote && !reason ? current.quote : null} unitLabel={tour.priceUnitLabel} />

          {reason && (
            <p className={styles.hint} role="status">
              {reason}
            </p>
          )}

          <button type="button" className={styles.button} onClick={reserve} disabled={Boolean(reason) || quoting || !current}>
            {quoting ? "Checking..." : "Reserve"}
          </button>
        </aside>
      </div>
    </main>
  );
}
