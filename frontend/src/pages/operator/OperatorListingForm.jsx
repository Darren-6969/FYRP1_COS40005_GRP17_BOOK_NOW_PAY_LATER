import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  Link,
  useNavigate,
  useParams,
} from "react-router-dom";

import {
  operatorService,
} from "../../services/operator_service";
import { ImagePlus, Info, Search, Star, X } from "lucide-react";
import { useDirtyState } from "../../hooks/useDirtyState";
import { getUser } from "../../utils/session";

// The operator's type decides which listings it can create (the server
// checks it too, in operator_type_rules.js). Admins see every category.
// Sessions from before operator types existed count as car rental.
function sessionOperatorType() {
  const user = getUser();
  if (user?.role === "MASTER_SELLER") return null;
  return user?.operator?.operatorType || "CAR_RENTAL";
}

const CATEGORY_OPTIONS = {
  CAR_RENTAL: [
    { value: "CAR_RENTAL", label: "Car Rental" },
    { value: "TOUR", label: "Charter Tour (with your car)" },
    // TEST-ITEM-MISC: delete this option when testing is finished
    { value: "MISCELLANEOUS", label: "Miscellaneous (test item)" },
  ],
  TOUR_GUIDE: [{ value: "TOUR", label: "Tour Package" }],
  DRIVER: [],
};

const MAX_PHOTOS = 5;

const VEHICLE_TYPES = [
  ["COMPACT", "Compact"],
  ["HATCHBACK", "Hatchback"],
  ["SEDAN", "Sedan"],
  ["SUV", "SUV"],
  ["MPV", "MPV"],
  ["PICKUP", "Pickup"],
  ["VAN", "Van"],
];

// Behind the public Powertrain and Drivetrain filters.
const POWERTRAINS = [
  ["PETROL", "Petrol"],
  ["DIESEL", "Diesel"],
  ["HYBRID", "Hybrid"],
  ["EV", "Electric"],
];

const DRIVETRAINS = [
  ["TWO_WD", "2WD"],
  ["FOUR_WD", "4WD"],
  ["AWD", "AWD"],
];

const ALL_CATEGORY_OPTIONS = [
  { value: "CAR_RENTAL", label: "Car Rental" },
  { value: "TOUR", label: "Tour" },
  // TEST-ITEM-MISC: delete this option when testing is finished
  { value: "MISCELLANEOUS", label: "Miscellaneous (test item)" },
];

