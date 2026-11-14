import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button, GlassCard, Money } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";

/**
 * Shown after a card payment is confirmed (from payment-status). The amount
 * is the server's figure for the part that was paid, passed through as text
 * and only formatted here (F16).
 */
export default function PaymentSuccessScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const params = useLocalSearchParams<{
    bookingId?: string;
    bookingCode?: string;
    paymentType?: string;
    amount?: string;
  }>();

  const partLabel =
    params.paymentType === "FINAL_PAYMENT"
      ? "Balance"
      : params.paymentType === "FULL_PAYMENT"
        ? "Payment in full"
        : params.paymentType === "DOWN_PAYMENT"
          ? "Down payment"
          : "Payment";

  const nextLine =
    params.paymentType === "DOWN_PAYMENT"
      ? "Your car is secured. The balance is due before pick-up; you'll see its deadline on the booking."
      : "You're all paid. See you at pick-up.";

  const goToBooking = () =>
    router.replace((params.bookingId ? `/customer/booking/${params.bookingId}` : "/customer/(tabs)/bookings") as Href);

  return (
    <View style={[styles.screen, { paddingTop: insets.top + 24, paddingBottom: insets.bottom + 24 }]}>
      <GlassCard padding={24} style={styles.card}>
        <View style={[styles.icon, { backgroundColor: tokens.okBg }]}>
          <Ionicons name="checkmark" size={36} color={tokens.okFg} />
        </View>
        <AppText variant="title" align="center" accessibilityRole="header">
          Payment received
        </AppText>
        <AppText align="center">{nextLine}</AppText>

        <View style={[styles.rows, { borderColor: tokens.line }]}>
          <Row label="Booking" value={params.bookingCode || (params.bookingId ? `#${params.bookingId}` : "—")} mono />
          <Row label="Paid" value={partLabel} />
          {params.amount ? (
            <View style={styles.row}>
              <AppText variant="caption" style={styles.flex}>
                Amount
              </AppText>
              <Money value={params.amount} variant="headline" />
            </View>
          ) : null}
        </View>

        <View style={styles.buttons}>
          <Button label="View booking" variant="brand" onPress={goToBooking} />
          <Button label="All bookings" variant="line" onPress={() => router.replace("/customer/(tabs)/bookings")} />
        </View>
      </GlassCard>
    </View>
  );
}

function Row({ label, value, mono = false }: { label: string; value: string; mono?: boolean }) {
  return (
    <View style={styles.row}>
      <AppText variant="caption" style={styles.flex}>
        {label}
      </AppText>
      <AppText variant={mono ? "mono" : "bodyStrong"} color="ink">
        {value}
      </AppText>
    </View>
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
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  rows: {
    alignSelf: "stretch",
    gap: 10,
    marginTop: 4,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  buttons: {
    alignSelf: "stretch",
    gap: 10,
    marginTop: 8,
  },
});
