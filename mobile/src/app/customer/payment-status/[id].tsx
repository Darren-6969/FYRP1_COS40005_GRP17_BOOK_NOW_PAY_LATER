// F2: where Stripe sends the customer back after paying.
// Built in the current style; restyled in redesign phase 3.

import { Ionicons } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useRouter,
  type Href,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { isApiError } from "@/services/api";
import {
  confirmStripeCheckoutSession,
  getCustomerBookingById,
} from "@/services/customerApi";
import { logger } from "@/utils/logger";
import {
  forgetStripePayment,
  isPartPaid,
  paidAmountLabel,
  pendingStripePayment,
} from "@/utils/stripe-payment";

// Waits between checks: about 20 seconds in total before "Still processing".
const RETRY_DELAYS_MS = [2000, 3000, 4000, 5000, 6000];

type Phase =
  | { kind: "checking" }
  | { kind: "processing" }
  | { kind: "offline"; message: string }
  | { kind: "failed"; message: string };

const sleep = (ms: number) =>
  new Promise((resolve) => setTimeout(resolve, ms));

export default function PaymentStatusScreen() {
  const router = useRouter();

  const params = useLocalSearchParams<{
    id: string;
    payment?: string;
    session_id?: string;
  }>();

  const bookingId = params.id;
  const sessionId =
    params.payment === "success" ? params.session_id : undefined;

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

  // Checks, waits, checks again; ends on paid, offline, an error, or
  // "Still processing" after about 20 seconds.
  const checkLoop = useCallback(async () => {
    setPhase({ kind: "checking" });

    for (let i = 0; i <= RETRY_DELAYS_MS.length; i++) {
      try {
        if (await checkOnce()) return;
      } catch (err) {
        if (isApiError(err) && err.status === 0) {
          if (mounted.current) {
            setPhase({ kind: "offline", message: err.message });
          }
          return;
        }

        // 400 "Stripe payment is unpaid": not settled yet, keep checking.
        if (!(isApiError(err) && err.status === 400)) {
          logger.warn("[payment-status] check failed", err);
          if (mounted.current) {
            setPhase({
              kind: "failed",
              message:
                (err as Error)?.message ||
                "We couldn't check this payment.",
            });
          }
          return;
        }
      }

      if (!mounted.current) return;
      if (i < RETRY_DELAYS_MS.length) await sleep(RETRY_DELAYS_MS[i]);
      if (!mounted.current) return;
    }

    if (mounted.current) setPhase({ kind: "processing" });
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

  const openBooking = () =>
    router.replace(`/customer/booking/${bookingId}` as Href);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <View style={styles.container}>
        {phase.kind === "checking" ? (
          <>
            <ActivityIndicator size="large" color="#07869B" />
            <Text style={styles.title}>Confirming your payment</Text>
            <Text style={styles.text}>
              This usually takes a few seconds. Please keep the app open.
            </Text>
          </>
        ) : (
          <>
            <View style={styles.iconCircle}>
              <Ionicons
                name={
                  phase.kind === "processing"
                    ? "time-outline"
                    : phase.kind === "offline"
                      ? "cloud-offline-outline"
                      : "alert-circle-outline"
                }
                size={34}
                color="#07869B"
              />
            </View>

            <Text style={styles.title}>
              {phase.kind === "processing"
                ? "Still processing"
                : phase.kind === "offline"
                  ? "No connection"
                  : "Couldn't confirm the payment"}
            </Text>

            <Text style={styles.text}>
              {phase.kind === "processing"
                ? "Stripe hasn't confirmed this payment yet. If you were charged, it will show on your booking shortly. You won't be charged twice."
                : phase.message}
            </Text>

            <Pressable
              style={({ pressed }) => [
                styles.primaryButton,
                pressed && { opacity: 0.8 },
              ]}
              onPress={check}
              accessibilityRole="button"
            >
              <Ionicons name="refresh" size={18} color="#FFFFFF" />
              <Text style={styles.primaryText}>Check again</Text>
            </Pressable>

            <Pressable
              style={styles.secondaryButton}
              onPress={openBooking}
              accessibilityRole="button"
            >
              <Text style={styles.secondaryText}>View booking</Text>
            </Pressable>
          </>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },

  container: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: 14,
  },

  iconCircle: {
    width: 72,
    height: 72,
    borderRadius: 36,
    backgroundColor: "#E3F3F6",
    alignItems: "center",
    justifyContent: "center",
  },

  title: {
    fontSize: 22,
    fontWeight: "700",
    color: "#17313C",
    textAlign: "center",
  },

  text: {
    fontSize: 15,
    lineHeight: 22,
    color: "#5B6B73",
    textAlign: "center",
    maxWidth: 340,
  },

  primaryButton: {
    marginTop: 10,
    minHeight: 50,
    paddingHorizontal: 24,
    borderRadius: 25,
    backgroundColor: "#07869B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    alignSelf: "stretch",
  },

  primaryText: {
    color: "#FFFFFF",
    fontSize: 16,
    fontWeight: "700",
  },

  secondaryButton: {
    minHeight: 48,
    justifyContent: "center",
    paddingHorizontal: 16,
  },

  secondaryText: {
    color: "#07869B",
    fontSize: 15,
    fontWeight: "600",
  },
});