// "08:00, 13:00" -> ["08:00", "13:00"]; the server checks the format.
function textToTimes(value) {
  return String(value || "")
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

const initialForm = {
  category: "CAR_RENTAL",
  branchId: "",

  name: "",
  description: "",

  // Pricing
  hourlyRate: "",
  price: "", // Daily rate
  weeklyRate: "",
  monthlyRate: "",
  cdwDailyPrice: "",

  quantity: 1,

  vehicleMake: "",
  vehicleModel: "",
  vehicleType: "",
  modelYear: "",
  seats: "",
  transmission: "AUTOMATIC",
  luggageCapacity: "",
  powertrain: "",
  drivetrain: "",
  fuelPolicy: "",
  mileagePolicy: "UNLIMITED",
  mileageLimitKm: "",
  mileageExcessRate: "",
  travelArea: "",

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
  pickupTimes: "",

  refundPolicy: "",
  termsAndConditions: "",
};

export default function OperatorListingForm() {
  const navigate = useNavigate();

  const { id } = useParams();

  const isEdit = Boolean(id);

  const operatorType = sessionOperatorType();
  const categoryOptions = operatorType ? CATEGORY_OPTIONS[operatorType] || [] : ALL_CATEGORY_OPTIONS;
  const isGuide = operatorType === "TOUR_GUIDE";

  const [form, setForm] =
    useState(() => ({
      ...initialForm,
      // A tour guide can only list tours.
      category: categoryOptions[0]?.value || initialForm.category,
    }));

  // FR-SUB-004: an untouched edit form cannot be saved, so opening and saving
  // it does not count as activity.
  const { dirty, markClean } =
    useDirtyState(form);

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

  // Photos to add on save, in the order the operator arranged them: uploads
  // and stock photos together. The first is the cover on a new listing; when
  // editing they go after the current photos.
  const [pendingPhotos, setPendingPhotos] =
    useState([]);

  // Drag to reorder: the photo being dragged and the one it is over.
  const [dragPhoto, setDragPhoto] =
    useState({ from: null, over: null });

  const [listingImages, setListingImages] =
  useState([]);

  const [deletingImageId, setDeletingImageId] =
  useState(null);

  const [
    uploadingVehicleImage,
    setUploadingVehicleImage,
  ] = useState(false);

  const [loadingVehicleImages, setLoadingVehicleImages] =
    useState(false);

  const isCar =
    form.category === "CAR_RENTAL";

  const isTour =
    form.category === "TOUR";

  // A charter tour bundles the operator's car with the tour package, so it
  // lists the car too. Guides list the package only. (Admins: not enforced.)
  const isCharter =
    isTour && operatorType === "CAR_RENTAL";

  // Cars and charter tours can use the stock photo finder.
  const hasVehicle = isCar || isCharter;

  // TEST-ITEM-MISC: the fixed-price test item. Delete this line and every other
  // TEST-ITEM-MISC block in this file when testing is finished
  // (search for the tag; see backend/TEST_ITEM_MISCELLANEOUS.md).
  const isMisc =
    form.category === "MISCELLANEOUS";

  // =========================================================
  // LOAD PAGE
  // =========================================================

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

      setListingImages(
        listing.images || []
      );

      const loadedForm = {
        category:
          listing.category ||
          "CAR_RENTAL",

        branchId:
          listing.branchId || "",

        name:
          listing.name || "",

        description:
          listing.description || "",

        // =====================================================
        // Pricing
        // =====================================================

        hourlyRate:
          listing.hourlyRate ?? "",

        price:
          listing.price ?? "",

        weeklyRate:
          listing.weeklyRate ?? "",

        monthlyRate:
          listing.monthlyRate ?? "",

        cdwDailyPrice:
          listing.cdwDailyPrice ?? "",

        quantity:
          listing.quantity ?? 1,

        vehicleMake:
          listing.vehicleMake || "",

        vehicleModel:
          listing.vehicleModel || "",

        vehicleType:
          listing.vehicleType || "",

        modelYear:
          listing.modelYear || "",

        seats:
          listing.seats || "",

        transmission:
          listing.transmission ||
          "AUTOMATIC",

        luggageCapacity:
          listing.luggageCapacity || "",

        powertrain: listing.powertrain || "",
        drivetrain: listing.drivetrain || "",
        fuelPolicy: listing.fuelPolicy || "",
        mileagePolicy: listing.mileagePolicy || "UNLIMITED",
        mileageLimitKm: listing.mileageLimitKm ?? "",
        mileageExcessRate: listing.mileageExcessRate ?? "",
        travelArea: listing.travelArea || "",

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

        pickupTimes:
          (listing.pickupTimes || []).join(", "),

        refundPolicy:
          listing.refundPolicy || "",

        termsAndConditions:
          listing.termsAndConditions ||
          "",
      };

      setForm(loadedForm);

      // What is stored now. Saving stays disabled until the operator changes it.
      markClean(loadedForm);
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to load listing form"
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadPage();
  }, [id]);

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

    const [
      ratePreview,
      setRatePreview,
    ] = useState({
      samples: [],
      warnings: [],
      notes: [],
    });

    const [
      rateErrors,
      setRateErrors,
    ] = useState({});

    const [
      previewLoading,
      setPreviewLoading,
    ] = useState(false);

    useEffect(() => {
  if (
    !isCar ||
    !form.price
  ) {
    setRatePreview({
      samples: [],
      warnings: [],
      notes: [],
    });

    setRateErrors({});

    return;
  }

  const timer =
        setTimeout(
          async () => {
            try {
              setPreviewLoading(true);

              setRateErrors({});

              const { data } =
                await operatorService
                  .previewListingRates({
                    price:
                      form.price,

                    hourlyRate:
                      form.hourlyRate,

                    weeklyRate:
                      form.weeklyRate,

                    monthlyRate:
                      form.monthlyRate,
                  });

              setRatePreview({
                samples:
                  data.samples || [],

                warnings:
                  data.warnings || [],

                notes:
                  data.notes || [],
              });
            } catch (err) {
              if (
                err.response?.status ===
                400
              ) {
                setRateErrors(
                  err.response?.data
                    ?.errors || {}
                );

                setRatePreview({
                  samples: [],
                  warnings: [],
                  notes: [],
                });

                return;
              }

              setRatePreview({
                samples: [],
                warnings: [],
                notes: [],
              });
            } finally {
              setPreviewLoading(
                false
              );
            }
          },
          300
        );

      return () =>
        clearTimeout(timer);
    }, [
      isCar,
      form.price,
      form.hourlyRate,
      form.weeklyRate,
      form.monthlyRate,
    ]);

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
      return isMisc || isTour ? "Enter a valid price." : "Enter a valid daily rate."; // TEST-ITEM-MISC
    }

    if (isCar) {
  const optionalRates = [
    ["Hourly rate", form.hourlyRate],
    ["Weekly rate", form.weeklyRate],
    ["Monthly rate", form.monthlyRate],
    ["CDW daily price", form.cdwDailyPrice],
  ];

  for (const [label, value] of optionalRates) {
    if (
      value !== "" &&
      (
        !Number.isFinite(Number(value)) ||
        Number(value) < 0
      )
    ) {
      return `${label} must be 0 or greater.`;
    }
  }
}

    // TEST-ITEM-MISC: the test item has no quantity (it is always 1)
    if (
      !isMisc &&
      (
        !Number.isInteger(
          Number(form.quantity)
        ) ||
        Number(form.quantity) < 1
      )
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

      if (!form.vehicleType) {
        return "Vehicle type is required.";
      }

      if (!form.transmission) {
        return "Transmission is required.";
      }

      // Customers filter by these, so a car without them would be hidden.
      if (!form.powertrain) {
        return "Powertrain is required.";
      }

      if (!form.drivetrain) {
        return "Drivetrain is required.";
      }

      if (form.mileagePolicy === "LIMITED") {
        const limit = Number(form.mileageLimitKm);
        if (!Number.isInteger(limit) || limit < 1) {
          return "Enter the daily mileage allowance in km.";
        }

        if (
          form.mileageExcessRate !== "" &&
          (!Number.isFinite(Number(form.mileageExcessRate)) || Number(form.mileageExcessRate) < 0)
        ) {
          return "The charge per extra km must be 0 or more.";
        }
      }
    }

    if (isTour) {
      if (
        !form.durationDays ||
        Number(form.durationDays) < 1
      ) {
        return "Tour duration must be at least 1 day.";
      }

      if (
        !Number.isInteger(Number(form.maxGroupSize)) ||
        Number(form.maxGroupSize) < 1
      ) {
        return "Enter the maximum number of passengers.";
      }

      if (isCharter) {
        if (!form.vehicleMake.trim() || !form.vehicleModel.trim()) {
          return "Enter the make and model of the car used for this tour.";
        }

        if (!form.vehicleType) {
          return "Choose the vehicle type of the car used for this tour.";
        }

        const seats = Number(form.seats);
        if (!Number.isInteger(seats) || seats < 2) {
          return "Enter the number of seats in the car, including the driver.";
        }

        if (Number(form.maxGroupSize) > seats - 1) {
          return `The car has ${seats} seats, so it takes up to ${seats - 1} passengers besides the driver.`;
        }
      }

      const badTime = textToTimes(form.pickupTimes).find(
        (time) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(time)
      );
      if (badTime) {
        return `Pickup time "${badTime}" must be in HH:mm format, for example 08:30.`;
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

      imageUrls:
        pendingPhotos.map((photo) => photo.url),
    };

    if (isCar) {
      Object.assign(payload, {

        hourlyRate:
          form.hourlyRate !== ""
            ? Number(form.hourlyRate)
            : null,

        weeklyRate:
          form.weeklyRate !== ""
            ? Number(form.weeklyRate)
            : null,

        monthlyRate:
          form.monthlyRate !== ""
            ? Number(form.monthlyRate)
            : null,

        cdwDailyPrice:
          form.cdwDailyPrice !== ""
            ? Number(form.cdwDailyPrice)
            : null,

        vehicleMake:
          form.vehicleMake.trim(),

        vehicleModel:
          form.vehicleModel.trim(),

        vehicleType:
          form.vehicleType,

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

        powertrain: form.powertrain,
        drivetrain: form.drivetrain,
        fuelPolicy: form.fuelPolicy || null,
        mileagePolicy: form.mileagePolicy,
        mileageLimitKm:
          form.mileagePolicy === "LIMITED" ? Number(form.mileageLimitKm) : null,
        mileageExcessRate:
          form.mileagePolicy === "LIMITED" && form.mileageExcessRate !== ""
            ? Number(form.mileageExcessRate)
            : null,
        travelArea: form.travelArea.trim() || null,

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

        pickupTimes:
          textToTimes(form.pickupTimes),

        // A charter tour lists the car it uses; a guide package has none.
        vehicleMake: isCharter ? form.vehicleMake.trim() : null,
        vehicleModel: isCharter ? form.vehicleModel.trim() : null,
        vehicleType: isCharter ? form.vehicleType : null,
        modelYear: isCharter && form.modelYear ? Number(form.modelYear) : null,
        seats: isCharter && form.seats ? Number(form.seats) : null,
        transmission: null,
        luggageCapacity: null,
        pickupRules: null,
        returnRules: null,
        insuranceInfo: null,
      });
    }

    // TEST-ITEM-MISC: a fixed price and nothing else. Delete this block when testing is
    // finished.
    if (isMisc) {
      Object.assign(payload, {
        quantity: 1,
        hourlyRate: null,
        weeklyRate: null,
        monthlyRate: null,
        cdwDailyPrice: null,
        refundPolicy: null,
        termsAndConditions: null,
      });
    }

    return payload;
  };

  // Room left for new photos (up to 5 per listing, counting saved ones).
  const photoRoom =
    MAX_PHOTOS -
    (isEdit ? listingImages.length : 0) -
    pendingPhotos.length;

  const addPendingPhoto = (photo) =>
    setPendingPhotos((current) =>
      current.some((item) => item.url === photo.url) ||
      current.length + (isEdit ? listingImages.length : 0) >= MAX_PHOTOS
        ? current
        : [...current, photo]
    );

  const removePendingPhoto = (url) =>
    setPendingPhotos((current) => current.filter((item) => item.url !== url));

  // Moves a photo from one place in the list to another.
  const movePendingPhoto = (from, to) =>
    setPendingPhotos((current) => {
      if (from === null || to < 0 || to >= current.length || to === from) return current;
      const next = [...current];
      const [photo] = next.splice(from, 1);
      next.splice(to, 0, photo);
      return next;
    });

  const endPhotoDrag = () => setDragPhoto({ from: null, over: null });

  // Keyboard alternative to dragging: arrow keys move the focused photo, and
  // focus follows it to its new place.
  const handlePhotoKeyDown = (event, index, url) => {
    const step = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1 }[event.key];
    const to = event.key === "Home" ? 0 : event.key === "End" ? pendingPhotos.length - 1 : step ? index + step : null;
    if (to === null) return;
    event.preventDefault();
    movePendingPhoto(index, to);
    window.requestAnimationFrame(() => {
      document.querySelector(`[data-photo-url="${CSS.escape(url)}"]`)?.focus();
    });
  };

  const toggleStockPhoto = (image) => {
    if (pendingPhotos.some((item) => item.url === image.url)) {
      removePendingPhoto(image.url);
    } else if (photoRoom > 0) {
      addPendingPhoto({ url: image.url, thumbnailUrl: image.thumbnailUrl || image.url, source: "stock" });
    } else {
      setError(`A listing can have up to ${MAX_PHOTOS} photos. Remove one first.`);
    }
  };

  const uploadOwnVehicleImage =
  async (event) => {
    const allowedTypes = [
      "image/png",
      "image/jpeg",
      "image/webp",
    ];

    const files = Array.from(event.target.files || []);
    event.target.value = "";
    if (!files.length) {
      return;
    }

    if (files.length > photoRoom) {
      setError(
        photoRoom > 0
          ? `You can add ${photoRoom} more photo${photoRoom === 1 ? "" : "s"}. Only the first ${photoRoom} were added.`
          : `A listing can have up to ${MAX_PHOTOS} photos. Remove one first.`
      );
    } else {
      setError("");
    }

    const accepted = [];
    for (const file of files.slice(0, Math.max(0, photoRoom))) {
      if (!allowedTypes.includes(file.type)) {
        setError(`${file.name} is not a PNG, JPG or WebP image.`);
        continue;
      }
      if (file.size > 5 * 1024 * 1024) {
        setError(`${file.name} is over 5 MB.`);
        continue;
      }
      accepted.push(file);
    }

    if (!accepted.length) return;

    try {
      setUploadingVehicleImage(
        true
      );

      // One at a time, so the photos keep the order they were picked in.
      for (const file of accepted) {
        const res =
          await operatorService.uploadListingImage(
            file
          );
        addPendingPhoto({ url: res.data.url, thumbnailUrl: res.data.url, source: "upload" });
      }
    } catch (err) {
      setError(
        err.response?.data
          ?.message ||
          "Failed to upload a photo. Try again."
      );
    } finally {
      setUploadingVehicleImage(
        false
      );
    }
  };

  const handleDeleteListingImage =
  async (imageId) => {
    const confirmed =
      window.confirm(
        "Remove this photo from the listing?"
      );

    if (!confirmed) {
      return;
    }

    try {
      setDeletingImageId(imageId);
      setError("");

      const res =
        await operatorService
          .deleteListingImage(
            id,
            imageId
          );

      setListingImages(
        res.data?.listing?.images || []
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to remove listing photo."
      );
    } finally {
      setDeletingImageId(null);
    }
  };


  const handleImagePositionChange =
  async (imageId, newPosition) => {
    const newIndex =
      Number(newPosition) - 1;

    const currentIndex =
      listingImages.findIndex(
        (image) =>
          image.id === imageId
      );

    if (
      currentIndex === -1 ||
      currentIndex === newIndex
    ) {
      return;
    }

    const reordered =
      [...listingImages];

    const [movedImage] =
      reordered.splice(
        currentIndex,
        1
      );

    reordered.splice(
      newIndex,
      0,
      movedImage
    );

    try {
      setError("");

      const payload =
        reordered.map(
          (image, index) => ({
            id: image.id,
            sortOrder: index,
          })
        );

      const res =
        await operatorService
          .reorderListingImages(
            id,
            payload
          );

      setListingImages(
        res.data?.listing?.images ||
          reordered
      );
    } catch (err) {
      setError(
        err.response?.data?.message ||
          "Failed to reorder photos."
      );
    }
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
        if (
          err.response?.status === 400 &&
          err.response?.data?.errors
        ) {
          setRateErrors(
            err.response.data.errors
          );

          setError(
            err.response.data.message ||
              "Some rates are not valid."
          );

          return;
        }

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
                {categoryOptions.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
              {operatorType === "DRIVER" && (
                <small>
                  Driver listings are not open yet. We will let you know when you can add one.
                </small>
              )}
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
                    : isMisc // TEST-ITEM-MISC
                      ? "Example: Test item"
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
              Vehicle Type *

              <select
                name="vehicleType"
                value={
                  form.vehicleType
                }
                onChange={
                  handleChange
                }
              >
                <option value="">
                  Select vehicle type
                </option>

                <option value="COMPACT">
                  Compact
                </option>

                <option value="HATCHBACK">
                  Hatchback
                </option>

                <option value="SEDAN">
                  Sedan
                </option>

                <option value="SUV">
                  SUV
                </option>

                <option value="MPV">
                  MPV
                </option>

                <option value="PICKUP">
                  Pickup
                </option>

                <option value="VAN">
                  Van
                </option>
              </select>
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

              <label className="operator-field">
                Powertrain *

                <select name="powertrain" value={form.powertrain} onChange={handleChange}>
                  <option value="">Select powertrain</option>
                  {POWERTRAINS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <small className="listing-help">Customers filter by this.</small>
              </label>

              <label className="operator-field">
                Drivetrain *

                <select name="drivetrain" value={form.drivetrain} onChange={handleChange}>
                  <option value="">Select drivetrain</option>
                  {DRIVETRAINS.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
                <small className="listing-help">Customers filter by this. AWD shows under 4WD.</small>
              </label>
            </div>
          </section>
        )}

        {/* ===================================================
            CHARTER TOUR VEHICLE (car + tour package bundle)
        ==================================================== */}

        {isCharter && (
          <section className="operator-card">
            <div className="operator-card-head">
              <div>
                <h2>Car for this Tour</h2>
                <p>
                  The car customers ride in. A charter tour is your car, a driver and the tour package together,
                  priced per car.
                </p>
              </div>
            </div>

            <div className="operator-form-grid">
              <label className="operator-field">
                Make *
                <input name="vehicleMake" value={form.vehicleMake} onChange={handleChange} placeholder="Toyota" />
              </label>

              <label className="operator-field">
                Model *
                <input name="vehicleModel" value={form.vehicleModel} onChange={handleChange} placeholder="Innova" />
              </label>

              <label className="operator-field">
                Vehicle Type *
                <select name="vehicleType" value={form.vehicleType} onChange={handleChange}>
                  <option value="">Select vehicle type</option>
                  {VEHICLE_TYPES.map(([value, label]) => (
                    <option key={value} value={value}>
                      {label}
                    </option>
                  ))}
                </select>
              </label>

              <label className="operator-field">
                Model Year
                <input
                  type="number"
                  name="modelYear"
                  min="1990"
                  max="2100"
                  value={form.modelYear}
                  onChange={handleChange}
                  placeholder="2022"
                />
              </label>

              <label className="operator-field">
                Seats, including the driver *
                <input
                  type="number"
                  name="seats"
                  min="2"
                  max="60"
                  value={form.seats}
                  onChange={handleChange}
                  placeholder="7"
                />
                <small>Maximum passengers can be at most seats minus one.</small>
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
                Maximum Passengers *

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

              <label className="operator-field">
                Pickup Times

                <input
                  name="pickupTimes"
                  value={form.pickupTimes}
                  onChange={handleChange}
                  placeholder="Example: 08:00, 13:00"
                />
                <small>
                  Times customers can choose, in 24-hour format. Leave empty to let the customer suggest a time.
                </small>
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
                <small>
                  Pickup points and their charges come from the branch, on the Branches page.
                </small>
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
        {isCar
          ? "Set rental rates and the number of cars available under this listing."
          : isMisc // TEST-ITEM-MISC
            ? "Set the fixed price of the item."
            : "Set the package price and available quantity."}
      </p>
    </div>
  </div>

  <div className="operator-form-grid">

    {/* ===============================================
        CAR RENTAL PRICING
    =============================================== */}

    {isCar && (
      <>
        <label className="operator-field">
          Hourly Rate (RM)

          <input
            type="number"
            name="hourlyRate"
            min="0.01"
            step="0.01"
            value={form.hourlyRate}
            onChange={handleChange}
            placeholder="Example: 15.00"
          />

          {rateErrors.hourlyRate && (
            <small className="operator-rate-error">
              {rateErrors.hourlyRate}
            </small>
          )}
        </label>

        <label className="operator-field">
          Daily Rate (RM) *

          <input
            type="number"
            name="price"
            min="0.01"
            step="0.01"
            value={form.price}
            onChange={handleChange}
            placeholder="Example: 120.00"
          />

          {rateErrors.price && (
            <small className="operator-rate-error">
              {rateErrors.price}
            </small>
          )}
        </label>

        <label className="operator-field">
          Weekly Rate (RM)

          <input
            type="number"
            name="weeklyRate"
            min="0.01"
            step="0.01"
            value={form.weeklyRate}
            onChange={handleChange}
            placeholder="Example: 700.00"
          />

          {rateErrors.weeklyRate && (
            <small className="operator-rate-error">
              {rateErrors.weeklyRate}
            </small>
          )}
        </label>

        <label className="operator-field">
          Monthly Rate (RM)

          <input
            type="number"
            name="monthlyRate"
            min="0.01"
            step="0.01"
            value={form.monthlyRate}
            onChange={handleChange}
            placeholder="Example: 2400.00"
          />

          {rateErrors.monthlyRate && (
            <small className="operator-rate-error">
              {rateErrors.monthlyRate}
            </small>
          )}
        </label>

        <label className="operator-field">
          CDW Price / Day (RM)

          <input
            type="number"
            name="cdwDailyPrice"
            min="0.01"
            step="0.01"
            value={form.cdwDailyPrice}
            onChange={handleChange}
            placeholder="Example: 25.00"
          />

          {rateErrors.cdwDailyPrice && (
            <small className="operator-rate-error">
              {rateErrors.cdwDailyPrice}
            </small>
          )}
        </label>
      </>
    )}

    {/* ===============================================
        TOUR PRICE
    =============================================== */}

    {isTour && (
      <label className="operator-field">
        {isGuide ? "Package Price (RM) *" : "Price per Car (RM) *"}

        <input
          type="number"
          name="price"
          min="0.01"
          step="0.01"
          value={form.price}
          onChange={handleChange}
        />

        <small>
          One price for the whole group, up to the maximum passengers. Never per person.
        </small>

        {rateErrors.price && (
          <small className="operator-rate-error">
            {rateErrors.price}
          </small>
        )}
      </label>
    )}

    {/* ===============================================
        TEST-ITEM-MISC: FIXED PRICE (delete this block when testing is finished)
    =============================================== */}

    {isMisc && (
      <label className="operator-field">
        Fixed Price (RM) *

        <input
          type="number"
          name="price"
          min="0.01"
          step="0.01"
          value={form.price}
          onChange={handleChange}
          placeholder="Example: 10.00"
        />

        {rateErrors.price && (
          <small className="operator-rate-error">
            {rateErrors.price}
          </small>
        )}
      </label>
    )}

    {/* ===============================================
        QUANTITY
    =============================================== */}

    {/* TEST-ITEM-MISC: the test item has no quantity, so this field is hidden for it */}
    {!isMisc && (

    <label className="operator-field">
      {isCar
        ? "Car Count *"
        : isTour
          ? "Groups per Day *"
          : "Allocation / Quantity *"}

      <input
        type="number"
        name="quantity"
        min="1"
        step="1"
        value={form.quantity}
        onChange={handleChange}
      />
    </label>
    )}
  </div>

  {/* ===============================================
      SERVER PRICE PREVIEW
  =============================================== */}

  {isCar && (
    <div className="operator-rate-preview">
      <h3>
        Duration Price Preview
      </h3>

      <p>
        Estimated base rental price using
        the rates entered above.
      </p>

      {!form.price && (
        <div className="operator-empty-state">
          Enter a daily rate to see the
          price preview.
        </div>
      )}

      {previewLoading && form.price && (
        <p>
          Calculating prices...
        </p>
      )}

      {!previewLoading &&
        ratePreview.samples.length > 0 && (
          <div className="operator-rate-preview-grid">
            {ratePreview.samples.map(
              (sample) => (
                <div
                  key={sample.key}
                  className="operator-rate-preview-item"
                >
                  <span>
                    {sample.label}
                  </span>

                  <strong>
                    RM {sample.total}
                  </strong>
                </div>
              )
            )}
          </div>
        )}

      {ratePreview.warnings.map(
        (warning) => (
          <div
            key={warning.code}
            className="operator-rate-warning"
          >
            {warning.message}
          </div>
        )
      )}

      {ratePreview.notes.map(
        (note) => (
          <p
            key={note.code}
            className="operator-rate-note"
          >
            {note.message}
          </p>
        )
      )}

      {form.cdwDailyPrice !== "" && (
        <p className="operator-rate-note">
          CDW is optional and is not included
          in the base rental preview. Current
          CDW rate:{" "}
          <strong>
            RM{" "}
            {Number(
              form.cdwDailyPrice
            ).toFixed(2)}
            {" / day"}
          </strong>
        </p>
      )}
    </div>
  )}
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

              <label className="operator-field">
                Fuel Policy

                <select name="fuelPolicy" value={form.fuelPolicy} onChange={handleChange}>
                  <option value="">Not set (customers are told to ask you)</option>
                  <option value="FULL_TO_FULL">Full to full</option>
                  <option value="SAME_TO_SAME">Same to same</option>
                </select>
              </label>

              <label className="operator-field">
                Mileage *

                <select name="mileagePolicy" value={form.mileagePolicy} onChange={handleChange}>
                  <option value="UNLIMITED">Unlimited</option>
                  <option value="LIMITED">Limited per day</option>
                </select>
                <small className="listing-help">
                  Unlimited shows an "Unlimited mileage" badge on the car.
                </small>
              </label>

              {form.mileagePolicy === "LIMITED" && (
                <>
                  <label className="operator-field">
                    Daily Allowance (km) *

                    <input
                      type="number"
                      name="mileageLimitKm"
                      min="1"
                      step="1"
                      value={form.mileageLimitKm}
                      onChange={handleChange}
                      placeholder="300"
                    />
                  </label>

                  <label className="operator-field">
                    Charge per Extra km (RM)

                    <input
                      type="number"
                      name="mileageExcessRate"
                      min="0"
                      step="0.01"
                      value={form.mileageExcessRate}
                      onChange={handleChange}
                      placeholder="0.60"
                    />
                    <small className="listing-help">Leave empty to say customers should ask you.</small>
                  </label>
                </>
              )}

              <label className="operator-field operator-field-full">
                Travel Area

                <input
                  name="travelArea"
                  maxLength={500}
                  value={form.travelArea}
                  onChange={handleChange}
                  placeholder="Example: Anywhere in Sarawak. Not allowed into Sabah or Brunei."
                />
              </label>

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

        {/* TEST-ITEM-MISC: the test item has no policies, so this section is hidden for it */}
        {!isMisc && (
        <section className="operator-card">
          <div className="operator-card-head">
            <div>
              <h2>
                Policies
              </h2>
            </div>
          </div>

          <div className="operator-form-grid">

            <div className="operator-field-full listing-callout" role="note">
              <Info size={18} aria-hidden="true" className="listing-callout-icon" />
              <div>
                <strong>Refunds follow your shop rule</strong>
                <p>
                  {isTour
                    ? "For tours you keep the down payment when a customer cancels, and any balance they paid is refunded in full."
                    : "By default you keep the deposit when a customer cancels, and any balance they paid is refunded in full."}{" "}
                  {isCar && (
                    <>
                      Change the deposit rule in <Link to="/operator/settings">Shop Settings</Link>.
                    </>
                  )}
                </p>
              </div>
            </div>

            <label className="operator-field operator-field-full" htmlFor="listing-terms">
              Terms & Conditions

              <textarea
                id="listing-terms"
                name="termsAndConditions"
                rows="4"
                value={
                  form.termsAndConditions
                }
                onChange={
                  handleChange
                }
                placeholder={
                  isTour
                    ? "Example: Children under 3 travel free on a lap. Smoking is not allowed in the car."
                    : "Example: No pets. A cleaning fee applies if the car is returned very dirty."
                }
              />
              <small className="listing-help">
                Customers see these before they send a request and accept them when they book.
              </small>
            </label>
          </div>
        </section>
        )}

        {/* ===================================================
            PHOTOS: upload your own, or (cars and charter tours)
            find a stock photo of the model
        ==================================================== */}

        <section className="operator-card" aria-labelledby="listing-photos-h">
          <div className="operator-card-head">
            <div>
              <h2 id="listing-photos-h">Photos</h2>
              <p>
                {isMisc /* TEST-ITEM-MISC */
                  ? "Add a photo of the item."
                  : isTour
                    ? isCharter
                      ? "Show the places on the tour and the car customers ride in. The first photo is the cover."
                      : "Show the places on the tour. The first photo is the cover."
                    : "Your own photos of this exact car work best. The first photo is the cover."}
              </p>
            </div>
            {isEdit && (
              <span className="listing-photo-count">
                {listingImages.length} of {MAX_PHOTOS} photos
              </span>
            )}
          </div>

          {photoRoom > 0 && (
            <label className={`listing-dropzone ${uploadingVehicleImage ? "is-busy" : ""}`}>
              <input
                type="file"
                accept=".jpg,.jpeg,.png,.webp,image/jpeg,image/png,image/webp"
                onChange={uploadOwnVehicleImage}
                disabled={uploadingVehicleImage}
                multiple
                className="listing-dropzone-input"
              />
              <span className="listing-dropzone-icon" aria-hidden="true">
                <ImagePlus size={26} />
              </span>
              <span className="listing-dropzone-title">
                {uploadingVehicleImage ? "Uploading photos..." : "Choose photos to upload"}
              </span>
              <span className="listing-dropzone-meta">
                PNG, JPG or WebP, up to 5 MB each. You can add {photoRoom} more.
              </span>
            </label>
          )}

          {pendingPhotos.length > 0 && (
            <div className="listing-pending">
              <p className="listing-pending-title" id="listing-pending-title">
                {isEdit
                  ? "New photos, added after your current photos when you save"
                  : "Your photos, in the order customers see them"}
              </p>
              <p className="listing-help" id="listing-pending-hint">
                Drag a photo to move it. With the keyboard, focus a photo and use the arrow keys.
              </p>
              <ol className="listing-photo-grid" aria-labelledby="listing-pending-title">
                {pendingPhotos.map((photo, index) => {
                  const position = (isEdit ? listingImages.length : 0) + index + 1;
                  const cover = position === 1;
                  const dragging = dragPhoto.from === index;
                  const dropTarget = dragPhoto.over === index && dragPhoto.from !== null && !dragging;
                  return (
                    <li
                      key={photo.url}
                      data-photo-url={photo.url}
                      className={[
                        "listing-photo-card",
                        cover ? "is-cover" : "",
                        dragging ? "is-dragging" : "",
                        dropTarget ? "is-drop-target" : "",
                      ].join(" ")}
                      draggable
                      tabIndex={0}
                      aria-label={`Photo ${position}${cover ? ", cover" : ""}${photo.source === "stock" ? ", stock photo" : ""}`}
                      aria-describedby="listing-pending-hint"
                      onKeyDown={(event) => handlePhotoKeyDown(event, index, photo.url)}
                      onDragStart={(event) => {
                        event.dataTransfer.effectAllowed = "move";
                        event.dataTransfer.setData("text/plain", photo.url);
                        setDragPhoto({ from: index, over: index });
                      }}
                      onDragOver={(event) => {
                        event.preventDefault();
                        event.dataTransfer.dropEffect = "move";
                        if (dragPhoto.over !== index) setDragPhoto((d) => ({ ...d, over: index }));
                      }}
                      onDrop={(event) => {
                        event.preventDefault();
                        movePendingPhoto(dragPhoto.from, index);
                        endPhotoDrag();
                      }}
                      onDragEnd={endPhotoDrag}
                    >
                      <img src={photo.thumbnailUrl || photo.url} alt="" draggable={false} />
                      <span className="listing-photo-badge">
                        {position}
                        {cover ? " · Cover" : ""}
                        {photo.source === "stock" ? " · Stock" : ""}
                      </span>
                      <div className="listing-photo-actions">
                        {!isEdit && !cover && (
                          <button
                            type="button"
                            className="listing-photo-action"
                            onClick={() => movePendingPhoto(index, 0)}
                            aria-label={`Make photo ${position} the cover`}
                            title="Make cover"
                          >
                            <Star size={16} aria-hidden="true" />
                          </button>
                        )}
                        <button
                          type="button"
                          className="listing-photo-action listing-photo-action-danger"
                          onClick={() => removePendingPhoto(photo.url)}
                          aria-label={`Remove photo ${position}`}
                          title="Remove"
                        >
                          <X size={16} aria-hidden="true" />
                        </button>
                      </div>
                    </li>
                  );
                })}
              </ol>
            </div>
          )}

          {isEdit && listingImages.length > 0 && (
          <div className="operator-listing-image-grid">
            {listingImages.map((image, index) => (
              <div
                key={image.id}
                className="operator-listing-image-card"
              >
                <img
                  src={image.imageUrl}
                  alt={`Listing photo ${index + 1}`}
                  className="operator-listing-image-preview"
                />

                <div className="operator-listing-image-info">
                  <div>
                    <label className="operator-image-label" htmlFor={`photo-position-${image.id}`}>
                      Photo position
                    </label>

                    <select
                      id={`photo-position-${image.id}`}
                      value={index + 1}
                      onChange={(event) =>
                        handleImagePositionChange(
                          image.id,
                          event.target.value
                        )
                      }
                      className="operator-image-position-select"
                    >
                      {listingImages.map(
                        (_, positionIndex) => (
                          <option
                            key={positionIndex}
                            value={positionIndex + 1}
                          >
                            Position {positionIndex + 1}
                          </option>
                        )
                      )}
                    </select>
                  </div>

                  <div className="operator-image-status">
                    <span className="operator-image-label">
                      Status
                    </span>

                    {image.isPrimary ? (
                      <span className="operator-primary-badge">
                        Cover
                      </span>
                    ) : (
                      <span className="operator-secondary-badge">
                        Extra
                      </span>
                    )}
                  </div>
                </div>

                <button
                  type="button"
                  className="operator-image-remove-btn"
                  disabled={
                    deletingImageId === image.id
                  }
                  onClick={() =>
                    handleDeleteListingImage(
                      image.id
                    )
                  }
                >
                  {deletingImageId === image.id
                    ? "Removing..."
                    : "Remove Photo"}
                </button>
              </div>
            ))}
          </div>
          )}

          {hasVehicle && (
            <div className="listing-stock-photos">
              <div className="listing-divider" role="separator">
                <span>or use a stock photo of the model</span>
              </div>

              <div className="listing-stock-head">
                <p className="listing-help">
                  {form.vehicleMake && form.vehicleModel
                    ? `Search photos of the ${[form.modelYear, form.vehicleMake, form.vehicleModel].filter(Boolean).join(" ")}.`
                    : "Enter the make and model above first."}
                </p>
                <button
                  type="button"
                  className="operator-secondary-btn listing-icon-btn"
                  onClick={findVehicleImages}
                  disabled={loadingVehicleImages || !form.vehicleMake || !form.vehicleModel}
                >
                  <Search size={16} aria-hidden="true" />
                  {loadingVehicleImages ? "Finding Photos..." : "Find Photos"}
                </button>
              </div>

              {vehicleImages.length > 0 && (
                <div className="carsxe-image-grid">
                  {vehicleImages.map((image, index) => {
                    const selected = pendingPhotos.some((item) => item.url === image.url);
                    return (
                      <button
                        key={`${image.url}-${index}`}
                        type="button"
                        className={`carsxe-image-option ${selected ? "selected" : ""}`}
                        aria-pressed={selected}
                        onClick={() => toggleStockPhoto(image)}
                        disabled={!selected && photoRoom <= 0}
                      >
                        <img src={image.thumbnailUrl || image.url} alt={`${form.vehicleMake} ${form.vehicleModel}`} />
                        <span>{selected ? "Added, tap to remove" : "Add Photo"}</span>
                      </button>
                    );
                  })}
                </div>
              )}

            </div>
          )}
        </section>

        {/* ===================================================
            ACTIONS
        ==================================================== */}

        <section className="listing-action-bar" aria-label="Save listing">
          <p className="listing-action-note">
            {isEdit
              ? dirty || pendingPhotos.length > 0
                ? "You have unsaved changes."
                : "No changes yet."
              : "New listings are saved as drafts. Publish them from Listings when ready."}
          </p>
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
                saving ||
                uploadingVehicleImage ||
                (isEdit && !dirty && pendingPhotos.length === 0)
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