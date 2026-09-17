import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  operatorService,
} from "../../services/operator_service";

const initialForm = {
  category: "CAR_RENTAL",
  branchId: "",

  name: "",
  description: "",

  price: "",
  quantity: 1,

  vehicleMake: "",
  vehicleModel: "",
  modelYear: "",
  seats: "",
  transmission: "AUTOMATIC",
  luggageCapacity: "",

  pickupRules: "",
  returnRules: "",
  insuranceInfo: "",

  durationDays: "",
  highlights: "",
  itinerary: "",
  inclusions: "",
  exclusions: "",
  cancellationPolicy: "",
  meetingPoint: "",
  maxGroupSize: "",

  refundPolicy: "",
  termsAndConditions: "",
};

export default function OperatorListingForm() {
  const navigate = useNavigate();

  const { id } = useParams();

  const isEdit = Boolean(id);

  const [form, setForm] =
    useState(initialForm);

  const [branches, setBranches] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [saving, setSaving] =
    useState(false);

  const [error, setError] =
    useState("");

  const [vehicleImages, setVehicleImages] =
    useState([]);

  const [selectedVehicleImage, setSelectedVehicleImage] =
    useState(null);

  const [loadingVehicleImages, setLoadingVehicleImages] =
    useState(false);

  const isCar =
    form.category === "CAR_RENTAL";

  const isTour =
    form.category === "TOUR";

  // =========================================================
  // LOAD PAGE
  // =========================================================

  useEffect(() => {
    loadPage();
  }, [id]);

  const loadPage = async () => {
    try {
      setLoading(true);
      setError("");

      const branchRes =
        await operatorService.getBranches();

      const branchList =
        branchRes.data?.branches || [];

      setBranches(branchList);

      if (!isEdit) {
        setForm((current) => ({
          ...current,
          branchId:
            current.branchId ||
            branchList[0]?.id ||
            "",
        }));

        return;
      }

      const listingRes =
        await operatorService.getListingById(id);

      const listing =
        listingRes.data?.listing;

      if (!listing) {
        setError("Listing not found");
        return;
      }

      setForm({
        category:
          listing.category ||
          "CAR_RENTAL",

        branchId:
          listing.branchId || "",

        name:
          listing.name || "",

        description:
          listing.description || "",

        price:
          listing.price ?? "",

        quantity:
          listing.quantity ?? 1,

        vehicleMake:
          listing.vehicleMake || "",

        vehicleModel:
          listing.vehicleModel || "",

        modelYear:
          listing.modelYear || "",

        seats:
          listing.seats || "",

        transmission:
          listing.transmission ||
          "AUTOMATIC",

        luggageCapacity:
          listing.luggageCapacity || "",

        pickupRules:
          listing.pickupRules || "",

        returnRules:
          listing.returnRules || "",

        insuranceInfo:
          listing.insuranceInfo || "",

        durationDays:
          listing.durationDays || "",

        highlights:
          normalizeJsonField(
            listing.highlights
          ),

        itinerary:
          normalizeJsonField(
            listing.itinerary
          ),

        inclusions:
          normalizeJsonField(
            listing.inclusions
          ),

        exclusions:
          normalizeJsonField(
            listing.exclusions
          ),

        cancellationPolicy:
          listing.cancellationPolicy ||
          "",

        meetingPoint:
          listing.meetingPoint || "",

        maxGroupSize:
          listing.maxGroupSize || "",

        refundPolicy:
          listing.refundPolicy || "",

        termsAndConditions:
          listing.termsAndConditions ||
          "",
      });
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load listing form"
      );
    } finally {
      setLoading(false);
    }
  };

  // =========================================================
  // FORM HANDLERS
  // =========================================================

  const handleChange = (event) => {
    const {
      name,
      value,
    } = event.target;

    setForm((current) => ({
      ...current,
      [name]: value,
    }));
  };

  const pageTitle =
    isEdit
      ? "Edit Listing"
      : "Create Listing";

  const activeBranches =
    useMemo(
      () =>
        branches.filter(
          (branch) =>
            branch.isActive !== false
        ),
      [branches]
    );

  // =========================================================
  // VALIDATION
  // =========================================================

  const validate = () => {
    if (!form.branchId) {
      return "Please select a branch.";
    }

    if (!form.name.trim()) {
      return "Listing name is required.";
    }

    if (
      !form.price ||
      Number(form.price) <= 0
    ) {
      return "Enter a valid price.";
    }

    if (
      !Number.isInteger(
        Number(form.quantity)
      ) ||
      Number(form.quantity) < 1
    ) {
      return "Quantity must be at least 1.";
    }

    if (isCar) {
      if (!form.vehicleMake.trim()) {
        return "Vehicle make is required.";
      }

      if (!form.vehicleModel.trim()) {
        return "Vehicle model is required.";
      }

      if (!form.transmission) {
        return "Transmission is required.";
      }
    }

    if (isTour) {
      if (
        !form.durationDays ||
        Number(form.durationDays) < 1
      ) {
        return "Tour duration must be at least 1 day.";
      }
    }

    return null;
  };

  // =========================================================
  // BUILD PAYLOAD
  // =========================================================

  const buildPayload = () => {
    const payload = {
      category:
        form.category,

      branchId:
        Number(form.branchId),

      name:
        form.name.trim(),

      description:
        form.description.trim() ||
        null,

      price:
        Number(form.price),

      quantity:
        Number(form.quantity),

      refundPolicy:
        form.refundPolicy.trim() ||
        null,

      termsAndConditions:
        form.termsAndConditions.trim() ||
        null,

      carsxeImageUrl:
        selectedVehicleImage?.url ||
        null,
    };

    if (isCar) {
      Object.assign(payload, {
        vehicleMake:
          form.vehicleMake.trim(),

        vehicleModel:
          form.vehicleModel.trim(),

        modelYear:
          form.modelYear
            ? Number(form.modelYear)
            : null,

        seats:
          form.seats
            ? Number(form.seats)
            : null,

        transmission:
          form.transmission,

        luggageCapacity:
          form.luggageCapacity
            ? Number(
                form.luggageCapacity
              )
            : null,

        pickupRules:
          form.pickupRules.trim() ||
          null,

        returnRules:
          form.returnRules.trim() ||
          null,

        insuranceInfo:
          form.insuranceInfo.trim() ||
          null,

        durationDays: null,
        highlights: null,
        itinerary: null,
        inclusions: null,
        exclusions: null,
        cancellationPolicy: null,
        meetingPoint: null,
        maxGroupSize: null,
      });
    }

    if (isTour) {
      Object.assign(payload, {
        durationDays:
          Number(form.durationDays),

        highlights:
          textToList(form.highlights),

        itinerary:
          textToList(form.itinerary),

        inclusions:
          textToList(form.inclusions),

        exclusions:
          textToList(form.exclusions),

        cancellationPolicy:
          form.cancellationPolicy.trim() ||
          null,

        meetingPoint:
          form.meetingPoint.trim() ||
          null,

        maxGroupSize:
          form.maxGroupSize
            ? Number(
                form.maxGroupSize
              )
            : null,

        vehicleMake: null,
        vehicleModel: null,
        modelYear: null,
        seats: null,
        transmission: null,
        luggageCapacity: null,
        pickupRules: null,
        returnRules: null,
        insuranceInfo: null,
      });
    }

    return payload;
  };

  //Implement Photo From CARSXE
  const findVehicleImages = async () => {
  if (!form.vehicleMake.trim()) {
    setError("Enter vehicle make first.");
    return;
  }

  if (!form.vehicleModel.trim()) {
    setError("Enter vehicle model first.");
    return;
  }

  try {
    setLoadingVehicleImages(true);
    setError("");

    const res =
      await operatorService.getVehicleImages({
        make: form.vehicleMake.trim(),
        model: form.vehicleModel.trim(),
        year:
          form.modelYear ||
          undefined,
      });

    const images =
      res.data?.images || [];

    setVehicleImages(images);

    if (!images.length) {
      setError(
        "No vehicle images were found for this make and model."
      );
    }
  } catch (err) {
    setError(
      err.response?.data?.message ||
        "Unable to find vehicle images."
    );
  } finally {
    setLoadingVehicleImages(false);
  }
};

  // =========================================================
  // SAVE
  // =========================================================

  const handleSubmit = async (
    event
  ) => {
    event.preventDefault();

    const validationError =
      validate();

    if (validationError) {
      setError(validationError);
      return;
    }

    try {
      setSaving(true);
      setError("");

      const payload =
        buildPayload();

      if (isEdit) {
        await operatorService.updateListing(
          id,
          payload
        );
      } else {
        await operatorService.createListing(
          payload
        );
      }

      navigate(
        "/operator/listings"
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          `Failed to ${
            isEdit
              ? "update"
              : "create"
          } listing`
      );
    } finally {
      setSaving(false);
    }
  };

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <div className="operator-page">
        <section className="operator-card operator-empty-state">
          Loading listing form...
        </section>
      </div>
    );
  }

  return (
    <div className="operator-page">

      <section className="operator-page-head">
        <div>
          <p className="operator-eyebrow">
            Catalogue Management
          </p>

          <h1>{pageTitle}</h1>

          <p>
            {isEdit
              ? "Update listing information, pricing, policies and allocation."
              : "Create a new car rental or tour package listing."}
          </p>
        </div>

        <button
          type="button"
          className="operator-secondary-btn"
          onClick={() =>
            navigate(
              "/operator/listings"
            )
          }
        >
          Back to Listings
        </button>
      </section>

      {error && (
        <div className="operator-alert danger">
          {error}
        </div>
      )}

      <form
        onSubmit={handleSubmit}
      >

        {/* ===================================================
            BASIC INFORMATION
        ==================================================== */}

        <section className="operator-card">
          <div className="operator-card-head">
            <div>
              <h2>
                Listing Information
              </h2>

              <p>
                Define the package type,
                branch and basic
                information.
              </p>
            </div>
          </div>

          <div className="operator-form-grid">

            <label className="operator-field">
              Listing Type *

              <select
                name="category"
                value={
                  form.category
                }
                onChange={
                  handleChange
                }
              >
                <option value="CAR_RENTAL">
                  Car Rental
                </option>

                <option value="TOUR">
                  Tour Package
                </option>
              </select>
            </label>

            <label className="operator-field">
              Branch *

              <select
                name="branchId"
                value={
                  form.branchId
                }
                onChange={
                  handleChange
                }
              >
                <option value="">
                  Select branch
                </option>

                {activeBranches.map(
                  (branch) => (
                    <option
                      key={
                        branch.id
                      }
                      value={
                        branch.id
                      }
                    >
                      {branch.name}
                    </option>
                  )
                )}
              </select>
            </label>

            <label className="operator-field operator-field-full">
              Listing Name *

              <input
                name="name"
                value={
                  form.name
                }
                onChange={
                  handleChange
                }
                placeholder={
                  isCar
                    ? "Example: Perodua Axia 1.0 G Automatic"
                    : "Example: Kuching Heritage Day Tour"
                }
              />
            </label>

            <label className="operator-field operator-field-full">
              Description

              <textarea
                name="description"
                rows="4"
                value={
                  form.description
                }
                onChange={
                  handleChange
                }
                placeholder="Describe the listing..."
              />
            </label>
          </div>
        </section>

        {/* ===================================================
            CAR DETAILS
        ==================================================== */}

        {isCar && (
          <section className="operator-card">
            <div className="operator-card-head">
              <div>
                <h2>
                  Vehicle Details
                </h2>

                <p>
                  Make and model are
                  structured fields for
                  customer filtering and
                  search.
                </p>
              </div>
            </div>

            <div className="operator-form-grid">

              <label className="operator-field">
                Make *

                <input
                  name="vehicleMake"
                  value={
                    form.vehicleMake
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Perodua"
                />
              </label>

              <label className="operator-field">
                Model *

                <input
                  name="vehicleModel"
                  value={
                    form.vehicleModel
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="Axia"
                />
              </label>

              <label className="operator-field">
                Model Year

                <input
                  type="number"
                  name="modelYear"
                  min="1990"
                  max="2100"
                  value={
                    form.modelYear
                  }
                  onChange={
                    handleChange
                  }
                />
              </label>

              <label className="operator-field">
                Seats

                <input
                  type="number"
                  name="seats"
                  min="1"
                  value={
                    form.seats
                  }
                  onChange={
                    handleChange
                  }
                />
              </label>

              <label className="operator-field">
                Transmission *

                <select
                  name="transmission"
                  value={
                    form.transmission
                  }
                  onChange={
                    handleChange
                  }
                >
                  <option value="AUTOMATIC">
                    Automatic
                  </option>

                  <option value="MANUAL">
                    Manual
                  </option>
                </select>
              </label>

              <label className="operator-field">
                Luggage Capacity

                <input
                  type="number"
                  name="luggageCapacity"
                  min="0"
                  value={
                    form.luggageCapacity
                  }
                  onChange={
                    handleChange
                  }
                  placeholder="2"
                />
              </label>
            </div>
          </section>
        )}

        {/* ===================================================
            TOUR DETAILS
        ==================================================== */}

        {isTour && (
          <section className="operator-card">
            <div className="operator-card-head">
              <div>
                <h2>
                  Tour Details
                </h2>
              </div>
            </div>

            <div className="operator-form-grid">

              <label className="operator-field">
                Duration (Days) *

                <input
                  type="number"
                  name="durationDays"
                  min="1"
                  value={
                    form.durationDays
                  }
                  onChange={
                    handleChange
                  }
                />
              </label>

              <label className="operator-field">
                Maximum Group Size

                <input
                  type="number"
                  name="maxGroupSize"
                  min="1"
                  value={
                    form.maxGroupSize
                  }
                  onChange={
                    handleChange
                  }
                />
              </label>

              <label className="operator-field operator-field-full">
                Meeting Point

                <input
                  name="meetingPoint"
                  value={
                    form.meetingPoint
                  }
                  onChange={
                    handleChange
                  }
                />
              </label>

              <ListField
                label="Highlights"
                name="highlights"
                value={
                  form.highlights
                }
                onChange={
                  handleChange
                }
              />

              <ListField
                label="Daily Itinerary"
                name="itinerary"
                value={
                  form.itinerary
                }
                onChange={
                  handleChange
                }
              />

              <ListField
                label="Inclusions"
                name="inclusions"
                value={
                  form.inclusions
                }
                onChange={
                  handleChange
                }
              />

              <ListField
                label="Exclusions"
                name="exclusions"
                value={
                  form.exclusions
                }
                onChange={
                  handleChange
                }
              />

              <label className="operator-field operator-field-full">
                Cancellation Policy

                <textarea
                  name="cancellationPolicy"
                  rows="4"
                  value={
                    form.cancellationPolicy
                  }
                  onChange={
                    handleChange
                  }
                />
              </label>
            </div>
          </section>
        )}

        {/* ===================================================
            PRICE / ALLOCATION
        ==================================================== */}

        <section className="operator-card">
          <div className="operator-card-head">
            <div>
              <h2>
                Pricing & Allocation
              </h2>

              <p>
                Quantity represents the
                number of identical units
                available under this
                listing.
              </p>
            </div>
          </div>

          <div className="operator-form-grid">

            <label className="operator-field">
              Price (RM) *

              <input
                type="number"
                name="price"
                min="0.01"
                step="0.01"
                value={
                  form.price
                }
                onChange={
                  handleChange
                }
              />
            </label>

            <label className="operator-field">
              Allocation / Quantity *

              <input
                type="number"
                name="quantity"
                min="1"
                step="1"
                value={
                  form.quantity
                }
                onChange={
                  handleChange
                }
              />
            </label>
          </div>
        </section>

        {/* ===================================================
            CAR POLICIES
        ==================================================== */}

        {isCar && (
          <section className="operator-card">
            <div className="operator-card-head">
              <div>
                <h2>
                  Rental Rules
                </h2>
              </div>
            </div>

            <div className="operator-form-grid">

              <label className="operator-field operator-field-full">
                Pickup Rules

                <textarea
                  name="pickupRules"
                  rows="3"
                  value={
                    form.pickupRules
                  }
                  onChange={
                    handleChange
                  }
                />
              </label>

              <label className="operator-field operator-field-full">
                Return Rules

                <textarea
                  name="returnRules"
                  rows="3"
                  value={
                    form.returnRules
                  }
                  onChange={
                    handleChange
                  }
                />
              </label>

              <label className="operator-field operator-field-full">
                Insurance Information

                <textarea
                  name="insuranceInfo"
                  rows="3"
                  value={
                    form.insuranceInfo
                  }
                  onChange={
                    handleChange
                  }
                />
              </label>
            </div>
          </section>
        )}

        {/* ===================================================
            COMMON POLICIES
        ==================================================== */}

        <section className="operator-card">
          <div className="operator-card-head">
            <div>
              <h2>
                Policies
              </h2>
            </div>
          </div>

          <div className="operator-form-grid">

            <label className="operator-field operator-field-full">
              Refund Policy

              <textarea
                name="refundPolicy"
                rows="3"
                value={
                  form.refundPolicy
                }
                onChange={
                  handleChange
                }
              />
            </label>

            <label className="operator-field operator-field-full">
              Terms & Conditions

              <textarea
                name="termsAndConditions"
                rows="4"
                value={
                  form.termsAndConditions
                }
                onChange={
                  handleChange
                }
              />
            </label>
          </div>
        </section>

        {/* ===================================================
            VEHICLE PHOTOS - CARSXE
        ==================================================== */}

        {isCar && (
        <section className="operator-card">
            <div className="operator-card-head">
            <div>
                <h2>
                Vehicle Photo
                </h2>

                <p>
                Find a representative vehicle photo
                automatically using the selected
                make, model and year.
                </p>
            </div>

            <button
                type="button"
                className="operator-secondary-btn"
                onClick={findVehicleImages}
                disabled={
                loadingVehicleImages
                }
            >
                {loadingVehicleImages
                ? "Finding Photos..."
                : "Find Vehicle Photos"}
            </button>
            </div>

            {vehicleImages.length > 0 ? (
            <div className="carsxe-image-grid">
                {vehicleImages.map(
                (image, index) => {
                    const selected =
                    selectedVehicleImage?.url ===
                    image.url;

                    return (
                    <button
                        key={`${image.url}-${index}`}
                        type="button"
                        className={`carsxe-image-option ${
                        selected
                            ? "selected"
                            : ""
                        }`}
                        onClick={() =>
                        setSelectedVehicleImage(
                            image
                        )
                        }
                    >
                        <img
                        src={
                            image.thumbnailUrl ||
                            image.url
                        }
                        alt={`${form.vehicleMake} ${form.vehicleModel}`}
                        />

                        <span>
                        {selected
                            ? "Selected"
                            : "Use Photo"}
                        </span>
                    </button>
                    );
                }
                )}
            </div>
            ) : (
            <div className="operator-empty-state">
                Enter vehicle make, model and
                optional year, then click
                "Find Vehicle Photos".
            </div>
            )}

            {selectedVehicleImage && (
            <div className="operator-selected-image-preview">
                <strong>
                Selected Photo
                </strong>

                <img
                src={selectedVehicleImage.url}
                alt={`${form.vehicleMake} ${form.vehicleModel}`}
                />
            </div>
            )}
        </section>
        )}

        {/* ===================================================
            ACTIONS
        ==================================================== */}

        <section className="operator-card">
          <div className="operator-form-actions">

            <button
              type="button"
              className="operator-secondary-btn"
              onClick={() =>
                navigate(
                  "/operator/listings"
                )
              }
              disabled={
                saving
              }
            >
              Cancel
            </button>

            <button
              type="submit"
              className="operator-primary-btn"
              disabled={
                saving
              }
            >
              {saving
                ? "Saving..."
                : isEdit
                ? "Save Changes"
                : "Create Listing"}
            </button>
          </div>
        </section>
      </form>
    </div>
  );
}

function ListField({
  label,
  name,
  value,
  onChange,
}) {
  return (
    <label className="operator-field operator-field-full">
      {label}

      <textarea
        name={name}
        rows="4"
        value={value}
        onChange={onChange}
        placeholder="Enter one item per line"
      />

      <small>
        Enter one item per line.
      </small>
    </label>
  );
}

function textToList(value) {
  return String(value || "")
    .split("\n")
    .map((item) =>
      item.trim()
    )
    .filter(Boolean);
}

function normalizeJsonField(value) {
  if (!value) return "";

  if (Array.isArray(value)) {
    return value.join("\n");
  }

  if (
    typeof value === "object"
  ) {
    return Object.values(value)
      .map(String)
      .join("\n");
  }

  return String(value);
}