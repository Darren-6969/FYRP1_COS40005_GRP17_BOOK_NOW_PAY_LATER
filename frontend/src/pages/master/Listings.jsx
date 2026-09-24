import { useEffect, useState } from "react";
import {
  getAdminListings,
  reactivateAdminListing,
  suspendAdminListing,
} from "../../services/admin_service";

export default function Listings() {
  const [listings, setListings] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  const load = async () => {
    try {
      setLoading(true);
      setError("");
      const response = await getAdminListings();
      setListings(response.data?.listings || []);
    } catch (err) {
      setError(err.response?.data?.message || "Failed to load listings.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    load();
  }, []);

  const changeStatus = async (listing) => {
    const nextStatus = listing.status === "SUSPENDED" ? "reactivate" : "suspend";
    const reason = window.prompt(`${nextStatus === "suspend" ? "Suspension" : "Reactivation"} reason (required):`);
    if (!reason || reason.trim().length < 5) return;

    try {
      setError("");
      setMessage("");
      if (nextStatus === "suspend") {
        await suspendAdminListing(listing.id, reason.trim());
      } else {
        await reactivateAdminListing(listing.id, reason.trim());
      }
      setMessage(`Listing ${nextStatus === "suspend" ? "suspended" : "reactivated"} successfully.`);
      await load();
    } catch (err) {
      setError(err.response?.data?.message || `Failed to ${nextStatus} listing.`);
    }
  };

  return (
    <div className="page-stack">
      <section className="card">
        <div className="section-header">
          <div>
            <h3>Listing Support</h3>
            <p>Review operator listings and suspend an individual listing when platform support is required.</p>
          </div>
          <button className="btn" type="button" onClick={load}>Refresh</button>
        </div>
        {error && <div className="alert danger">{error}</div>}
        {message && <div className="alert">{message}</div>}
        {loading ? <p>Loading listings...</p> : (
          <table className="table">
            <thead>
              <tr><th>Listing</th><th>Operator</th><th>Branch</th><th>Status</th><th>Action</th></tr>
            </thead>
            <tbody>
              {listings.map((listing) => (
                <tr key={listing.id}>
                  <td><strong>{listing.name}</strong><br /><small>{listing.category}</small></td>
                  <td>{listing.operator?.companyName || "-"}</td>
                  <td>{listing.branch?.name || "-"}</td>
                  <td><span className={`badge ${String(listing.status).toLowerCase()}`}>{listing.status}</span></td>
                  <td>
                    <button className={`btn ${listing.status === "SUSPENDED" ? "primary" : "danger"}`} type="button" onClick={() => changeStatus(listing)}>
                      {listing.status === "SUSPENDED" ? "Reactivate" : "Suspend"}
                    </button>
                  </td>
                </tr>
              ))}
              {!listings.length && <tr><td colSpan="5">No listings found.</td></tr>}
            </tbody>
          </table>
        )}
      </section>
    </div>
  );
}
