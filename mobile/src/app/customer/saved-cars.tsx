import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CarCard, type CarSummary } from "@/components/booking/CarCard";
import { AppText, Button, EmptyState, ErrorState, GlassCard, IconButton, Skeleton, SkeletonText, StatusPill, useToast } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getSavedListings, removeSavedListing } from "@/services/customerApi";
import { logger } from "@/utils/logger";

type SavedCar = {
  listingId: number;
  savedAt?: string;
  available?: boolean;
  car?: {
    title?: string;
    vehicleType?: string;
    seats?: number;
    transmission?: string;
    imageUrl?: string | null;
    /** Server amount in integer sen (F16: formatted, never calculated). */
    dailyRateSen?: number;
    operator?: { companyName?: string };
    branch?: { city?: string };
  };
};

/** The saved item in the shape the shared car card reads. */
function toSummary(item: SavedCar): CarSummary {
  const car = item.car || {};
  return {
    id: item.listingId,
    name: car.title || null,
    vehicleType: car.vehicleType || null,
    seats: car.seats ?? null,
    transmission: car.transmission || null,
    images: car.imageUrl ? [{ imageUrl: car.imageUrl }] : [],
    operator: car.operator ? { companyName: car.operator.companyName ?? null } : null,
    branch: car.branch ? { city: car.branch.city ?? null } : null,
    booking: { dailyRateSen: car.dailyRateSen ?? null },
  };
}

/** Saved cars (plan phase 3), on the shared car card. */
export default function SavedCarsScreen() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  const [items, setItems] = useState<SavedCar[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [removing, setRemoving] = useState<Set<number>>(new Set());

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      const data = await getSavedListings();
      setItems(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      logger.debug("Failed to load saved cars:", err);
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

  // Removed at once; put back if the server refuses. Saving again is one tap,
  // so there is no confirmation.
  const remove = async (item: SavedCar) => {
    if (removing.has(item.listingId)) return;
    setRemoving((s) => new Set(s).add(item.listingId));
    const before = items;
    setItems((current) => current?.filter((i) => i.listingId !== item.listingId) ?? current);
    try {
      await removeSavedListing(item.listingId);
      toast.show("Removed from saved cars.", { tone: "ok" });
    } catch (err) {
      logger.debug("Failed to remove saved car:", err);
      setItems(before);
      toast.show("Couldn't remove it. Try again.", { tone: "err" });
    } finally {
      setRemoving((s) => {
        const next = new Set(s);
        next.delete(item.listingId);
        return next;
      });
    }
  };

  const openCar = (item: SavedCar) => {
    if (item.available === false) return;
    router.push({ pathname: "/customer/car-details", params: { id: String(item.listingId) } } as unknown as Href);
  };

  const header = (
    <View style={styles.topRow}>
      <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
      <AppText variant="largeTitle" accessibilityRole="header" style={styles.flex} numberOfLines={1}>
        Saved cars
      </AppText>
    </View>
  );

  if (error && !items) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8 }]}>
        {header}
        <ErrorState error={error} onRetry={() => load()} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items ?? []}
        keyExtractor={(item) => String(item.listingId)}
        ListHeaderComponent={<View style={styles.headerWrap}>{header}</View>}
        ListEmptyComponent={
          items ? (
            <EmptyState
              icon="heart-outline"
              title="No saved cars yet"
              message="Tap the heart on a car to keep it here for later."
              action={<Button label="Browse cars" variant="brand" onPress={() => router.push("/customer/cars" as Href)} />}
            />
          ) : (
            <View style={styles.list}>
              {[0, 1].map((i) => (
                <GlassCard key={i} padding={8}>
                  <Skeleton height={150} radius={Radius.md} />
                  <View style={styles.skeletonText}>
                    <SkeletonText lines={3} />
                  </View>
                </GlassCard>
              ))}
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const unavailable = item.available === false;
          return (
            <View style={unavailable ? styles.dimmed : null}>
              {unavailable ? (
                <View style={styles.unavailable}>
                  <StatusPill label="Not available now" tone="neutral" />
                </View>
              ) : null}
              <CarCard car={toSummary(item)} saved onPress={() => openCar(item)} onToggleSaved={() => remove(item)} />
            </View>
          );
        }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tokens.label} colors={[tokens.brand]} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: 18,
  },
  content: {
    paddingHorizontal: 18,
  },
  headerWrap: {
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  list: {
    gap: 12,
  },
  separator: {
    height: 12,
  },
  skeletonText: {
    padding: 8,
  },
  dimmed: {
    opacity: 0.6,
  },
  unavailable: {
    position: "absolute",
    top: 18,
    left: 18,
    zIndex: 2,
  },
});
