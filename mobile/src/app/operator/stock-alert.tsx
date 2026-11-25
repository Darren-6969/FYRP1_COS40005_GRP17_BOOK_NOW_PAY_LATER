import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { DailyStockSheet } from "@/components/operator/DailyStockSheet";
import {
  AppText,
  Button,
  ErrorState,
  GlassCard,
  IconButton,
  SkeletonText,
  TextField,
  useToast,
} from "@/components/ui";
import {
  getOperatorListingById,
  getOperatorListings,
  quickEditOperatorListing,
  type OperatorListing,
} from "@/services/operatorApi";
import { describeError } from "@/utils/errors";
import { logger } from "@/utils/logger";
import { startAsync } from "@/utils/start-async";

const PLAIN_DATE = /^\d{4}-\d{2}-\d{2}$/;

function dateText(value: string) {
  return new Intl.DateTimeFormat("en-MY", { day: "numeric", month: "short", timeZone: "UTC" }).format(
    new Date(`${value}T00:00:00Z`)
  );
}

/** Same vehicle identity Branch Transfer uses, so only cars it accepts are offered. */
function vehicleKey(listing: OperatorListing) {
  return [listing.vehicleMake, listing.vehicleModel, listing.vehicleType, listing.modelYear, listing.transmission, listing.seats]
    .map((value) => String(value ?? "").trim().toLowerCase())
    .join("|");
}

/**
 * BNPLB-184: the sold-out alert, opened from the notification. Names the
 * listing and dates and offers the two ways to take the next request:
 * raise the car count, or move a car from another branch. Daily Stock for
 * the dates is here too, for a date that was lowered on purpose.
 */
export default function StockAlertScreen() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ listingId?: string; dates?: string }>();
  const listingId = Number(params.listingId) || null;
  const dates = String(params.dates ?? "")
    .split(",")
    .filter((value) => PLAIN_DATE.test(value))
    .sort();

  const [listing, setListing] = useState<OperatorListing | null>(null);
  const [others, setOthers] = useState<OperatorListing[]>([]);
  const [error, setError] = useState<unknown>(null);
  const [count, setCount] = useState("");
  const [countError, setCountError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const [showDailyStock, setShowDailyStock] = useState(false);

  const load = useCallback(
    () =>
      startAsync(async () => {
        if (!listingId) return;
        try {
          const [own, all] = await Promise.all([getOperatorListingById(listingId), getOperatorListings()]);
          setListing(own.listing);
          setCount(String(Number(own.listing.quantity || 0) + 1));
          setOthers(all.listings ?? []);
        } catch (err) {
          logger.debug("Failed to load the stock alert:", err);
          setError(err);
        }
      }),
    [listingId]
  );

  useEffect(() => {
    load();
  }, [load]);

  const isCar = listing?.category === "CAR_RENTAL";
  const sources =
    listing && isCar
      ? others.filter(
          (item) =>
            item.id !== listing.id &&
            item.branchId !== listing.branchId &&
            item.category === "CAR_RENTAL" &&
            item.quantity > 0 &&
            vehicleKey(item) === vehicleKey(listing)
        )
      : [];

  const datesText =
    dates.length > 3
      ? `${dateText(dates[0])} to ${dateText(dates[dates.length - 1])}`
      : dates.map(dateText).join(", ");

  const raiseCount = async () => {
    if (!listing) return;
    const next = Number(count);
    if (!Number.isInteger(next) || next <= listing.quantity) {
      setCountError(`Enter a number above the current ${listing.quantity}.`);
      return;
    }
    setSaving(true);
    setCountError(null);
    try {
      await quickEditOperatorListing(listing.id, { quantity: next });
      toast.show(`Car count is now ${next}.`, { tone: "ok" });
      await load();
    } catch (err) {
      setCountError(describeError(err).message);
    } finally {
      setSaving(false);
    }
  };

  const header = (
    <View style={styles.topRow}>
      <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
      <AppText variant="largeTitle" accessibilityRole="header" style={styles.flex} numberOfLines={1} adjustsFontSizeToFit>
        Fully booked
      </AppText>
    </View>
  );

  if (!listingId || error) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8 }]}>
        {header}
        <ErrorState
          error={error ?? new Error("This alert is no longer available.")}
          onRetry={
            listingId
              ? () => {
                  setError(null);
                  return load();
                }
              : undefined
          }
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
      >
        {header}

        {!listing ? (
          <GlassCard>
            <SkeletonText lines={3} />
          </GlassCard>
        ) : (
          <>
            <GlassCard>
              <AppText variant="headline">
                {listing.name}
                {listing.branch?.name ? ` (${listing.branch.name})` : ""}
              </AppText>
              <AppText variant="body" style={styles.mt8}>
                Fully booked on {datesText || "the alert's dates"}. Customers can&apos;t request it for{" "}
                {dates.length === 1 ? "this date" : "these dates"} until a car is free.
              </AppText>
            </GlassCard>

            <GlassCard>
              <View style={styles.section}>
                <AppText variant="headline">Add a car</AppText>
                <AppText variant="caption">
                  Raise the car count if you have another one for the platform. It&apos;s {listing.quantity} now.
                </AppText>
                <TextField
                  label="Car count"
                  value={count}
                  keyboardType="number-pad"
                  onChangeText={(value) => {
                    setCount(value);
                    setCountError(null);
                  }}
                  error={countError}
                />
                <Button label={saving ? "Saving..." : "Save car count"} variant="brand" disabled={saving} onPress={raiseCount} />
              </View>
            </GlassCard>

            {isCar ? (
              <GlassCard>
                <View style={styles.section}>
                  <AppText variant="headline">Move a car from another branch</AppText>
                  {sources.length ? (
                    sources.map((source) => (
                      <View key={source.id} style={styles.sourceRow}>
                        <AppText variant="body" style={styles.flex}>
                          {source.branch?.name || "Branch"}: {source.quantity} car{source.quantity === 1 ? "" : "s"}
                        </AppText>
                        <Button
                          label="Move a car"
                          size="sm"
                          variant="line"
                          onPress={() =>
                            router.push({
                              pathname: "/operator/branch-transfer",
                              params: { sourceListingId: String(source.id), destinationListingId: String(listing.id) },
                            } as Href)
                          }
                        />
                      </View>
                    ))
                  ) : (
                    <AppText variant="caption">No other branch has a matching car to move.</AppText>
                  )}
                </View>
              </GlassCard>
            ) : null}

            {isCar ? (
              <GlassCard>
                <View style={styles.section}>
                  <AppText variant="headline">Daily Stock</AppText>
                  <AppText variant="caption">If you lowered the stock on these dates, restore it here.</AppText>
                  <Button label="Open Daily Stock" variant="line" onPress={() => setShowDailyStock(true)} />
                </View>
              </GlassCard>
            ) : null}

          </>
        )}
      </ScrollView>

      {showDailyStock && listing ? (
        <DailyStockSheet
          listing={listing}
          initialFrom={dates[0]}
          initialTo={dates[dates.length - 1]}
          onClose={() => {
            setShowDailyStock(false);
            load();
          }}
        />
      ) : null}
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
    gap: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  mt8: {
    marginTop: 8,
  },
  section: {
    gap: 10,
  },
  sourceRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
});
