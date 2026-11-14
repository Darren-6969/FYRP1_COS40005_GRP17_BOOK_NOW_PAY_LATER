import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { BookingCard, offerSummary } from "@/components/booking/BookingCard";
import {
  AppText,
  Button,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  SegmentedControl,
  Skeleton,
  useToast,
} from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTabBarInset } from "@/hooks/use-tab-bar-inset";
import { useTheme } from "@/hooks/use-theme";
import { getCustomerBookings, rejectAlternative } from "@/services/customerApi";
import { isActiveBooking, owedPart } from "@/utils/booking-view";
import { logger } from "@/utils/logger";

type Tab = "active" | "past";

const TABS = [
  { value: "active", label: "Active" },
  { value: "past", label: "Past" },
] as const;

/**
 * The customer's bookings (plan phase 3, Bookings mock). Active shows what
 * still needs something from the customer or the operator, with the next
 * step on each card. Reloads whenever the tab comes into view, so a booking
 * paid or answered elsewhere is never shown in its old state.
 */
export default function Bookings() {
  const router = useRouter();
  const toast = useToast();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = useTabBarInset();

  const [bookings, setBookings] = useState<any[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("active");
  const [declining, setDeclining] = useState<any | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      const data = await getCustomerBookings();
      setBookings(Array.isArray(data) ? data : []);
    } catch (err) {
      logger.debug("Failed to load bookings:", err);
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

  const { active, past } = useMemo(() => {
    const all = bookings ?? [];
    const activeList = all.filter(isActiveBooking);
    // Bookings waiting on the customer first: a payment due, then an offer.
    const rank = (b: any) => (owedPart(b) ? 0 : b.status === "ALTERNATIVE_SUGGESTED" ? 1 : 2);
    activeList.sort((a, b) => rank(a) - rank(b));
    return { active: activeList, past: all.filter((b) => !isActiveBooking(b)) };
  }, [bookings]);

  const shown = tab === "active" ? active : past;

  const openBooking = useCallback(
    (booking: any) => router.push({ pathname: "/customer/booking/[id]", params: { id: String(booking.id) } } as unknown as Href),
    [router]
  );

  const reviewOffer = useCallback(
    (booking: any) =>
      router.push({ pathname: "/customer/booking/[id]", params: { id: String(booking.id), offer: "1" } } as unknown as Href),
    [router]
  );

  const pay = useCallback(
    (booking: any) => {
      const owed = owedPart(booking);
      router.push({
        pathname: "/customer/checkout",
        params: { bookingId: String(booking.id), ...(owed ? { type: owed.part } : {}) },
      } as unknown as Href);
    },
    [router]
  );

  const confirmDecline = async () => {
    if (!declining) return;
    await rejectAlternative(declining.id);
    setDeclining(null);
    toast.show("Offer declined. The booking is closed.", { tone: "info" });
    await load();
  };

  const header = (
    <View style={styles.header}>
      <View>
        <AppText variant="largeTitle" accessibilityRole="header">
          Bookings
        </AppText>
        {bookings ? (
          <AppText variant="caption">
            {active.length === 0 ? "Nothing active" : `${active.length} active`}
          </AppText>
        ) : null}
      </View>
      <SegmentedControl options={TABS} value={tab} onChange={setTab} accessibilityLabel="Show bookings" />
    </View>
  );

  const empty =
    bookings === null && !error ? (
      <View style={styles.list}>
        <Skeleton height={168} radius={Radius.card} />
        <Skeleton height={168} radius={Radius.card} />
        <Skeleton height={168} radius={Radius.card} />
      </View>
    ) : error ? (
      <ErrorState error={error} onRetry={() => load()} compact />
    ) : tab === "active" ? (
      <EmptyState
        icon="calendar-outline"
        title="No active bookings"
        message="Send a booking request for a car. You don't pay anything until the operator accepts."
        action={<Button label="Browse cars" variant="brand" size="sm" onPress={() => router.push("/customer/cars")} />}
      />
    ) : (
      <EmptyState icon="time-outline" title="No past bookings" message="Completed, cancelled and declined bookings show here." />
    );

  return (
    <View style={styles.screen}>
      <FlatList
        data={shown}
        keyExtractor={(booking) => String(booking.id)}
        renderItem={({ item }) => (
          <BookingCard booking={item} onOpen={openBooking} onPay={pay} onReviewOffer={reviewOffer} onDecline={setDeclining} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tokens.label} colors={[tokens.brand]} />
        }
      />

      <ConfirmSheet
        visible={declining !== null}
        title="Decline this offer?"
        message={
          declining
            ? `${offerSummary(declining)} If you decline, this booking closes and nothing is charged. You can send a new request for another car.`
            : undefined
        }
        confirmLabel="Decline offer"
        confirmVariant="danger"
        cancelLabel="Keep the offer"
        onConfirm={confirmDecline}
        onCancel={() => setDeclining(null)}
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
    gap: 16,
    marginBottom: 16,
  },
  list: {
    gap: 16,
  },
  separator: {
    height: 14,
  },
});
