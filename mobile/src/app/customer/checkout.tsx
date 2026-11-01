import { Ionicons } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  AppState,
  Linking,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  createStripeCheckoutSession,
  getCustomerBookingById,
} from "../../services/customerApi";

const PAYMENT_TYPES = {
  DOWN_PAYMENT: "DOWN_PAYMENT",
  FINAL_PAYMENT: "FINAL_PAYMENT",
  FULL_PAYMENT: "FULL_PAYMENT",
} as const;

type PaymentType =
  (typeof PAYMENT_TYPES)[keyof typeof PAYMENT_TYPES];

type PaymentMethod =
  | "STRIPE"
  | "DUITNOW_SPAY";

export default function CheckoutScreen() {
  const router = useRouter();

  const params =
    useLocalSearchParams<{
      bookingId?: string;
      type?: string;
    }>();

  const bookingId =
    params.bookingId;

  const [booking, setBooking] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const [submitting, setSubmitting] =
    useState(false);

  const appState =
  useRef(AppState.currentState);

  const waitingForStripe =
  useRef(false);

  const initialPaymentType =
    params.type ===
    PAYMENT_TYPES.FINAL_PAYMENT
      ? PAYMENT_TYPES.FINAL_PAYMENT
      : params.type ===
        PAYMENT_TYPES.FULL_PAYMENT
      ? PAYMENT_TYPES.FULL_PAYMENT
      : PAYMENT_TYPES.DOWN_PAYMENT;

  const [paymentType, setPaymentType] =
    useState<PaymentType>(
      initialPaymentType
    );

  const [method, setMethod] =
    useState<PaymentMethod>(
      "STRIPE"
    );

  useEffect(() => {
    if (!bookingId) {
      setError(
        "Booking information is missing."
      );
      setLoading(false);
      return;
    }

    loadBooking();
  }, [bookingId]);

  useEffect(() => {
  const subscription =
    AppState.addEventListener(
      "change",
      async (nextAppState) => {
        const wasBackground =
          appState.current.match(
            /inactive|background/
          );

        const isActive =
          nextAppState === "active";

        appState.current =
          nextAppState;

        if (
          !wasBackground ||
          !isActive ||
          !waitingForStripe.current ||
          !bookingId
        ) {
          return;
        }

        try {
          const refreshed =
            await getCustomerBookingById(
              bookingId
            );

          setBooking(refreshed);

          const paymentStatus =
            refreshed?.payment?.status;

          const downPaymentStatus =
            refreshed?.payment
              ?.downPaymentStatus;

          const finalPaymentStatus =
            refreshed?.payment
              ?.finalPaymentStatus;

          const paymentSucceeded =
            paymentStatus === "PAID" ||
            downPaymentStatus === "PAID" ||
            finalPaymentStatus === "PAID";

          if (paymentSucceeded) {
            waitingForStripe.current =
              false;

            router.replace(
              `/customer/booking/${bookingId}`
            );
          }
        } catch (err) {
          console.log(
            "Failed to refresh payment status:",
            err
          );
        }
      }
    );

  return () => {
    subscription.remove();
  };
}, [bookingId, router]);

  const loadBooking = async () => {
    try {
      setLoading(true);
      setError("");

      const data =
        await getCustomerBookingById(
          bookingId as string
        );

      setBooking(data);
    } catch (err: any) {
      console.log(
        "Failed to load booking:",
        err
      );

      setError(
        err?.message ||
          "Unable to load booking."
      );
    } finally {
      setLoading(false);
    }
  };

  const payment =
    booking?.payment || {};

  const downPaymentPaid =
    payment?.downPaymentStatus ===
    "PAID";

  const finalPaymentPaid =
    payment?.finalPaymentStatus ===
    "PAID";

  const totalAmount =
    Number(
      booking?.totalAmount ??
        booking?.total ??
        0
    );

  const downPaymentAmount =
    Number(
      payment?.downPaymentAmount ??
        booking?.downPaymentAmount ??
        0
    );

  const finalPaymentAmount =
    Number(
      payment?.finalPaymentAmount ??
        booking?.finalPaymentAmount ??
        0
    );

  const amountToPay =
    useMemo(() => {
      if (
        paymentType ===
        PAYMENT_TYPES.DOWN_PAYMENT
      ) {
        return downPaymentAmount;
      }

      if (
        paymentType ===
        PAYMENT_TYPES.FINAL_PAYMENT
      ) {
        return finalPaymentAmount;
      }

      return totalAmount;
    }, [
      paymentType,
      downPaymentAmount,
      finalPaymentAmount,
      totalAmount,
    ]);

  const formatMoney = (
    value: number
  ) => {
    return `RM ${Number(
      value || 0
    ).toFixed(2)}`;
  };

  const handleContinuePayment =
    async () => {
      if (
        submitting ||
        !booking?.id
      ) {
        return;
      }

      if (
        method ===
        "DUITNOW_SPAY"
      ) {
        router.push({
          pathname:
            "/customer/upload-receipt",
          params: {
            bookingId:
              String(
                booking.id
              ),
            paymentType,
          },
        });

        return;
      }

      try {
        setSubmitting(true);
        setError("");

        const result =
          await createStripeCheckoutSession(
            booking.id,
            paymentType
          );

        console.log(
          "Stripe checkout response:",
          result
        );

        const checkoutUrl =
          result?.url ||
          result?.checkoutUrl;

        if (!checkoutUrl) {
          throw new Error(
            "Stripe checkout URL was not returned."
          );
        }

        const supported =
          await Linking.canOpenURL(
            checkoutUrl
          );

        if (!supported) {
          throw new Error(
            "Unable to open Stripe checkout."
          );
        }

        waitingForStripe.current = true;

        await Linking.openURL(
          checkoutUrl
        );
      } catch (err: any) {
        console.log(
          "Stripe payment failed:",
          err
        );

        setError(
          err?.message ||
            "Unable to start Stripe payment."
        );
      } finally {
        setSubmitting(false);
      }
    };

  if (loading) {
    return (
      <SafeAreaView
        style={styles.center}
      >
        <StatusBar style="dark" />

        <Text
          style={styles.loadingText}
        >
          Loading checkout...
        </Text>
      </SafeAreaView>
    );
  }

  if (
    error &&
    !booking
  ) {
    return (
      <SafeAreaView
        style={styles.center}
      >
        <StatusBar style="dark" />

        <Ionicons
          name="alert-circle-outline"
          size={38}
          color="#B94747"
        />

        <Text
          style={styles.errorTitle}
        >
          Unable to open checkout
        </Text>

        <Text
          style={styles.errorMessage}
        >
          {error}
        </Text>

        <Pressable
          style={styles.retryButton}
          onPress={loadBooking}
        >
          <Text
            style={
              styles.retryText
            }
          >
            Try Again
          </Text>
        </Pressable>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <StatusBar style="dark" />

      <View style={styles.header}>
        <Pressable
          style={
            styles.headerButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color="#17313C"
          />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text
            style={
              styles.headerTitle
            }
          >
            Complete Payment
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            Secure booking payment
          </Text>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        <View style={styles.card}>
          <Text style={styles.eyebrow}>
            Booking
          </Text>

          <Text
            style={
              styles.bookingCode
            }
          >
            {booking?.bookingCode ||
              `Booking #${booking?.id}`}
          </Text>

          <InfoRow
            label="Service"
            value={
              booking?.serviceName ||
              booking?.listing
                ?.title ||
              booking?.listing?.name ||
              "Car Rental"
            }
          />

          <InfoRow
            label="Status"
            value={
              booking?.status ||
              "—"
            }
          />

          <View
            style={
              styles.divider
            }
          />

          <View
            style={
              styles.amountRow
            }
          >
            <Text
              style={
                styles.amountLabel
              }
            >
              Amount to Pay
            </Text>

            <Text
              style={
                styles.amountValue
              }
            >
              {formatMoney(
                amountToPay
              )}
            </Text>
          </View>
        </View>

        <View style={styles.card}>
          <Text
            style={
              styles.sectionTitle
            }
          >
            Payment Type
          </Text>

          <PaymentChoice
            selected={
              paymentType ===
              PAYMENT_TYPES.DOWN_PAYMENT
            }
            disabled={
              downPaymentPaid
            }
            label="Down Payment"
            description={
              downPaymentPaid
                ? "Already paid"
                : formatMoney(
                    downPaymentAmount
                  )
            }
            onPress={() =>
              setPaymentType(
                PAYMENT_TYPES.DOWN_PAYMENT
              )
            }
          />

          <PaymentChoice
            selected={
              paymentType ===
              PAYMENT_TYPES.FINAL_PAYMENT
            }
            disabled={
              !downPaymentPaid ||
              finalPaymentPaid
            }
            label="Final Payment"
            description={
              finalPaymentPaid
                ? "Already paid"
                : formatMoney(
                    finalPaymentAmount
                  )
            }
            onPress={() =>
              setPaymentType(
                PAYMENT_TYPES.FINAL_PAYMENT
              )
            }
          />

          <PaymentChoice
            selected={
              paymentType ===
              PAYMENT_TYPES.FULL_PAYMENT
            }
            disabled={
              downPaymentPaid ||
              finalPaymentPaid
            }
            label="Full Payment"
            description={
              formatMoney(
                totalAmount
              )
            }
            onPress={() =>
              setPaymentType(
                PAYMENT_TYPES.FULL_PAYMENT
              )
            }
          />
        </View>

        <View style={styles.card}>
          <Text
            style={
              styles.sectionTitle
            }
          >
            Payment Method
          </Text>

          <PaymentMethodChoice
            selected={
              method === "STRIPE"
            }
            icon="card-outline"
            label="Stripe"
            description="Secure card payment"
            onPress={() =>
              setMethod("STRIPE")
            }
          />

          <PaymentMethodChoice
            selected={
              method ===
              "DUITNOW_SPAY"
            }
            icon="qr-code-outline"
            label="DuitNow / SPay"
            description="Manual payment with receipt upload"
            onPress={() =>
              setMethod(
                "DUITNOW_SPAY"
              )
            }
          />
        </View>

        {error ? (
          <View
            style={
              styles.errorCard
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={19}
              color="#B94747"
            />

            <Text
              style={
                styles.errorText
              }
            >
              {error}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <View style={styles.footer}>
        <View>
          <Text
            style={
              styles.footerLabel
            }
          >
            Total
          </Text>

          <Text
            style={
              styles.footerAmount
            }
          >
            {formatMoney(
              amountToPay
            )}
          </Text>
        </View>

        <Pressable
          disabled={submitting}
          style={[
            styles.payButton,
            submitting &&
              styles.payButtonDisabled,
          ]}
          onPress={
            handleContinuePayment
          }
        >
          <Text
            style={
              styles.payButtonText
            }
          >
            {submitting
              ? "Processing..."
              : method ===
                "DUITNOW_SPAY"
              ? "Continue"
              : "Pay Now"}
          </Text>

          {!submitting && (
            <Ionicons
              name="arrow-forward"
              size={18}
              color="#FFFFFF"
            />
          )}
        </Pressable>
      </View>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text
        style={styles.infoLabel}
      >
        {label}
      </Text>

      <Text
        style={styles.infoValue}
      >
        {value}
      </Text>
    </View>
  );
}

function PaymentChoice({
  selected,
  disabled,
  label,
  description,
  onPress,
}: {
  selected: boolean;
  disabled: boolean;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.choice,
        selected &&
          styles.choiceSelected,
        disabled &&
          styles.choiceDisabled,
      ]}
    >
      <View
        style={[
          styles.radio,
          selected &&
            styles.radioSelected,
        ]}
      >
        {selected ? (
          <View
            style={
              styles.radioInner
            }
          />
        ) : null}
      </View>

      <View style={{ flex: 1 }}>
        <Text
          style={
            styles.choiceTitle
          }
        >
          {label}
        </Text>

        <Text
          style={
            styles.choiceDescription
          }
        >
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

function PaymentMethodChoice({
  selected,
  icon,
  label,
  description,
  onPress,
}: {
  selected: boolean;
  icon: any;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      onPress={onPress}
      style={[
        styles.choice,
        selected &&
          styles.choiceSelected,
      ]}
    >
      <Ionicons
        name={icon}
        size={21}
        color="#07869B"
      />

      <View style={{ flex: 1 }}>
        <Text
          style={
            styles.choiceTitle
          }
        >
          {label}
        </Text>

        <Text
          style={
            styles.choiceDescription
          }
        >
          {description}
        </Text>
      </View>

      <View
        style={[
          styles.radio,
          selected &&
            styles.radioSelected,
        ]}
      >
        {selected ? (
          <View
            style={
              styles.radioInner
            }
          />
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    backgroundColor: "#F7FAFB",
  },

  loadingText: {
    color: "#70858E",
    fontWeight: "700",
  },

  errorTitle: {
    color: "#17313C",
    fontSize: 17,
    fontWeight: "900",
    marginTop: 12,
  },

  errorMessage: {
    color: "#7A8E96",
    fontSize: 12,
    textAlign: "center",
    marginTop: 6,
  },

  retryButton: {
    marginTop: 18,
    paddingHorizontal: 20,
    height: 46,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#07869B",
  },

  retryText: {
    color: "#FFFFFF",
    fontWeight: "900",
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    paddingHorizontal: 18,
    paddingVertical: 14,
    backgroundColor: "#FFFFFF",
    borderBottomWidth: 1,
    borderBottomColor: "#E5ECEF",
  },

  headerButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    backgroundColor: "#F3F7F8",
    alignItems: "center",
    justifyContent: "center",
  },

  headerTitle: {
    color: "#17313C",
    fontSize: 18,
    fontWeight: "900",
  },

  headerSubtitle: {
    color: "#83969E",
    fontSize: 10,
    marginTop: 2,
  },

  content: {
    padding: 18,
    paddingBottom: 125,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    borderRadius: 18,
    padding: 16,
    marginBottom: 16,
  },

  eyebrow: {
    color: "#07869B",
    fontSize: 10,
    fontWeight: "900",
    textTransform: "uppercase",
  },

  bookingCode: {
    color: "#17313C",
    fontSize: 21,
    fontWeight: "900",
    marginTop: 5,
    marginBottom: 15,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
    paddingVertical: 8,
  },

  infoLabel: {
    color: "#82949C",
    fontSize: 10,
  },

  infoValue: {
    flex: 1,
    textAlign: "right",
    color: "#17313C",
    fontSize: 11,
    fontWeight: "800",
  },

  divider: {
    height: 1,
    backgroundColor: "#E7ECEF",
    marginVertical: 13,
  },

  amountRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },

  amountLabel: {
    color: "#17313C",
    fontSize: 13,
    fontWeight: "800",
  },

  amountValue: {
    color: "#07869B",
    fontSize: 22,
    fontWeight: "900",
  },

  sectionTitle: {
    color: "#17313C",
    fontSize: 14,
    fontWeight: "900",
    marginBottom: 12,
  },

  choice: {
    minHeight: 67,
    borderWidth: 1,
    borderColor: "#E1E9EC",
    borderRadius: 15,
    padding: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 11,
    marginBottom: 10,
    backgroundColor: "#FAFCFD",
  },

  choiceSelected: {
    borderColor: "#07869B",
    backgroundColor: "#EAF8FA",
  },

  choiceDisabled: {
    opacity: 0.42,
  },

  choiceTitle: {
    color: "#17313C",
    fontSize: 12,
    fontWeight: "900",
  },

  choiceDescription: {
    color: "#83969E",
    fontSize: 10,
    marginTop: 3,
  },

  radio: {
    width: 21,
    height: 21,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: "#BAC9CE",
    alignItems: "center",
    justifyContent: "center",
  },

  radioSelected: {
    borderColor: "#07869B",
  },

  radioInner: {
    width: 9,
    height: 9,
    borderRadius: 5,
    backgroundColor: "#07869B",
  },

  errorCard: {
    flexDirection: "row",
    gap: 8,
    padding: 13,
    borderRadius: 14,
    backgroundColor: "#FFF1F1",
    borderWidth: 1,
    borderColor: "#F0CCCC",
  },

  errorText: {
    flex: 1,
    color: "#A33E3E",
    fontSize: 11,
    fontWeight: "700",
  },

  footer: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    paddingHorizontal: 18,
    paddingTop: 12,
    paddingBottom: 20,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E3EAED",
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 16,
  },

  footerLabel: {
    color: "#83969E",
    fontSize: 10,
  },

  footerAmount: {
    color: "#17313C",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 2,
  },

  payButton: {
    minWidth: 150,
    height: 52,
    borderRadius: 15,
    backgroundColor: "#07869B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    paddingHorizontal: 18,
  },

  payButtonDisabled: {
    opacity: 0.65,
  },

  payButtonText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
});