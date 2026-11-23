import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { memo } from "react";
import { Pressable, StyleSheet, View } from "react-native";

import { AppText, GlassCard, Money, StatusPill } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { durationText, type Tour } from "@/services/tourApi";
import { formatSen } from "@/utils/money";

/**
 * A tour in a list: photo, charter or guided, name, operator, length and
 * passenger limit, and the one price for the group (never per person).
 */
export const TourCard = memo(function TourCard({ tour, onPress }: { tour: Tour; onPress: (tour: Tour) => void }) {
  const { tokens } = useTheme();
  const photo = tour.images[0]?.url;
  const meta = [
    durationText(tour.durationDays),
    tour.maxPassengers ? `up to ${tour.maxPassengers} passengers` : null,
    tour.branch.city,
  ]
    .filter(Boolean)
    .join(" · ");

  return (
    <Pressable
      onPress={() => onPress(tour)}
      accessibilityRole="button"
      accessibilityLabel={`${tour.name}, ${tour.kindLabel}, ${formatSen(tour.priceSen)} ${tour.priceUnitLabel}`}
      style={({ pressed }) => pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] }}
    >
      <GlassCard padding={8}>
        <View style={[styles.photo, { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine }]}>
          {photo ? (
            <Image source={{ uri: photo }} style={StyleSheet.absoluteFill} contentFit="cover" transition={150} recyclingKey={String(tour.id)} accessible={false} />
          ) : (
            <Ionicons name="map-outline" size={44} color={tokens.label} />
          )}
          <View style={styles.kind}>
            <StatusPill label={tour.kindLabel} tone={tour.kind === "GUIDED" ? "info" : "ok"} />
          </View>
        </View>
        <View style={styles.meta}>
          <AppText variant="headline" numberOfLines={2}>
            {tour.name}
          </AppText>
          <AppText variant="caption" numberOfLines={1}>
            {tour.operator.name}
            {tour.vehicle?.name ? ` · ${tour.vehicle.name}` : ""}
          </AppText>
          <AppText variant="caption">{meta}</AppText>
          <View style={styles.priceRow}>
            <View style={styles.price}>
              <Money sen={tour.priceSen} variant="title" />
              <AppText variant="caption"> {tour.priceUnitLabel}</AppText>
            </View>
            <AppText variant="caption">RM 0 to request</AppText>
          </View>
        </View>
      </GlassCard>
    </Pressable>
  );
});

const styles = StyleSheet.create({
  photo: {
    height: 150,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  kind: { position: "absolute", left: 10, top: 10 },
  meta: { paddingHorizontal: 6, paddingTop: 10, paddingBottom: 4, gap: 5 },
  priceRow: { flexDirection: "row", alignItems: "baseline", justifyContent: "space-between", marginTop: 2 },
  price: { flexDirection: "row", alignItems: "baseline" },
});
