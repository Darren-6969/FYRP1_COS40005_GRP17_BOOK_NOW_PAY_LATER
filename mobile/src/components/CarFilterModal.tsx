import { useEffect, useMemo, useState, type ReactNode } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";

import { AppText, BottomSheet, Button, Chip, GlassCard } from "@/components/ui";
import { FontFamily, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";

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

type ListKey = Exclude<keyof CarFilters, "priceMin" | "priceMax" | "sort">;

const VEHICLE_TYPES = ["Compact", "Sedan", "SUV", "MPV", "Pickup"].map((v) => ({ value: v, label: v }));
const SEATS = [
  { value: "4", label: "4+ seats" },
  { value: "5", label: "5+ seats" },
  { value: "7", label: "7+ seats" },
];
const TRANSMISSIONS = [
  { value: "AUTOMATIC", label: "Automatic" },
  { value: "MANUAL", label: "Manual" },
];
const FUELS = ["Petrol", "Diesel", "Hybrid", "Electric"].map((v) => ({ value: v, label: v }));
const DRIVES = [
  { value: "2WD", label: "2WD" },
  { value: "4WD", label: "4WD or AWD" },
];
const REFUNDS = [
  { value: "partial", label: "Partial refund available" },
  { value: "none", label: "No refund on deposit" },
];
const SORTS = [
  { value: "recommended", label: "Recommended" },
  { value: "daily", label: "Price per day: low to high" },
  { value: "payable", label: "Amount payable now: low to high" },
  { value: "seats", label: "Smallest that fits" },
  { value: "recent", label: "Most recently listed" },
];

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="headline">{title}</AppText>
      {children}
    </View>
  );
}

/** Filters for Home and the car list, as a bottom panel with Apply. */
export default function CarFilterModal({ visible, cars, filters, onClose, onApply }: Props) {
  const { tokens } = useTheme();
  const [draft, setDraft] = useState<CarFilters>(filters);

  useEffect(() => {
    if (visible) setDraft(filters);
  }, [visible, filters]);

  // Brand and operator options come from the cars on offer.
  const brands = useMemo(
    () =>
      Array.from(new Set(cars.map((car) => car.vehicleMake).filter(Boolean)))
        .sort()
        .map((v) => ({ value: String(v), label: String(v) })),
    [cars]
  );

  const operators = useMemo(() => {
    const map = new Map<string, string>();
    cars.forEach((car) => {
      if (car.operator?.id && car.operator?.companyName) {
        map.set(String(car.operator.id), car.operator.companyName);
      }
    });
    return Array.from(map.entries()).map(([value, label]) => ({ value, label }));
  }, [cars]);

  const toggle = (key: ListKey, value: string) =>
    setDraft((current) => ({
      ...current,
      [key]: current[key].includes(value) ? current[key].filter((v) => v !== value) : [...current[key], value],
    }));

  const chips = (key: ListKey, options: { value: string; label: string }[]) => (
    <View style={styles.chips}>
      {options.map((option) => (
        <Chip
          key={option.value}
          label={option.label}
          selected={draft[key].includes(option.value)}
          onPress={() => toggle(key, option.value)}
          check
        />
      ))}
    </View>
  );

  const priceInput = (field: "priceMin" | "priceMax", placeholder: string) => (
    <View style={[styles.price, { backgroundColor: tokens.glass, borderColor: tokens.glassLine }]}>
      <AppText variant="label">RM</AppText>
      <TextInput
        value={draft[field]}
        onChangeText={(text) => setDraft((current) => ({ ...current, [field]: text.replace(/[^0-9.]/g, "") }))}
        placeholder={placeholder}
        placeholderTextColor={tokens.label}
        keyboardType="decimal-pad"
        accessibilityLabel={`${placeholder} price per day`}
        style={[styles.priceInput, { color: tokens.ink }]}
      />
    </View>
  );

  return (
    <BottomSheet
      visible={visible}
      title="Filters"
      subtitle="Find the right car for your trip"
      onClose={onClose}
      headerAction={
        <Button label="Reset" variant="text" size="sm" onPress={() => setDraft(DEFAULT_CAR_FILTERS)} />
      }
      footer={
        <Button
          label="Apply filters"
          onPress={() => {
            onApply(draft);
            onClose();
          }}
        />
      }
    >
      <Section title="Vehicle type">{chips("vehicleTypes", VEHICLE_TYPES)}</Section>
      <Section title="Seats">{chips("seats", SEATS)}</Section>
      <Section title="Transmission">{chips("transmissions", TRANSMISSIONS)}</Section>
      <Section title="Powertrain">{chips("fuels", FUELS)}</Section>
      <Section title="Drivetrain">{chips("drives", DRIVES)}</Section>
      {brands.length ? <Section title="Brand">{chips("brands", brands)}</Section> : null}
      <Section title="Refund if cancelled">{chips("refunds", REFUNDS)}</Section>
      {operators.length ? <Section title="Operator">{chips("operators", operators)}</Section> : null}

      <Section title="Price per day">
        <View style={styles.priceRow}>
          {priceInput("priceMin", "Min")}
          <AppText variant="caption">to</AppText>
          {priceInput("priceMax", "Max")}
        </View>
      </Section>

      <Section title="Sort by">
        <GlassCard padding={4}>
          <View accessibilityRole="radiogroup">
            {SORTS.map((option) => {
              const selected = draft.sort === option.value;
              return (
                <Pressable
                  key={option.value}
                  onPress={() => setDraft((current) => ({ ...current, sort: option.value }))}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  style={styles.sortRow}
                >
                  <View style={[styles.radio, { borderColor: selected ? tokens.brand : tokens.label }]}>
                    {selected ? <View style={[styles.radioDot, { backgroundColor: tokens.brand }]} /> : null}
                  </View>
                  <AppText variant={selected ? "bodyStrong" : "body"}>{option.label}</AppText>
                </Pressable>
              );
            })}
          </View>
        </GlassCard>
      </Section>
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  price: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    height: 48,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  priceInput: {
    flex: 1,
    fontFamily: FontFamily.medium,
    fontSize: 15,
    paddingVertical: 0,
  },
  sortRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
