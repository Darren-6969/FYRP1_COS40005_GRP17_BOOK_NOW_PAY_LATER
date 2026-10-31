import {
  useFocusEffect,
  useRouter,
} from "expo-router";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useCallback,
  useState,
} from "react";

import {
  getCustomerBookings,
} from "../../../services/customerApi";

type Booking = {
  id: number;
  bookingCode?: string | null;
  serviceName?: string | null;
  serviceType?: string | null;
  pickupDate?: string | null;
  returnDate?: string | null;
  location?: string | null;
  totalAmount?: number;
  status?: string;
  createdAt?: string;
  payment?: {
    status?: string;
    downPaymentStatus?: string;
    finalPaymentStatus?: string;
    paidAmount?: number;
  } | null;
};

function formatMoney(value?: number) {
  const amount = Number(value || 0);

  return `RM ${amount.toFixed(2)}`;
}

function formatDate(value?: string | null) {
  if (!value) return "-";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "-";
  }

  return date.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function formatStatus(status?: string) {
  if (!status) return "UNKNOWN";

  return status.replaceAll("_", " ");
}

function getStatusStyle(status?: string) {
  switch (status) {
    case "PENDING":
      return styles.statusPending;

    case "ACCEPTED":
    case "CONFIRMED":
      return styles.statusAccepted;

    case "PAID":
    case "READY_FOR_PICKUP":
    case "COMPLETED":
      return styles.statusPaid;

    case "REJECTED":
    case "CANCELLED":
    case "OVERDUE":
    case "EXPIRED":
      return styles.statusRejected;

    default:
      return styles.statusDefault;
  }
}

function getStatusTextStyle(status?: string) {
  switch (status) {
    case "PENDING":
      return styles.statusPendingText;

    case "ACCEPTED":
    case "CONFIRMED":
      return styles.statusAcceptedText;

    case "PAID":
    case "READY_FOR_PICKUP":
    case "COMPLETED":
      return styles.statusPaidText;

    case "REJECTED":
    case "CANCELLED":
    case "OVERDUE":
    case "EXPIRED":
      return styles.statusRejectedText;

    default:
      return styles.statusDefaultText;
  }
}

export default function Bookings() {
  const router = useRouter();
  
  const [bookings, setBookings] =
    useState<Booking[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const loadBookings = async (
    isRefresh = false
  ) => {
    try {
      setError("");

      if (isRefresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data =
        await getCustomerBookings();

      if (Array.isArray(data)) {
        setBookings(data);
      } else {
        setBookings([]);
      }
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to load bookings."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBookings();
    }, [])
  );

  if (loading) {
    return (
      <View style={styles.center}>
        <ActivityIndicator
          size="large"
          color="#07869B"
        />

        <Text style={styles.loadingText}>
          Loading bookings...
        </Text>
      </View>
    );
  }

  return (
    <ScrollView
      style={styles.screen}
      contentContainerStyle={
        styles.container
      }
      refreshControl={
        <RefreshControl
          refreshing={refreshing}
          onRefresh={() =>
            loadBookings(true)
          }
        />
      }
    >
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          BNPL CAR RENTAL
        </Text>

        <Text style={styles.title}>
          My Bookings
        </Text>

        <Text style={styles.subtitle}>
          View and track all your booking
          requests.
        </Text>
      </View>

      {error ? (
        <View style={styles.errorBox}>
          <Text style={styles.errorText}>
            {error}
          </Text>
        </View>
      ) : null}

      {!error &&
        bookings.length === 0 && (
          <View style={styles.emptyCard}>
            <Text
              style={styles.emptyTitle}
            >
              No bookings yet
            </Text>

            <Text
              style={styles.emptyText}
            >
              Your bookings will appear
              here after you make a
              booking request.
            </Text>
          </View>
        )}

      {bookings.map((booking) => (
        <Pressable
          key={booking.id}
          style={({ pressed }) => [
            styles.bookingCard,
            pressed && styles.bookingCardPressed,
          ]}
          onPress={() =>
            router.push(
              `/customer/booking/${booking.id}`
            )
          }
        >
          <View style={styles.cardTop}>
            <View style={styles.codeArea}>
              <Text
                style={
                  styles.bookingLabel
                }
              >
                BOOKING
              </Text>

              <Text
                style={
                  styles.bookingCode
                }
              >
                {booking.bookingCode ||
                  `BNPL-${booking.id}`}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                getStatusStyle(
                  booking.status
                ),
              ]}
            >
              <Text
                style={[
                  styles.statusText,
                  getStatusTextStyle(
                    booking.status
                  ),
                ]}
              >
                {formatStatus(
                  booking.status
                )}
              </Text>
            </View>
          </View>

          <View style={styles.divider} />

          <Text
            style={styles.serviceName}
          >
            {booking.serviceName ||
              "Car Rental"}
          </Text>

          {booking.serviceType ? (
            <Text
              style={
                styles.serviceType
              }
            >
              {booking.serviceType}
            </Text>
          ) : null}

          <View style={styles.infoRow}>
            <View style={styles.infoItem}>
              <Text
                style={styles.infoLabel}
              >
                Pick-up
              </Text>

              <Text
                style={styles.infoValue}
              >
                {formatDate(
                  booking.pickupDate
                )}
              </Text>
            </View>

            <View style={styles.infoItem}>
              <Text
                style={styles.infoLabel}
              >
                Return
              </Text>

              <Text
                style={styles.infoValue}
              >
                {formatDate(
                  booking.returnDate
                )}
              </Text>
            </View>
          </View>

          {booking.location ? (
            <View
              style={styles.locationRow}
            >
              <Text
                style={styles.infoLabel}
              >
                Location
              </Text>

              <Text
                style={
                  styles.locationValue
                }
              >
                {booking.location}
              </Text>
            </View>
          ) : null}

          <View
            style={styles.bottomRow}
          >
            <View>
              <Text
                style={styles.infoLabel}
              >
                Total Amount
              </Text>

              <Text
                style={styles.amount}
              >
                {formatMoney(
                  booking.totalAmount
                )}
              </Text>
            </View>

            {booking.payment ? (
              <View
                style={
                  styles.paymentArea
                }
              >
                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Payment
                </Text>

                <Text
                  style={
                    styles.paymentStatus
                  }
                >
                  {formatStatus(
                    booking.payment
                      .status
                  )}
                </Text>
              </View>
            ) : (
              <View
                style={
                  styles.paymentArea
                }
              >
                <Text
                  style={
                    styles.infoLabel
                  }
                >
                  Payment
                </Text>

                <Text
                  style={
                    styles.waitingPayment
                  }
                >
                  Waiting
                </Text>
              </View>
            )}
          </View>
        </Pressable>
      ))}
    </ScrollView>
  );
}

