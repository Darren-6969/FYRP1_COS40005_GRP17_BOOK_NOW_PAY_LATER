// F2: where Stripe sends the customer back after paying. Restyled in
// redesign phase 3.

import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState, type ComponentProps, type ReactNode } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button, GlassCard } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { ERROR_CODES, isApiError } from "@/services/api";
import { confirmStripeCheckoutSession, getCustomerBookingById } from "@/services/customerApi";
import { logger } from "@/utils/logger";
import { forgetStripePayment, isPartPaid, paidAmountLabel, pendingStripePayment } from "@/utils/stripe-payment";

// Waits between checks: about 20 seconds in total before "Still processing".
const RETRY_DELAYS_MS = [2000, 3000, 4000, 5000, 6000];

type Phase =
  | { kind: "checking" }
  | { kind: "processing" }
  | { kind: "offline" }
  | { kind: "failed"; message: string };

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

/** Errors that mean "no answer yet", so the loop keeps checking. */
function isTransient(err: unknown) {
  if (!isApiError(err)) return false;
  return (
    err.code === ERROR_CODES.NETWORK ||
    err.code === ERROR_CODES.TIMEOUT ||
    // The server is still finishing an earlier confirm call for this
    // session (idempotency). Not an error for the customer.
    err.code === "REQUEST_IN_PROGRESS" ||
    // 400 "Stripe payment is unpaid": not settled yet.
    err.status === 400
  );
}

function isOffline(err: unknown) {
  return isApiError(err) && (err.code === ERROR_CODES.NETWORK || err.code === ERROR_CODES.TIMEOUT);
}

export default function PaymentStatusScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams<{ id: string; payment?: string; session_id?: string }>();

  const bookingId = params.id;
  const sessionId = params.payment === "success" ? params.session_id : undefined;

  const [phase, setPhase] = useState<Phase>({ kind: "checking" });
  const mounted = useRef(true);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  }, []);

  const showPaid = useCallback(
    (booking: any) => {
      const paymentType = pendingStripePayment(bookingId);
      forgetStripePayment(bookingId);
      router.replace({
        pathname: "/customer/payment-success",
        params: {
          bookingId: String(booking?.id ?? bookingId),
          bookingCode: booking?.bookingCode || "",
          paymentType: paymentType || "",
          amount: paymentType ? paidAmountLabel(booking, paymentType) : "",
        },
      });
    },
    [bookingId, router]
  );

  // One check: true when the payment is confirmed.
  const checkOnce = useCallback(async (): Promise<boolean> => {
    if (sessionId) {
      // Asks Stripe directly, so it works even before the webhook lands.
      const result = await confirmStripeCheckoutSession(sessionId);
      showPaid(result?.booking);
      return true;
    }

    // No session ID (e.g. the browser was closed): read the booking.
    const booking = await getCustomerBookingById(bookingId);
    const paymentType = pendingStripePayment(bookingId);
    if (paymentType && isPartPaid(booking, paymentType)) {
      showPaid(booking);
      return true;
    }
    return false;
  }, [bookingId, sessionId, showPaid]);

  // Checks, waits, checks again. A dropped connection, a timeout or "still
  // processing" on one check doesn't end the loop (Phase 2 test: the first
  // check showed "No connection" instead of retrying). Ends on paid, a real
  // error, or after about 20 seconds.
  const checkLoop = useCallback(async () => {
    setPhase({ kind: "checking" });
    let lastError: unknown = null;

    for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
      try {
        if (await checkOnce()) return;
        lastError = null;
      } catch (err) {
        if (!isTransient(err)) {
          logger.warn("[payment-status] check failed", err);
          if (mounted.current) {
            setPhase({ kind: "failed", message: (err as Error)?.message || "We couldn't check this payment." });
          }
          return;
        }
        lastError = err;
      }

      if (!mounted.current) return;
      if (i < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[i]);
      if (!mounted.current) return;
    }

    if (mounted.current) setPhase(isOffline(lastError) ? { kind: "offline" } : { kind: "processing" });
  }, [checkOnce]);

  const running = useRef(false);

  const check = useCallback(async () => {
    if (!bookingId) {
      setPhase({ kind: "failed", message: "Booking information is missing." });
      return;
    }
    // One check loop at a time ("Check again" while one is running).
    if (running.current) return;
    running.current = true;
    try {
      await checkLoop();
    } finally {
      running.current = false;
    }
  }, [bookingId, checkLoop]);

  useEffect(() => {
    check();
  }, [check]);

  const openBooking = () => router.replace(`/customer/booking/${bookingId}` as Href);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      {phase.kind === "checking" ? (
        <StatusCard
          icon={null}
          title="Confirming your payment"
          message="This usually takes a few seconds. Please keep the app open."
        />
      ) : (
        <StatusCard
          icon={phase.kind === "processing" ? "time-outline" : phase.kind === "offline" ? "cloud-offline-outline" : "alert-circle-outline"}
          tone={phase.kind === "failed" ? "err" : "info"}
          title={
            phase.kind === "processing"
              ? "Still processing"
              : phase.kind === "offline"
                ? "No connection"
                : "Couldn't confirm the payment"
          }
          message={
            phase.kind === "processing"
              ? "Stripe hasn't confirmed this payment yet. If you were charged, it will show on your booking shortly. You won't be charged twice."
              : phase.kind === "offline"
                ? "We couldn't reach the server to check this payment. If you paid, nothing is lost: check again when you're back online."
                : phase.message
          }
        >
          <Button label="Check again" variant="brand" icon="refresh" onPress={check} />
          <Button label="View booking" variant="line" onPress={openBooking} />
        </StatusCard>
      )}
    </View>
  );
}

function StatusCard({
  icon,
  tone = "info",
  title,
  message,
  children,
}: {
  icon: ComponentProps<typeof Ionicons>["name"] | null;
  tone?: "info" | "err";
  title: string;
  message: string;
  children?: ReactNode;
}) {
  const { tokens } = useTheme();
  const bg = tone === "err" ? tokens.errBg : tokens.infoBg;
  const fg = tone === "err" ? tokens.errFg : tokens.infoFg;

  return (
    <GlassCard padding={24} style={styles.card}>
      <View style={[styles.icon, { backgroundColor: bg }]}>
        {icon ? <Ionicons name={icon} size={30} color={fg} /> : <ActivityIndicator size="large" color={fg} />}
      </View>
      <AppText variant="title" align="center" accessibilityRole="header">
        {title}
      </AppText>
      <AppText align="center" accessibilityLiveRegion="polite">
        {message}
      </AppText>
      {children ? <View style={styles.buttons}>{children}</View> : null}
    </GlassCard>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 18,
  },
  card: {
    alignItems: "center",
    gap: 12,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  buttons: {
    alignSelf: "stretch",
    gap: 10,
    marginTop: 8,
  },
});
