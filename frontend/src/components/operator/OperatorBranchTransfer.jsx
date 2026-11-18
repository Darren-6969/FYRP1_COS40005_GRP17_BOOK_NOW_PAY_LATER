
import { useEffect, useMemo, useState } from "react";
import { operatorService } from "../../services/operator_service";

const cardStyle = {
  border: "1px solid #dce5e8",
  borderRadius: 12,
  padding: 16,
};

const inputStyle = {
  width: "100%",
  padding: "10px 12px",
  borderRadius: 8,
  border: "1px solid #cbd5dc",
  marginTop: 6,
  background: "white",
  color: "#17232c",
};

function getError(err) {
  return (
    err.response?.data?.message ||
    err.message ||
    "Operation failed."
  );
}

function vehicleIdentity(listing) {
  return [
    listing.vehicleMake,
    listing.vehicleModel,
    listing.vehicleType,
    listing.modelYear,
    listing.transmission,
    listing.seats,
  ]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");
}

function vehicleLabel(listing) {
  return [
    listing.name,
    listing.vehicleMake,
    listing.vehicleModel,
  ]
    .filter(Boolean)
    .join(" · ");
}

export default function OperatorBranchTransfer({
  onClose,
}) {
  const [branches, setBranches] = useState([]);
  const [listings, setListings] = useState([]);
  const [history, setHistory] = useState([]);

  const [sourceBranchId, setSourceBranchId] =
    useState("");
  const [destinationBranchId, setDestinationBranchId] =
    useState("");

  const [sourceListingId, setSourceListingId] =
    useState("");
  const [destinationListingId, setDestinationListingId] =
    useState("");

  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const loadData = async () => {
    setLoading(true);
    setError("");

    try {
      const [branchResult, listingResult, historyResult] =
        await Promise.all([
          operatorService.getBranches(),
          operatorService.getListings(),
          operatorService.getBranchTransfers(),
        ]);

      setBranches(
        branchResult.data?.branches ?? []
      );

      setListings(
        listingResult.data?.listings ?? []
      );

      setHistory(
        historyResult.data?.transfers ?? []
      );
    } catch (err) {
      setError(getError(err));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const activeBranches = useMemo(
    () => branches.filter((branch) => branch.isActive),
    [branches]
  );

  const sourceListings = useMemo(
    () =>
      listings.filter(
        (listing) =>
          listing.branchId === Number(sourceBranchId) &&
          listing.category === "CAR_RENTAL" &&
          Number(listing.quantity) > 0
      ),
    [listings, sourceBranchId]
  );

  const source = listings.find(
    (listing) => listing.id === Number(sourceListingId)
  );

  const destinationListings = useMemo(() => {
    if (!source) return [];

    return listings.filter(
      (listing) =>
        listing.branchId === Number(destinationBranchId) &&
        listing.category === "CAR_RENTAL" &&
        listing.operatorId === source.operatorId &&
        vehicleIdentity(listing) === vehicleIdentity(source)
    );
  }, [listings, source, destinationBranchId]);

  const destination = listings.find(
    (listing) =>
      listing.id === Number(destinationListingId) &&
      destinationListings.some((item) => item.id === listing.id)
  );

  const amount = Number(quantity);

  const canSubmit =
    source &&
    destination &&
    Number.isSafeInteger(amount) &&
    amount > 0 &&
    amount <= Number(source.quantity) &&
    reason.trim().length >= 5 &&
    reason.trim().length <= 300 &&
    !saving;

  const transfer = async () => {
    if (!canSubmit) return;

    const confirmed = window.confirm(
      `Transfer ${amount} vehicle(s) from ` +
      `${branches.find((b) => b.id === source.branchId)?.name} ` +
      `to ${branches.find((b) => b.id === destination.branchId)?.name}?\n\n` +
      "This immediately changes inventory."
    );

    if (!confirmed) return;

    setSaving(true);
    setError("");
    setSuccess("");

    try {
      await operatorService.transferBranchStock({
        sourceListingId: source.id,
        destinationListingId: destination.id,
        quantity: amount,
        reason: reason.trim(),
        ...(source.operatorId
          ? { operatorId: source.operatorId }
          : {}),
      });

      setSuccess("Vehicle transfer completed successfully.");

      setQuantity("1");
      setReason("");

      await loadData();
    } catch (err) {
      setError(getError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="Branch Stock Transfer"
      style={{
        position: "fixed",
        inset: 0,
        zIndex: 9999,
        background: "rgba(0, 0, 0, 0.55)",
        display: "flex",
        justifyContent: "center",
        alignItems: "center",
        padding: 16,
      }}
    >
      <div
        style={{
          background: "#ffffff",
          color: "#17232c",
          width: "100%",
          maxWidth: 720,
          maxHeight: "90vh",
          overflowY: "auto",
          borderRadius: 18,
          padding: 24,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
          }}
        >
          <div>
            <h2 style={{ margin: 0 }}>Branch Transfer</h2>
            <p style={{ marginTop: 6, color: "#64748b" }}>
              Move available vehicles between branches.
            </p>
          </div>

          <button
            type="button"
            className="operator-secondary-btn"
            disabled={saving}
            onClick={onClose}
          >
            Close
          </button>
        </div>

        {loading && <p>Loading branch inventory...</p>}

        {error && (
          <p role="alert" style={{ color: "#c62828" }}>
            {error}
          </p>
        )}

        {success && (
          <p role="status" style={{ color: "#07869b" }}>
            {success}
          </p>
        )}

        {!loading && (
          <>
            <div style={{ ...cardStyle, marginTop: 16 }}>
              <h3>Source Branch</h3>

              <label>
                Branch
                <select
                  style={inputStyle}
                  value={sourceBranchId}
                  onChange={(event) => {
                    setSourceBranchId(event.target.value);
                    setSourceListingId("");
                    setDestinationBranchId("");
                    setDestinationListingId("");
                  }}
                >
                  <option value="">Select source branch</option>
                  {activeBranches.map((branch) => (
                    <option key={branch.id} value={branch.id}>
                      {branch.name}
                    </option>
                  ))}
                </select>
              </label>

              <label style={{ display: "block", marginTop: 14 }}>
                Vehicle
                <select
                  style={inputStyle}
                  value={sourceListingId}
                  onChange={(event) => {
                    setSourceListingId(event.target.value);
                    setDestinationListingId("");
                  }}
                >
                  <option value="">Select vehicle</option>
                  {sourceListings.map((listing) => (
                    <option key={listing.id} value={listing.id}>
                      {vehicleLabel(listing)} — {listing.quantity} cars
                    </option>
                  ))}
                </select>
              </label>
            </div>

            <div
              style={{
                textAlign: "center",
                padding: 14,
                fontSize: 22,
              }}
            >
              ↓
            </div>

            <div style={cardStyle}>
              <h3>Destination Branch</h3>

              <label>
                Branch
                <select
                  style={inputStyle}
                  value={destinationBranchId}
                  disabled={!source}
                  onChange={(event) => {
                    setDestinationBranchId(event.target.value);
                    setDestinationListingId("");
                  }}
                >
                  <option value="">Select destination branch</option>
                  {activeBranches
                    .filter(
                      (branch) =>
                        branch.id !== Number(sourceBranchId) &&
                        branch.operatorId === source?.operatorId
                    )
                    .map((branch) => (
                      <option key={branch.id} value={branch.id}>
                        {branch.name}
                      </option>
                    ))}
                </select>
              </label>

              <label style={{ display: "block", marginTop: 14 }}>
                Matching Vehicle Listing
                <select
                  style={inputStyle}
                  value={destinationListingId}
                  disabled={!destinationBranchId}
                  onChange={(event) =>
                    setDestinationListingId(event.target.value)
                  }
                >
                  <option value="">Select destination vehicle</option>
                  {destinationListings.map((listing) => (
                    <option key={listing.id} value={listing.id}>
                      {vehicleLabel(listing)} — {listing.quantity} cars
                    </option>
                  ))}
                </select>
              </label>

              {destinationBranchId &&
                destinationListings.length === 0 && (
                  <p style={{ fontSize: 13, color: "#a16207" }}>
                    No matching vehicle listing exists at this branch.
                  </p>
                )}
            </div>

            <div style={{ ...cardStyle, marginTop: 16 }}>
              <h3>Transfer Details</h3>

              <label>
                Number of Vehicles
                <input
                  type="number"
                  min="1"
                  max={source?.quantity || 1}
                  step="1"
                  value={quantity}
                  style={inputStyle}
                  onChange={(event) =>
                    setQuantity(event.target.value)
                  }
                />
              </label>

              <label style={{ display: "block", marginTop: 14 }}>
                Reason
                <textarea
                  rows={3}
                  maxLength={300}
                  value={reason}
                  style={inputStyle}
                  placeholder="Reason for transferring vehicles"
                  onChange={(event) =>
                    setReason(event.target.value)
                  }
                />
              </label>

              {source && destination && (
                <div
                  style={{
                    marginTop: 16,
                    padding: 14,
                    background: "#f0f7f9",
                    borderRadius: 10,
                  }}
                >
                  <strong>Transfer Preview</strong>
                  <p>
                    Source: {source.quantity} →{" "}
                    {Number.isSafeInteger(amount)
                      ? source.quantity - amount
                      : "—"}
                  </p>
                  <p>
                    Destination: {destination.quantity} →{" "}
                    {Number.isSafeInteger(amount)
                      ? destination.quantity + amount
                      : "—"}
                  </p>
                  <small>
                    This is a quantity preview. The Backend
                    validates reservations and servicing.
                  </small>
                </div>
              )}

              <button
                type="button"
                className="operator-primary-btn"
                disabled={!canSubmit}
                onClick={transfer}
                style={{ marginTop: 16 }}
              >
                {saving ? "Transferring..." : "Confirm Transfer"}
              </button>
            </div>

            <div style={{ marginTop: 24 }}>
              <h3>Transfer History</h3>

              {!history.length ? (
                <p>No transfer records found.</p>
              ) : (
                <div style={{ overflowX: "auto" }}>
                  <table style={{ width: "100%" }}>
                    <thead>
                      <tr>
                        <th>Date</th>
                        <th>Vehicle</th>
                        <th>Transfer</th>
                        <th>Qty</th>
                      </tr>
                    </thead>

                    <tbody>
                      {history.map((item) => (
                        <tr key={item.id}>
                          <td>
                            {item.transferredAt
                              ? new Date(item.transferredAt)
                                  .toLocaleDateString("en-MY")
                              : "—"}
                          </td>
                          <td>{item.vehicleName}</td>
                          <td>
                            {item.sourceBranchName}
                            {" → "}
                            {item.destinationBranchName}
                          </td>
                          <td>{item.quantity}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
