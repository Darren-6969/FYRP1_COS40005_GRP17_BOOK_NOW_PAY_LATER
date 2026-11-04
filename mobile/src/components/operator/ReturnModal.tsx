
import { Ionicons } from "@expo/vector-icons";
import { useMemo, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  OperatorBooking,
  returnOperatorBooking,
} from "../../services/operatorApi";

type Props = {
  booking: OperatorBooking;
  onClose: () => void;
  onDone: () => Promise<void>;
};

// Convert a real Date into Malaysia-local input text.
function formatMalaysiaInput(date: Date): string {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuala_Lumpur",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hourCycle: "h23",
  }).formatToParts(date);

  const get = (type: string) =>
    parts.find((part) => part.type === type)?.value || "";

  return (
    `${get("year")}-${get("month")}-${get("day")} ` +
    `${get("hour")}:${get("minute")}`
  );
}

// Interpret the entered wall-clock time as Malaysia time.
function parseMalaysiaInput(value: string): Date | null {
  const match = value.trim().match(
    /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/
  );

  if (!match) return null;

  const [, yy, mm, dd, hh, min] = match;

  const year = Number(yy);
  const month = Number(mm);
  const day = Number(dd);
  const hour = Number(hh);
  const minute = Number(min);

  if (
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > 31 ||
    hour > 23 ||
    minute > 59
  ) {
    return null;
  }

  const date = new Date(
    Date.UTC(year, month - 1, day, hour - 8, minute)
  );

  // Reject impossible dates such as 2026-02-30.
  if (formatMalaysiaInput(date) !== value.trim()) {
    return null;
  }

  return date;
}

