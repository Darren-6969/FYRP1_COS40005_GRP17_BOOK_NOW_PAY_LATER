import { useFocusEffect, useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState, type ReactNode } from "react";
import { Linking, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { QuoteBreakdown } from "@/components/booking/QuoteBreakdown";
import {
  AppText,
  Button,
  ErrorState,
  GlassCard,
  IconButton,
  Money,
  SkeletonText,
  StatusPill,
} from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { getCustomerBookingById } from "@/services/customerApi";
import { bookingRef, bookingTitle } from "@/utils/booking-view";
import { formatMYT } from "@/utils/datetime";
import { logger } from "@/utils/logger";

const INVOICE_STATUS: Record<string, { label: string; tone: "ok" | "info" | "neutral" }> = {
  GENERATED: { label: "Issued", tone: "info" },
  SENT: { label: "Sent", tone: "info" },
  PAID: { label: "Paid", tone: "ok" },
  CANCELLED: { label: "Cancelled", tone: "neutral" },
};

/**
 * The invoice for a booking (route param `id` is the booking ID). Every
 * figure is the server's: the pricing snapshot's lines for car bookings,
 * then the two payment parts and what's been paid (F16, nothing re-added).
 */
export default function InvoiceScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const { id: bookingId } = useLocalSearchParams<{ id: string }>();

  const [booking, setBooking] = useState<any | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(
    async (refresh = false) => {
      if (!bookingId) return;
      if (refresh) setRefreshing(true);
      setError(null);
      try {
        setBooking(await getCustomerBookingById(bookingId));
      } catch (err) {
        logger.debug("Failed to load invoice:", err);
        setError(err);
      } finally {
        setRefreshing(false);
      }
    },
    [bookingId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const top = (
    <View style={styles.topRow}>
      <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
      <AppText variant="largeTitle" accessibilityRole="header" style={styles.flex}>
        Invoice
      </AppText>
    </View>
  );

  if (error && !booking) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8 }]}>
        {top}
        <ErrorState error={error} onRetry={() => load()} />
      </View>
    );
  }

  const invoice = booking?.invoice;
  const payment = booking?.payment;
  const pricing = booking?.car?.pricing;
  const status = invoice ? INVOICE_STATUS[invoice.status] ?? { label: invoice.status, tone: "neutral" as const } : null;
  const pdfUrl: string | null = typeof invoice?.pdfUrl === "string" && invoice.pdfUrl.startsWith("https://") ? invoice.pdfUrl : null;

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 32 }]}
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tokens.label} colors={[tokens.brand]} />
      }
    >
      {top}

      {!booking ? (
        <GlassCard>
          <SkeletonText lines={6} />
        </GlassCard>
      ) : !invoice ? (
        <GlassCard>
          <AppText variant="bodyStrong">No invoice yet</AppText>
          <AppText variant="caption" style={styles.mt4}>
            The invoice is issued when the operator accepts the booking.
          </AppText>
        </GlassCard>
      ) : (
        <>
          <GlassCard>
            <View style={styles.between}>
              <View style={styles.flex}>
                <AppText variant="micro">Invoice number</AppText>
                <AppText variant="headline" selectable>
                  {invoice.invoiceNo}
                </AppText>
              </View>
              {status ? <StatusPill label={status.label} tone={status.tone} /> : null}
            </View>
            <View style={[styles.divider, { backgroundColor: tokens.line }]} />
            <Field label="Booking" value={bookingRef(booking)} mono />
            <Field label="Issued" value={formatMYT(invoice.issuedAt, "date")} />
            {booking.operator?.companyName ? <Field label="From" value={booking.operator.companyName} /> : null}
            {booking.customer?.name ? <Field label="To" value={booking.customer.name} /> : null}
          </GlassCard>

          <Section title="Rental">
            <GlassCard>
              <AppText variant="bodyStrong">{bookingTitle(booking)}</AppText>
              <AppText variant="caption" style={styles.mt4}>
                {formatMYT(booking.pickupDate, "dayDateTime")} → {formatMYT(booking.returnDate, "dayDateTime")}
              </AppText>
              {pricing ? (
                <View style={styles.mt12}>
                  <QuoteBreakdown quote={pricing} />
                </View>
              ) : (
                <View style={[styles.between, styles.mt12]}>
                  <AppText variant="bodyStrong">Total</AppText>
                  <Money value={booking.totalAmount} />
                </View>
              )}
            </GlassCard>
          </Section>

          {payment ? (
            <Section title="Payments">
              <GlassCard>
                <PartRow title="Down payment" amount={payment.downPaymentAmount} status={payment.downPaymentStatus} />
                <PartRow title="Balance" amount={payment.finalPaymentAmount} status={payment.finalPaymentStatus} divider />
                <View style={[styles.between, styles.totalRow, { borderTopColor: tokens.line }]}>
                  <AppText variant="bodyStrong">Paid so far</AppText>
                  <Money value={payment.paidAmount} variant="headline" />
                </View>
              </GlassCard>
            </Section>
          ) : null}

          {pdfUrl ? (
            <Button
              label="Open PDF"
              variant="line"
              icon="download-outline"
              onPress={() => Linking.openURL(pdfUrl).catch((err) => logger.debug("Failed to open invoice PDF:", err))}
            />
          ) : null}
        </>
      )}
    </ScrollView>
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

function Field({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.field}>
      <AppText variant="caption" style={styles.flex}>
        {label}
      </AppText>
      <AppText variant={mono ? "mono" : "label"} color="ink" selectable>
        {value}
      </AppText>
    </View>
  );
}

function PartRow({ title, amount, status, divider = false }: { title: string; amount: any; status?: string; divider?: boolean }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.partRow, divider && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.line }]}>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        <StatusPill status={status} kind="payment" dot={false} style={styles.mt4} />
      </View>
      <Money value={amount} />
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
  mt4: {
    marginTop: 4,
  },
  mt12: {
    marginTop: 12,
  },
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
    marginVertical: 12,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 4,
  },
  section: {
    gap: 10,
  },
  partRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 10,
  },
  totalRow: {
    marginTop: 4,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
