import { Ionicons } from "@expo/vector-icons";
import {
  Modal,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { useEffect, useMemo, useState } from "react";

export type CarFilters = {
  vehicleTypes: string[];
  seats: string[];
  transmissions: string[];
  fuels: string[];
  drives: string[];
  brands: string[];
  refunds: string[];
  operators: string[];
  priceMin: string;
  priceMax: string;
  sort: string;
};

export const DEFAULT_CAR_FILTERS: CarFilters = {
  vehicleTypes: [],
  seats: [],
  transmissions: [],
  fuels: [],
  drives: [],
  brands: [],
  refunds: [],
  operators: [],
  priceMin: "",
  priceMax: "",
  sort: "recommended",
};

type Props = {
  visible: boolean;
  cars: any[];
  filters: CarFilters;
  onClose: () => void;
  onApply: (filters: CarFilters) => void;
};

const VEHICLE_TYPES = [
  "Compact",
  "Sedan",
  "SUV",
  "MPV",
  "Pickup",
];

const SEATS = [
  { value: "4", label: "4+ seats" },
  { value: "5", label: "5+ seats" },
  { value: "7", label: "7+ seats" },
];

const TRANSMISSIONS = [
  {
    value: "AUTOMATIC",
    label: "Automatic",
  },
  {
    value: "MANUAL",
    label: "Manual",
  },
];

const FUELS = [
  "Petrol",
  "Diesel",
  "Hybrid",
  "Electric",
];

const DRIVES = ["2WD", "4WD"];

const REFUNDS = [
  {
    value: "partial",
    label: "Partial refund available",
  },
  {
    value: "none",
    label: "No refund on deposit",
  },
];

const SORTS = [
  {
    value: "recommended",
    label: "Recommended",
  },
  {
    value: "daily",
    label: "Price per day: Low to High",
  },
  {
    value: "payable",
    label: "Amount payable now: Low to High",
  },
  {
    value: "seats",
    label: "Smallest that fits",
  },
  {
    value: "recent",
    label: "Most recently listed",
  },
];

export default function CarFilterModal({
  visible,
  cars,
  filters,
  onClose,
  onApply,
}: Props) {
  const [draft, setDraft] =
    useState<CarFilters>(filters);

  useEffect(() => {
    if (visible) {
      setDraft(filters);
    }
  }, [visible, filters]);

  const brands = useMemo(() => {
    return Array.from(
      new Set(
        cars
          .map((car) => car.vehicleMake)
          .filter(Boolean)
      )
    ).sort();
  }, [cars]);

  const operators = useMemo(() => {
    const map = new Map<
      string,
      string
    >();

    cars.forEach((car) => {
      if (
        car.operator?.id &&
        car.operator?.companyName
      ) {
        map.set(
          String(car.operator.id),
          car.operator.companyName
        );
      }
    });

    return Array.from(map.entries()).map(
      ([value, label]) => ({
        value,
        label,
      })
    );
  }, [cars]);

  const toggle = (
    key:
      | "vehicleTypes"
      | "seats"
      | "transmissions"
      | "fuels"
      | "drives"
      | "brands"
      | "refunds"
      | "operators",
    value: string
  ) => {
    setDraft((current) => {
      const list = current[key];

      return {
        ...current,
        [key]: list.includes(value)
          ? list.filter(
              (item) => item !== value
            )
          : [...list, value],
      };
    });
  };

  const renderPill = (
    key:
      | "vehicleTypes"
      | "seats"
      | "transmissions"
      | "fuels"
      | "drives"
      | "brands"
      | "refunds"
      | "operators",
    value: string,
    label: string
  ) => {
    const selected =
      draft[key].includes(value);

    return (
      <Pressable
        key={value}
        style={[
          styles.pill,
          selected &&
            styles.pillSelected,
        ]}
        onPress={() =>
          toggle(key, value)
        }
      >
        {selected && (
          <Ionicons
            name="checkmark"
            size={15}
            color="#FFFFFF"
          />
        )}

        <Text
          style={[
            styles.pillText,
            selected &&
              styles.pillTextSelected,
          ]}
        >
          {label}
        </Text>
      </Pressable>
    );
  };

  const reset = () => {
    setDraft(DEFAULT_CAR_FILTERS);
  };

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={onClose}
    >
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.header}>
          <Pressable
            style={styles.headerButton}
            onPress={onClose}
          >
            <Ionicons
              name="close"
              size={23}
              color="#17313C"
            />
          </Pressable>

          <View style={styles.headerText}>
            <Text style={styles.title}>
              Filters
            </Text>

            <Text style={styles.subtitle}>
              Find the right car for your trip
            </Text>
          </View>

          <Pressable onPress={reset}>
            <Text style={styles.reset}>
              Reset
            </Text>
          </Pressable>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.content
          }
        >
          {/* Vehicle type */}
          <FilterSection title="Vehicle type">
            <View style={styles.pills}>
              {VEHICLE_TYPES.map(
                (value) =>
                  renderPill(
                    "vehicleTypes",
                    value,
                    value
                  )
              )}
            </View>
          </FilterSection>

          {/* Seats */}
          <FilterSection title="Seat count">
            <View style={styles.pills}>
              {SEATS.map((item) =>
                renderPill(
                  "seats",
                  item.value,
                  item.label
                )
              )}
            </View>
          </FilterSection>

          {/* Transmission */}
          <FilterSection title="Transmission">
            <View style={styles.pills}>
              {TRANSMISSIONS.map(
                (item) =>
                  renderPill(
                    "transmissions",
                    item.value,
                    item.label
                  )
              )}
            </View>
          </FilterSection>

          {/* Fuel */}
          <FilterSection title="Powertrain">
            <View style={styles.pills}>
              {FUELS.map((value) =>
                renderPill(
                  "fuels",
                  value,
                  value
                )
              )}
            </View>
          </FilterSection>

          {/* Drive */}
          <FilterSection title="Drivetrain">
            <View style={styles.pills}>
              {DRIVES.map((value) =>
                renderPill(
                  "drives",
                  value,
                  value === "4WD"
                    ? "4WD or AWD"
                    : value
                )
              )}
            </View>
          </FilterSection>

          {/* Brand */}
          {brands.length > 0 && (
            <FilterSection title="Brand">
              <View style={styles.pills}>
                {brands.map((brand) =>
                  renderPill(
                    "brands",
                    brand,
                    brand
                  )
                )}
              </View>
            </FilterSection>
          )}

          {/* Refund */}
          <FilterSection title="Refund treatment">
            <View style={styles.pills}>
              {REFUNDS.map((item) =>
                renderPill(
                  "refunds",
                  item.value,
                  item.label
                )
              )}
            </View>
          </FilterSection>

          {/* Operator */}
          {operators.length > 0 && (
            <FilterSection title="Operator">
              <View style={styles.pills}>
                {operators.map(
                  (operator) =>
                    renderPill(
                      "operators",
                      operator.value,
                      operator.label
                    )
                )}
              </View>
            </FilterSection>
          )}

          {/* Price */}
          <FilterSection title="Price per day">
            <View style={styles.priceRow}>
              <View
                style={styles.priceInput}
              >
                <Text
                  style={
                    styles.currency
                  }
                >
                  RM
                </Text>

                <TextInput
                  value={
                    draft.priceMin
                  }
                  onChangeText={(value) =>
                    setDraft(
                      (current) => ({
                        ...current,
                        priceMin:
                          value.replace(
                            /[^0-9.]/g,
                            ""
                          ),
                      })
                    )
                  }
                  placeholder="Min"
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>

              <Text style={styles.to}>
                to
              </Text>

              <View
                style={styles.priceInput}
              >
                <Text
                  style={
                    styles.currency
                  }
                >
                  RM
                </Text>

                <TextInput
                  value={
                    draft.priceMax
                  }
                  onChangeText={(value) =>
                    setDraft(
                      (current) => ({
                        ...current,
                        priceMax:
                          value.replace(
                            /[^0-9.]/g,
                            ""
                          ),
                      })
                    )
                  }
                  placeholder="Max"
                  keyboardType="decimal-pad"
                  style={styles.input}
                />
              </View>
            </View>
          </FilterSection>

          {/* Amount Payable Now */}
          <FilterSection title="Amount payable now">
            <View style={styles.disabledCard}>
              <Ionicons
                name="calendar-outline"
                size={21}
                color="#8698A1"
              />

              <View style={{ flex: 1 }}>
                <Text
                  style={
                    styles.disabledTitle
                  }
                >
                  Set your rental dates first
                </Text>

                <Text
                  style={
                    styles.disabledText
                  }
                >
                  The exact deposit depends on
                  your selected rental dates.
                </Text>
              </View>
            </View>
          </FilterSection>

          {/* Sort */}
          <FilterSection title="Sort by">
            {SORTS.map((item) => {
              const selected =
                draft.sort === item.value;

              return (
                <Pressable
                  key={item.value}
                  style={
                    styles.sortRow
                  }
                  onPress={() =>
                    setDraft(
                      (current) => ({
                        ...current,
                        sort:
                          item.value,
                      })
                    )
                  }
                >
                  <View
                    style={[
                      styles.radio,
                      selected &&
                        styles.radioSelected,
                    ]}
                  >
                    {selected && (
                      <View
                        style={
                          styles.radioInner
                        }
                      />
                    )}
                  </View>

                  <Text
                    style={
                      styles.sortText
                    }
                  >
                    {item.label}
                  </Text>
                </Pressable>
              );
            })}
          </FilterSection>
        </ScrollView>

        <View style={styles.footer}>
          <Pressable
            style={styles.clearButton}
            onPress={reset}
          >
            <Text
              style={
                styles.clearButtonText
              }
            >
              Reset Filters
            </Text>
          </Pressable>

          <Pressable
            style={styles.applyButton}
            onPress={() => {
              onApply(draft);
              onClose();
            }}
          >
            <Text
              style={
                styles.applyButtonText
              }
            >
              Show Cars
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    </Modal>
  );
}

