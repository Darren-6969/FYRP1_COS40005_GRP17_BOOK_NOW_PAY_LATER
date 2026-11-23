import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppText,
  Button,
  ErrorState,
  FLOATING_BAR_CLEARANCE,
  FloatingActionBar,
  GlassCard,
  IconButton,
  Money,
  SkeletonText,
  StatusPill,
} from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { durationText, getTour, type Tour } from "@/services/tourApi";
import { formatSen } from "@/utils/money";
import { startAsync } from "@/utils/start-async";

type IconName = ComponentProps<typeof Ionicons>["name"];

/**
 * One tour: what's included, where it starts, the car for a charter tour,
 * and the one price for the group. "Choose a date" opens the booking form.
 */
export default function TourDetailsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();

  const [tour, setTour] = useState<Tour | null>(null);
  const [error, setError] = useState<unknown>(null);

  const load = useCallback(
    () =>
      startAsync(async () => {
        if (!params.id) return;
        try {
          setTour(await getTour(params.id));
        } catch (err) {
          setError(err);
        }
      }),
    [params.id]
  );

  useEffect(() => {
    load();
  }, [load]);

  const shownError = error ?? (params.id ? null : new Error("This tour link is missing the tour."));
  if (shownError) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingHorizontal: 18 }]}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <ErrorState
          error={shownError}
          onRetry={() => {
            setError(null);
            return load();
          }}
        />
      </View>
    );
  }

  if (!tour) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8, paddingHorizontal: 18, gap: 16 }]}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <GlassCard>
          <SkeletonText lines={6} />
        </GlassCard>
      </View>
    );
  }

  const photo = tour.images[0]?.url;
  const book = () =>
    router.push({ pathname: "/customer/tour-booking", params: { id: String(tour.id) } } as unknown as Href);

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: FLOATING_BAR_CLEARANCE + insets.bottom + 12 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        </View>

        <View style={[styles.photo, { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine }]}>
          {photo ? (
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} accessible={false} />
          ) : (
            <Ionicons name="map-outline" size={52} color={tokens.label} />
          )}
        </View>

        <View style={styles.gap6}>
          <View style={styles.row}>
            <StatusPill label={tour.kindLabel} tone={tour.kind === "GUIDED" ? "info" : "ok"} />
          </View>
          <AppText variant="largeTitle" accessibilityRole="header">
            {tour.name}
          </AppText>
          <AppText variant="caption">
            {tour.operator.name}
            {tour.operator.verified ? " · Verified" : ""}
          </AppText>
        </View>

        <GlassCard>
          <Fact icon="time-outline" label="Length" value={durationText(tour.durationDays)} />
          {tour.maxPassengers ? <Fact icon="people-outline" label="Passengers" value={`Up to ${tour.maxPassengers}`} /> : null}
          {tour.pickupTimes.length ? <Fact icon="alarm-outline" label="Pickup times" value={tour.pickupTimes.join(", ")} /> : null}
          {tour.vehicle?.name || tour.vehicle?.type ? (
            <Fact
              icon="car-outline"
              label="Car"
              value={[tour.vehicle?.name, tour.vehicle?.type, tour.vehicle?.seats ? `${tour.vehicle.seats} seats` : null]
                .filter(Boolean)
                .join(" · ")}
            />
          ) : null}
          {tour.meetingPoint ? <Fact icon="flag-outline" label="Meeting point" value={tour.meetingPoint} /> : null}
          <Fact icon="business-outline" label="Starts from" value={[tour.branch.name, tour.branch.city].filter(Boolean).join(", ")} />
        </GlassCard>

        {tour.description ? <AppText variant="body">{tour.description}</AppText> : null}

        <ListCard title="Highlights" items={tour.highlights} />
        <ListCard title="Itinerary" items={tour.itinerary} numbered />
        <ListCard title="Included" items={tour.inclusions} icon="checkmark-circle-outline" />
        <ListCard title="Not included" items={tour.exclusions} icon="close-circle-outline" />

        {tour.pickupPoints.length ? (
          <Section title="Pickup points">
            <GlassCard padding={4}>
              {tour.pickupPoints.map((point, i) => (
                <View
                  key={point.id}
                  style={[styles.point, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.line }]}
                >
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">{point.label}</AppText>
                    {point.address ? <AppText variant="caption">{point.address}</AppText> : null}
                  </View>
                  <AppText variant="label" color={point.feeSen ? "ink" : "label"}>
                    {point.feeSen ? `+${formatSen(point.feeSen)}` : "Free"}
                  </AppText>
                </View>
              ))}
            </GlassCard>
          </Section>
        ) : null}

        {tour.policies.cancellation || tour.policies.refund ? (
          <Section title="Cancellation">
            <GlassCard>
              <AppText variant="body">{tour.policies.cancellation || tour.policies.refund}</AppText>
            </GlassCard>
          </Section>
        ) : null}

        <AppText variant="caption">
          You pay a {tour.depositPct}% down payment once the operator accepts, and the balance before the tour. If
          you cancel, the operator keeps the down payment and any balance you have paid comes back in full.
        </AppText>
      </ScrollView>

      <FloatingActionBar action={<Button label="Choose a date" variant="cta" grow onPress={book} />}>
        <View style={styles.price}>
          <Money sen={tour.priceSen} variant="headline" />
          <AppText variant="caption"> {tour.priceUnitLabel}</AppText>
        </View>
        <AppText variant="caption">{formatSen(tour.depositSen)} down payment</AppText>
      </FloatingActionBar>
    </View>
  );
}

function Section({ title, children }: { title: string; children: ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="headline" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

function Fact({ icon, label, value }: { icon: IconName; label: string; value: string }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.fact} accessible accessibilityLabel={`${label}: ${value}`}>
      <Ionicons name={icon} size={18} color={tokens.leafInk} />
      <AppText variant="caption" style={styles.factLabel}>
        {label}
      </AppText>
      <AppText variant="label" color="ink" style={styles.flex} align="right">
        {value}
      </AppText>
    </View>
  );
}

function ListCard({
  title,
  items,
  numbered = false,
  icon = "ellipse",
}: {
  title: string;
  items: string[];
  numbered?: boolean;
  icon?: IconName;
}) {
  const { tokens } = useTheme();
  if (!items?.length) return null;
  return (
    <Section title={title}>
      <GlassCard>
        {items.map((item, i) => (
          <View key={`${i}-${item}`} style={styles.listRow}>
            {numbered ? (
              <AppText variant="label" color="leafInk" style={styles.num}>
                {i + 1}.
              </AppText>
            ) : (
              <Ionicons name={icon} size={icon === "ellipse" ? 7 : 17} color={tokens.leafInk} style={styles.bullet} />
            )}
            <AppText variant="body" style={styles.flex}>
              {item}
            </AppText>
          </View>
        ))}
      </GlassCard>
    </Section>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18, gap: 16 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  row: { flexDirection: "row" },
  flex: { flex: 1 },
  gap6: { gap: 6 },
  section: { gap: 10 },
  photo: {
    height: 210,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  fact: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 6 },
  factLabel: { width: 100 },
  point: { flexDirection: "row", alignItems: "center", gap: 12, padding: 12 },
  listRow: { flexDirection: "row", alignItems: "flex-start", gap: 10, paddingVertical: 4 },
  bullet: { marginTop: 7 },
  num: { width: 22 },
  price: { flexDirection: "row", alignItems: "baseline" },
});
