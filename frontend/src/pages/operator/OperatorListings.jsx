import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
} from "react-router-dom";

import {
  operatorService,
  formatOperatorMoney,
} from "../../services/operator_service";

const STATUS_TABS = [
  {
    label: "All",
    value: "ALL",
  },
  {
    label: "Published",
    value: "PUBLISHED",
  },
  {
    label: "Draft",
    value: "DRAFT",
  },
  {
    label: "Withdrawn",
    value: "WITHDRAWN",
  },
];

export default function OperatorListings() {
  const [listings, setListings] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [search, setSearch] =
    useState("");

  const [activeStatus, setActiveStatus] =
    useState("ALL");

  const [category, setCategory] =
    useState("ALL");

  const [selectedIds, setSelectedIds] =
    useState([]);

  const [quickEditListing, setQuickEditListing] =
    useState(null);

  const loadListings = async () => {
    try {
      setLoading(true);
      setError("");

      const res =
        await operatorService.getListings();

      setListings(
        res.data?.listings || []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load listings"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadListings();
  }, []);

  // =========================================================
  // FILTERING
  // =========================================================

  const filteredListings =
    useMemo(() => {
      const normalizedSearch =
        search.trim().toLowerCase();

      return listings.filter(
        (listing) => {
          const status =
            String(
              listing.status || ""
            ).toUpperCase();

          const listingCategory =
            String(
              listing.category || ""
            ).toUpperCase();

          if (
            activeStatus !== "ALL" &&
            status !== activeStatus
          ) {
            return false;
          }

          if (
            category !== "ALL" &&
            listingCategory !== category
          ) {
            return false;
          }

          if (!normalizedSearch) {
            return true;
          }

          const searchableText = [
            listing.name,
            listing.vehicleMake,
            listing.vehicleModel,
            listing.branch?.name,
            listing.serviceType,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();

          return searchableText.includes(
            normalizedSearch
          );
        }
      );
    }, [
      listings,
      search,
      activeStatus,
      category,
    ]);

  // =========================================================
  // SELECTION
  // =========================================================

  const allVisibleSelected =
    filteredListings.length > 0 &&
    filteredListings.every(
      (listing) =>
        selectedIds.includes(
          listing.id
        )
    );

  const toggleListing = (id) => {
    setSelectedIds((current) =>
      current.includes(id)
        ? current.filter(
            (item) => item !== id
          )
        : [...current, id]
    );
  };

  const toggleAllVisible = () => {
    if (allVisibleSelected) {
      const visibleIds =
        filteredListings.map(
          (listing) => listing.id
        );

      setSelectedIds((current) =>
        current.filter(
          (id) =>
            !visibleIds.includes(id)
        )
      );

      return;
    }

    const next = new Set(
      selectedIds
    );

    filteredListings.forEach(
      (listing) =>
        next.add(listing.id)
    );

    setSelectedIds(
      Array.from(next)
    );
  };

  // =========================================================
  // BULK STATUS
  // =========================================================

  const bulkChangeStatus =
    async (status) => {
      if (!selectedIds.length) {
        alert(
          "Please select at least one listing."
        );

        return;
      }

      try {
        await operatorService.bulkUpdateListingStatus(
          {
            listingIds:
              selectedIds,

            status,
          }
        );

        setSelectedIds([]);

        await loadListings();
      } catch (err) {
        alert(
          err.response?.data?.message ||
            "Failed to update listings"
        );
      }
    };

  // =========================================================
  // SINGLE STATUS
  // =========================================================

  const updateListingStatus =
    async (listing, status) => {
      try {
        if (
          status === "PUBLISHED"
        ) {
          await operatorService.publishListing(
            listing.id
          );
        }

        if (
          status === "WITHDRAWN"
        ) {
          await operatorService.withdrawListing(
            listing.id
          );
        }

        await loadListings();
      } catch (err) {
        alert(
          err.response?.data?.message ||
            "Failed to update listing"
        );
      }
    };

  return (
    <div className="operator-page">

      {/* =====================================================
          PAGE HEADER
      ====================================================== */}

      <section className="operator-page-head">
        <div>
          <p className="operator-eyebrow">
            Catalogue Management
          </p>

          <h1>Listings</h1>

          <p>
            Manage packages,
            availability, pricing and
            listing visibility.
          </p>
        </div>

        <Link
          to="/operator/listings/new"
          className="operator-primary-btn"
        >
          + Create Listing
        </Link>
      </section>

      {/* =====================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="operator-alert danger">
          {error}

          <button
            type="button"
            onClick={loadListings}
          >
            Retry
          </button>
        </div>
      )}

      {/* =====================================================
          FILTERS
      ====================================================== */}

      <section className="operator-card">
        <div className="operator-listing-toolbar">

          <div className="operator-tabs">
            {STATUS_TABS.map(
              (tab) => (
                <button
                  key={tab.value}
                  type="button"
                  className={
                    activeStatus ===
                    tab.value
                      ? "active"
                      : ""
                  }
                  onClick={() =>
                    setActiveStatus(
                      tab.value
                    )
                  }
                >
                  {tab.label}
                </button>
              )
            )}
          </div>

          <div className="operator-listing-filters">

            <select
              value={category}
              onChange={(e) =>
                setCategory(
                  e.target.value
                )
              }
            >
              <option value="ALL">
                All Categories
              </option>

              <option value="CAR_RENTAL">
                Car Rental
              </option>

              <option value="TOUR">
                Tour Package
              </option>
            </select>

            <input
              type="search"
              placeholder="Search make, model, listing or branch..."
              value={search}
              onChange={(e) =>
                setSearch(
                  e.target.value
                )
              }
            />
          </div>
        </div>

        {/* =================================================
            BULK ACTIONS
        ================================================== */}

        <div className="operator-listing-bulk-bar">

          <label className="operator-listing-select-all">
            <input
              type="checkbox"
              checked={
                allVisibleSelected
              }
              onChange={
                toggleAllVisible
              }
            />

            Select All
          </label>

          <span>
            {selectedIds.length}{" "}
            selected
          </span>

          {selectedIds.length >
            0 && (
            <div className="operator-listing-bulk-actions">

              <button
                type="button"
                className="operator-secondary-btn"
                onClick={() =>
                  bulkChangeStatus(
                    "PUBLISHED"
                  )
                }
              >
                Publish Selected
              </button>

              <button
                type="button"
                className="operator-danger-btn"
                onClick={() =>
                  bulkChangeStatus(
                    "WITHDRAWN"
                  )
                }
              >
                Withdraw Selected
              </button>
            </div>
          )}
        </div>
      </section>

      {/* =====================================================
          LISTING CARDS
      ====================================================== */}

      <section className="operator-listing-grid">

        {loading && (
          <div className="operator-card operator-empty-state">
            Loading listings...
          </div>
        )}

        {!loading &&
          filteredListings.map(
            (listing) => (
              <ListingCard
                key={listing.id}
                listing={listing}
                selected={selectedIds.includes(
                  listing.id
                )}
                onSelect={() =>
                  toggleListing(
                    listing.id
                  )
                }
                onQuickEdit={() =>
                  setQuickEditListing(
                    listing
                  )
                }
                onPublish={() =>
                  updateListingStatus(
                    listing,
                    "PUBLISHED"
                  )
                }
                onWithdraw={() =>
                  updateListingStatus(
                    listing,
                    "WITHDRAWN"
                  )
                }
              />
            )
          )}

        {!loading &&
          !filteredListings.length &&
          !error && (
            <div className="operator-card operator-empty-state">
              <h3>
                No listings found
              </h3>

              <p>
                Create your first
                package listing to make
                it available in the
                catalogue.
              </p>

              <Link
                to="/operator/listings/new"
                className="operator-primary-btn"
              >
                Create Listing
              </Link>
            </div>
          )}
      </section>

      {/* =====================================================
          QUICK EDIT MODAL
      ====================================================== */}

      {quickEditListing && (
        <QuickEditListingModal
          listing={
            quickEditListing
          }
          onClose={() =>
            setQuickEditListing(
              null
            )
          }
          onDone={async () => {
            setQuickEditListing(
              null
            );

            await loadListings();
          }}
        />
      )}
    </div>
  );
}

// ===========================================================
// LISTING CARD
// ===========================================================

function ListingCard({
  listing,
  selected,
  onSelect,
  onQuickEdit,
  onPublish,
  onWithdraw,
}) {
  const category = String(
    listing.category || ""
  ).toUpperCase();

  const status = String(
    listing.status || ""
  ).toUpperCase();

  const primaryImage =
    listing.images?.find(
      (image) => image.isPrimary
    ) ||
    listing.images?.[0] ||
    null;

  const isCar =
    category === "CAR_RENTAL";

  const isTour =
    category === "TOUR";

  return (
    <article
      className={`operator-card operator-listing-card ${
        selected ? "selected" : ""
      }`}
    >

      {/* =====================================================
          IMAGE
      ====================================================== */}

      <div className="operator-listing-image-wrap">

        <label className="operator-listing-checkbox">
          <input
            type="checkbox"
            checked={selected}
            onChange={onSelect}
          />
        </label>

        {primaryImage?.imageUrl ? (
          <img
            src={
              primaryImage.imageUrl
            }
            alt={
              listing.name ||
              "Listing"
            }
            className="operator-listing-image"
          />
        ) : (
          <div className="operator-listing-image-placeholder">
            <div>
            <span className="operator-listing-placeholder-icon">
                {isCar ? "🚗" : isTour ? "🗺️" : "📦"}
            </span>

            <p>
                {isCar
                ? `${listing.vehicleMake || ""} ${
                    listing.vehicleModel || ""
                    }`
                : listing.name}
            </p>

            <small>Photo coming soon</small>
            </div>
        </div>
        )}

        <span
          className={`operator-listing-status ${getListingStatusClass(
            status
          )}`}
        >
          {getListingStatusLabel(
            status
          )}
        </span>
      </div>

      {/* =====================================================
          CONTENT
      ====================================================== */}

      <div className="operator-listing-card-body">

        <div className="operator-listing-card-head">

          <div>
            <span className="operator-listing-category">
              {getCategoryLabel(
                category
              )}
            </span>

            <h3>
              {listing.name ||
                getListingDisplayName(
                  listing
                )}
            </h3>

            <p>
              {listing.branch?.name ||
                "No branch"}
            </p>
          </div>

          <strong className="operator-listing-price">
            {formatOperatorMoney(
              listing.price
            )}
          </strong>
        </div>

        {/* CAR INFORMATION */}

        {isCar && (
          <div className="operator-listing-specs">

            <ListingSpec
              label="Make"
              value={
                listing.vehicleMake ||
                "-"
              }
            />

            <ListingSpec
              label="Model"
              value={
                listing.vehicleModel ||
                "-"
              }
            />

            <ListingSpec
              label="Seats"
              value={
                listing.seats
                  ? `${listing.seats}`
                  : "-"
              }
            />

            <ListingSpec
              label="Transmission"
              value={
                formatTransmission(
                  listing.transmission
                )
              }
            />
          </div>
        )}

        {/* TOUR INFORMATION */}

        {isTour && (
          <div className="operator-listing-specs">

            <ListingSpec
              label="Duration"
              value={
                listing.durationDays
                  ? `${listing.durationDays} days`
                  : "-"
              }
            />

            <ListingSpec
              label="Group Size"
              value={
                listing.maxGroupSize ||
                "-"
              }
            />

            <ListingSpec
              label="Meeting Point"
              value={
                listing.meetingPoint ||
                "-"
              }
            />
          </div>
        )}

        {/* =================================================
            ALLOCATION
        ================================================== */}

        <div className="operator-listing-allocation">

          <div>
            <span>
              Allocation
            </span>

            <strong>
              {listing.quantity ??
                0}
            </strong>
          </div>

          <div>
            <span>
              Available
            </span>

            <strong>
              {listing.availableQuantity ??
                listing.quantity ??
                0}
            </strong>
          </div>

          <div>
            <span>
              Reserved
            </span>

            <strong>
              {listing.reservedQuantity ??
                0}
            </strong>
          </div>
        </div>

        {/* =================================================
            ACTIONS
        ================================================== */}

        <div className="operator-listing-actions">

          <button
            type="button"
            className="operator-secondary-btn"
            onClick={
              onQuickEdit
            }
          >
            Quick Edit
          </button>

          <Link
            to={`/operator/listings/${listing.id}/edit`}
            className="operator-secondary-btn"
          >
            Edit
          </Link>

          {status !==
            "PUBLISHED" && (
            <button
              type="button"
              className="operator-primary-btn"
              onClick={
                onPublish
              }
            >
              Publish
            </button>
          )}

          {status ===
            "PUBLISHED" && (
            <button
              type="button"
              className="operator-danger-btn"
              onClick={
                onWithdraw
              }
            >
              Withdraw
            </button>
          )}
        </div>
      </div>
    </article>
  );
}

// ===========================================================
// QUICK EDIT
// ===========================================================

function QuickEditListingModal({
  listing,
  onClose,
  onDone,
}) {
  const [price, setPrice] =
    useState(
      listing.price || ""
    );

  const [quantity, setQuantity] =
    useState(
      listing.quantity || 1
    );

  const [loading, setLoading] =
    useState(false);

  const handleSave = async () => {
    const parsedPrice =
      Number(price);

    const parsedQuantity =
      Number(quantity);

    if (
      !Number.isFinite(
        parsedPrice
      ) ||
      parsedPrice <= 0
    ) {
      alert(
        "Enter a valid price."
      );

      return;
    }

    if (
      !Number.isInteger(
        parsedQuantity
      ) ||
      parsedQuantity < 0
    ) {
      alert(
        "Quantity must be zero or greater."
      );

      return;
    }

    try {
      setLoading(true);

      await operatorService.quickEditListing(
        listing.id,
        {
          price:
            parsedPrice,

          quantity:
            parsedQuantity,
        }
      );

      await onDone();
    } catch (err) {
      alert(
        err.response?.data?.message ||
          "Failed to update listing"
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="operator-modal-backdrop">
      <div className="operator-modal">

        <div className="operator-card-head">
          <div>
            <h2>
              Quick Edit
            </h2>

            <p>
              {listing.name ||
                getListingDisplayName(
                  listing
                )}
            </p>
          </div>

          <button
            type="button"
            onClick={onClose}
          >
            ×
          </button>
        </div>

        <label className="operator-field">
          Price

          <input
            type="number"
            min="0"
            step="0.01"
            value={price}
            onChange={(e) =>
              setPrice(
                e.target.value
              )
            }
          />
        </label>

        <label className="operator-field">
          Allocation / Quantity

          <input
            type="number"
            min="0"
            step="1"
            value={quantity}
            onChange={(e) =>
              setQuantity(
                e.target.value
              )
            }
          />
        </label>

        <div className="operator-modal-actions">

          <button
            type="button"
            className="operator-secondary-btn"
            onClick={onClose}
            disabled={loading}
          >
            Cancel
          </button>

          <button
            type="button"
            className="operator-primary-btn"
            onClick={handleSave}
            disabled={loading}
          >
            {loading
              ? "Saving..."
              : "Save Changes"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ===========================================================
// SMALL COMPONENTS
// ===========================================================

function ListingSpec({
  label,
  value,
}) {
  return (
    <div className="operator-listing-spec">
      <span>{label}</span>
      <strong>
        {value}
      </strong>
    </div>
  );
}

function getListingDisplayName(
  listing
) {
  if (
    listing.category ===
    "CAR_RENTAL"
  ) {
    return [
      listing.vehicleMake,
      listing.vehicleModel,
    ]
      .filter(Boolean)
      .join(" ");
  }

  return (
    listing.name ||
    "Tour Package"
  );
}

function getCategoryLabel(
  category
) {
  if (
    category ===
    "CAR_RENTAL"
  ) {
    return "Car Rental";
  }

  if (
    category === "TOUR"
  ) {
    return "Tour Package";
  }

  return category || "-";
}

function formatTransmission(
  value
) {
  if (!value) return "-";

  if (
    value === "AUTOMATIC"
  ) {
    return "Automatic";
  }

  if (
    value === "MANUAL"
  ) {
    return "Manual";
  }

  return value;
}

function getListingStatusLabel(
  status
) {
  const labels = {
    DRAFT: "Draft",
    PUBLISHED: "Published",
    WITHDRAWN: "Withdrawn",
  };

  return (
    labels[status] ||
    status ||
    "-"
  );
}

function getListingStatusClass(
  status
) {
  if (
    status === "PUBLISHED"
  ) {
    return "success";
  }

  if (
    status === "DRAFT"
  ) {
    return "warning";
  }

  if (
    status === "WITHDRAWN"
  ) {
    return "danger";
  }

  return "neutral";
}