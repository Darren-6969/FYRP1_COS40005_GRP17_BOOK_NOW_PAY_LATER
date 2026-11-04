
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useRouter,
} from "expo-router";
import {
  useCallback,
  useState,
} from "react";

import {
  ActivityIndicator,
  Alert,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  acceptOperatorBooking,
  getOperatorBookings,
  OperatorBooking,
  rejectOperatorBooking,
} from "../../../services/operatorApi";

type BookingTab =
  | "PENDING"
  | "ALL"
  | "ACCEPTED"
  | "REJECTED"
  | "UPCOMING"
  | "IN_PROGRESS";

const BOOKING_TABS: {
  label: string;
  value: BookingTab;
}[] = [
  { label: "Pending", value: "PENDING" },
  { label: "All", value: "ALL" },
  { label: "Upcoming", value: "UPCOMING" },
  { label: "In Progress", value: "IN_PROGRESS" },
  { label: "Accepted", value: "ACCEPTED" },
  { label: "Rejected", value: "REJECTED" },
];

export default function OperatorBookingsScreen() {
  const [activeTab, setActiveTab] =
    useState<BookingTab>("PENDING");

  const router = useRouter();

  const [bookings, setBookings] =
    useState<OperatorBooking[]>([]);

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processingId, setProcessingId] =
    useState<number | null>(null);

  const [error, setError] = useState("");

  const [rejectTarget, setRejectTarget] =
    useState<OperatorBooking | null>(null);

  const [rejectReason, setRejectReason] =
    useState("");

  const [acceptTarget, setAcceptTarget] =
    useState<OperatorBooking | null>(null);

  const [successMessage, setSuccessMessage] =
    useState("");

  const loadBookings = useCallback(
    async (refresh = false) => {
      try {
        setError("");

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        // Load current bookings from the shared backend.
        const response = await getOperatorBookings(
        activeTab === "UPCOMING" ? "ALL" : activeTab
        );

        const receivedBookings = Array.isArray(
        response?.bookings
        )
        ? response.bookings
        : [];

        const nextBookings =
        activeTab === "UPCOMING"
            ? receivedBookings.filter(
                (booking) =>
                booking.status === "PAID" ||
                booking.status === "READY_FOR_PICKUP"
            )
            : receivedBookings;

        setBookings(nextBookings);
      } catch (err: any) {
        setError(
          err?.message ||
            "Unable to load bookings."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [activeTab]
  );

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [loadBookings])
  );

  const handleAccept = async () => {
    if (!acceptTarget || processingId !== null) {
      return;
    }

    const bookingId = acceptTarget.id;

    try {
      setProcessingId(bookingId);
      setError("");
      setSuccessMessage("");
      setAcceptTarget(null);

      await acceptOperatorBooking(bookingId);
      await loadBookings(true);

      setSuccessMessage(
        "Booking accepted successfully."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to accept booking."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async () => {
    if (!rejectTarget || processingId !== null) {
      return;
    }

    const bookingId = rejectTarget.id;

    try {
      setProcessingId(bookingId);
      setError("");
      setSuccessMessage("");

      await rejectOperatorBooking(
        bookingId,
        rejectReason.trim()
      );

      setRejectTarget(null);
      setRejectReason("");

      await loadBookings(true);

      setSuccessMessage(
        "Booking rejected successfully."
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to reject booking."
      );
    } finally {
      setProcessingId(null);
    }
  };

  const money = (value?: number) =>
    `RM ${Number(value || 0).toLocaleString(
      "en-MY",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;

  const formatDate = (value?: string) => {
    if (!value) return "Not specified";

    const date = new Date(value);

    return Number.isNaN(date.getTime())
      ? String(value)
      : date.toLocaleDateString("en-MY", {
          day: "2-digit",
          month: "short",
          year: "numeric",
        });
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          BOOKING MANAGEMENT
        </Text>

        <Text style={styles.title}>
          Bookings
        </Text>

        <Text style={styles.subtitle}>
          Review and manage customer reservations
        </Text>
      </View>

      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.tabs}
        style={styles.tabsScroll}
        bounces={false}
        >
        {BOOKING_TABS.map((tab) => (
          <Pressable
            key={tab.value}
            style={[
              styles.tab,
              activeTab === tab.value &&
                styles.activeTab,
            ]}
            onPress={() => {
              setActiveTab(tab.value);
              setSuccessMessage("");
            }}
          >
            <Text
            numberOfLines={1}
            allowFontScaling={false}
            style={[
                styles.tabText,
                activeTab === tab.value &&
                styles.activeTabText,
            ]}
            >
            {tab.label}
            </Text>
          </Pressable>
        ))}
      </ScrollView>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadBookings(true)}
          />
        }
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {activeTab === "ALL"
              ? "All Bookings"
              : `${BOOKING_TABS.find(
                  (tab) => tab.value === activeTab
                )?.label} Bookings`}
          </Text>

          {!loading && !error && (
            <Text style={styles.count}>
              {bookings.length} bookings
            </Text>
          )}
        </View>

        {!!successMessage && (
          <View style={styles.successBox}>
            <Ionicons
              name="checkmark-circle"
              size={18}
              color="#07869B"
            />
            <Text style={styles.successText}>
              {successMessage}
            </Text>
          </View>
        )}

        {!!error && (
          <View style={styles.errorBox}>
            <Text style={styles.errorText}>
              {error}
            </Text>

            <Pressable onPress={() => loadBookings()}>
              <Text style={styles.retryText}>
                Retry
              </Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              size="large"
              color="#07869B"
            />
            <Text style={styles.helperText}>
              Loading bookings...
            </Text>
          </View>
        ) : !error && bookings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="calendar-outline"
              size={34}
              color="#81939C"
            />

            <Text style={styles.emptyTitle}>
              No bookings found
            </Text>

            <Text style={styles.helperText}>
              Bookings will appear here when
              customers submit reservations.
            </Text>
          </View>
        ) : !error ? (
          bookings.map((booking) => (
            <Pressable
                key={booking.id}
                style={({ pressed }) => [
                styles.bookingCard,
                pressed && { opacity: 0.85 },
                ]}
                onPress={() =>
                router.push({
                    pathname: "/operator/booking/[id]",
                    params: {
                    id: String(booking.id),
                    },
                })
                }
            >
              <View style={styles.bookingTop}>
                <Text style={styles.bookingCode}>
                  {booking.bookingCode ||
                    `Booking #${booking.id}`}
                </Text>

                <View
                  style={[
                    styles.statusBadge,
                    booking.status === "REJECTED" &&
                      styles.rejectedBadge,
                  ]}
                >
                  <Text
                    style={[
                      styles.statusText,
                      booking.status === "REJECTED" &&
                        styles.rejectedText,
                    ]}
                  >
                    {String(booking.status).replace(
                      /_/g,
                      " "
                    )}
                  </Text>
                </View>
              </View>

              <Text style={styles.carName}>
                {booking.serviceName ||
                  "Car Rental"}
              </Text>

              <View style={styles.infoRow}>
                <Ionicons
                  name="person-outline"
                  size={16}
                  color="#81939C"
                />
                <Text style={styles.infoText}>
                  {booking.customer?.name ||
                    "Customer"}
                </Text>
              </View>

              {booking.location ? (
                <View style={styles.infoRow}>
                  <Ionicons
                    name="location-outline"
                    size={16}
                    color="#81939C"
                  />
                  <Text style={styles.infoText}>
                    {booking.location}
                  </Text>
                </View>
              ) : null}

              <View style={styles.infoRow}>
                <Ionicons
                  name="calendar-outline"
                  size={16}
                  color="#81939C"
                />
                <Text style={styles.infoText}>
                  {formatDate(booking.pickupDate)}
                  {" – "}
                  {formatDate(booking.returnDate)}
                </Text>
              </View>

              <View style={styles.divider} />

              <View style={styles.amountRow}>
                <Text style={styles.amountLabel}>
                  Total Rental
                </Text>

                <Text style={styles.amount}>
                  {money(booking.totalAmount)}
                </Text>
              </View>

              {booking.status === "PENDING" && (
                <View style={styles.actionRow}>
                  <Pressable
                    style={[
                      styles.rejectButton,
                      processingId !== null &&
                        styles.disabled,
                    ]}
                    disabled={processingId !== null}
                    onPress={(event) => {
                    event.stopPropagation();
                    setRejectReason("");
                    setRejectTarget(booking);
                    }}
                  >
                    <Text style={styles.rejectText}>
                      Reject
                    </Text>
                  </Pressable>

                  <Pressable
                    style={[
                      styles.acceptButton,
                      processingId !== null &&
                        styles.disabled,
                    ]}
                    disabled={processingId !== null}
                    onPress={(event) => {
                    event.stopPropagation();
                    setAcceptTarget(booking);
                    }}
                  >
                    <Text style={styles.acceptText}>
                      Accept
                    </Text>
                  </Pressable>
                </View>
              )}
            </Pressable>
          ))
        ) : null}
      </ScrollView>

      {/* Accept Confirmation */}
      <Modal
        visible={acceptTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setAcceptTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Ionicons
              name="checkmark-circle-outline"
              size={34}
              color="#07869B"
            />

            <Text style={styles.modalTitle}>
              Accept Booking?
            </Text>

            <Text style={styles.modalDescription}>
              Accepting this booking will trigger
              the existing payment request process.
            </Text>

            <Text style={styles.modalBookingCode}>
              {acceptTarget?.bookingCode ||
                `Booking #${acceptTarget?.id || ""}`}
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                disabled={processingId !== null}
                onPress={() => setAcceptTarget(null)}
              >
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={styles.confirmButton}
                disabled={processingId !== null}
                onPress={handleAccept}
              >
                <Text style={styles.confirmText}>
                  Confirm Accept
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* Reject Confirmation */}
      <Modal
        visible={rejectTarget !== null}
        transparent
        animationType="fade"
        onRequestClose={() => setRejectTarget(null)}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <Ionicons
              name="close-circle-outline"
              size={34}
              color="#D14343"
            />

            <Text style={styles.modalTitle}>
              Reject Booking?
            </Text>

            <Text style={styles.modalDescription}>
              The customer will be notified that
              this booking was rejected.
            </Text>

            <TextInput
              style={styles.reasonInput}
              placeholder="Reason for rejection (optional)"
              placeholderTextColor="#91A2A9"
              value={rejectReason}
              onChangeText={setRejectReason}
              multiline
            />

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                disabled={processingId !== null}
                onPress={() => {
                  setRejectTarget(null);
                  setRejectReason("");
                }}
              >
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={styles.confirmRejectButton}
                disabled={processingId !== null}
                onPress={handleReject}
              >
                <Text style={styles.confirmText}>
                  Confirm Reject
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 22,
    paddingBottom: 14,
  },
  eyebrow: {
    fontSize: 10,
    color: "#07869B",
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: {
    fontSize: 28,
    fontWeight: "900",
    color: "#17313C",
    marginTop: 5,
  },
  subtitle: {
    fontSize: 12,
    color: "#81939C",
    marginTop: 5,
  },
  tabsScroll: {
  height: 64,
  maxHeight: 64,
  flexGrow: 0,
  flexShrink: 0,
  marginBottom: 8,
  },
  tabs: {
  paddingHorizontal: 20,
  paddingVertical: 8,
  gap: 10,
  alignItems: "center",
  minHeight: 64,
  },
  tab: {
  height: 44,
  paddingHorizontal: 18,
  borderRadius: 13,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E3EAED",
  alignItems: "center",
  justifyContent: "center",
  },
  activeTab: {
  backgroundColor: "#07869B",
  borderColor: "#07869B",
  },
  tabText: {
  color: "#617780",
  fontSize: 12,
  fontWeight: "800",
  lineHeight: 18,
  includeFontPadding: true,
  textAlign: "center",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 125,
    paddingTop: 10,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#17313C",
  },
  count: {
    color: "#81939C",
    fontSize: 11,
    fontWeight: "800",
  },
  bookingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 17,
    marginBottom: 13,
    borderWidth: 1,
    borderColor: "#E3EAED",
  },
  bookingTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 8,
  },
  bookingCode: {
    color: "#17313C",
    fontSize: 13,
    fontWeight: "900",
    flex: 1,
  },
  statusBadge: {
    paddingHorizontal: 9,
    paddingVertical: 6,
    borderRadius: 9,
    backgroundColor: "#E6F7F9",
  },
  statusText: {
    fontSize: 10,
    color: "#07869B",
    fontWeight: "900",
  },
  rejectedBadge: {
    backgroundColor: "#FDE8E8",
  },
  rejectedText: {
    color: "#D14343",
  },
  carName: {
    color: "#17313C",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 15,
    marginBottom: 10,
  },
  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginTop: 8,
  },
  infoText: {
    fontSize: 12,
    color: "#6E838C",
    flex: 1,
  },
  divider: {
    height: 1,
    backgroundColor: "#EDF1F3",
    marginVertical: 15,
  },
  amountRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  amountLabel: {
    color: "#81939C",
    fontSize: 12,
  },
  amount: {
    color: "#17313C",
    fontSize: 17,
    fontWeight: "900",
  },
  actionRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 17,
  },
  acceptButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 13,
    backgroundColor: "#07869B",
    alignItems: "center",
  },
  rejectButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 13,
    backgroundColor: "#FFF0F0",
    borderWidth: 1,
    borderColor: "#F4CDCD",
    alignItems: "center",
  },
  acceptText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  rejectText: {
    color: "#D14343",
    fontSize: 13,
    fontWeight: "900",
  },
  disabled: {
    opacity: 0.5,
  },
  loading: {
    paddingVertical: 80,
    alignItems: "center",
  },
  helperText: {
    fontSize: 12,
    color: "#81939C",
    textAlign: "center",
    marginTop: 10,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 35,
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E3EAED",
  },
  emptyTitle: {
    color: "#17313C",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 12,
  },
  errorBox: {
    backgroundColor: "#FFF0F0",
    padding: 14,
    borderRadius: 13,
    marginBottom: 14,
  },
  errorText: {
    color: "#D14343",
    fontSize: 12,
  },
  retryText: {
    color: "#07869B",
    fontWeight: "900",
    marginTop: 8,
  },
  successBox: {
    backgroundColor: "#E6F7F9",
    padding: 13,
    borderRadius: 13,
    flexDirection: "row",
    alignItems: "center",
    gap: 9,
    marginBottom: 14,
  },
  successText: {
    color: "#07869B",
    fontSize: 12,
    fontWeight: "800",
    flex: 1,
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(8, 26, 35, 0.55)",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 22,
  },
  modalTitle: {
    color: "#17313C",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 12,
  },
  modalDescription: {
    color: "#81939C",
    fontSize: 13,
    lineHeight: 20,
    marginTop: 8,
  },
  modalBookingCode: {
    color: "#07869B",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 13,
  },
  reasonInput: {
    backgroundColor: "#F7FAFB",
    borderWidth: 1,
    borderColor: "#E3EAED",
    borderRadius: 13,
    minHeight: 90,
    textAlignVertical: "top",
    padding: 13,
    marginTop: 16,
    color: "#17313C",
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 22,
  },
  cancelButton: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#F0F4F5",
    borderRadius: 12,
  },
  confirmButton: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#07869B",
    borderRadius: 12,
  },
  confirmRejectButton: {
    flex: 1,
    paddingVertical: 13,
    alignItems: "center",
    backgroundColor: "#D14343",
    borderRadius: 12,
  },
  cancelText: {
    color: "#617780",
    fontSize: 12,
    fontWeight: "900",
  },
  confirmText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
});
