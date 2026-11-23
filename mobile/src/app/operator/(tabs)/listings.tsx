import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QuickEditSheet } from "@/components/operator/QuickEditSheet";
import { AppText, Button, Chip, EmptyState, ErrorState, GlassCard, IconButton, Money, Skeleton, SkeletonText, StatusPill } from "@/components/ui";
import { FontFamily, Radius } from "@/constants/theme";
import { useTabBarInset } from "@/hooks/use-tab-bar-inset";
import { useTheme } from "@/hooks/use-theme";
import { getOperatorListings, type OperatorListing, type OperatorListingSubscription } from "@/services/operatorApi";
import { logger } from "@/utils/logger";
import { DailyStockSheet } from "@/components/operator/DailyStockSheet";

type Filter = "ALL" | "PUBLISHED" | "DRAFT" | "WITHDRAWN";

const FILTERS: { value: Filter; label: string }[] = [
  { value: "ALL", label: "All" },
  { value: "PUBLISHED", label: "Published" },
  { value: "DRAFT", label: "Drafts" },
  { value: "WITHDRAWN", label: "Withdrawn" },
];

function coverOf(listing: OperatorListing) {
  const images = [...(listing.images || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  return (images.find((i) => i.isPrimary) || images[0])?.imageUrl ?? null;
}

/** The operator's cars (plan phase 4): filters, search, quick edit, and the way into details and photos. */
export default function OperatorListingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomInset = useTabBarInset();
  const { tokens } = useTheme();

  const [listings, setListings] = useState<OperatorListing[] | null>(null);
  const [subscription, setSubscription] = useState<OperatorListingSubscription | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [search, setSearch] = useState("");
  const [editing, setEditing] = useState<OperatorListing | null>(null);
  const [dailyStockListing, setDailyStockListing] = useState<OperatorListing | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      const response = await getOperatorListings();
      setListings(Array.isArray(response?.listings) ? response.listings : []);
      setSubscription(response?.subscription || null);
    } catch (err) {
      logger.debug("Failed to load listings:", err);
      setError(err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const shown = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (listings ?? []).filter((l) => {
      if (filter !== "ALL" && l.status !== filter) return false;
      if (!q) return true;
      return [l.name, l.vehicleMake, l.vehicleModel, l.branch?.name].filter(Boolean).join(" ").toLowerCase().includes(q);
    });
  }, [listings, filter, search]);

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <AppText variant="largeTitle" accessibilityRole="header" style={styles.flex}>
          Listings
        </AppText>
        <IconButton icon="business-outline" label="Branches and pick-up points" onPress={() => router.push("/operator/branches" as Href)} />
        <IconButton icon="add" label="Add a listing" onPress={() => router.push("/operator/listing/form" as Href)} />
      </View>

      {subscription ? (
        <GlassCard>
          <View style={styles.planRow}>
            <View style={styles.flex}>
              <AppText variant="micro">{subscription.plan} plan</AppText>
              <AppText variant="bodyStrong">
                {subscription.publishedCount} of {subscription.listingLimit} listings published
              </AppText>
            </View>
            <StatusPill
              label={subscription.remaining > 0 ? `${subscription.remaining} left` : "Limit reached"}
              tone={subscription.remaining > 0 ? "ok" : "warn"}
            />
          </View>
          <View style={[styles.bar, { backgroundColor: tokens.glassStrong }]}>
            <View
              style={[
                styles.barFill,
                {
                  backgroundColor: subscription.remaining > 0 ? tokens.brand : tokens.warnFg,
                  // Display only: how full the plan is.
                  width: `${subscription.listingLimit > 0 ? Math.min(100, (subscription.publishedCount / subscription.listingLimit) * 100) : 0}%` as `${number}%`,
                },
              ]}
            />
          </View>
        </GlassCard>
      ) : null}

      <View style={[styles.search, { backgroundColor: tokens.glass, borderColor: tokens.glassLine }]}>
        <Ionicons name="search-outline" size={18} color={tokens.label} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          placeholder="Search your cars"
          placeholderTextColor={tokens.label}
          accessibilityLabel="Search your cars"
          style={[styles.searchInput, { color: tokens.ink }]}
        />
        {search ? (
          <Pressable onPress={() => setSearch("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={8}>
            <Ionicons name="close-circle" size={18} color={tokens.label} />
          </Pressable>
        ) : null}
      </View>

      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {FILTERS.map((f) => (
          <Chip key={f.value} label={f.label} selected={filter === f.value} onPress={() => setFilter(f.value)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={error && !listings ? [] : shown}
        keyExtractor={(l) => String(l.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={
          error && !listings ? (
            <ErrorState error={error} onRetry={() => load()} />
          ) : listings ? (
            listings.length === 0 ? (
              <EmptyState
                icon="car-sport-outline"
                title="No listings yet"
                message="Add your first listing. It starts as a draft until you publish it."
                action={<Button label="Add a listing" variant="brand" onPress={() => router.push("/operator/listing/form" as Href)} />}
              />
            ) : (
              <EmptyState icon="search-outline" title="No listings match" message="Try another search or filter." />
            )
          ) : (
            <View style={styles.list}>
              {[0, 1].map((i) => (
                <GlassCard key={i} padding={8}>
                  <Skeleton height={140} radius={Radius.md} />
                  <View style={styles.pad8}>
                    <SkeletonText lines={3} />
                  </View>
                </GlassCard>
              ))}
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const cover = coverOf(item);
          // Cars, tours and driver profiles (operator types plan).
          const category = (item as any).category as string | undefined;
          const isTour = category === "TOUR";
          const isDriver = category === "DRIVER_SERVICE";
          const specs = [item.vehicleType, item.transmission === "AUTOMATIC" ? "Auto" : item.transmission === "MANUAL" ? "Manual" : item.transmission, item.seats ? `${item.seats} seats` : null]
            .filter(Boolean)
            .join(" · ");
          return (
            <GlassCard padding={8}>
              <View style={[styles.photo, { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine }]}>
                {cover ? (
                  <Image source={{ uri: cover }} style={StyleSheet.absoluteFill} contentFit="cover" recyclingKey={String(item.id)} accessible={false} />
                ) : (
                  <View style={styles.noPhoto}>
                    <Ionicons name={isTour ? "map-outline" : isDriver ? "person-outline" : "car-sport-outline"} size={36} color={tokens.label} />
                    <AppText variant="caption">No photos yet</AppText>
                  </View>
                )}
                <View style={styles.status}>
                  <StatusPill kind="listing" status={item.status} />
                </View>
              </View>
              <View style={styles.pad8}>
                <AppText variant="headline" numberOfLines={1}>
                  {item.name}
                </AppText>
                <AppText variant="caption" numberOfLines={1}>
                  {[specs, item.branch?.name].filter(Boolean).join(" · ")}
                </AppText>
                <View style={styles.priceRow}>
                  <View style={styles.flex}>
                    <View style={styles.inline}>
                      <Money value={item.price} variant="title" />
                      <AppText variant="caption">{isTour ? " per tour" : " / day"}</AppText>
                    </View>
                  </View>
                  {isDriver ? (
                    <AppText variant="caption">Driver profile</AppText>
                  ) : (
                    <AppText variant="caption">
                      {item.quantity} {isTour ? (item.quantity === 1 ? "group a day" : "groups a day") : item.quantity === 1 ? "car" : "cars"}
                    </AppText>
                  )}
                </View>
                <View style={styles.actions}>
                  <Button label="Quick edit" variant="line" size="sm" grow icon="create-outline" onPress={() => setEditing(item)} />
                  <Button
                    label="Photos & status"
                    variant="line"
                    size="sm"
                    grow
                    icon="images-outline"
                    onPress={() => router.push({ pathname: "/operator/listing/manage", params: { id: String(item.id) } } as unknown as Href)}
                  />
                </View>

                {item.category === "CAR_RENTAL" && (
                  <Button
                    label="Daily Stock"
                    variant="line"
                    size="sm"
                    icon="calendar-outline"
                    onPress={() => setDailyStockListing(item)}
                  />
                )}
                <Button
                  label="Edit details"
                  variant="text"
                  size="sm"
                  icon="chevron-forward"
                  iconPosition="end"
                  style={styles.alignStart}
                  onPress={() => router.push({ pathname: "/operator/listing/form", params: { id: String(item.id) } } as unknown as Href)}
                />
              </View>
            </GlassCard>
          );
        }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: bottomInset }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tokens.label} colors={[tokens.brand]} />
        }
      />

      <QuickEditSheet
        listing={editing}
        onClose={() => setEditing(null)}
        onSaved={(updated) => setListings((current) => current?.map((l) => (l.id === updated.id ? updated : l)) ?? current)}
      />

      <DailyStockSheet
        listing={dailyStockListing}
        onClose={() => setDailyStockListing(null)}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
  },
  header: {
    gap: 12,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  planRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bar: {
    height: 6,
    borderRadius: 3,
    marginTop: 10,
    overflow: "hidden",
  },
  barFill: {
    height: 6,
    borderRadius: 3,
  },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    paddingVertical: 10,
  },
  chips: {
    gap: 8,
    paddingRight: 18,
  },
  list: {
    gap: 12,
  },
  separator: {
    height: 12,
  },
  photo: {
    height: 150,
    borderRadius: Radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  noPhoto: {
    alignItems: "center",
    gap: 4,
  },
  status: {
    position: "absolute",
    top: 10,
    left: 10,
  },
  pad8: {
    padding: 8,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },
  inline: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  alignStart: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
});
