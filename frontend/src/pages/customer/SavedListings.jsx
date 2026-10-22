import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Heart } from "lucide-react";
import { getSavedListings, unsaveListing } from "../../services/customer_service";
import { operatorHref } from "../../services/listing_public_service";
import { formatSen } from "../../utils/formatPublic";

const TRANSMISSION = { AUTOMATIC: "Automatic", MANUAL: "Manual" };

// BNPLB-108 (SRS 4.2.6): cars the customer saved, held on their account.
// A save has no dates, so each card sends the customer to the car page to
// pick them. A car that can no longer be booked stays, marked unavailable.
export default function SavedListings() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [removing, setRemoving] = useState(() => new Set());

  useEffect(() => {
    let alive = true;
    getSavedListings()
      .then((res) => alive && setItems(res.data?.items || []))
      .catch(() => alive && setError("We couldn't load your saved cars. Please try again."))
      .finally(() => alive && setLoading(false));
    return () => {
      alive = false;
    };
  }, []);

  const remove = async (listingId) => {
    if (removing.has(listingId)) return;
    const before = items;
    setRemoving((prev) => new Set(prev).add(listingId));
    setItems((prev) => prev.filter((i) => i.listingId !== listingId));
    try {
      await unsaveListing(listingId);
    } catch {
      setItems(before);
      setError("That car couldn't be removed. Please try again.");
    } finally {
      setRemoving((prev) => {
        const next = new Set(prev);
        next.delete(listingId);
        return next;
      });
    }
  };

  if (loading) {
    return (
      <div className="customer-page">
        <div className="customer-glass-card">Loading saved cars...</div>
      </div>
    );
  }

  return (
    <div className="customer-page">
      <section className="customer-hero-card compact">
        <p className="customer-eyebrow">Saved cars</p>
        <h1>Cars you want to come back to</h1>
        <p>Saved cars are kept on your account, so they show on every device. Saving a car does not reserve it.</p>
      </section>

      {error && (
        <p className="customer-saved-error" role="alert">
          {error}
        </p>
      )}

      {items.length > 0 && (
        <section className="customer-list-stack" aria-label="Saved cars">
          {items.map(({ listingId, available, car }) => {
            const meta = [car.modelYear, car.vehicleType, car.seats && `${car.seats} seats`, TRANSMISSION[car.transmission]]
              .filter(Boolean)
              .join(" · ");
            return (
              <article
                key={listingId}
                className={`customer-glass-card customer-saved-card ${available ? "" : "is-unavailable"}`}
              >
                <div className="customer-saved-photo">
                  {car.imageUrl ? <img src={car.imageUrl} alt="" /> : <span aria-hidden="true">{car.title}</span>}
                </div>

                <div className="customer-saved-body">
                  <div className="customer-saved-head">
                    <h3>{car.title}</h3>
                    {!available && <span className="customer-status status-neutral">No longer available</span>}
                  </div>
                  {meta && <p className="customer-saved-meta">{meta}</p>}
                  <p className="customer-saved-meta">
                    {available ? (
                      <Link to={operatorHref(car.operator)}>{car.operator.companyName}</Link>
                    ) : (
                      car.operator.companyName
                    )}
                    {car.branch.name ? ` (${car.branch.name})` : ""}
                  </p>
                  {available && Number.isInteger(car.dailyRateSen) && (
                    <p className="customer-saved-price">
                      From <strong>{formatSen(car.dailyRateSen)}</strong> a day
                    </p>
                  )}
                </div>

                <div className="customer-saved-actions">
                  {available && (
                    <Link className="customer-primary-btn small" to={`/cars/${listingId}`}>
                      Check dates
                    </Link>
                  )}
                  <button
                    type="button"
                    className="customer-secondary-btn small"
                    onClick={() => remove(listingId)}
                    disabled={removing.has(listingId)}
                    aria-label={`Remove ${car.title} from saved cars`}
                  >
                    Remove
                  </button>
                </div>
              </article>
            );
          })}
        </section>
      )}

      {!items.length && !error && (
        <div className="customer-empty-state">
          <Heart size={28} aria-hidden="true" />
          <h3>No saved cars yet</h3>
          <p>Tap the heart on any car while you browse to keep it here.</p>
          <Link className="customer-primary-btn" to="/cars">
            Browse cars
          </Link>
        </div>
      )}
    </div>
  );
}
