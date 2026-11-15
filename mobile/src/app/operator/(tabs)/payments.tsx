import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { ReceiptReviewSheet, receiptPart } from "@/components/operator/ReceiptReviewSheet";
import {
  AppText,
  EmptyState,
  ErrorState,
  GlassCard,
  Money,
  SegmentedControl,
  SkeletonText,
  StatusPill,
  type SegmentOption,
} from "@/components/ui";
import { useTabBarInset } from "@/hooks/use-tab-bar-inset";
import { useTheme } from "@/hooks/use-theme";
import { getOperatorPayments, type OperatorPayment } from "@/services/operatorApi";
import { formatMYT } from "@/utils/datetime";
import { logger } from "@/utils/logger";
import { customerName, operatorBookingRef, operatorBookingTitle } from "@/utils/operator-booking";

type Tab = "CHECK" | "ALL";

const TABS: readonly SegmentOption<Tab>[] = [
  { value: "CHECK", label: "To check" },
  { value: "ALL", label: "All payments" },
];

function waitingForReview(p: OperatorPayment) {
  return (
    String(p.status).includes("PENDING_VERIFICATION") ||
    p.downPaymentStatus === "PENDING_VERIFICATION" ||
    p.finalPaymentStatus === "PENDING_VERIFICATION"
  );
}

/** A receipt the operator can act on now (the same rule the old screen used). */
function reviewable(p: OperatorPayment) {
  return waitingForReview(p) && p.status !== "PAID" && p.booking?.receipt?.status === "PENDING" && !!p.booking?.receipt?.imageUrl;
}

/** Operator payments (plan phase 4): receipts to check first, then everything. */
export default function OperatorPaymentsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomInset = useTabBarInset();
  const { tokens } = useTheme();

  const [tab, setTab] = useState<Tab>("CHECK");
  const [payments, setPayments] = useState<OperatorPayment[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [reviewing, setReviewing] = useState<OperatorPayment | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      const response = await getOperatorPayments();
      setPayments(Array.isArray(response?.payments) ? response.payments : []);
    } catch (err) {
      logger.debug("Failed to load operator payments:", err);
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

  const toCheck = useMemo(() => (payments ?? []).filter(reviewable), [payments]);
  const shown = tab === "CHECK" ? toCheck : payments ?? [];

  const open = (p: OperatorPayment) => {
    if (reviewable(p)) setReviewing(p);
    else if (p.bookingId) router.push(`/operator/booking/${p.bookingId}` as Href);
  };

  const header = (
    <View style={styles.header}>
      <AppText variant="largeTitle" accessibilityRole="header">
        Payments
      </AppText>
      <SegmentedControl options={TABS} value={tab} onChange={setTab} accessibilityLabel="Show" />
      {payments && toCheck.length > 0 ? (
        <AppText variant="caption">
          {toCheck.length === 1 ? "1 receipt waiting for you" : `${toCheck.length} receipts waiting for you`}
        </AppText>
      ) : null}
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={error && !payments ? [] : shown}
        keyExtractor={(p) => String(p.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={
          error && !payments ? (
            <ErrorState error={error} onRetry={() => load()} />
          ) : payments ? (
            <EmptyState
              icon="wallet-outline"
              title={tab === "CHECK" ? "No receipts to check" : "No payments yet"}
              message={tab === "CHECK" ? "DuitNow and SPay receipts from customers appear here." : undefined}
            />
          ) : (
            <View style={styles.list}>
              {[0, 1, 2].map((i) => (
                <GlassCard key={i}>
                  <SkeletonText lines={3} />
                </GlassCard>
              ))}
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const booking = item.booking;
          const check = reviewable(item);
          const part = receiptPart(item);
          return (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={[
                booking ? operatorBookingRef(booking) : null,
                booking ? customerName(booking) : null,
                check ? `${part.label} receipt to check` : null,
              ]
                .filter(Boolean)
                .join(", ")}
              style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            >
              <GlassCard strong={check}>
                <View style={styles.row}>
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong" numberOfLines={1}>
                      {booking ? customerName(booking) : `Payment #${item.id}`}
                    </AppText>
                    <AppText variant="caption" numberOfLines={1}>
                      {booking ? `${operatorBookingRef(booking)} · ${operatorBookingTitle(booking)}` : ""}
                    </AppText>
                  </View>
                  <Money value={check ? part.amount : item.amount} variant="bodyStrong" />
                </View>
                <View style={styles.pills}>
                  {check ? (
                    <StatusPill label={`${part.label} receipt to check`} tone="warn" />
                  ) : (
                    <StatusPill kind="payment" status={item.status} />
                  )}
                  {item.method ? <StatusPill label={item.method} tone="neutral" dot={false} /> : null}
                </View>
                {check && booking?.receipt?.uploadedAt ? (
                  <AppText variant="caption" style={styles.mt8}>
                    Sent {formatMYT(booking.receipt.uploadedAt, "dayDateTime")}
                  </AppText>
                ) : item.updatedAt ? (
                  <AppText variant="caption" style={styles.mt8}>
                    Updated {formatMYT(item.updatedAt, "dayDateTime")}
                  </AppText>
                ) : null}
              </GlassCard>
            </Pressable>
          );
        }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tokens.label} colors={[tokens.brand]} />
        }
      />

      <ReceiptReviewSheet payment={reviewing} onClose={() => setReviewing(null)} onDone={() => load(true)} />
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
  flex: {
    flex: 1,
  },
  list: {
    gap: 12,
  },
  separator: {
    height: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  pills: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 6,
    marginTop: 10,
  },
  mt8: {
    marginTop: 8,
  },
});
