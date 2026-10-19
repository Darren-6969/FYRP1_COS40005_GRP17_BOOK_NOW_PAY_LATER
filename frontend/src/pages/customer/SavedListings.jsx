import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getCarListing } from "../../services/listing_public_service";

const SAVED_KEY = "bnpl_saved_listings";

export default function SavedListings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    let ids;
    try {
      ids = JSON.parse(localStorage.getItem(SAVED_KEY) || "[]");
    } catch {
      ids = [];
    }
    const savedIds = Array.isArray(ids) ? ids : [];
    Promise.all(savedIds.map((id) => getCarListing(id).then((response) => response.data).catch(() => null)))
      .then((items) => active && setListings(items.filter(Boolean)))
      .finally(() => active && setLoading(false));
    return () => { active = false; };
  }, []);

  if (loading) return <div className="customer-page"><div className="customer-glass-card">Loading saved listings...</div></div>;

  return (
    <div className="customer-page">
      <section className="customer-hero-card compact">
        <p className="customer-eyebrow">Saved Listings</p>
        <h1>Cars you want to come back to</h1>
        <p>Saved listings are kept on this device and are not reservations.</p>
      </section>
      <section className="customer-list-stack">
        {listings.map((listing) => (
          <article key={listing.id} className="customer-glass-card customer-row-card">
            <div>
              <h3>{listing.name || `${listing.vehicleMake} ${listing.vehicleModel}`}</h3>
              <p>{listing.branch?.city || listing.branch?.name || "Available listing"}</p>
            </div>
            <Link className="customer-primary-btn small" to={`/cars/${listing.id}`}>View listing</Link>
          </article>
        ))}
      </section>
      {!listings.length && <div className="customer-empty-state"><h3>No saved listings</h3><p>Use the heart button while browsing cars to save one here.</p><Link className="customer-primary-btn" to="/cars">Browse cars</Link></div>}
    </div>
  );
}
