import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, Switch, View } from "react-native";

import { AccountScreen, SaveError } from "@/components/account/AccountScreen";
import { AppText, Button, Chip, ErrorState, FieldError, GlassCard, SkeletonText, TextField, useToast } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { isApiError } from "@/services/api";
import {
  createOperatorListing,
  getOperatorBranches,
  getOperatorListingById,
  updateOperatorListing,
  type ListingCategory,
  type OperatorBranch,
  type OperatorListingFormPayload,
} from "@/services/operatorApi";
import { getStoredUser } from "@/services/session";
import { logger } from "@/utils/logger";
import { startAsync } from "@/utils/start-async";

const VEHICLE_TYPES = ["SEDAN", "HATCHBACK", "COMPACT", "SUV", "MPV", "PICKUP", "VAN"] as const;
const TRANSMISSIONS = [
  { value: "AUTOMATIC", label: "Automatic" },
  { value: "MANUAL", label: "Manual" },
] as const;
// Behind the customer Powertrain and Drivetrain filters; the server requires
// both for a car (listing_vehicle_fields.js).
const POWERTRAINS = [
  { value: "PETROL", label: "Petrol" },
  { value: "DIESEL", label: "Diesel" },
  { value: "HYBRID", label: "Hybrid" },
  { value: "EV", label: "Electric" },
] as const;
const DRIVETRAINS = [
  { value: "TWO_WD", label: "2WD" },
  { value: "FOUR_WD", label: "4WD" },
  { value: "AWD", label: "AWD" },
] as const;

type OperatorType = "CAR_RENTAL" | "TOUR_GUIDE" | "DRIVER";

// What each operator type can list (operator_type_rules.js decides on the
// server). A car rental operator lists cars and charter tours with their own
// cars, a guide lists tour packages, a driver has one driver profile.
const CATEGORIES: Record<OperatorType, { value: ListingCategory; label: string }[]> = {
  CAR_RENTAL: [
    { value: "CAR_RENTAL", label: "Car" },
    { value: "TOUR", label: "Charter tour" },
  ],
  TOUR_GUIDE: [{ value: "TOUR", label: "Tour package" }],
  DRIVER: [{ value: "DRIVER_SERVICE", label: "Driver profile" }],
};

type FormState = {
  category: ListingCategory;
  branchId: number | null;
  name: string;
  description: string;
  // Car, and the car used on a charter tour
  vehicleMake: string;
  vehicleModel: string;
  vehicleType: string;
  transmission: string;
  powertrain: string;
  drivetrain: string;
  modelYear: string;
  seats: string;
  luggageCapacity: string;
  allowIndependentDrivers: boolean;
  // Prices and stock
  quantity: string;
  price: string;
  hourlyRate: string;
  weeklyRate: string;
  monthlyRate: string;
  cdwDailyPrice: string;
  // Tours
  durationDays: string;
  maxGroupSize: string;
  pickupTimes: string;
  meetingPoint: string;
  highlights: string;
  itinerary: string;
  inclusions: string;
  exclusions: string;
  cancellationPolicy: string;
  // Driver profile
  languages: string;
  serviceAreas: string;
  yearsDriving: string;
  // Policies
  pickupRules: string;
  returnRules: string;
  insuranceInfo: string;
  refundPolicy: string;
  termsAndConditions: string;
};

type Field = keyof FormState;
type Errors = Partial<Record<Field, string>>;

const EMPTY: FormState = {
  category: "CAR_RENTAL",
  branchId: null,
  name: "",
  description: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleType: "SEDAN",
  transmission: "AUTOMATIC",
  powertrain: "",
  drivetrain: "",
  modelYear: "",
  seats: "",
  luggageCapacity: "",
  allowIndependentDrivers: false,
  quantity: "1",
  price: "",
  hourlyRate: "",
  weeklyRate: "",
  monthlyRate: "",
  cdwDailyPrice: "",
  durationDays: "1",
  maxGroupSize: "",
  pickupTimes: "",
  meetingPoint: "",
  highlights: "",
  itinerary: "",
  inclusions: "",
  exclusions: "",
  cancellationPolicy: "",
  languages: "",
  serviceAreas: "",
  yearsDriving: "",
  pickupRules: "",
  returnRules: "",
  insuranceInfo: "",
  refundPolicy: "",
  termsAndConditions: "",
};

