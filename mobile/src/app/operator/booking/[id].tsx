
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import { useCallback, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getOperatorBookingById,
  handoverOperatorBooking,
  OperatorBooking,
} from "../../../services/operatorApi";

import ReturnModal from "../../../components/operator/ReturnModal";

const formatDate = (value?: string | null) => {
  if (!value) return "Not specified";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return String(value);
  }

  return date.toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
};

const formatMoney = (value?: number) =>
  `RM ${Number(value || 0).toFixed(2)}`;

export default function OperatorBookingDetails() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();

  const bookingId = Number(id);

  const [booking, setBooking] =
    useState<OperatorBooking | null>(null);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [showReturn, setShowReturn] = useState(false);
  const [error, setError] = useState("");

  const loadBooking = useCallback(
    async (refresh = false) => {
      if (!Number.isInteger(bookingId) || bookingId <= 0) {
        setError("Invalid booking ID.");
        setLoading(false);
        return;
      }

      try {
        setError("");

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response =
          await getOperatorBookingById(bookingId);

        setBooking(response.booking);
      } catch (err: any) {
        setError(
          err?.message || "Failed to load booking."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [bookingId]
  );

  useFocusEffect(
    useCallback(() => {
      loadBooking();
    }, [loadBooking])
  );

  const confirmHandover = () => {
    if (!booking || processing) return;

    Alert.alert(
      "Record Handover",
      `Confirm that the vehicle for ${
        booking.bookingCode || `Booking #${booking.id}`
      } has been handed over to the customer?`,
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Confirm Handover",
          onPress: async () => {
            try {
              setProcessing(true);

              await handoverOperatorBooking(booking.id);

              await loadBooking(true);

              Alert.alert(
                "Success",
                "Vehicle handover recorded successfully."
              );
            } catch (err: any) {
              Alert.alert(
                "Handover Failed",
                err?.message ||
                  "Unable to record handover."
              );
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const status = booking?.status || "";

  const canHandover =
    status === "READY_FOR_PICKUP";

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={23}
            color="#17313C"
          />
        </Pressable>

        <View style={styles.headerText}>
          <Text style={styles.headerLabel}>
            OPERATOR
          </Text>

          <Text style={styles.headerTitle}>
            Booking Details
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadBooking(true)}
          />
        }
      >
        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator
              size="large"
              color="#07869B"
            />
            <Text style={styles.muted}>
              Loading booking...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.card}>
            <Text style={styles.error}>{error}</Text>

            <Pressable onPress={() => loadBooking()}>
              <Text style={styles.link}>Try Again</Text>
            </Pressable>
          </View>
        ) : booking ? (
          <>
            <View style={styles.card}>
              <Text style={styles.bookingCode}>
                {booking.bookingCode ||
                  `Booking #${booking.id}`}
              </Text>

              <View style={styles.statusBadge}>
                <Text style={styles.statusText}>
                  {status.replace(/_/g, " ")}
                </Text>
              </View>

              <Text style={styles.vehicleName}>
                {booking.serviceName || "Car Rental"}
              </Text>

              <Text style={styles.muted}>
                Booking information
              </Text>

              <View style={styles.divider} />

              <DetailRow
                label="Customer"
                value={booking.customer?.name || "N/A"}
              />

              <DetailRow
                label="Email"
                value={booking.customer?.email || "N/A"}
              />

              <DetailRow
                label="Location"
                value={booking.location || "N/A"}
              />

              <DetailRow
                label="Pickup"
                value={formatDate(booking.pickupDate)}
              />

              <DetailRow
                label="Return"
                value={formatDate(booking.returnDate)}
              />
            </View>

            <Text style={styles.sectionTitle}>
              Payment Information
            </Text>

            <View style={styles.card}>
              <DetailRow
                label="Payment Status"
                value={booking.payment?.status || "N/A"}
              />

              <DetailRow
                label="Total Rental"
                value={formatMoney(booking.totalAmount)}
              />

              <DetailRow
                label="Licence Status"
                value={
                  booking.customer?.licenceStatus ||
                  "NOT SUBMITTED"
                }
              />
            </View>

            <Text style={styles.sectionTitle}>
              Vehicle Handover
            </Text>

            <View style={styles.card}>
              {canHandover ? (
                <>
                  <Text style={styles.description}>
                    Confirm the customer identity, driving
                    licence and vehicle handover before
                    continuing.
                  </Text>

                  <Pressable
                    style={[
                      styles.primaryButton,
                      processing && styles.disabled,
                    ]}
                    disabled={processing}
                    onPress={confirmHandover}
                  >
                    {processing ? (
                      <ActivityIndicator color="#FFFFFF" />
                    ) : (
                      <>
                        <Ionicons
                          name="key-outline"
                          size={19}
                          color="#FFFFFF"
                        />
                        <Text style={styles.primaryText}>
                          Record Handover
                        </Text>
                      </>
                    )}
                  </Pressable>
                </>
              ) : status === "IN_PROGRESS" ? (
                <View>
                    <View style={styles.infoLine}>
                    <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#07869B"
                    />

                    <Text style={styles.infoText}>
                        Vehicle handed over. Rental is
                        currently in progress.
                    </Text>
                    </View>

                    <Pressable
                    style={styles.primaryButton}
                    onPress={() => setShowReturn(true)}
                    >
                    <Ionicons
                        name="return-down-back-outline"
                        size={19}
                        color="#FFFFFF"
                    />

                    <Text style={styles.primaryText}>
                        Record Return
                    </Text>
                    </Pressable>
                </View>
              
                ) : status === "COMPLETED" ? (
                <View>
                    <View style={styles.infoLine}>
                    <Ionicons
                        name="checkmark-circle"
                        size={22}
                        color="#07869B"
                    />

                    <Text style={styles.infoText}>
                        Rental completed and vehicle returned.
                    </Text>
                    </View>

                    {booking.returnedAt && (
                    <DetailRow
                        label="Actual Return"
                        value={formatDate(booking.returnedAt)}
                    />
                    )}

                    {booking.lateReturnHours != null && (
                    <DetailRow
                        label="Chargeable Hours"
                        value={`${booking.lateReturnHours} hour(s)`}
                    />
                    )}

                    {Number(booking.lateReturnCharge || 0) > 0 && (
                    <>
                        <DetailRow
                        label="Late Return Charge"
                        value={formatMoney(booking.lateReturnCharge)}
                        />

                        <DetailRow
                        label="Counter Payment"
                        value={
                            booking.lateReturnPaidAt
                            ? "Paid at Counter"
                            : "Pending"
                        }
                        />
                    </>
                    )}
                </View>

              ) : (
                <Text style={styles.description}>
                  Handover becomes available when the
                  booking reaches READY FOR PICKUP.
                </Text>
              )}
            </View>
          </>
        ) : null}
      </ScrollView>
      {showReturn && booking && (
  <ReturnModal
    booking={booking}
    onClose={() => setShowReturn(false)}
    onDone={async () => {
      await loadBooking(true);
    }}
  />
)}
    </SafeAreaView>
  );
}

function DetailRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.detailRow}>
      <Text style={styles.detailLabel}>{label}</Text>
      <Text style={styles.detailValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingTop: 15,
    paddingBottom: 15,
    gap: 13,
  },
  backButton: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    justifyContent: "center",
    alignItems: "center",
  },
  headerText: {
    flex: 1,
  },
  headerLabel: {
    fontSize: 10,
    fontWeight: "900",
    color: "#07869B",
    letterSpacing: 1,
  },
  headerTitle: {
    fontSize: 19,
    fontWeight: "900",
    color: "#17313C",
    marginTop: 2,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 65,
  },
  center: {
    alignItems: "center",
    paddingVertical: 80,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E3EAED",
    padding: 18,
    marginBottom: 17,
  },
  bookingCode: {
    color: "#17313C",
    fontSize: 21,
    fontWeight: "900",
  },
  statusBadge: {
    backgroundColor: "#E6F7F9",
    paddingHorizontal: 11,
    paddingVertical: 7,
    borderRadius: 10,
    alignSelf: "flex-start",
    marginTop: 12,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "900",
    color: "#07869B",
  },
  vehicleName: {
    fontSize: 20,
    fontWeight: "900",
    color: "#17313C",
    marginTop: 18,
    marginBottom: 7,
  },
  muted: {
    fontSize: 12,
    color: "#81939C",
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#EDF1F3",
    marginVertical: 17,
  },
  detailRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 14,
    marginVertical: 9,
  },
  detailLabel: {
    fontSize: 12,
    color: "#81939C",
    flex: 1,
  },
  detailValue: {
    fontSize: 12,
    fontWeight: "800",
    color: "#17313C",
    flex: 1.5,
    textAlign: "right",
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#17313C",
    marginBottom: 13,
    marginTop: 6,
  },
  description: {
    color: "#71858E",
    fontSize: 12,
    lineHeight: 20,
  },
  primaryButton: {
    backgroundColor: "#07869B",
    paddingVertical: 15,
    borderRadius: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginTop: 18,
  },
  primaryText: {
    fontSize: 13,
    fontWeight: "900",
    color: "#FFFFFF",
  },
  disabled: {
    opacity: 0.55,
  },
  infoLine: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  infoText: {
    color: "#07869B",
    fontSize: 12,
    flex: 1,
    fontWeight: "700",
    lineHeight: 19,
  },
  error: {
    fontSize: 13,
    color: "#D14343",
  },
  link: {
    fontSize: 13,
    color: "#07869B",
    fontWeight: "900",
    marginTop: 12,
  },
});