function FilterSection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <View style={styles.section}>
      <Text style={styles.sectionTitle}>
        {title}
      </Text>

      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 18,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: "#E5ECEF",
    backgroundColor: "#FFFFFF",
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#F4F8F9",
  },

  headerText: {
    flex: 1,
    marginLeft: 13,
  },

  title: {
    fontSize: 19,
    fontWeight: "900",
    color: "#17313C",
  },

  subtitle: {
    fontSize: 10,
    color: "#8798A1",
    marginTop: 2,
  },

  reset: {
    color: "#07869B",
    fontSize: 12,
    fontWeight: "800",
  },

  content: {
    padding: 18,
    paddingBottom: 120,
  },

  section: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 17,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: "#E6ECEF",
  },

  sectionTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#17313C",
    marginBottom: 13,
  },

  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },

  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    paddingHorizontal: 13,
    paddingVertical: 9,
    borderRadius: 14,
    backgroundColor: "#F4F8F9",
    borderWidth: 1,
    borderColor: "#DFE8EB",
  },

  pillSelected: {
    backgroundColor: "#07869B",
    borderColor: "#07869B",
  },

  pillText: {
    color: "#526871",
    fontSize: 11,
    fontWeight: "700",
  },

  pillTextSelected: {
    color: "#FFFFFF",
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  priceInput: {
    flex: 1,
    height: 48,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#DFE8EB",
    backgroundColor: "#F8FAFB",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
  },

  currency: {
    fontSize: 11,
    fontWeight: "900",
    color: "#60747C",
    marginRight: 5,
  },

  input: {
    flex: 1,
    color: "#17313C",
    fontSize: 13,
  },

  to: {
    color: "#92A1A7",
    fontSize: 11,
  },

  disabledCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#F3F6F7",
    borderRadius: 14,
    padding: 14,
  },

  disabledTitle: {
    color: "#657980",
    fontSize: 11,
    fontWeight: "800",
  },

  disabledText: {
    color: "#95A4AA",
    fontSize: 9,
    marginTop: 3,
    lineHeight: 14,
  },

  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 10,
  },

  radio: {
    width: 20,
    height: 20,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#BAC7CC",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 11,
  },

  radioSelected: {
    borderColor: "#07869B",
  },

  radioInner: {
    width: 10,
    height: 10,
    borderRadius: 10,
    backgroundColor: "#07869B",
  },

  sortText: {
    color: "#3D535C",
    fontSize: 12,
    fontWeight: "700",
  },

  footer: {
    position: "absolute",
    bottom: 0,
    left: 0,
    right: 0,

    flexDirection: "row",
    gap: 10,

    backgroundColor: "#FFFFFF",

    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 20,

    borderTopWidth: 1,
    borderTopColor: "#E4EBEE",
  },

  clearButton: {
    flex: 1,
    height: 52,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#DCE5E8",
    alignItems: "center",
    justifyContent: "center",
  },

  clearButtonText: {
    color: "#536871",
    fontWeight: "800",
    fontSize: 12,
  },

  applyButton: {
    flex: 1.4,
    height: 52,
    borderRadius: 16,
    backgroundColor: "#07869B",
    alignItems: "center",
    justifyContent: "center",
  },

  applyButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
});