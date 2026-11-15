import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useEffect, useState, type ReactNode } from "react";
import { StyleSheet, View } from "react-native";

import { AccountScreen, SaveError } from "@/components/account/AccountScreen";
import { AppText, Button, Chip, ErrorState, FieldError, GlassCard, SkeletonText, TextField, useToast } from "@/components/ui";
import { isApiError } from "@/services/api";
import {
  createOperatorListing,
  getOperatorBranches,
  getOperatorListingById,
  updateOperatorListing,
  type OperatorBranch,
  type OperatorListingFormPayload,
} from "@/services/operatorApi";
import { logger } from "@/utils/logger";
import { startAsync } from "@/utils/start-async";

const VEHICLE_TYPES = ["SEDAN", "HATCHBACK", "COMPACT", "SUV", "MPV", "PICKUP", "VAN"] as const;
const TRANSMISSIONS = [
  { value: "AUTOMATIC", label: "Automatic" },
  { value: "MANUAL", label: "Manual" },
] as const;

type FormState = {
  branchId: number | null;
  name: string;
  description: string;
  vehicleMake: string;
  vehicleModel: string;
  vehicleType: string;
  transmission: string;
  modelYear: string;
  seats: string;
  luggageCapacity: string;
  quantity: string;
  price: string;
  hourlyRate: string;
  weeklyRate: string;
  monthlyRate: string;
  cdwDailyPrice: string;
  pickupRules: string;
  returnRules: string;
  insuranceInfo: string;
  refundPolicy: string;
  termsAndConditions: string;
};

type Field = keyof FormState;
type Errors = Partial<Record<Field, string>>;