const money = (value: number) =>
  `RM ${value.toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function ReturnModal({
  booking,
  onClose,
  onDone,
}: Props) {
  const [actualReturnedAt, setActualReturnedAt] =
    useState(() => formatMalaysiaInput(new Date()));

  const [counterPaymentReceived, setCounterPaymentReceived] =
    useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const calculation = useMemo(() => {
    const actual = parseMalaysiaInput(actualReturnedAt);

    const scheduled = booking.returnDate
      ? new Date(booking.returnDate)
      : null;

    const scheduledValid =
      scheduled && !Number.isNaN(scheduled.getTime());

    const snapshotRate =
      Number(
        booking.pricingSnapshot?.rateCard?.hourlySen || 0
      ) / 100;

    const listingRate =
      Number(booking.listing?.hourlyRate || 0);

    const hourlyRate =
      snapshotRate > 0 ? snapshotRate : listingRate;

    if (!actual || !scheduledValid || !scheduled) {
      return {
        valid: false,
        actual,
        lateMinutes: 0,
        chargeableHours: 0,
        hourlyRate,
        lateCharge: 0,
      };
    }

    const lateMilliseconds = Math.max(
      0,
      actual.getTime() - scheduled.getTime()
    );

    const lateMinutes = Math.floor(
      lateMilliseconds / 60000
    );

    const chargeableHours =
      lateMilliseconds > 0
        ? Math.ceil(lateMilliseconds / 3600000)
        : 0;

    const lateCharge = Number(
      (chargeableHours * hourlyRate).toFixed(2)
    );

    return {
      valid: true,
      actual,
      lateMinutes,
      chargeableHours,
      hourlyRate,
      lateCharge,
    };
  }, [actualReturnedAt, booking]);

  const hasLateCharge =
    calculation.chargeableHours > 0;

  const submitReturn = async () => {
    if (submitting) return;

    if (!calculation.valid || !calculation.actual) {
      setError(
        "Enter a valid return time: YYYY-MM-DD HH:mm."
      );
      return;
    }

    if (calculation.actual.getTime() > Date.now()) {
      setError(
        "Actual return time cannot be in the future."
      );
      return;
    }

    if (
      booking.pickedUpAt &&
      calculation.actual.getTime() <
        new Date(booking.pickedUpAt).getTime()
    ) {
      setError(
        "Return time cannot be before vehicle handover."
      );
      return;
    }

    if (hasLateCharge && calculation.hourlyRate <= 0) {
      setError(
        "Hourly rate is unavailable. Check the booking configuration."
      );
      return;
    }

    if (hasLateCharge && !counterPaymentReceived) {
      setError(
        "Confirm the late return payment was received at the counter."
      );
      return;
    }

    setError("");

    const message = hasLateCharge
      ? `The estimated late return charge is ${money(
          calculation.lateCharge
        )}. Confirm the payment was collected and complete the return?`
      : "Confirm that the vehicle has been returned and complete this booking?";

    Alert.alert("Confirm Vehicle Return", message, [
      { text: "Cancel", style: "cancel" },
      {
        text: "Confirm Return",
        onPress: async () => {
          try {
            setSubmitting(true);

            // Send Malaysia-local time to match backend parser.
            const response = await returnOperatorBooking(
              booking.id,
              {
                actualReturnedAt:
                  actualReturnedAt.trim().replace(" ", "T"),
                counterPaymentReceived:
                  hasLateCharge && counterPaymentReceived,
              }
            );

            await onDone();
            onClose();

            const summary = response.returnSummary;

            Alert.alert(
              "Return Completed",
              summary.late
                ? `Booking completed.\n\nLate return: ${
                    summary.lateReturnHours
                  } hour(s)\nCharge: ${money(
                    summary.lateReturnCharge
                  )}\nPayment: Paid at counter`
                : "Vehicle returned successfully. No late return charge."
            );
          } catch (err: any) {
            setError(
              err?.message ||
                "Unable to complete vehicle return."
            );
          } finally {
            setSubmitting(false);
          }
        },
      },
    ]);
  };

  const lateHours = Math.floor(
    calculation.lateMinutes / 60
  );

  const remainingMinutes =
    calculation.lateMinutes % 60;

  return (
    <Modal
      visible
      animationType="slide"
      presentationStyle="pageSheet"
      onRequestClose={() => {
        if (!submitting) onClose();
      }}
    >
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              VEHICLE MANAGEMENT
            </Text>
            <Text style={styles.title}>
              Record Vehicle Return
            </Text>
            <Text style={styles.subtitle}>
              {booking.bookingCode ||
                `Booking #${booking.id}`}
            </Text>
          </View>

          <Pressable
            onPress={onClose}
            disabled={submitting}
            style={styles.closeButton}
          >
            <Ionicons
              name="close"
              size={23}
              color="#17313C"
            />
          </Pressable>
        </View>

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
        >
          <View style={styles.card}>
            <InfoRow
              label="Scheduled Return"
              value={
                booking.returnDate
                  ? formatMalaysiaInput(
                      new Date(booking.returnDate)
                    )
                  : "Not available"
              }
            />

            <InfoRow
              label="Hourly Rate"
              value={
                calculation.hourlyRate > 0
                  ? `${money(calculation.hourlyRate)} / hour`
                  : "Not configured"
              }
            />
          </View>

          <Text style={styles.label}>
            Actual Return Time *
          </Text>

          <TextInput
            style={styles.input}
            value={actualReturnedAt}
            onChangeText={(value) => {
              setActualReturnedAt(value);
              setCounterPaymentReceived(false);
              setError("");
            }}
            placeholder="YYYY-MM-DD HH:mm"
            placeholderTextColor="#8A9AA3"
            autoCapitalize="none"
          />

          <Pressable
            onPress={() => {
              setActualReturnedAt(
                formatMalaysiaInput(new Date())
              );
              setCounterPaymentReceived(false);
              setError("");
            }}
            style={styles.nowButton}
          >
            <Ionicons
              name="time-outline"
              size={16}
              color="#07869B"
            />
            <Text style={styles.nowText}>
              Use Current Time
            </Text>
          </Pressable>

          <View style={styles.card}>
            <Text style={styles.cardTitle}>
              Return Summary
            </Text>

            <InfoRow
              label="Late Duration"
              value={
                calculation.valid && hasLateCharge
                  ? `${lateHours}h ${remainingMinutes}m`
                  : calculation.valid
                    ? "On time"
                    : "Invalid return time"
              }
            />

            <InfoRow
              label="Chargeable Hours"
              value={
                calculation.valid
                  ? `${calculation.chargeableHours} hour(s)`
                  : "—"
              }
            />

            <View style={styles.divider} />

            <InfoRow
              label="Estimated Late Charge"
              value={
                calculation.valid
                  ? money(calculation.lateCharge)
                  : "—"
              }
            />
          </View>

          {hasLateCharge && calculation.valid && (
            <Pressable
              style={styles.paymentCard}
              onPress={() =>
                setCounterPaymentReceived((value) => !value)
              }
              disabled={submitting}
            >
              <Ionicons
                name={
                  counterPaymentReceived
                    ? "checkbox"
                    : "square-outline"
                }
                size={25}
                color="#07869B"
              />

              <View style={{ flex: 1 }}>
                <Text style={styles.paymentTitle}>
                  Payment Received at Counter
                </Text>

                <Text style={styles.paymentDescription}>
                  Confirm that the actual late return
                  charge has been collected from
                  the customer.
                </Text>
              </View>
            </Pressable>
          )}

          {!!error && (
            <Text style={styles.error}>
              {error}
            </Text>
          )}

          <Text style={styles.notice}>
            Late return charges are calculated using the
            existing booking rate. The backend will
            validate the final amount and return status.
          </Text>

          <Pressable
            style={[
              styles.confirmButton,
              submitting && styles.disabled,
            ]}
            disabled={submitting}
            onPress={submitReturn}
          >
            {submitting ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="checkmark-circle-outline"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.confirmText}>
                  Confirm Vehicle Return
                </Text>
              </>
            )}
          </Pressable>
        </ScrollView>
      </View>
    </Modal>
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
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
    paddingTop: 26,
  },
  eyebrow: {
    color: "#07869B",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: {
    color: "#17313C",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 5,
  },
  subtitle: {
    color: "#81939C",
    fontSize: 12,
    marginTop: 6,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 65,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 18,
    marginBottom: 17,
    borderWidth: 1,
    borderColor: "#E3EAED",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginVertical: 9,
  },
  infoLabel: {
    color: "#81939C",
    fontSize: 12,
    flex: 1,
  },
  infoValue: {
    color: "#17313C",
    fontSize: 12,
    fontWeight: "800",
    flex: 1.3,
    textAlign: "right",
  },
  label: {
    color: "#17313C",
    fontSize: 13,
    fontWeight: "800",
    marginBottom: 9,
  },
  input: {
    borderWidth: 1,
    borderColor: "#E3EAED",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    paddingHorizontal: 15,
    paddingVertical: 14,
    color: "#17313C",
    fontSize: 15,
  },
  nowButton: {
    flexDirection: "row",
    gap: 7,
    alignItems: "center",
    marginTop: 11,
    marginBottom: 22,
  },
  nowText: {
    color: "#07869B",
    fontWeight: "800",
    fontSize: 12,
  },
  cardTitle: {
    color: "#17313C",
    fontSize: 15,
    fontWeight: "900",
    marginBottom: 10,
  },
  divider: {
    height: 1,
    backgroundColor: "#EDF1F3",
    marginVertical: 10,
  },
  paymentCard: {
    flexDirection: "row",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#D4E9ED",
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
  },
  paymentTitle: {
    color: "#17313C",
    fontWeight: "900",
    fontSize: 13,
  },
  paymentDescription: {
    color: "#81939C",
    fontSize: 11,
    lineHeight: 18,
    marginTop: 5,
  },
  error: {
    color: "#D14343",
    fontSize: 12,
    marginBottom: 15,
  },
  notice: {
    color: "#81939C",
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 18,
  },
  confirmButton: {
    backgroundColor: "#07869B",
    borderRadius: 15,
    minHeight: 52,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.6,
  },
});