/** A ringgit amount as typed: above 0, whole ringgit or up to two decimals. */
function validMoney(value: string) {
  return /^\d+(\.\d{1,2})?$/.test(value.trim()) && Number(value) > 0;
}

function text(value: string) {
  return value.trim() || null;
}

function whole(value: string) {
  return value.trim() ? Number(value) : null;
}

/** One item per line. */
function lines(value: string) {
  return value
    .split("\n")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** "Malay, English" -> ["Malay", "English"]. */
function commaList(value: string) {
  return value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean);
}

/** "08:00, 13:00" -> ["08:00", "13:00"]. */
function times(value: string) {
  return value
    .split(/[,\s]+/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function listText(value: unknown, separator: string) {
  return Array.isArray(value) ? value.filter((v) => typeof v === "string").join(separator) : "";
}

function typeLabel(value: string) {
  return value === "SUV" || value === "MPV" ? value : value.charAt(0) + value.slice(1).toLowerCase();
}

function str(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

/** Every field rule, with plain-English messages shown under the field (rule 05b). */
function validate(form: FormState, operatorType: OperatorType): Errors {
  const e: Errors = {};
  const isCar = form.category === "CAR_RENTAL";
  const isTour = form.category === "TOUR";
  const isDriver = form.category === "DRIVER_SERVICE";
  const isCharter = isTour && operatorType === "CAR_RENTAL";

  if (!form.branchId) e.branchId = isCar ? "Choose the branch this car is rented from." : "Choose your base location.";
  if (!form.name.trim()) e.name = "Give the listing a name.";
  if (!validMoney(form.price)) {
    e.price = isTour ? "Enter the price above RM 0, with up to two decimals." : "Enter a daily rate above RM 0, with up to two decimals.";
  }

  if (isCar || isCharter) {
    if (!form.vehicleMake.trim()) e.vehicleMake = "Enter the make, for example Toyota.";
    if (!form.vehicleModel.trim()) e.vehicleModel = "Enter the model, for example Vios.";
  }
  if (isCar) {
    if (!form.powertrain) e.powertrain = "Choose the powertrain. Customers filter by it.";
    if (!form.drivetrain) e.drivetrain = "Choose the drivetrain. Customers filter by it.";
    for (const key of ["hourlyRate", "weeklyRate", "monthlyRate", "cdwDailyPrice"] as const) {
      if (form[key].trim() && !validMoney(form[key])) e[key] = "Enter an amount above RM 0, with up to two decimals, or leave it empty.";
    }
  }
  if (!isDriver && (!/^\d+$/.test(form.quantity.trim()) || Number(form.quantity) < 1)) {
    e.quantity = isTour ? "Enter at least 1 group a day." : "Enter at least 1 car.";
  }
  for (const key of ["modelYear", "luggageCapacity"] as const) {
    const v = form[key].trim();
    if (v && (!/^\d+$/.test(v) || Number(v) <= 0)) e[key] = "Enter a whole number, or leave it empty.";
  }

  if (isTour) {
    if (!/^\d+$/.test(form.durationDays.trim()) || Number(form.durationDays) < 1) e.durationDays = "Enter at least 1 day.";
    if (!/^\d+$/.test(form.maxGroupSize.trim()) || Number(form.maxGroupSize) < 1) e.maxGroupSize = "Enter the most passengers you take.";
    const bad = times(form.pickupTimes).find((t) => !/^([01]\d|2[0-3]):[0-5]\d$/.test(t));
    if (bad) e.pickupTimes = `"${bad}" must be a time like 08:30.`;
    if (isCharter) {
      const seats = Number(form.seats);
      if (!/^\d+$/.test(form.seats.trim()) || seats < 2) e.seats = "Enter the seats in the car, including the driver.";
      else if (Number(form.maxGroupSize) > seats - 1) e.maxGroupSize = `The car takes up to ${seats - 1} passengers besides the driver.`;
    }
  } else {
    const v = form.seats.trim();
    if (v && (!/^\d+$/.test(v) || Number(v) <= 0)) e.seats = "Enter a whole number, or leave it empty.";
  }

  if (isDriver) {
    if (!validMoney(form.hourlyRate)) e.hourlyRate = "Enter your hourly rate above RM 0.";
    if (!commaList(form.languages).length) e.languages = "Add at least one language you speak.";
    if (!commaList(form.serviceAreas).length) e.serviceAreas = "Add at least one town you cover.";
    const y = form.yearsDriving.trim();
    if (y && (!/^\d+$/.test(y) || Number(y) > 60)) e.yearsDriving = "Enter a whole number from 0 to 60, or leave it empty.";
  }
  return e;
}

/** Field errors the server sends in details (validate_middleware), if any. */
function serverFieldErrors(err: unknown): Errors {
  if (!isApiError(err)) return {};
  const list = (err.details as any)?.errors;
  if (!Array.isArray(list)) return {};
  const out: Errors = {};
  for (const item of list) {
    const field = String(item?.field || "");
    if (field in EMPTY && item?.message) out[field as Field] = String(item.message);
  }
  return out;
}

/**
 * Add or edit a listing: a car, a charter tour or tour package, or a
 * driver's profile, depending on the operator's type. Pushed form, grouped
 * frosted sections, errors under each field, Save in the floating bar. A new
 * listing is saved as a draft; publishing is on Photos & status.
 */
export default function OperatorListingFormScreen() {
  const router = useRouter();
  const toast = useToast();
  const { tokens } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const parsed = Number(params.id);
  const listingId = params.id ? (Number.isInteger(parsed) && parsed > 0 ? parsed : NaN) : null;
  const editing = listingId !== null;

  const [operatorType, setOperatorType] = useState<OperatorType>("CAR_RENTAL");
  const [form, setForm] = useState<FormState>(EMPTY);
  const [branches, setBranches] = useState<OperatorBranch[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<unknown>(null);

  const load = () =>
    startAsync(async () => {
      try {
        if (Number.isNaN(listingId)) throw new Error("This listing link isn't valid.");
        const [branchResponse, listingResponse, user] = await Promise.all([
          getOperatorBranches(),
          editing ? getOperatorListingById(listingId as number) : Promise.resolve(null),
          getStoredUser(),
        ]);
        // Sessions from before operator types existed are car rental.
        const type: OperatorType = user?.operator?.operatorType || "CAR_RENTAL";
        setOperatorType(type);
        const list = Array.isArray(branchResponse?.branches) ? branchResponse.branches : [];
        setBranches(list);
        const l: any = listingResponse?.listing;
        if (l) {
          setForm({
            category: l.category || "CAR_RENTAL",
            branchId: l.branchId,
            name: l.name || "",
            description: l.description || "",
            vehicleMake: l.vehicleMake || "",
            vehicleModel: l.vehicleModel || "",
            vehicleType: l.vehicleType || "SEDAN",
            transmission: l.transmission || "AUTOMATIC",
            powertrain: l.powertrain || "",
            drivetrain: l.drivetrain || "",
            modelYear: str(l.modelYear),
            seats: str(l.seats),
            luggageCapacity: str(l.luggageCapacity),
            allowIndependentDrivers: Boolean(l.allowIndependentDrivers),
            quantity: str(l.quantity ?? 1),
            price: str(l.price),
            hourlyRate: str(l.hourlyRate),
            weeklyRate: str(l.weeklyRate),
            monthlyRate: str(l.monthlyRate),
            cdwDailyPrice: str(l.cdwDailyPrice),
            durationDays: str(l.durationDays ?? 1),
            maxGroupSize: str(l.maxGroupSize),
            pickupTimes: listText(l.pickupTimes, ", "),
            meetingPoint: l.meetingPoint || "",
            highlights: listText(l.highlights, "\n"),
            itinerary: listText(l.itinerary, "\n"),
            inclusions: listText(l.inclusions, "\n"),
            exclusions: listText(l.exclusions, "\n"),
            cancellationPolicy: l.cancellationPolicy || "",
            languages: listText(l.languages, ", "),
            serviceAreas: listText(l.serviceAreas, ", "),
            yearsDriving: str(l.yearsDriving),
            pickupRules: l.pickupRules || "",
            returnRules: l.returnRules || "",
            insuranceInfo: l.insuranceInfo || "",
            refundPolicy: l.refundPolicy || "",
            termsAndConditions: l.termsAndConditions || "",
          });
        } else {
          const preferred = list.find((b) => b.isActive) || list[0];
          setForm((f) => ({
            ...f,
            category: CATEGORIES[type]?.[0]?.value || "CAR_RENTAL",
            branchId: preferred ? preferred.id : f.branchId,
          }));
        }
      } catch (err) {
        logger.debug("Failed to load the listing form:", err);
        setLoadError(err);
      }
    });

  // Retry resets first; the first load needs no reset, so the effect's load
  // makes no synchronous state updates (react-hooks/set-state-in-effect).
  const retry = () => {
    setLoadError(null);
    return load();
  };

  useEffect(() => {
    load();
    // Load once for the listing in the link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const set = <K extends Field>(key: K, value: FormState[K]) => {
    setForm((f) => ({ ...f, [key]: value }));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const field = (
    key: Exclude<Field, "branchId" | "category" | "allowIndependentDrivers">,
    label: string,
    extra: Partial<Parameters<typeof TextField>[0]> = {}
  ) => <TextField label={label} value={form[key]} onChangeText={(t) => set(key, t)} error={errors[key]} {...extra} />;

  const isCar = form.category === "CAR_RENTAL";
  const isTour = form.category === "TOUR";
  const isDriver = form.category === "DRIVER_SERVICE";
  const isCharter = isTour && operatorType === "CAR_RENTAL";
  const isGuide = operatorType === "TOUR_GUIDE";

  const buildPayload = (): OperatorListingFormPayload => {
    const base: OperatorListingFormPayload = {
      branchId: form.branchId!,
      category: form.category,
      name: form.name.trim(),
      description: text(form.description),
      // Amounts go as typed text; the server parses and stores them.
      price: form.price.trim(),
      refundPolicy: text(form.refundPolicy),
      termsAndConditions: text(form.termsAndConditions),
    };
    if (isCar) {
      return {
        ...base,
        vehicleMake: form.vehicleMake.trim(),
        vehicleModel: form.vehicleModel.trim(),
        vehicleType: form.vehicleType,
        transmission: form.transmission,
        powertrain: form.powertrain,
        drivetrain: form.drivetrain,
        modelYear: whole(form.modelYear),
        seats: whole(form.seats),
        luggageCapacity: whole(form.luggageCapacity),
        quantity: Number(form.quantity),
        hourlyRate: text(form.hourlyRate),
        weeklyRate: text(form.weeklyRate),
        monthlyRate: text(form.monthlyRate),
        cdwDailyPrice: text(form.cdwDailyPrice),
        allowIndependentDrivers: form.allowIndependentDrivers,
        pickupRules: text(form.pickupRules),
        returnRules: text(form.returnRules),
        insuranceInfo: text(form.insuranceInfo),
      };
    }
    if (isTour) {
      return {
        ...base,
        quantity: Number(form.quantity),
        durationDays: Number(form.durationDays),
        maxGroupSize: Number(form.maxGroupSize),
        pickupTimes: times(form.pickupTimes),
        meetingPoint: text(form.meetingPoint),
        highlights: lines(form.highlights),
        itinerary: lines(form.itinerary),
        inclusions: lines(form.inclusions),
        exclusions: lines(form.exclusions),
        cancellationPolicy: text(form.cancellationPolicy),
        // A charter tour names the car it uses; a guide package has none.
        vehicleMake: isCharter ? form.vehicleMake.trim() : null,
        vehicleModel: isCharter ? form.vehicleModel.trim() : null,
        vehicleType: isCharter ? form.vehicleType : null,
        modelYear: isCharter ? whole(form.modelYear) : null,
        seats: isCharter ? whole(form.seats) : null,
      };
    }
    return {
      ...base,
      quantity: 1,
      hourlyRate: form.hourlyRate.trim(),
      languages: commaList(form.languages),
      serviceAreas: commaList(form.serviceAreas),
      yearsDriving: whole(form.yearsDriving),
    };
  };

  const save = async () => {
    const found = validate(form, operatorType);
    setErrors(found);
    setSaveError(null);
    if (Object.values(found).some(Boolean)) return;

    try {
      const payload = buildPayload();
      if (editing) await updateOperatorListing(listingId as number, payload);
      else await createOperatorListing(payload);
      toast.show(editing ? "Changes saved." : "Saved as a draft. Add photos, then publish it.", { tone: "ok" });
      router.back();
    } catch (err) {
      logger.debug("Failed to save the listing:", err);
      const fromServer = serverFieldErrors(err);
      if (Object.keys(fromServer).length) setErrors(fromServer);
      else setSaveError(err);
    }
  };

  const title = editing ? "Edit details" : isDriver ? "Your driver profile" : isTour ? "Add a tour" : "Add a car";

  if (loadError) {
    return (
      <AccountScreen title={title}>
        <ErrorState error={loadError} onRetry={retry} />
      </AccountScreen>
    );
  }

  if (!branches) {
    return (
      <AccountScreen title={title}>
        <GlassCard>
          <SkeletonText lines={6} />
        </GlassCard>
      </AccountScreen>
    );
  }

  const categories = CATEGORIES[operatorType] || CATEGORIES.CAR_RENTAL;
  const switchColors = { trackColor: { true: tokens.brand, false: tokens.neutralBg }, thumbColor: "#FFFFFF" };

  return (
    <AccountScreen title={title} action={<Button label={editing ? "Save changes" : "Save as draft"} variant="brand" grow onPress={save} />}>
      {!editing && categories.length > 1 ? (
        <Section title="What are you listing?">
          <View style={styles.chips} accessibilityRole="radiogroup">
            {categories.map((c) => (
              <Chip key={c.value} label={c.label} selected={form.category === c.value} onPress={() => set("category", c.value)} />
            ))}
          </View>
          {isCharter ? (
            <AppText variant="caption">A tour with one of your cars and drivers, priced per car, never per person.</AppText>
          ) : null}
        </Section>
      ) : null}

      <Section title={isCar ? "Branch" : "Base location"}>
        {branches.length === 0 ? (
          <GlassCard>
            <AppText variant="body">
              {isCar ? "Add a branch first. Cars are rented from a branch." : "Add your base location first, under Branches."}
            </AppText>
            <Button label="Branches" variant="line" size="sm" style={styles.mt8} onPress={() => router.push("/operator/branches" as Href)} />
          </GlassCard>
        ) : (
          <View style={styles.chips} accessibilityRole="radiogroup">
            {branches.map((b) => (
              <Chip key={b.id} label={b.isActive ? b.name : `${b.name} (inactive)`} selected={form.branchId === b.id} onPress={() => set("branchId", b.id)} />
            ))}
          </View>
        )}
        <FieldError message={errors.branchId} />
      </Section>

      {isDriver ? (
        <Section title="Your profile">
          {field("name", "Name shown to customers", { placeholder: "e.g. Ahmad, Kuching driver", maxLength: 120 })}
          {field("languages", "Languages you speak", { placeholder: "Malay, English, Mandarin", hint: "Separate with commas." })}
          {field("serviceAreas", "Towns you cover", {
            placeholder: "Kuching, Samarahan, Bau",
            hint: "Separate with commas. You're offered for cars picked up in these places.",
          })}
          {field("yearsDriving", "Years driving (optional)", { keyboardType: "number-pad", maxLength: 2 })}
          {field("description", "About you (optional)", { multiline: true, maxLength: 2000 })}
          <AppText variant="caption">
            Your driving licence and PSV permit are the ones from your approved application. The car operator checks
            them before each job.
          </AppText>
        </Section>
      ) : null}

      {isTour ? (
        <Section title={isGuide ? "The tour package" : "The tour"}>
          {field("name", "Tour name", { placeholder: "e.g. Kuching Heritage Day Tour", maxLength: 120 })}
          {field("description", "Description (optional)", { multiline: true, maxLength: 2000 })}
          <View style={styles.row}>
            <View style={styles.flex}>{field("durationDays", "Days", { keyboardType: "number-pad", maxLength: 2 })}</View>
            <View style={styles.flex}>{field("maxGroupSize", "Max passengers", { keyboardType: "number-pad", maxLength: 3 })}</View>
          </View>
          {field("pickupTimes", "Pickup times", { placeholder: "08:00, 13:00", hint: "24-hour times, separated with commas." })}
          {field("meetingPoint", "Meeting point (optional)", { maxLength: 200 })}
          {field("highlights", "Highlights (optional)", { multiline: true, hint: "One per line." })}
          {field("itinerary", "Itinerary (optional)", { multiline: true, hint: "One stop per line, in order." })}
          {field("inclusions", "Included (optional)", { multiline: true, hint: "One per line." })}
          {field("exclusions", "Not included (optional)", { multiline: true, hint: "One per line." })}
        </Section>
      ) : null}

      {isCar || isCharter ? (
        <Section title={isCar ? "The car" : "Car for this tour"}>
          {isCar ? field("name", "Listing name", { placeholder: "e.g. Toyota Vios 1.5G", maxLength: 120 }) : null}
          <View style={styles.row}>
            <View style={styles.flex}>{field("vehicleMake", "Make", { placeholder: "Toyota", autoCapitalize: "words" })}</View>
            <View style={styles.flex}>{field("vehicleModel", "Model", { placeholder: "Vios", autoCapitalize: "words" })}</View>
          </View>
          <AppText variant="label" color="ink">
            Type
          </AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {VEHICLE_TYPES.map((t) => (
              <Chip key={t} label={typeLabel(t)} selected={form.vehicleType === t} onPress={() => set("vehicleType", t)} />
            ))}
          </View>
          {isCar ? (
            <>
              <AppText variant="label" color="ink">
                Transmission
              </AppText>
              <View style={styles.chips} accessibilityRole="radiogroup">
                {TRANSMISSIONS.map((t) => (
                  <Chip key={t.value} label={t.label} selected={form.transmission === t.value} onPress={() => set("transmission", t.value)} />
                ))}
              </View>
              <AppText variant="label" color="ink">
                Powertrain
              </AppText>
              <View style={styles.chips} accessibilityRole="radiogroup">
                {POWERTRAINS.map((t) => (
                  <Chip key={t.value} label={t.label} selected={form.powertrain === t.value} onPress={() => set("powertrain", t.value)} />
                ))}
              </View>
              <FieldError message={errors.powertrain} />
              <AppText variant="label" color="ink">
                Drivetrain
              </AppText>
              <View style={styles.chips} accessibilityRole="radiogroup">
                {DRIVETRAINS.map((t) => (
                  <Chip key={t.value} label={t.label} selected={form.drivetrain === t.value} onPress={() => set("drivetrain", t.value)} />
                ))}
              </View>
              <FieldError message={errors.drivetrain} />
            </>
          ) : null}
          <View style={styles.row}>
            <View style={styles.flex}>{field("modelYear", "Year", { placeholder: "2024", keyboardType: "number-pad", maxLength: 4 })}</View>
            <View style={styles.flex}>
              {field("seats", isCharter ? "Seats (with driver)" : "Seats", { placeholder: "5", keyboardType: "number-pad", maxLength: 2 })}
            </View>
            {isCar ? (
              <View style={styles.flex}>{field("luggageCapacity", "Bags", { placeholder: "2", keyboardType: "number-pad", maxLength: 2 })}</View>
            ) : null}
          </View>
          {isCar ? field("description", "Description (optional)", { multiline: true, maxLength: 2000, placeholder: "What customers should know about this car" }) : null}
        </Section>
      ) : null}

      <Section title={isTour ? "Price" : isDriver ? "Your rates" : "Prices and fleet"}>
        {isTour ? (
          <>
            {field("price", isGuide ? "Package price (RM)" : "Price per car (RM)", {
              keyboardType: "decimal-pad",
              placeholder: "350.00",
              hint: "One price for the whole group, up to the maximum passengers. Never per person.",
            })}
            {field("quantity", "Groups per day", { keyboardType: "number-pad", placeholder: "1", hint: "How many groups you can take on the same day." })}
          </>
        ) : isDriver ? (
          <>
            {field("hourlyRate", "Hourly rate (RM)", { keyboardType: "decimal-pad", placeholder: "25.00" })}
            {field("price", "Daily rate (RM)", {
              keyboardType: "decimal-pad",
              placeholder: "180.00",
              hint: "Under 6 hours is charged by the hour, 6 hours or more is a day. Hourly charges never go over a day.",
            })}
          </>
        ) : (
          <>
            {field("price", "Daily rate (RM)", { keyboardType: "decimal-pad", placeholder: "120.00" })}
            {field("hourlyRate", "Hourly rate (RM, optional)", {
              keyboardType: "decimal-pad",
              placeholder: "Optional",
              hint: "Used for rentals under 6 hours, and never more than one day.",
            })}
            <View style={styles.row}>
              <View style={styles.flex}>{field("weeklyRate", "Weekly (RM)", { keyboardType: "decimal-pad", placeholder: "Optional" })}</View>
              <View style={styles.flex}>{field("monthlyRate", "Monthly (RM)", { keyboardType: "decimal-pad", placeholder: "Optional" })}</View>
            </View>
            <AppText variant="caption">A missing weekly or monthly rate falls back to the next shorter rate.</AppText>
            {field("cdwDailyPrice", "Collision damage waiver per day (RM, optional)", {
              keyboardType: "decimal-pad",
              placeholder: "Optional",
              hint: "Offered to customers as an optional add-on.",
            })}
            {field("quantity", "Number of cars", {
              keyboardType: "number-pad",
              placeholder: "1",
              hint: "How many of this car you can rent out at the same time.",
            })}
            <View style={styles.between}>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">Allow independent drivers</AppText>
                <AppText variant="caption">
                  Customers can book a licensed driver to drive this car. Check your insurance covers another driver.
                  The driver is paid separately; you check their licence instead of the customer&apos;s.
                </AppText>
              </View>
              <Switch
                value={form.allowIndependentDrivers}
                onValueChange={(v) => set("allowIndependentDrivers", v)}
                {...switchColors}
                accessibilityLabel="Allow independent drivers"
              />
            </View>
          </>
        )}
      </Section>

      <Section title="Rules and policies">
        {isCar ? field("pickupRules", "Pick-up rules (optional)", { multiline: true, maxLength: 2000 }) : null}
        {isCar ? field("returnRules", "Return rules (optional)", { multiline: true, maxLength: 2000 }) : null}
        {isCar ? field("insuranceInfo", "Insurance (optional)", { multiline: true, maxLength: 2000 }) : null}
        {isTour ? field("cancellationPolicy", "Cancellation policy (optional)", { multiline: true, maxLength: 2000 }) : null}
        {field("refundPolicy", "Refund policy (optional)", { multiline: true, maxLength: 2000 })}
        {field("termsAndConditions", "Terms and conditions (optional)", { multiline: true, maxLength: 4000 })}
      </Section>

      {Object.values(errors).some(Boolean) ? <FieldError message="Some details need fixing. Check the fields marked above." /> : null}
      <SaveError error={saveError} />
    </AccountScreen>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="headline" accessibilityRole="header">
        {title}
      </AppText>
      <GlassCard>
        <View style={styles.sectionBody}>{children}</View>
      </GlassCard>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  mt8: {
    marginTop: 8,
    alignSelf: "flex-start",
  },
  section: {
    gap: 10,
  },
  sectionBody: {
    gap: 14,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
