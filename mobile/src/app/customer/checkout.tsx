// mobile/src/app/customer/checkout.tsx

import { Ionicons } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useNavigation,
  useRouter,
  type Href,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import * as WebBrowser from "expo-web-browser";

import {
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
  useState,
} from "react";

import {
  createStripeCheckoutSession,
  getCustomerBookingById,
} from "../../services/customerApi";
import { logger } from "@/utils/logger";
import { useIdempotentAttempt } from "@/hooks/use-idempotent-attempt";
import {
  STRIPE_RETURN_PREFIX,
  appPathFromReturnUrl,
  isPartPaid,
  rememberStripePayment,
} from "@/utils/stripe-payment";

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

  const checkoutAttempt =
    useIdempotentAttempt();

  const navigation =
    useNavigation();

  const initialPaymentType:
    PaymentType =
    params.type ===
    PAYMENT_TYPES.FINAL_PAYMENT
      ? PAYMENT_TYPES.FINAL_PAYMENT
      : params.type ===
          PAYMENT_TYPES.FULL_PAYMENT
        ? PAYMENT_TYPES.FULL_PAYMENT
        : PAYMENT_TYPES.DOWN_PAYMENT;

  const [
    paymentType,
    setPaymentType,
  ] =
    useState<PaymentType>(
      initialPaymentType
    );

  const [method, setMethod] =
    useState<PaymentMethod>(
      "STRIPE"
    );

  // =========================================================
  // LOAD BOOKING
  // =========================================================

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

  // =========================================================
  // LOAD BOOKING FUNCTION
  // =========================================================

  const loadBooking =
    async () => {
      try {
        setLoading(true);
        setError("");

        const data =
          await getCustomerBookingById(
            bookingId as string
          );

        setBooking(data);

        // Safety:
        // if down payment already paid,
        // automatically switch to final payment.
        const payment =
          data?.payment || {};

        if (
          payment
            ?.downPaymentStatus ===
            "PAID" &&
          payment
            ?.finalPaymentStatus !==
            "PAID" &&
          params.type !==
            PAYMENT_TYPES.FULL_PAYMENT
        ) {
          setPaymentType(
            PAYMENT_TYPES.FINAL_PAYMENT
          );
        }
      } catch (
        err: any
      ) {
        logger.debug(
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

  // =========================================================
  // PAYMENT DATA
  // =========================================================

  const payment =
    booking?.payment || {};

  const downPaymentPaid =
    payment
      ?.downPaymentStatus ===
    "PAID";

  const finalPaymentPaid =
    payment
      ?.finalPaymentStatus ===
    "PAID";

  const totalAmount =
    Number(
      booking?.totalAmount ??
        booking?.total ??
        0
    );

  const downPaymentAmount =
    Number(
      payment
        ?.downPaymentAmount ??
        booking
          ?.downPaymentAmount ??
        0
    );

  const finalPaymentAmount =
    Number(
      payment
        ?.finalPaymentAmount ??
        booking
          ?.finalPaymentAmount ??
        0
    );

  // =========================================================
  // AMOUNT TO PAY
  // =========================================================

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

  // =========================================================
  // FORMAT MONEY
  // =========================================================

  const formatMoney = (
    value: number
  ) => {
    return `RM ${Number(
      value || 0
    ).toFixed(2)}`;
  };

  // =========================================================
  // CONTINUE PAYMENT
  // =========================================================

  const handleContinuePayment = () =>
    checkoutAttempt.run(continuePayment);

  const continuePayment =
    async () => {
      if (
        submitting ||
        !booking?.id
      ) {
        return;
      }

      // =============================================
      // DUITNOW / SPAY
      // =============================================

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

      // =============================================
      // STRIPE
      // =============================================

      try {
        setSubmitting(true);
        setError("");

        logger.debug(
          "Starting Stripe payment:",
          paymentType
        );

        // Same booking and payment part -> same key until a session
        // comes back, so a retry after a timeout replays it.
        const attempt =
          checkoutAttempt.attemptFor(
            `${booking.id}:${paymentType}`
          );

        const result =
          await createStripeCheckoutSession(
            booking.id,
            paymentType,
            attempt.key
          );

        // Got a session: the next tap (e.g. after cancelling on Stripe)
        // asks for a new one, as before.
        checkoutAttempt.finish();

        logger.debug(
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

        // F2: the payment-status screen needs to know which part
        // is being paid; the return URL doesn't say.
        rememberStripePayment(
          booking.id,
          paymentType
        );

        // In-app browser that closes itself when Stripe redirects to
        // mobile://customer/... (success or cancel).
        const browserResult =
          await WebBrowser.openAuthSessionAsync(
            checkoutUrl,
            STRIPE_RETURN_PREFIX
          );

        if (
          browserResult.type ===
          "success"
        ) {
          const returnPath =
            appPathFromReturnUrl(
              browserResult.url
            );

          // On Android the router also receives this link and opens
          // the screen itself; on iOS it doesn't. Navigate only if we
          // are still on checkout, so the screen never opens twice.
          setTimeout(() => {
            if (
              returnPath &&
              navigation.isFocused()
            ) {
              router.replace(
                returnPath as Href
              );
            }
          }, 800);

          return;
        }

        // Browser closed without returning. If the payment went
        // through anyway, show its status; otherwise stay here.
        try {
          const refreshed =
            await getCustomerBookingById(
              booking.id
            );

          setBooking(refreshed);

          if (
            isPartPaid(
              refreshed,
              paymentType
            )
          ) {
            router.replace(
              `/customer/payment-status/${booking.id}` as Href
            );
          }
        } catch (refreshErr) {
          logger.debug(
            "Could not refresh after closing Stripe:",
            refreshErr
          );
        }
      } catch (
        err: any
      ) {
        logger.debug(
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

  // =========================================================
  // LOADING
  // =========================================================

  if (loading) {
    return (
      <SafeAreaView
        style={styles.center}
      >
        <StatusBar
          style="dark"
        />

        <Text
          style={
            styles.loadingText
          }
        >
          Loading checkout...
        </Text>
      </SafeAreaView>
    );
  }

  // =========================================================
  // LOAD ERROR
  // =========================================================

  if (
    error &&
    !booking
  ) {
    return (
      <SafeAreaView
        style={styles.center}
      >
        <StatusBar
          style="dark"
        />

        <Ionicons
          name="alert-circle-outline"
          size={38}
          color="#B94747"
        />

        <Text
          style={
            styles.errorTitle
          }
        >
          Unable to open checkout
        </Text>

        <Text
          style={
            styles.errorMessage
          }
        >
          {error}
        </Text>

        <Pressable
          style={
            styles.retryButton
          }
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

  // =========================================================
  // MAIN UI
  // =========================================================

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <StatusBar
        style="dark"
      />

      {/* HEADER */}
      <View
        style={
          styles.header
        }
      >
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

        <View
          style={{
            flex: 1,
          }}
        >
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
        {/* BOOKING SUMMARY */}
        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.eyebrow
            }
          >
            Booking
          </Text>

          <Text
            style={
              styles.bookingCode
            }
          >
            {booking
              ?.bookingCode ||
              `Booking #${booking?.id}`}
          </Text>

          <InfoRow
            label="Service"
            value={
              booking
                ?.serviceName ||
              booking?.listing
                ?.title ||
              booking?.listing
                ?.name ||
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

        {/* PAYMENT TYPE */}
        <View
          style={
            styles.card
          }
        >
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

        {/* PAYMENT METHOD */}
        <View
          style={
            styles.card
          }
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Payment Method
          </Text>

          <PaymentMethodChoice
            selected={
              method ===
              "STRIPE"
            }
            icon="card-outline"
            label="Stripe"
            description="Secure card payment"
            onPress={() =>
              setMethod(
                "STRIPE"
              )
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

        {/* ERROR */}
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

      {/* FOOTER */}
      <View
        style={
          styles.footer
        }
      >
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
          disabled={
            submitting
          }
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

// =========================================================
// INFO ROW
// =========================================================

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.infoRow
      }
    >
      <Text
        style={
          styles.infoLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.infoValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

// =========================================================
// PAYMENT CHOICE
// =========================================================

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
      disabled={
        disabled
      }
      onPress={
        onPress
      }
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

      <View
        style={{
          flex: 1,
        }}
      >
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

// =========================================================
// PAYMENT METHOD CHOICE
// =========================================================

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
      onPress={
        onPress
      }
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

      <View
        style={{
          flex: 1,
        }}
      >
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

// =========================================================
// STYLES
// =========================================================

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        "#F7FAFB",
    },

    center: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      padding: 24,
      backgroundColor:
        "#F7FAFB",
    },

    loadingText: {
      color:
        "#70858E",
      fontWeight:
        "700",
    },

    errorTitle: {
      color:
        "#17313C",
      fontSize: 17,
      fontWeight:
        "900",
      marginTop: 12,
    },

    errorMessage: {
      color:
        "#7A8E96",
      fontSize: 12,
      textAlign:
        "center",
      marginTop: 6,
    },

    retryButton: {
      marginTop: 18,
      paddingHorizontal:
        20,
      height: 46,
      borderRadius:
        14,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#07869B",
    },

    retryText: {
      color:
        "#FFFFFF",
      fontWeight:
        "900",
    },

    header: {
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 12,
      paddingHorizontal:
        18,
      paddingVertical:
        14,
      backgroundColor:
        "#FFFFFF",
      borderBottomWidth:
        1,
      borderBottomColor:
        "#E5ECEF",
    },

    headerButton: {
      width: 42,
      height: 42,
      borderRadius:
        14,
      backgroundColor:
        "#F3F7F8",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    headerTitle: {
      color:
        "#17313C",
      fontSize: 18,
      fontWeight:
        "900",
    },

    headerSubtitle: {
      color:
        "#83969E",
      fontSize: 10,
      marginTop: 2,
    },

    content: {
      padding: 18,
      paddingBottom:
        125,
    },

    card: {
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E3EAED",
      borderRadius:
        18,
      padding: 16,
      marginBottom:
        16,
    },

    eyebrow: {
      color:
        "#07869B",
      fontSize: 10,
      fontWeight:
        "900",
      textTransform:
        "uppercase",
    },

    bookingCode: {
      color:
        "#17313C",
      fontSize: 21,
      fontWeight:
        "900",
      marginTop: 5,
      marginBottom:
        15,
    },

    infoRow: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      gap: 20,
      paddingVertical:
        8,
    },

    infoLabel: {
      color:
        "#82949C",
      fontSize: 10,
    },

    infoValue: {
      flex: 1,
      textAlign:
        "right",
      color:
        "#17313C",
      fontSize: 11,
      fontWeight:
        "800",
    },

    divider: {
      height: 1,
      backgroundColor:
        "#E7ECEF",
      marginVertical:
        13,
    },

    amountRow: {
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "space-between",
    },

    amountLabel: {
      color:
        "#17313C",
      fontSize: 13,
      fontWeight:
        "800",
    },

    amountValue: {
      color:
        "#07869B",
      fontSize: 22,
      fontWeight:
        "900",
    },

    sectionTitle: {
      color:
        "#17313C",
      fontSize: 14,
      fontWeight:
        "900",
      marginBottom:
        12,
    },

    choice: {
      minHeight: 67,
      borderWidth: 1,
      borderColor:
        "#E1E9EC",
      borderRadius:
        15,
      padding: 13,
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 11,
      marginBottom:
        10,
      backgroundColor:
        "#FAFCFD",
    },

    choiceSelected: {
      borderColor:
        "#07869B",
      backgroundColor:
        "#EAF8FA",
    },

    choiceDisabled: {
      opacity: 0.42,
    },

    choiceTitle: {
      color:
        "#17313C",
      fontSize: 12,
      fontWeight:
        "900",
    },

    choiceDescription: {
      color:
        "#83969E",
      fontSize: 10,
      marginTop: 3,
    },

    radio: {
      width: 21,
      height: 21,
      borderRadius:
        11,
      borderWidth: 2,
      borderColor:
        "#BAC9CE",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    radioSelected: {
      borderColor:
        "#07869B",
    },

    radioInner: {
      width: 9,
      height: 9,
      borderRadius: 5,
      backgroundColor:
        "#07869B",
    },

    errorCard: {
      flexDirection:
        "row",
      gap: 8,
      padding: 13,
      borderRadius:
        14,
      backgroundColor:
        "#FFF1F1",
      borderWidth: 1,
      borderColor:
        "#F0CCCC",
    },

    errorText: {
      flex: 1,
      color:
        "#A33E3E",
      fontSize: 11,
      fontWeight:
        "700",
    },

    footer: {
      position:
        "absolute",
      left: 0,
      right: 0,
      bottom: 0,
      paddingHorizontal:
        18,
      paddingTop: 12,
      paddingBottom:
        20,
      backgroundColor:
        "#FFFFFF",
      borderTopWidth: 1,
      borderTopColor:
        "#E3EAED",
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      alignItems:
        "center",
      gap: 16,
    },

    footerLabel: {
      color:
        "#83969E",
      fontSize: 10,
    },

    footerAmount: {
      color:
        "#17313C",
      fontSize: 18,
      fontWeight:
        "900",
      marginTop: 2,
    },

    payButton: {
      minWidth: 150,
      height: 52,
      borderRadius:
        15,
      backgroundColor:
        "#07869B",
      flexDirection:
        "row",
      alignItems:
        "center",
      justifyContent:
        "center",
      gap: 7,
      paddingHorizontal:
        18,
    },

    payButtonDisabled: {
      opacity: 0.65,
    },

    payButtonText: {
      color:
        "#FFFFFF",
      fontSize: 12,
      fontWeight:
        "900",
    },
  });