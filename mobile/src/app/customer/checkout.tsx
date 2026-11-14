import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useLocalSearchParams, useNavigation, useRouter, type Href } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
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
import { useIdempotentAttempt } from "@/hooks/use-idempotent-attempt";
import { useTheme } from "@/hooks/use-theme";
import { createStripeCheckoutSession, getCustomerBookingById } from "@/services/customerApi";
import { formatMYT } from "@/utils/datetime";
import { logger } from "@/utils/logger";
import { OWED, PAYABLE_STATUSES } from "@/utils/next-payment";
import {
  STRIPE_RETURN_PREFIX,
  appPathFromReturnUrl,
  isPartPaid,
  rememberStripePayment,
  type StripePaymentType,
} from "@/utils/stripe-payment";

type PaymentMethod = "STRIPE" | "DUITNOW_SPAY";

/** Which parts can be paid now, from the server's part statuses. */
function payableParts(booking: any) {
  const p = booking?.payment || {};
  const downOwed = OWED.has(p.downPaymentStatus);
  const finalOwed = OWED.has(p.finalPaymentStatus);
  return {
    DOWN_PAYMENT: downOwed,
    FINAL_PAYMENT: p.downPaymentStatus === "PAID" && finalOwed,
    FULL_PAYMENT: downOwed && finalOwed,
  } as Record<StripePaymentType, boolean>;
}

/** Keeps the chosen part if it's still payable, otherwise moves to the next one. */
function settlePart(booking: any, current: StripePaymentType): StripePaymentType {
  const parts = payableParts(booking);
  if (parts[current]) return current;
  if (parts.DOWN_PAYMENT) return "DOWN_PAYMENT";
  if (parts.FINAL_PAYMENT) return "FINAL_PAYMENT";
  return current;
}

function partAmount(booking: any, part: StripePaymentType) {
  const p = booking?.payment || {};
  if (part === "DOWN_PAYMENT") return p.downPaymentAmount;
  if (part === "FINAL_PAYMENT") return p.finalPaymentAmount;
  return p.amount ?? booking?.totalAmount;
}

/**
 * Pay the down payment, the balance, or both at once, by card (Stripe in an
 * in-app browser, F2) or by DuitNow/SPay receipt. Reloads the booking every
 * time it comes into view, so a screen left open can't offer a part that is
 * already paid.
 */
