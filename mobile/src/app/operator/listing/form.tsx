
import { Ionicons } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  createOperatorListing,
  getOperatorBranches,
  getOperatorListingById,
  OperatorBranch,
  OperatorListingFormPayload,
  updateOperatorListing,
} from "../../../services/operatorApi";

const VEHICLE_TYPES = [
  "SEDAN",
  "HATCHBACK",
  "COMPACT",
  "SUV",
  "MPV",
  "PICKUP",
  "VAN",
];

const TRANSMISSIONS = [
  "AUTOMATIC",
  "MANUAL",
];

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

const initialForm: FormState = {
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

function optionalNumber(value: string) {
  return value.trim() ? Number(value) : null;
}

function optionalText(value: string) {
  return value.trim() || null;
}

function optionalMoney(value: string) {
  return value.trim() || null;
}

function validMoney(value: string) {
  return /^\d+(\.\d{1,2})?$/.test(value.trim()) &&
    Number(value) > 0;
}

export default function OperatorListingFormScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();

  const listingId = params.id
    ? Number(params.id)
    : null;

  const isEditing = listingId !== null;

  const [form, setForm] =
    useState<FormState>(initialForm);

  const [branches, setBranches] =
    useState<OperatorBranch[]>([]);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const setField = <K extends keyof FormState>(
    key: K,
    value: FormState[K]
  ) => {
    setForm((previous) => ({
      ...previous,
      [key]: value,
    }));
  };

  useEffect(() => {
    let active = true;

    const load = async () => {
      try {
        setLoading(true);
        setError("");

        if (
          isEditing &&
          (!Number.isInteger(listingId) || listingId! <= 0)
        ) {
          throw new Error("Invalid listing ID.");
        }

        const [branchResponse, listingResponse] =
          await Promise.all([
            getOperatorBranches(),
            isEditing
              ? getOperatorListingById(listingId!)
              : Promise.resolve(null),
          ]);

        if (!active) return;

        const loadedBranches = Array.isArray(
          branchResponse.branches
        )
          ? branchResponse.branches
          : [];

        setBranches(loadedBranches);

        if (listingResponse?.listing) {
          const listing = listingResponse.listing;

          setForm({
            branchId: listing.branchId,
            name: listing.name || "",
            description: listing.description || "",
            vehicleMake: listing.vehicleMake || "",
            vehicleModel: listing.vehicleModel || "",
            vehicleType: listing.vehicleType || "SEDAN",
            transmission: listing.transmission || "AUTOMATIC",
            modelYear: String(listing.modelYear ?? ""),
            seats: String(listing.seats ?? ""),
            luggageCapacity: String(
              listing.luggageCapacity ?? ""
            ),
            quantity: String(listing.quantity ?? 1),
            price: String(listing.price ?? ""),
            hourlyRate: String(listing.hourlyRate ?? ""),
            weeklyRate: String(listing.weeklyRate ?? ""),
            monthlyRate: String(listing.monthlyRate ?? ""),
            cdwDailyPrice: String(
              listing.cdwDailyPrice ?? ""
            ),
            pickupRules: listing.pickupRules || "",
            returnRules: listing.returnRules || "",
            insuranceInfo: listing.insuranceInfo || "",
            refundPolicy: listing.refundPolicy || "",
            termsAndConditions:
              listing.termsAndConditions || "",
          });
        } else if (loadedBranches.length > 0) {
          const preferred =
            loadedBranches.find((branch) => branch.isActive) ||
            loadedBranches[0];

          setField("branchId", preferred.id);
        }
      } catch (err: any) {
        if (active) {
          setError(
            err?.message ||
              "Unable to load listing form."
          );
        }
      } finally {
        if (active) setLoading(false);
      }
    };

    load();

    return () => {
      active = false;
    };
  }, [listingId, isEditing]);

  const validate = () => {
    if (!form.branchId) {
      return "Please select a branch.";
    }

    if (
      !form.name.trim() ||
      !form.vehicleMake.trim() ||
      !form.vehicleModel.trim()
    ) {
      return "Vehicle name, make and model are required.";
    }

    if (
      !VEHICLE_TYPES.includes(form.vehicleType) ||
      !TRANSMISSIONS.includes(form.transmission)
    ) {
      return "Select valid vehicle type and transmission.";
    }

    if (!validMoney(form.price)) {
      return "Daily rate must be greater than RM 0 with up to 2 decimals.";
    }

    for (const key of [
      "hourlyRate",
      "weeklyRate",
      "monthlyRate",
      "cdwDailyPrice",
    ] as const) {
      const value = form[key].trim();

      if (value && !validMoney(value)) {
        return `${key} must be a positive RM amount with up to 2 decimals.`;
      }
    }

    const quantity = Number(form.quantity);

    if (
      !form.quantity.trim() ||
      !Number.isInteger(quantity) ||
      quantity < 1
    ) {
      return "Fleet quantity must be at least 1.";
    }

    for (const key of [
      "modelYear",
      "seats",
      "luggageCapacity",
    ] as const) {
      const value = form[key].trim();

      if (
        value &&
        (!/^\d+$/.test(value) ||
          Number(value) <= 0)
      ) {
        return `${key} must be a positive whole number.`;
      }
    }

    return null;
  };

  const handleSave = async () => {
    if (saving || loading) return;

    const validationError = validate();

    if (validationError) {
      Alert.alert("Check Your Details", validationError);
      return;
    }

    const payload: OperatorListingFormPayload = {
      branchId: form.branchId!,
      category: "CAR_RENTAL",
      name: form.name.trim(),
      description: optionalText(form.description),

      vehicleMake: form.vehicleMake.trim(),
      vehicleModel: form.vehicleModel.trim(),
      vehicleType: form.vehicleType,
      transmission: form.transmission,

      modelYear: optionalNumber(form.modelYear),
      seats: optionalNumber(form.seats),
      luggageCapacity: optionalNumber(
        form.luggageCapacity
      ),
      quantity: Number(form.quantity),

      price: form.price.trim(),
      hourlyRate: optionalMoney(form.hourlyRate),
      weeklyRate: optionalMoney(form.weeklyRate),
      monthlyRate: optionalMoney(form.monthlyRate),
      cdwDailyPrice: optionalMoney(form.cdwDailyPrice),

      pickupRules: optionalText(form.pickupRules),
      returnRules: optionalText(form.returnRules),
      insuranceInfo: optionalText(form.insuranceInfo),
      refundPolicy: optionalText(form.refundPolicy),
      termsAndConditions: optionalText(
        form.termsAndConditions
      ),
    };

    try {
      setSaving(true);

      if (isEditing) {
        await updateOperatorListing(listingId!, payload);
      } else {
        await createOperatorListing(payload);
      }

      Alert.alert(
        "Success",
        isEditing
          ? "Vehicle listing updated successfully."
          : "Vehicle listing created as Draft.",
        [
          {
            text: "OK",
            onPress: () => router.back(),
          },
        ]
      );
    } catch (err: any) {
      Alert.alert(
        "Unable to Save",
        err?.message ||
          "Failed to save vehicle listing."
      );
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color="#07869B"
          />
          <Text style={styles.helper}>
            Loading vehicle details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (error) {
    return (
      <SafeAreaView style={styles.screen}>
        <View style={styles.center}>
          <Ionicons
            name="alert-circle-outline"
            size={35}
            color="#D14343"
          />
          <Text style={styles.error}>{error}</Text>
          <Pressable onPress={() => router.back()}>
            <Text style={styles.link}>Go Back</Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={
          Platform.OS === "ios" ? "padding" : undefined
        }
      >
        <View style={styles.header}>
          <Pressable
            style={styles.back}
            onPress={() => router.back()}
            disabled={saving}
          >
            <Ionicons
              name="arrow-back"
              size={22}
              color="#17313C"
            />
          </Pressable>

          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              VEHICLE MANAGEMENT
            </Text>
            <Text style={styles.heading}>
              {isEditing
                ? "Edit Vehicle"
                : "Add Vehicle"}
            </Text>
            <Text style={styles.helper}>
              {isEditing
                ? "Update your existing listing"
                : "Create a new rental listing"}
            </Text>
          </View>
        </View>

        <ScrollView
          keyboardShouldPersistTaps="handled"
          contentContainerStyle={styles.content}
        >
          <SectionTitle
            icon="business-outline"
            title="Branch & Vehicle"
          />

          <Text style={styles.label}>Branch *</Text>

          {branches.length === 0 ? (
            <Text style={styles.error}>
              No branch found. Create a branch on the
              operator website first.
            </Text>
          ) : (
            <View style={styles.options}>
              {branches.map((branch) => (
                <Pressable
                  key={branch.id}
                  style={[
                    styles.option,
                    form.branchId === branch.id &&
                      styles.optionSelected,
                  ]}
                  onPress={() =>
                    setField("branchId", branch.id)
                  }
                >
                  <Text
                    style={[
                      styles.optionText,
                      form.branchId === branch.id &&
                        styles.optionTextSelected,
                    ]}
                  >
                    {branch.name}
                  </Text>
                </Pressable>
              ))}
            </View>
          )}

          <Field
            label="Listing Name *"
            value={form.name}
            onChange={(value) => setField("name", value)}
            placeholder="e.g. Toyota Vios 1.5G"
          />

          <Field
            label="Vehicle Make *"
            value={form.vehicleMake}
            onChange={(value) =>
              setField("vehicleMake", value)
            }
            placeholder="e.g. Toyota"
          />

          <Field
            label="Vehicle Model *"
            value={form.vehicleModel}
            onChange={(value) =>
              setField("vehicleModel", value)
            }
            placeholder="e.g. Vios"
          />

          <Text style={styles.label}>Vehicle Type *</Text>

          <View style={styles.options}>
            {VEHICLE_TYPES.map((type) => (
              <Pressable
                key={type}
                style={[
                  styles.option,
                  form.vehicleType === type &&
                    styles.optionSelected,
                ]}
                onPress={() =>
                  setField("vehicleType", type)
                }
              >
                <Text
                  style={[
                    styles.optionText,
                    form.vehicleType === type &&
                      styles.optionTextSelected,
                  ]}
                >
                  {type}
                </Text>
              </Pressable>
            ))}
          </View>

          <Text style={styles.label}>Transmission *</Text>

          <View style={styles.options}>
            {TRANSMISSIONS.map((value) => (
              <Pressable
                key={value}
                style={[
                  styles.option,
                  form.transmission === value &&
                    styles.optionSelected,
                ]}
                onPress={() =>
                  setField("transmission", value)
                }
              >
                <Text
                  style={[
                    styles.optionText,
                    form.transmission === value &&
                      styles.optionTextSelected,
                  ]}
                >
                  {value}
                </Text>
              </Pressable>
            ))}
          </View>

          <View style={styles.twoColumns}>
            <View style={{ flex: 1 }}>
              <Field
                label="Model Year"
                value={form.modelYear}
                onChange={(value) =>
                  setField("modelYear", value)
                }
                placeholder="2024"
                numeric
              />
            </View>

            <View style={{ flex: 1 }}>
              <Field
                label="Seats"
                value={form.seats}
                onChange={(value) =>
                  setField("seats", value)
                }
                placeholder="5"
                numeric
              />
            </View>
          </View>

          <Field
            label="Luggage Capacity"
            value={form.luggageCapacity}
            onChange={(value) =>
              setField("luggageCapacity", value)
            }
            placeholder="Number of bags"
            numeric
          />

          <Field
            label="Description"
            value={form.description}
            onChange={(value) =>
              setField("description", value)
            }
            placeholder="Describe this vehicle"
            multiline
          />

          <SectionTitle
            icon="pricetag-outline"
            title="Rental Pricing"
          />

          <Field
            label="Daily Rate (RM) *"
            value={form.price}
            onChange={(value) =>
              setField("price", value)
            }
            placeholder="120.00"
            decimal
          />

          <Field
            label="Hourly Rate (RM)"
            value={form.hourlyRate}
            onChange={(value) =>
              setField("hourlyRate", value)
            }
            placeholder="Optional"
            decimal
          />

          <Field
            label="Weekly Rate (RM)"
            value={form.weeklyRate}
            onChange={(value) =>
              setField("weeklyRate", value)
            }
            placeholder="Optional"
            decimal
          />

          <Field
            label="Monthly Rate (RM)"
            value={form.monthlyRate}
            onChange={(value) =>
              setField("monthlyRate", value)
            }
            placeholder="Optional"
            decimal
          />

          <Field
            label="CDW Daily Price (RM)"
            value={form.cdwDailyPrice}
            onChange={(value) =>
              setField("cdwDailyPrice", value)
            }
            placeholder="Optional"
            decimal
          />

          <Field
            label="Fleet Quantity *"
            value={form.quantity}
            onChange={(value) =>
              setField("quantity", value)
            }
            placeholder="1"
            numeric
          />

          <SectionTitle
            icon="document-text-outline"
            title="Rental Rules & Policies"
          />

          <Field
            label="Pickup Rules"
            value={form.pickupRules}
            onChange={(value) =>
              setField("pickupRules", value)
            }
            placeholder="Vehicle pickup instructions"
            multiline
          />

          <Field
            label="Return Rules"
            value={form.returnRules}
            onChange={(value) =>
              setField("returnRules", value)
            }
            placeholder="Vehicle return instructions"
            multiline
          />

          <Field
            label="Insurance Information"
            value={form.insuranceInfo}
            onChange={(value) =>
              setField("insuranceInfo", value)
            }
            placeholder="Insurance coverage details"
            multiline
          />

          <Field
            label="Refund Policy"
            value={form.refundPolicy}
            onChange={(value) =>
              setField("refundPolicy", value)
            }
            placeholder="Refund and cancellation conditions"
            multiline
          />

          <Field
            label="Terms and Conditions"
            value={form.termsAndConditions}
            onChange={(value) =>
              setField("termsAndConditions", value)
            }
            placeholder="Rental terms and conditions"
            multiline
          />

          <View style={styles.notice}>
            <Ionicons
              name="information-circle-outline"
              size={21}
              color="#07869B"
            />
            <Text style={styles.noticeText}>
              New listings are saved as Draft. Existing
              listing updates are saved to the shared
              backend without changing publication status.
            </Text>
          </View>

          <Pressable
            style={[
              styles.saveButton,
              saving && { opacity: 0.6 },
            ]}
            disabled={saving || branches.length === 0}
            onPress={handleSave}
          >
            {saving ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.saveText}>
                  {isEditing
                    ? "Save Changes"
                    : "Create Draft Listing"}
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

function SectionTitle({
  title,
  icon,
}: {
  title: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View style={styles.sectionTitle}>
      <Ionicons
        name={icon}
        size={20}
        color="#07869B"
      />
      <Text style={styles.sectionHeading}>
        {title}
      </Text>
    </View>
  );
}

function Field({
  label,
  value,
  onChange,
  placeholder,
  numeric,
  decimal,
  multiline,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  numeric?: boolean;
  decimal?: boolean;
  multiline?: boolean;
}) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        style={[
          styles.input,
          multiline && styles.textarea,
        ]}
        value={value}
        onChangeText={onChange}
        placeholder={placeholder}
        placeholderTextColor="#91A2A9"
        keyboardType={
          decimal
            ? "decimal-pad"
            : numeric
              ? "number-pad"
              : "default"
        }
        multiline={multiline}
        textAlignVertical={
          multiline ? "top" : "center"
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 25,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
    padding: 20,
    paddingTop: 16,
  },
  back: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    color: "#07869B",
    letterSpacing: 1.1,
  },
  heading: {
    fontSize: 23,
    fontWeight: "900",
    color: "#17313C",
    marginTop: 5,
  },
  helper: {
    fontSize: 12,
    color: "#81939C",
    marginTop: 6,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 65,
  },
  sectionTitle: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 20,
    marginBottom: 17,
  },
  sectionHeading: {
    fontSize: 17,
    fontWeight: "900",
    color: "#17313C",
  },
  field: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "800",
    color: "#17313C",
    marginBottom: 9,
  },
  input: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    borderRadius: 13,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 13,
    color: "#17313C",
    minHeight: 47,
  },
  textarea: {
    minHeight: 95,
  },
  options: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 18,
  },
  option: {
    borderWidth: 1,
    borderColor: "#E3EAED",
    backgroundColor: "#FFFFFF",
    paddingHorizontal: 13,
    paddingVertical: 11,
    borderRadius: 11,
  },
  optionSelected: {
    backgroundColor: "#07869B",
    borderColor: "#07869B",
  },
  optionText: {
    fontSize: 11,
    fontWeight: "800",
    color: "#617780",
  },
  optionTextSelected: {
    color: "#FFFFFF",
  },
  twoColumns: {
    flexDirection: "row",
    gap: 12,
  },
  notice: {
    backgroundColor: "#E6F7F9",
    borderRadius: 14,
    padding: 15,
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    marginTop: 12,
    marginBottom: 22,
  },
  noticeText: {
    color: "#617780",
    fontSize: 11,
    lineHeight: 18,
    flex: 1,
  },
  saveButton: {
    backgroundColor: "#07869B",
    borderRadius: 15,
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
  },
  saveText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  error: {
    color: "#D14343",
    fontSize: 13,
    textAlign: "center",
    marginVertical: 12,
  },
  link: {
    color: "#07869B",
    fontWeight: "900",
    marginTop: 12,
  },
});