const EMPTY: FormState = {
  branchId: null,
  name: "",
  description: "",
  vehicleMake: "",
  vehicleModel: "",
  vehicleType: "SEDAN",
  transmission: "AUTOMATIC",
  modelYear: "",
  seats: "",
  luggageCapacity: "",
  quantity: "1",
  price: "",
  hourlyRate: "",
  weeklyRate: "",
  monthlyRate: "",
  cdwDailyPrice: "",
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

function typeLabel(value: string) {
  return value === "SUV" || value === "MPV" ? value : value.charAt(0) + value.slice(1).toLowerCase();
}

function str(value: unknown) {
  return value === null || value === undefined ? "" : String(value);
}

/** Every field rule, with plain-English messages shown under the field (rule 05b). */
function validate(form: FormState): Errors {
  const e: Errors = {};
  if (!form.branchId) e.branchId = "Choose the branch this car is rented from.";
  if (!form.name.trim()) e.name = "Give the listing a name, for example Toyota Vios 1.5G.";
  if (!form.vehicleMake.trim()) e.vehicleMake = "Enter the make, for example Toyota.";
  if (!form.vehicleModel.trim()) e.vehicleModel = "Enter the model, for example Vios.";
  if (!validMoney(form.price)) e.price = "Enter a daily rate above RM 0, with up to two decimals.";
  for (const key of ["hourlyRate", "weeklyRate", "monthlyRate", "cdwDailyPrice"] as const) {
    if (form[key].trim() && !validMoney(form[key])) e[key] = "Enter an amount above RM 0, with up to two decimals, or leave it empty.";
  }
  if (!/^\d+$/.test(form.quantity.trim()) || Number(form.quantity) < 1) e.quantity = "Enter at least 1 car.";
  for (const key of ["modelYear", "seats", "luggageCapacity"] as const) {
    const v = form[key].trim();
    if (v && (!/^\d+$/.test(v) || Number(v) <= 0)) e[key] = "Enter a whole number, or leave it empty.";
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
 * Add or edit a car (plan phase 4): pushed form, grouped frosted sections,
 * errors under each field, Save in the floating bar. A new car is saved as
 * a draft; publishing is on Photos & status.
 */
export default function OperatorListingFormScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string }>();
  const parsed = Number(params.id);
  const listingId = params.id ? (Number.isInteger(parsed) && parsed > 0 ? parsed : NaN) : null;
  const editing = listingId !== null;

  const [form, setForm] = useState<FormState>(EMPTY);
  const [branches, setBranches] = useState<OperatorBranch[] | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<unknown>(null);

  const load = () => startAsync(async () => {
    try {
      if (Number.isNaN(listingId)) throw new Error("This listing link isn't valid.");
      const [branchResponse, listingResponse] = await Promise.all([
        getOperatorBranches(),
        editing ? getOperatorListingById(listingId as number) : Promise.resolve(null),
      ]);
      const list = Array.isArray(branchResponse?.branches) ? branchResponse.branches : [];
      setBranches(list);
      const l = listingResponse?.listing;
      if (l) {
        setForm({
          branchId: l.branchId,
          name: l.name || "",
          description: l.description || "",
          vehicleMake: l.vehicleMake || "",
          vehicleModel: l.vehicleModel || "",
          vehicleType: l.vehicleType || "SEDAN",
          transmission: l.transmission || "AUTOMATIC",
          modelYear: str(l.modelYear),
          seats: str(l.seats),
          luggageCapacity: str(l.luggageCapacity),
          quantity: str(l.quantity ?? 1),
          price: str(l.price),
          hourlyRate: str(l.hourlyRate),
          weeklyRate: str(l.weeklyRate),
          monthlyRate: str(l.monthlyRate),
          cdwDailyPrice: str(l.cdwDailyPrice),
          pickupRules: l.pickupRules || "",
          returnRules: l.returnRules || "",
          insuranceInfo: l.insuranceInfo || "",
          refundPolicy: l.refundPolicy || "",
          termsAndConditions: l.termsAndConditions || "",
        });
      } else if (list.length) {
        const preferred = list.find((b) => b.isActive) || list[0];
        setForm((f) => ({ ...f, branchId: preferred.id }));
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

  const field = (key: Exclude<Field, "branchId">, label: string, extra: Partial<Parameters<typeof TextField>[0]> = {}) => (
    <TextField label={label} value={form[key]} onChangeText={(t) => set(key, t)} error={errors[key]} {...extra} />
  );

  const save = async () => {
    const found = validate(form);
    setErrors(found);
    setSaveError(null);
    if (Object.values(found).some(Boolean)) return;

    const payload: OperatorListingFormPayload = {
      branchId: form.branchId!,
      category: "CAR_RENTAL",
      name: form.name.trim(),
      description: text(form.description),
      vehicleMake: form.vehicleMake.trim(),
      vehicleModel: form.vehicleModel.trim(),
      vehicleType: form.vehicleType,
      transmission: form.transmission,
      modelYear: whole(form.modelYear),
      seats: whole(form.seats),
      luggageCapacity: whole(form.luggageCapacity),
      quantity: Number(form.quantity),
      // Amounts go as typed text; the server parses and stores them.
      price: form.price.trim(),
      hourlyRate: text(form.hourlyRate),
      weeklyRate: text(form.weeklyRate),
      monthlyRate: text(form.monthlyRate),
      cdwDailyPrice: text(form.cdwDailyPrice),
      pickupRules: text(form.pickupRules),
      returnRules: text(form.returnRules),
      insuranceInfo: text(form.insuranceInfo),
      refundPolicy: text(form.refundPolicy),
      termsAndConditions: text(form.termsAndConditions),
    };

    try {
      if (editing) await updateOperatorListing(listingId as number, payload);
      else await createOperatorListing(payload);
      toast.show(editing ? "Changes saved." : "Car saved as a draft. Add photos, then publish it.", { tone: "ok" });
      router.back();
    } catch (err) {
      logger.debug("Failed to save the listing:", err);
      const fromServer = serverFieldErrors(err);
      if (Object.keys(fromServer).length) setErrors(fromServer);
      else setSaveError(err);
    }
  };

  const title = editing ? "Edit details" : "Add a car";

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

  return (
    <AccountScreen title={title} action={<Button label={editing ? "Save changes" : "Save as draft"} variant="brand" grow onPress={save} />}>
      <Section title="Branch">
        {branches.length === 0 ? (
          <GlassCard>
            <AppText variant="body">Add a branch first. Cars are rented from a branch.</AppText>
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

      <Section title="The car">
        {field("name", "Listing name", { placeholder: "e.g. Toyota Vios 1.5G", maxLength: 120 })}
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
        <AppText variant="label" color="ink">
          Transmission
        </AppText>
        <View style={styles.chips} accessibilityRole="radiogroup">
          {TRANSMISSIONS.map((t) => (
            <Chip key={t.value} label={t.label} selected={form.transmission === t.value} onPress={() => set("transmission", t.value)} />
          ))}
        </View>
        <View style={styles.row}>
          <View style={styles.flex}>{field("modelYear", "Year", { placeholder: "2024", keyboardType: "number-pad", maxLength: 4 })}</View>
          <View style={styles.flex}>{field("seats", "Seats", { placeholder: "5", keyboardType: "number-pad", maxLength: 2 })}</View>
          <View style={styles.flex}>{field("luggageCapacity", "Bags", { placeholder: "2", keyboardType: "number-pad", maxLength: 2 })}</View>
        </View>
        {field("description", "Description (optional)", { multiline: true, maxLength: 2000, placeholder: "What customers should know about this car" })}
      </Section>

      <Section title="Prices and fleet">
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
      </Section>

      <Section title="Rules and policies">
        {field("pickupRules", "Pick-up rules (optional)", { multiline: true, maxLength: 2000 })}
        {field("returnRules", "Return rules (optional)", { multiline: true, maxLength: 2000 })}
        {field("insuranceInfo", "Insurance (optional)", { multiline: true, maxLength: 2000 })}
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
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
