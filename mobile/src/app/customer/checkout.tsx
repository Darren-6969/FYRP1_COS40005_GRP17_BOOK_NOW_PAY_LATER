import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";
import { useMemo, useState } from "react";
import {
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

const PAYMENT_TYPES = {
  DOWN_PAYMENT: "DOWN_PAYMENT",
  FINAL_PAYMENT: "FINAL_PAYMENT",
  FULL_PAYMENT: "FULL_PAYMENT",
} as const;

type PaymentType =
  (typeof PAYMENT_TYPES)[keyof typeof PAYMENT_TYPES];

type PaymentMethod = "STRIPE" | "DUITNOW_SPAY";

export default function CheckoutScreen() {
  const router = useRouter();

  // TEMP DATA ONLY:
  // 下一步會直接換成 backend booking response。
  const booking = {
    id: 1048,
    bookingCode: "BNPL-1048",
    serviceName: "Toyota Corolla",
    pickupDate: "12 Mar 2026, 10:00 AM",
    returnDate: "15 Mar 2026, 10:00 AM",
    totalAmount: 660,

    status: "ACCEPTED",

    payment: {
      downPaymentAmount: 200,
      finalPaymentAmount: 460,
      downPaymentDueDate: "12 Mar 2026",
      finalPaymentDueDate: "10 Mar 2026",
      downPaymentStatus: "PENDING",
      finalPaymentStatus: "PENDING",
    },

    paymentSchedule: [
      {
        id: 1,
        label: "Deposit",
        amount: 200,
        dueAt: "12 Mar 2026",
        status: "DUE",
      },
      {
        id: 2,
        label: "Balance",
        amount: 460,
        dueAt: "10 Mar 2026",
        status: "DUE",
      },
    ],

    operator: {
      config: {
        acceptedPaymentMethods: {
          stripe: true,
          duitnowSpay: true,
        },
      },
    },
  };

  const [paymentType, setPaymentType] =
    useState<PaymentType>(PAYMENT_TYPES.DOWN_PAYMENT);

  const [method, setMethod] =
    useState<PaymentMethod>("STRIPE");

  const [submitting, setSubmitting] = useState(false);

  const downPaymentPaid =
    booking.payment.downPaymentStatus === "PAID";

  const finalPaymentPaid =
    booking.payment.finalPaymentStatus === "PAID";

  const acceptedPaymentMethods = useMemo(() => {
    return booking.operator.config.acceptedPaymentMethods;
  }, []);

  const amountToPay = useMemo(() => {
    if (paymentType === PAYMENT_TYPES.DOWN_PAYMENT) {
      return booking.payment.downPaymentAmount;
    }

    if (paymentType === PAYMENT_TYPES.FINAL_PAYMENT) {
      return booking.payment.finalPaymentAmount;
    }

    return booking.totalAmount;
  }, [paymentType]);

  const paymentDeadline = useMemo(() => {
    if (paymentType === PAYMENT_TYPES.DOWN_PAYMENT) {
      return booking.payment.downPaymentDueDate;
    }

    if (paymentType === PAYMENT_TYPES.FINAL_PAYMENT) {
      return booking.payment.finalPaymentDueDate;
    }

    return booking.payment.downPaymentDueDate;
  }, [paymentType]);

  const handleContinuePayment = async () => {
    if (method === "DUITNOW_SPAY") {
      router.push("/customer/upload-receipt");
      return;
    }

    if (method === "STRIPE") {
      setSubmitting(true);

      try {
        // NEXT STEP:
        // call existing backend:
        //
        // POST /stripe/checkout
        //
        // {
        //   bookingId: booking.id,
        //   paymentType
        // }
        //
        // backend returns:
        // {
        //   url: "https://checkout.stripe.com/..."
        // }
        //
        console.log("Stripe Checkout", {
          bookingId: booking.id,
          paymentType,
        });
      } finally {
        setSubmitting(false);
      }
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* HEADER */}
        <View style={styles.header}>
          <Pressable
            style={styles.headerButton}
            onPress={() => router.back()}
          >
            <Text style={styles.backIcon}>‹</Text>
          </Pressable>

          <Text style={styles.headerTitle}>
            Complete Payment
          </Text>

          <View style={styles.headerPlaceholder} />
        </View>

        {/* BOOKING */}
        <View style={styles.card}>
          <Text style={styles.eyebrow}>Checkout</Text>

          <Text style={styles.bookingCode}>
            {booking.bookingCode}
          </Text>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Service</Text>

            <Text style={styles.infoValue}>
              {booking.serviceName}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Pick-up</Text>

            <Text style={styles.infoValue}>
              {booking.pickupDate}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>Return</Text>

            <Text style={styles.infoValue}>
              {booking.returnDate}
            </Text>
          </View>

          <View style={styles.infoRow}>
            <Text style={styles.infoLabel}>
              Payment Deadline
            </Text>

            <Text style={styles.infoValue}>
              {paymentDeadline}
            </Text>
          </View>

          <View style={styles.divider} />

          <View style={styles.amountRow}>
            <Text style={styles.amountLabel}>
              Amount to Pay
            </Text>

            <Text style={styles.amountValue}>
              RM {amountToPay}
            </Text>
          </View>
        </View>

        {/* PAYMENT SCHEDULE */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Full Payment Schedule
          </Text>

          {booking.paymentSchedule.map((entry) => (
            <View
              key={entry.id}
              style={styles.scheduleRow}
            >
              <View>
                <Text style={styles.scheduleTitle}>
                  {entry.label}
                </Text>

                <Text style={styles.scheduleDate}>
                  Due {entry.dueAt}
                </Text>
              </View>

              <View style={styles.scheduleRight}>
                <Text style={styles.scheduleAmount}>
                  RM {entry.amount}
                </Text>

                <View style={styles.dueBadge}>
                  <Text style={styles.dueBadgeText}>
                    {entry.status}
                  </Text>
                </View>
              </View>
            </View>
          ))}
        </View>

        {/* PAYMENT TYPE */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Payment Plan
          </Text>

          <Text style={styles.sectionSubtitle}>
            Choose which part of the booking payment
            you want to complete.
          </Text>

          <PaymentChoice
            selected={
              paymentType ===
              PAYMENT_TYPES.DOWN_PAYMENT
            }
            disabled={downPaymentPaid}
            label="Pay down-payment"
            description={`RM ${booking.payment.downPaymentAmount} due ${booking.payment.downPaymentDueDate}`}
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
              !downPaymentPaid || finalPaymentPaid
            }
            label="Pay final payment"
            description={`RM ${booking.payment.finalPaymentAmount} due ${booking.payment.finalPaymentDueDate}`}
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
              downPaymentPaid || finalPaymentPaid
            }
            label="Pay full amount"
            description={`RM ${booking.totalAmount}`}
            onPress={() =>
              setPaymentType(
                PAYMENT_TYPES.FULL_PAYMENT
              )
            }
          />
        </View>

        {/* PAYMENT METHOD */}
        <View style={styles.card}>
          <Text style={styles.sectionTitle}>
            Payment Method
          </Text>

          {acceptedPaymentMethods.stripe && (
            <PaymentMethodChoice
              selected={method === "STRIPE"}
              label="Stripe"
              description="Card payment using Stripe secure checkout"
              onPress={() => setMethod("STRIPE")}
            />
          )}

          {acceptedPaymentMethods.duitnowSpay && (
            <PaymentMethodChoice
              selected={
                method === "DUITNOW_SPAY"
              }
              label="DuitNow / SPay"
              description="Scan DuitNow QR and upload receipt for verification"
              onPress={() =>
                setMethod("DUITNOW_SPAY")
              }
            />
          )}

          {method === "STRIPE" && (
            <View style={styles.note}>
              <Text style={styles.noteTitle}>
                Stripe Secure Checkout
              </Text>

              <Text style={styles.noteText}>
                You will be redirected to Stripe's
                secure checkout page to complete your
                card payment.
              </Text>
            </View>
          )}

          {method === "DUITNOW_SPAY" && (
            <View style={styles.note}>
              <Text style={styles.noteTitle}>
                Manual Payment
              </Text>

              <Text style={styles.noteText}>
                Complete payment using DuitNow or SPay,
                then upload your receipt for operator
                verification.
              </Text>
            </View>
          )}
        </View>
      </ScrollView>

      {/* BOTTOM ACTION */}
      <View style={styles.bottomBar}>
        <View>
          <Text style={styles.bottomLabel}>
            Amount
          </Text>

          <Text style={styles.bottomAmount}>
            RM {amountToPay}
          </Text>
        </View>

        <Pressable
          style={({ pressed }) => [
            styles.payButton,
            pressed && {
              opacity: 0.85,
            },
          ]}
          disabled={submitting}
          onPress={handleContinuePayment}
        >
          <Text style={styles.payButtonText}>
            {method === "DUITNOW_SPAY"
              ? "Continue"
              : submitting
              ? "Processing..."
              : `Pay RM ${amountToPay}`}
          </Text>

          {!submitting && (
            <Text style={styles.payArrow}>
              →
            </Text>
          )}
        </Pressable>
      </View>
    </SafeAreaView>
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
      style={[
        styles.choiceCard,
        selected && styles.choiceSelected,
        disabled && styles.choiceDisabled,
      ]}
      disabled={disabled}
      onPress={onPress}
    >
      <View
        style={[
          styles.radioOuter,
          selected && styles.radioSelected,
        ]}
      >
        {selected && (
          <View style={styles.radioInner} />
        )}
      </View>

      <View style={styles.choiceContent}>
        <Text style={styles.choiceTitle}>
          {label}
        </Text>

        <Text style={styles.choiceDescription}>
          {disabled
            ? "Already paid or unavailable"
            : description}
        </Text>
      </View>
    </Pressable>
  );
}

function PaymentMethodChoice({
  selected,
  label,
  description,
  onPress,
}: {
  selected: boolean;
  label: string;
  description: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.choiceCard,
        selected && styles.choiceSelected,
      ]}
      onPress={onPress}
    >
      <View
        style={[
          styles.radioOuter,
          selected && styles.radioSelected,
        ]}
      >
        {selected && (
          <View style={styles.radioInner} />
        )}
      </View>

      <View style={styles.choiceContent}>
        <Text style={styles.choiceTitle}>
          {label}
        </Text>

        <Text style={styles.choiceDescription}>
          {description}
        </Text>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },

  scrollContent: {
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 130,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EBEE",
    justifyContent: "center",
    alignItems: "center",
  },

  backIcon: {
    fontSize: 34,
    color: "#17313C",
    marginTop: -4,
  },

  headerTitle: {
    color: "#17313C",
    fontSize: 18,
    fontWeight: "900",
  },

  headerPlaceholder: {
    width: 44,
  },

  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EBEE",
    borderRadius: 22,
    padding: 18,
    marginBottom: 18,
  },

  eyebrow: {
    color: "#07869B",
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },

  bookingCode: {
    fontSize: 23,
    fontWeight: "900",
    color: "#17313C",
    marginTop: 5,
    marginBottom: 18,
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 20,
    paddingVertical: 9,
  },

  infoLabel: {
    color: "#8798A1",
    fontSize: 12,
  },

  infoValue: {
    color: "#253D47",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    flex: 1,
  },

  divider: {
    height: 1,
    backgroundColor: "#E7ECEF",
    marginVertical: 14,
  },

  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  amountLabel: {
    color: "#17313C",
    fontSize: 14,
    fontWeight: "800",
  },

  amountValue: {
    color: "#07869B",
    fontSize: 23,
    fontWeight: "900",
  },

  sectionTitle: {
    color: "#17313C",
    fontSize: 17,
    fontWeight: "900",
  },

  sectionSubtitle: {
    color: "#85969E",
    fontSize: 12,
    lineHeight: 18,
    marginTop: 5,
    marginBottom: 14,
  },

  scheduleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1F3",
    paddingVertical: 14,
  },

  scheduleTitle: {
    color: "#17313C",
    fontSize: 14,
    fontWeight: "900",
  },

  scheduleDate: {
    color: "#8798A1",
    fontSize: 11,
    marginTop: 4,
  },

  scheduleRight: {
    alignItems: "flex-end",
  },

  scheduleAmount: {
    color: "#17313C",
    fontWeight: "900",
    fontSize: 14,
  },

  dueBadge: {
    backgroundColor: "#FFF2D6",
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 4,
    marginTop: 5,
  },

  dueBadgeText: {
    color: "#C88400",
    fontSize: 9,
    fontWeight: "800",
  },

  choiceCard: {
    minHeight: 74,
    borderWidth: 1,
    borderColor: "#DFE7EA",
    borderRadius: 16,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    marginTop: 11,
  },

  choiceSelected: {
    borderColor: "#07869B",
    backgroundColor: "#F1FAFB",
  },

  choiceDisabled: {
    opacity: 0.45,
  },

  radioOuter: {
    width: 22,
    height: 22,
    borderRadius: 20,
    borderWidth: 2,
    borderColor: "#BCCAD0",
    alignItems: "center",
    justifyContent: "center",
  },

  radioSelected: {
    borderColor: "#07869B",
  },

  radioInner: {
    width: 11,
    height: 11,
    borderRadius: 10,
    backgroundColor: "#07869B",
  },

  choiceContent: {
    flex: 1,
    marginLeft: 13,
  },

  choiceTitle: {
    color: "#17313C",
    fontSize: 14,
    fontWeight: "900",
  },

  choiceDescription: {
    color: "#84969E",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 4,
  },

  note: {
    marginTop: 16,
    backgroundColor: "#EAF7F9",
    padding: 14,
    borderRadius: 14,
  },

  noteTitle: {
    color: "#0B5363",
    fontSize: 13,
    fontWeight: "900",
  },

  noteText: {
    color: "#58717B",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 5,
  },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E3EAED",
    paddingHorizontal: 20,
    paddingVertical: 15,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  bottomLabel: {
    color: "#84959D",
    fontSize: 10,
  },

  bottomAmount: {
    color: "#17313C",
    fontSize: 21,
    fontWeight: "900",
  },

  payButton: {
    minHeight: 54,
    minWidth: 170,
    backgroundColor: "#07869B",
    borderRadius: 16,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },

  payButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  payArrow: {
    color: "#FFFFFF",
    fontSize: 19,
    marginLeft: 8,
  },
});