export default function CheckoutScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams<{ bookingId?: string; type?: string }>();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const bookingId = params.bookingId;

  const [booking, setBooking] = useState<any | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [payError, setPayError] = useState<unknown>(null);
  const [method, setMethod] = useState<PaymentMethod>("STRIPE");
  const [part, setPart] = useState<StripePaymentType>(
    params.type === "FINAL_PAYMENT" || params.type === "FULL_PAYMENT" ? params.type : "DOWN_PAYMENT"
  );
  const partRef = useRef(part);
  partRef.current = part;

  const checkoutAttempt = useIdempotentAttempt();

  const loadBooking = useCallback(async () => {
    if (!bookingId) {
      setLoadError(new Error("This payment link is missing the booking."));
      return;
    }
    setLoadError(null);
    try {
      const data = await getCustomerBookingById(bookingId);
      setBooking(data);
      setPart(settlePart(data, partRef.current));
    } catch (err) {
      logger.debug("Failed to load booking:", err);
      setLoadError(err);
    }
  }, [bookingId]);

  // Reload whenever checkout comes back into view (stale-screen fix).
  useFocusEffect(
    useCallback(() => {
      loadBooking();
    }, [loadBooking])
  );

  const payWithStripe = async () => {
    // Same booking and payment part -> same key until a session comes back,
    // so a retry after a timeout replays it (F1).
    const attempt = checkoutAttempt.attemptFor(`${booking.id}:${part}`);
    const result = await createStripeCheckoutSession(booking.id, part, attempt.key);
    // Got a session: the next tap (e.g. after cancelling on Stripe) asks for a new one.
    checkoutAttempt.finish();

    const checkoutUrl = result?.url || result?.checkoutUrl;
    if (!checkoutUrl) throw new Error("Stripe didn't return a payment page. Try again.");

    // F2: payment-status needs to know which part is being paid.
    rememberStripePayment(booking.id, part);

    // In-app browser that closes itself when Stripe redirects to
    // mobile://customer/... (success or cancel).
    const browserResult = await WebBrowser.openAuthSessionAsync(checkoutUrl, STRIPE_RETURN_PREFIX);

    if (browserResult.type === "success") {
      const returnPath = appPathFromReturnUrl(browserResult.url);
      // Android also delivers this link to the router; iOS doesn't. Navigate
      // only if we're still on checkout, so the screen never opens twice.
      setTimeout(() => {
        if (returnPath && navigation.isFocused()) router.replace(returnPath as unknown as Href);
      }, 800);
      return;
    }

    // Browser closed without returning: if it went through anyway, show the status.
    try {
      const refreshed = await getCustomerBookingById(booking.id);
      setBooking(refreshed);
      if (isPartPaid(refreshed, part)) {
        router.replace(`/customer/payment-status/${booking.id}` as unknown as Href);
      } else {
        setPart(settlePart(refreshed, part));
      }
    } catch (err) {
      logger.debug("Could not refresh after closing Stripe:", err);
    }
  };

  const continuePayment = async () => {
    if (!booking?.id) return;
    setPayError(null);

    if (method === "DUITNOW_SPAY") {
      router.push({
        pathname: "/customer/upload-receipt",
        params: { bookingId: String(booking.id), paymentType: part },
      } as unknown as Href);
      return;
    }

    try {
      await payWithStripe();
    } catch (err) {
      logger.debug("Stripe payment failed:", err);
      setPayError(err);
    }
  };

  const handlePay = () => checkoutAttempt.run(continuePayment);

  if (loadError && !booking) {
    return (
      <View style={[styles.screen, { paddingTop: insets.top + 8 }]}>
        <View style={styles.pad}>
          <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        </View>
        <ErrorState error={loadError} onRetry={loadBooking} />
      </View>
    );
  }

  const parts = booking ? payableParts(booking) : null;
  const open = booking && PAYABLE_STATUSES.has(booking.status);
  const anythingOwed = parts ? parts.DOWN_PAYMENT || parts.FINAL_PAYMENT : false;
  const canPay = Boolean(open && parts?.[part]);
  const p = booking?.payment || {};
  const dueAt =
    part === "FINAL_PAYMENT" ? p.finalPaymentDueDate : part === "DOWN_PAYMENT" ? p.downPaymentDueDate : p.downPaymentDueDate;

  const options: { part: StripePaymentType; title: string; note: string }[] = [
    {
      part: "DOWN_PAYMENT",
      title: "Down payment",
      note: p.downPaymentStatus === "PAID" ? "Paid" : OWED.has(p.downPaymentStatus) ? "Secures your booking" : "In review",
    },
    {
      part: "FINAL_PAYMENT",
      title: "Balance",
      note:
        p.finalPaymentStatus === "PAID"
          ? "Paid"
          : p.downPaymentStatus !== "PAID"
            ? "After the down payment"
            : OWED.has(p.finalPaymentStatus)
              ? "Due before pick-up"
              : "In review",
    },
    {
      part: "FULL_PAYMENT",
      title: "Pay in full",
      note: OWED.has(p.downPaymentStatus) && OWED.has(p.finalPaymentStatus) ? "Both parts now" : "Not available",
    },
  ];

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
          <AppText variant="largeTitle" accessibilityRole="header" style={styles.flex}>
            Payment
          </AppText>
        </View>

        {!booking ? (
          <GlassCard>
            <SkeletonText lines={4} />
          </GlassCard>
        ) : (
          <>
            <GlassCard>
              <View style={styles.between}>
                <View style={styles.flex}>
                  <AppText variant="headline">{booking.serviceName || "Your booking"}</AppText>
                  <AppText variant="mono" color="label">
                    {booking.bookingCode || `#${booking.id}`}
                  </AppText>
                </View>
                <StatusPill status={booking.status} />
              </View>
              {booking.pickupDate ? (
                <AppText variant="caption" style={styles.mt8}>
                  {formatMYT(booking.pickupDate, "dayDateTime")} → {formatMYT(booking.returnDate, "dayDateTime")}
                </AppText>
              ) : null}
            </GlassCard>

            {!open ? (
              <GlassCard>
                <AppText variant="bodyStrong">Payment isn't open for this booking</AppText>
                <AppText variant="caption">
                  It's {booking.status ? booking.status.toLowerCase().replace(/_/g, " ") : "not ready"}. Check the booking for details.
                </AppText>
              </GlassCard>
            ) : !anythingOwed ? (
              <GlassCard>
                <View style={[styles.row, styles.alignStart]}>
                  <Ionicons name="checkmark-circle" size={22} color={tokens.okFg} />
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">Nothing to pay right now</AppText>
                    <AppText variant="caption">
                      {p.status === "PAID" ? "This booking is paid in full." : "A payment is being reviewed by the operator."}
                    </AppText>
                  </View>
                </View>
              </GlassCard>
            ) : (
              <>
                <Section title="What are you paying?">
                  <GlassCard padding={4}>
                    <View accessibilityRole="radiogroup">
                      {options.map((option, i) => {
                        const enabled = Boolean(parts?.[option.part]);
                        const selected = option.part === part;
                        return (
                          <Pressable
                            key={option.part}
                            onPress={() => enabled && setPart(option.part)}
                            disabled={!enabled}
                            accessibilityRole="radio"
                            accessibilityState={{ checked: selected, disabled: !enabled }}
                            style={[
                              styles.option,
                              i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.line },
                              !enabled && styles.dim,
                            ]}
                          >
                            <View style={[styles.radio, { borderColor: selected ? tokens.brand : tokens.label }]}>
                              {selected ? <View style={[styles.radioDot, { backgroundColor: tokens.brand }]} /> : null}
                            </View>
                            <View style={styles.flex}>
                              <AppText variant="bodyStrong">{option.title}</AppText>
                              <AppText variant="caption">{option.note}</AppText>
                            </View>
                            <Money value={partAmount(booking, option.part)} color={enabled ? "ink" : "label"} />
                          </Pressable>
                        );
                      })}
                    </View>
                  </GlassCard>
                  {dueAt && part !== "FULL_PAYMENT" ? (
                    <AppText variant="caption">Due {formatMYT(dueAt, "dayDateTime")}</AppText>
                  ) : null}
                </Section>

                <Section title="How do you want to pay?">
                  <View style={styles.methods}>
                    <MethodCard
                      icon="card-outline"
                      title="Card"
                      body="Secure payment by Stripe"
                      selected={method === "STRIPE"}
                      onPress={() => setMethod("STRIPE")}
                    />
                    <MethodCard
                      icon="qr-code-outline"
                      title="DuitNow / SPay"
                      body="Pay, then upload the receipt"
                      selected={method === "DUITNOW_SPAY"}
                      onPress={() => setMethod("DUITNOW_SPAY")}
                    />
                  </View>
                </Section>
              </>
            )}

            {payError ? <ErrorState error={payError} compact /> : null}
            {loadError ? <ErrorState error={loadError} onRetry={loadBooking} compact /> : null}
          </>
        )}
      </ScrollView>

      {booking && open && anythingOwed ? (
        <FloatingActionBar
          action={
            <Button
              label={method === "STRIPE" ? "Pay now" : "Continue"}
              variant="cta"
              grow
              disabled={!canPay}
              onPress={handlePay}
            />
          }
        >
          <Money value={partAmount(booking, part)} variant="headline" />
          <AppText variant="caption">{options.find((o) => o.part === part)?.title}</AppText>
        </FloatingActionBar>
      ) : booking ? (
        <FloatingActionBar
          action={
            <Button
              label="View booking"
              variant="brand"
              grow
              onPress={() => router.replace(`/customer/booking/${booking.id}` as unknown as Href)}
            />
          }
        />
      ) : null}
    </View>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={styles.section}>
      <AppText variant="headline" accessibilityRole="header">
        {title}
      </AppText>
      {children}
    </View>
  );
}

function MethodCard({
  icon,
  title,
  body,
  selected,
  onPress,
}: {
  icon: any;
  title: string;
  body: string;
  selected: boolean;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="radio"
      accessibilityState={{ checked: selected }}
      accessibilityLabel={`${title}. ${body}`}
      style={[
        styles.method,
        {
          backgroundColor: tokens.glass,
          borderColor: selected ? tokens.leafInk : tokens.glassLine,
          borderWidth: selected ? 2 : StyleSheet.hairlineWidth,
        },
      ]}
    >
      <Ionicons name={icon} size={22} color={selected ? tokens.leafInk : tokens.label} />
      <AppText variant="bodyStrong">{title}</AppText>
      <AppText variant="caption">{body}</AppText>
    </Pressable>
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
  between: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  alignStart: {
    alignItems: "flex-start",
  },
  mt8: {
    marginTop: 8,
  },
  section: {
    gap: 10,
  },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingVertical: 12,
    paddingHorizontal: 12,
  },
  dim: {
    opacity: 0.5,
  },
  radio: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  methods: {
    flexDirection: "row",
    gap: 10,
  },
  method: {
    flex: 1,
    gap: 4,
    padding: 14,
    borderRadius: 18,
    minHeight: 96,
  },
});
