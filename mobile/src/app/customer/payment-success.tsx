import { Ionicons } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

export default function PaymentSuccessScreen() {
  const router = useRouter();

  const params =
    useLocalSearchParams<{
      bookingId?: string;
      bookingCode?: string;
      paymentType?: string;
      amount?: string;
    }>();

  const paymentLabel =
    params.paymentType === "FINAL_PAYMENT"
      ? "Final Payment"
      : params.paymentType === "FULL_PAYMENT"
      ? "Full Payment"
      : "Down Payment";

  const goToBooking = () => {
    if (!params.bookingId) {
      router.replace(
        "/customer/(tabs)/bookings"
      );

      return;
    }

    router.replace(
      `/customer/booking/${params.bookingId}`
    );
  };

  const goToBookings = () => {
    router.replace(
      "/customer/(tabs)/bookings"
    );
  };

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <StatusBar style="dark" />

      <View style={styles.container}>
        <View
          style={styles.iconOuter}
        >
          <View
            style={styles.iconInner}
          >
            <Ionicons
              name="checkmark"
              size={42}
              color="#FFFFFF"
            />
          </View>
        </View>

        <Text style={styles.title}>
          Payment Successful
        </Text>

        <Text
          style={styles.description}
        >
          Your payment has been
          successfully received.
        </Text>

        <View style={styles.card}>
          <InfoRow
            label="Booking"
            value={
              params.bookingCode ||
              params.bookingId ||
              "—"
            }
          />

          <InfoRow
            label="Payment"
            value={paymentLabel}
          />

          {params.amount ? (
            <InfoRow
              label="Amount"
              value={`RM ${Number(
                params.amount
              ).toFixed(2)}`}
            />
          ) : null}

          <View style={styles.divider} />

          <View
            style={styles.statusRow}
          >
            <View
              style={styles.statusIcon}
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={19}
                color="#07869B"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={
                  styles.statusTitle
                }
              >
                Payment confirmed
              </Text>

              <Text
                style={
                  styles.statusDescription
                }
              >
                Your booking payment
                status has been updated.
              </Text>
            </View>
          </View>
        </View>

        <Pressable
          style={styles.primaryButton}
          onPress={goToBooking}
        >
          <Text
            style={
              styles.primaryButtonText
            }
          >
            View Booking
          </Text>

          <Ionicons
            name="arrow-forward"
            size={19}
            color="#FFFFFF"
          />
        </Pressable>

        <Pressable
          style={
            styles.secondaryButton
          }
          onPress={goToBookings}
        >
          <Text
            style={
              styles.secondaryButtonText
            }
          >
            Back to My Bookings
          </Text>
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

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },

  container: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 24,
  },

  iconOuter: {
    width: 98,
    height: 98,
    borderRadius: 49,
    alignSelf: "center",
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#DFF4F6",
    marginBottom: 22,
  },

  iconInner: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#07869B",
  },

  title: {
    textAlign: "center",
    color: "#17313C",
    fontSize: 25,
    fontWeight: "900",
  },

  description: {
    marginTop: 8,
    textAlign: "center",
    color: "#7A8E96",
    fontSize: 13,
    lineHeight: 20,
  },

  card: {
    marginTop: 30,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E2E9EC",
  },

  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 8,
    gap: 20,
  },

  infoLabel: {
    color: "#82949C",
    fontSize: 11,
  },

  infoValue: {
    flex: 1,
    textAlign: "right",
    color: "#17313C",
    fontSize: 12,
    fontWeight: "800",
  },

  divider: {
    height: 1,
    backgroundColor: "#E7ECEF",
    marginVertical: 14,
  },

  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },

  statusIcon: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#EAF8FA",
  },

  statusTitle: {
    color: "#17313C",
    fontSize: 12,
    fontWeight: "900",
  },

  statusDescription: {
    marginTop: 3,
    color: "#81949B",
    fontSize: 10,
  },

  primaryButton: {
    marginTop: 26,
    height: 54,
    borderRadius: 16,
    backgroundColor: "#07869B",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },

  primaryButtonText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },

  secondaryButton: {
    marginTop: 12,
    height: 52,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#DDE7EA",
  },

  secondaryButtonText: {
    color: "#17313C",
    fontSize: 12,
    fontWeight: "800",
  },
});