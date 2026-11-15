import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OperatorBookingCard } from "@/components/operator/OperatorBookingCard";
import { ResponseSheets, type BookingResponse } from "@/components/operator/ResponseSheets";
import { AppText, Chip, EmptyState, ErrorState, GlassCard, SkeletonText } from "@/components/ui";
import { useTabBarInset } from "@/hooks/use-tab-bar-inset";
import { useTheme } from "@/hooks/use-theme";
import { getOperatorBookings, type OperatorBooking } from "@/services/operatorApi";
import { logger } from "@/utils/logger";

type Filter = "PENDING" | "UPCOMING" | "IN_PROGRESS" | "ALTERNATIVE_SUGGESTED" | "ALL";

/** UPCOMING is filtered here: paid and waiting for pick-up. The rest are server filters. */
const FILTERS: { value: Filter; label: string; empty: string }[] = [
  { value: "PENDING", label: "Requests", empty: "No requests waiting for an answer." },
  { value: "UPCOMING", label: "Upcoming", empty: "No paid bookings waiting for pick-up." },
  { value: "IN_PROGRESS", label: "On trip", empty: "No cars out right now." },
  { value: "ALTERNATIVE_SUGGESTED", label: "Offers sent", empty: "No offers waiting for a customer's answer." },
  { value: "ALL", label: "All", empty: "No bookings yet." },
];

const UPCOMING = new Set(["PAID", "READY_FOR_PICKUP"]);

/** Operator bookings (plan phase 4), on the same card as the dashboard's requests. */
export default function OperatorBookingsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomInset = useTabBarInset();
  const { tokens } = useTheme();

  const [filter, setFilter] = useState<Filter>("PENDING");
  const [bookings, setBookings] = useState<OperatorBooking[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [respond, setRespond] = useState<{ booking: OperatorBooking; action: BookingResponse } | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      else setBookings(null);
      setError(null);
      setNow(new Date());
      try {
        const response = await getOperatorBookings(filter === "UPCOMING" ? "ALL" : filter);
        const list = Array.isArray(response?.bookings) ? response.bookings : [];
        setBookings(filter === "UPCOMING" ? list.filter((b) => UPCOMING.has(b.status)) : list);
      } catch (err) {
        logger.debug("Failed to load operator bookings:", err);
        setError(err);
      } finally {
        setRefreshing(false);
      }
    },
    [filter]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const current = FILTERS.find((f) => f.value === filter)!;

  const header = (
    <View style={styles.header}>
      <AppText variant="largeTitle" accessibilityRole="header">
        Bookings
      </AppText>
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
        data={error ? [] : bookings ?? []}
        keyExtractor={(b) => String(b.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={
          error ? (
            <ErrorState error={error} onRetry={() => load()} />
          ) : bookings ? (
            <EmptyState icon="calendar-outline" title={current.empty} />
          ) : (
            <View style={styles.list}>
              {[0, 1, 2].map((i) => (
                <GlassCard key={i}>
                  <SkeletonText lines={4} />
                </GlassCard>
              ))}
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <OperatorBookingCard
            booking={item}
            now={now}
            onOpen={(b) => router.push(`/operator/booking/${b.id}` as Href)}
            onRespond={(booking, action) => setRespond({ booking, action })}
          />
        )}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tokens.label} colors={[tokens.brand]} />
        }
      />

      <ResponseSheets
        booking={respond?.booking ?? null}
        action={respond?.action ?? null}
        onClose={() => setRespond(null)}
        onDone={() => load(true)}
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
});
