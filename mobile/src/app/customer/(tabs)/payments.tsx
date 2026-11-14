import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  PaymentCard,
  bookingOf,
  paymentGroup,
  type CustomerPayment,
  type PaymentGroup,
} from "@/components/booking/PaymentCard";
import { AppText, EmptyState, ErrorState, SegmentedControl, Skeleton } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTabBarInset } from "@/hooks/use-tab-bar-inset";
import { useTheme } from "@/hooks/use-theme";
import { getCustomerPayments } from "@/services/customerApi";
import { owedPart } from "@/utils/booking-view";
import { logger } from "@/utils/logger";

type Tab = "due" | "review" | "paid" | "all";

const TABS = [
  { value: "due", label: "To pay" },
  { value: "review", label: "In review" },
  { value: "paid", label: "Paid" },
  { value: "all", label: "All" },
] as const;

const EMPTY: Record<Tab, { title: string; message: string }> = {
  due: { title: "Nothing to pay", message: "Payments appear here once an operator accepts your request." },
  review: { title: "No receipts in review", message: "DuitNow receipts you upload wait here until the operator checks them." },
  paid: { title: "No paid bookings yet", message: "Bookings you've paid in full show here." },
  all: { title: "No payments yet", message: "Payments appear here once an operator accepts your request." },
};

/**
 * The customer's payments (plan phase 3). One card per booking with a
 * payment schedule, grouped by what the customer needs to do. The old
 * screen's "Total paid" figure was summed on the phone, so it's gone (F16).
 * Reloads whenever the tab comes into view.
 */
export default function PaymentsScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = useTabBarInset();

  const [payments, setPayments] = useState<CustomerPayment[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [tab, setTab] = useState<Tab>("due");

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      const data = await getCustomerPayments();
      setPayments(Array.isArray(data) ? data : []);
    } catch (err) {
      logger.debug("Failed to load payments:", err);
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

  const groups = useMemo(() => {
    const out: Record<PaymentGroup, CustomerPayment[]> = { due: [], review: [], paid: [], closed: [] };
    for (const p of payments ?? []) out[paymentGroup(p)].push(p);
    // Soonest deadline first.
    out.due.sort((a, b) => {
      const da = owedPart(bookingOf(a))?.dueAt;
      const db = owedPart(bookingOf(b))?.dueAt;
      if (!da) return 1;
      if (!db) return -1;
      return new Date(da).getTime() - new Date(db).getTime();
    });
    return out;
  }, [payments]);

  const shown = tab === "all" ? payments ?? [] : groups[tab];

  const pay = useCallback(
    (payment: CustomerPayment) => {
      const owed = owedPart(bookingOf(payment));
      router.push({
        pathname: "/customer/checkout",
        params: { bookingId: String(payment.bookingId), ...(owed ? { type: owed.part } : {}) },
      } as unknown as Href);
    },
    [router]
  );

  const openInvoice = useCallback(
    (payment: CustomerPayment) =>
      router.push({ pathname: "/customer/invoice/[id]", params: { id: String(payment.bookingId) } } as unknown as Href),
    [router]
  );

  const openBooking = useCallback(
    (payment: CustomerPayment) =>
      router.push({ pathname: "/customer/booking/[id]", params: { id: String(payment.bookingId) } } as unknown as Href),
    [router]
  );

  const summary = payments
    ? [
        groups.due.length ? `${groups.due.length} to pay` : null,
        groups.review.length ? `${groups.review.length} in review` : null,
      ]
        .filter(Boolean)
        .join(" · ") || "All settled"
    : null;

  const header = (
    <View style={styles.header}>
      <View>
        <AppText variant="largeTitle" accessibilityRole="header">
          Payments
        </AppText>
        {summary ? <AppText variant="caption">{summary}</AppText> : null}
      </View>
      <SegmentedControl options={TABS} value={tab} onChange={setTab} accessibilityLabel="Show payments" />
    </View>
  );

  const empty =
    payments === null && !error ? (
      <View style={styles.list}>
        <Skeleton height={200} radius={Radius.card} />
        <Skeleton height={200} radius={Radius.card} />
      </View>
    ) : error ? (
      <ErrorState error={error} onRetry={() => load()} compact />
    ) : (
      <EmptyState icon="wallet-outline" title={EMPTY[tab].title} message={EMPTY[tab].message} />
    );

  return (
    <View style={styles.screen}>
      <FlatList
        data={shown}
        keyExtractor={(payment) => String(payment.id)}
        renderItem={({ item }) => (
          <PaymentCard payment={item} onPay={pay} onInvoice={openInvoice} onOpenBooking={openBooking} />
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