const styles =
  StyleSheet.create({
    screen: {
      flex: 1,
      backgroundColor: "#F7FAFB",
    },

    container: {
      width: "100%",
      maxWidth: 700,
      alignSelf: "center",
      paddingHorizontal: 20,
      paddingTop: 24,
      paddingBottom: 110,
    },

    center: {
      flex: 1,
      backgroundColor: "#F7FAFB",
      alignItems: "center",
      justifyContent: "center",
    },

    loadingText: {
      marginTop: 12,
      color: "#84969E",
      fontSize: 13,
    },

    header: {
      marginBottom: 24,
    },

    eyebrow: {
      color: "#07869B",
      fontSize: 11,
      fontWeight: "900",
    },

    title: {
      color: "#17313C",
      fontSize: 30,
      fontWeight: "900",
      marginTop: 4,
    },

    subtitle: {
      color: "#81939C",
      fontSize: 13,
      marginTop: 6,
    },

    errorBox: {
      backgroundColor: "#FFF0F0",
      borderRadius: 16,
      padding: 16,
      marginBottom: 18,
    },

    errorText: {
      color: "#D73A49",
      fontSize: 12,
      textAlign: "center",
    },

    emptyCard: {
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#E1E9EC",
      borderRadius: 22,
      padding: 30,
      alignItems: "center",
    },

    emptyTitle: {
      color: "#17313C",
      fontSize: 18,
      fontWeight: "900",
    },

    emptyText: {
      color: "#84969E",
      fontSize: 12,
      textAlign: "center",
      marginTop: 8,
      lineHeight: 18,
    },

    bookingCard: {
      backgroundColor: "#FFFFFF",
      borderWidth: 1,
      borderColor: "#E1E9EC",
      borderRadius: 22,
      padding: 18,
      marginBottom: 16,
    },

    bookingCardPressed: {
    opacity: 0.85,
    transform: [
      {
        scale: 0.985,
      },
    ],
  },

    cardTop: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
    },

    codeArea: {
      flex: 1,
    },

    bookingLabel: {
      color: "#8799A1",
      fontSize: 9,
      fontWeight: "800",
    },

    bookingCode: {
      color: "#17313C",
      fontSize: 17,
      fontWeight: "900",
      marginTop: 3,
    },

    statusBadge: {
      borderRadius: 10,
      paddingHorizontal: 10,
      paddingVertical: 6,
    },

    statusText: {
      fontSize: 9,
      fontWeight: "900",
    },

    statusPending: {
      backgroundColor: "#FFF2D6",
    },

    statusPendingText: {
      color: "#B87400",
    },

    statusAccepted: {
      backgroundColor: "#E6F5F7",
    },

    statusAcceptedText: {
      color: "#07869B",
    },

    statusPaid: {
      backgroundColor: "#E9F7EF",
    },

    statusPaidText: {
      color: "#278653",
    },

    statusRejected: {
      backgroundColor: "#FDEDED",
    },

    statusRejectedText: {
      color: "#D14343",
    },

    statusDefault: {
      backgroundColor: "#EDF1F3",
    },

    statusDefaultText: {
      color: "#657A84",
    },

    divider: {
      height: 1,
      backgroundColor: "#E9EEF0",
      marginVertical: 15,
    },

    serviceName: {
      color: "#17313C",
      fontSize: 18,
      fontWeight: "900",
    },

    serviceType: {
      color: "#84969E",
      fontSize: 11,
      marginTop: 4,
    },

    infoRow: {
      flexDirection: "row",
      marginTop: 18,
      gap: 20,
    },

    infoItem: {
      flex: 1,
    },

    infoLabel: {
      color: "#8A9BA3",
      fontSize: 10,
    },

    infoValue: {
      color: "#28434D",
      fontSize: 12,
      fontWeight: "800",
      marginTop: 4,
    },

    locationRow: {
      marginTop: 15,
    },

    locationValue: {
      color: "#28434D",
      fontSize: 12,
      fontWeight: "800",
      marginTop: 4,
    },

    bottomRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "flex-end",
      marginTop: 20,
      paddingTop: 16,
      borderTopWidth: 1,
      borderTopColor: "#EDF1F3",
    },

    amount: {
      color: "#07869B",
      fontSize: 19,
      fontWeight: "900",
      marginTop: 4,
    },

    paymentArea: {
      alignItems: "flex-end",
    },

    paymentStatus: {
      color: "#17313C",
      fontSize: 11,
      fontWeight: "900",
      marginTop: 4,
    },

    waitingPayment: {
      color: "#B87400",
      fontSize: 11,
      fontWeight: "900",
      marginTop: 4,
    },
  });