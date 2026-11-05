
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
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getOperatorDashboard,
  getOperatorNotifications,
  OperatorDashboard,
} from "../../../services/operatorApi";

import {
  clearSession,
  getStoredUser,
} from "../../../services/session";

export default function OperatorDashboardScreen() {
  const router = useRouter();

  const [unreadCount, setUnreadCount] = useState(0);

  const [dashboard, setDashboard] =
    useState<OperatorDashboard | null>(null);

  const [operatorName, setOperatorName] =
    useState("Operator");

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const loadDashboard = async (
    refresh = false
  ) => {
    try {
      setError("");

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const user = await getStoredUser();

      setOperatorName(user?.name || "Operator");

      
const data = await getOperatorDashboard();

setDashboard(data);

// Load unread operator notifications.
try {
  const response = await getOperatorNotifications();

  const unread = (response.notifications || []).filter(
    (notification) => !notification.isRead
  ).length;

  setUnreadCount(unread);
} catch (notificationError) {
  console.log(
    "Unable to load notification count:",
    notificationError
  );
}

    } catch (err: any) {
      setError(
        err?.message ||
          "Unable to load operator dashboard."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadDashboard();
    }, [])
  );

  const handleLogout = () => {
    Alert.alert(
      "Log Out",
      "Are you sure you want to log out?",
      [
        {
          text: "Cancel",
          style: "cancel",
        },
        {
          text: "Log Out",
          style: "destructive",
          onPress: async () => {
            await clearSession();
            router.dismissAll();
            router.replace("/login");
          },
        },
      ]
    );
  };

  const summary = dashboard?.summary;

  const money = (value?: number) =>
    `RM ${Number(value || 0).toLocaleString(
      "en-MY",
      {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2,
      }
    )}`;

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadDashboard(true)}
          />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              BNPL MERCHANT
            </Text>

            <Text style={styles.title}>
              Dashboard
            </Text>

            <Text style={styles.subtitle}>
              Welcome back, {operatorName}
            </Text>
          </View>

          
          <Pressable
            style={styles.notificationButton}
            onPress={() => router.push("/operator/notifications")}
          >
            <Ionicons
              name="notifications-outline"
              size={23}
              color="#17313C"
            />

            {unreadCount > 0 && (
              <View style={styles.notificationDot} />
            )}
          </Pressable>


          <Pressable
            style={styles.logoutButton}
            onPress={handleLogout}
          >
            <Ionicons
              name="log-out-outline"
              size={22}
              color="#17313C"
            />
          </Pressable>
        </View>

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator
              size="large"
              color="#07869B"
            />
            <Text style={styles.helperText}>
              Loading dashboard...
            </Text>
          </View>
        ) : error ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="alert-circle-outline"
              size={30}
              color="#D14343"
            />

            <Text style={styles.errorText}>
              {error}
            </Text>

            <Pressable
              onPress={() => loadDashboard()}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        ) : (
          <>
            <Text style={styles.sectionTitle}>
              Overview
            </Text>

            <Pressable
  onPress={() => router.push("/operator/licence-checks")}
  style={{
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    borderRadius: 16,
    padding: 16,
    marginBottom: 16,
  }}
>
  <Ionicons
    name="id-card-outline"
    size={24}
    color="#07869B"
  />

  <View style={{ flex: 1 }}>
    <Text
      style={{
        fontSize: 14,
        fontWeight: "900",
        color: "#17313C",
      }}
    >
      Licence Checks
    </Text>
    <Text
      style={{
        fontSize: 11,
        color: "#81939C",
        marginTop: 5,
      }}
    >
      Review submitted driving licences
    </Text>
  </View>

  <Ionicons
    name="chevron-forward"
    size={19}
    color="#81939C"
  />
</Pressable>


            <View style={styles.statsGrid}>
              <StatCard
                title="Total Bookings"
                value={summary?.totalBookings ?? 0}
                icon="calendar-outline"
              />

              <StatCard
                title="Pending Requests"
                value={summary?.pendingRequests ?? 0}
                icon="time-outline"
              />

              <StatCard
                title="Payment Pending"
                value={summary?.paymentPending ?? 0}
                icon="wallet-outline"
              />

              <StatCard
                title="Paid Bookings"
                value={summary?.paidBookings ?? 0}
                icon="checkmark-circle-outline"
              />

              <StatCard
                title="Expired Bookings"
                value={summary?.expiredBookings ?? 0}
                icon="alert-circle-outline"
              />
            </View>

            <View style={styles.revenueCard}>
              <View style={styles.revenueTop}>
                <Text style={styles.revenueLabel}>
                  Total Revenue
                </Text>

                <Ionicons
                  name="trending-up-outline"
                  size={23}
                  color="#FFFFFF"
                />
              </View>

              <Text style={styles.revenueAmount}>
                {money(summary?.totalRevenue)}
              </Text>
            </View>

            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>
                Recent Bookings
              </Text>

              <Text style={styles.sectionCount}>
                {dashboard?.recentBookings?.length || 0}
              </Text>
            </View>

            {dashboard?.recentBookings?.length ? (
              dashboard.recentBookings.map((booking) => (
                <View
                  key={booking.id}
                  style={styles.bookingCard}
                >
                  <View style={styles.bookingTop}>
                    <Text style={styles.bookingCode}>
                      {booking.bookingCode ||
                        `Booking #${booking.id}`}
                    </Text>

                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>
                        {String(
                          booking.status || "UNKNOWN"
                        ).replaceAll("_", " ")}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.bookingName}>
                    {booking.serviceName || "Car Rental"}
                  </Text>

                  <Text style={styles.bookingAmount}>
                    {money(booking.totalAmount)}
                  </Text>
                </View>
              ))
            ) : (
              <View style={styles.emptyCard}>
                <Ionicons
                  name="car-outline"
                  size={30}
                  color="#81939C"
                />

                <Text style={styles.helperText}>
                  No recent bookings found.
                </Text>
              </View>
            )}
          </>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

function StatCard({
  title,
  value,
  icon,
}: {
  title: string;
  value: number;
  icon: React.ComponentProps<typeof Ionicons>["name"];
}) {
  return (
    <View style={styles.statCard}>
      <Ionicons
        name={icon}
        size={22}
        color="#07869B"
      />

      <Text style={styles.statValue}>
        {value}
      </Text>

      <Text style={styles.statLabel}>
        {title}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },

  content: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 60,
  },

  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 28,
  },

  eyebrow: {
    color: "#07869B",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.4,
  },

  title: {
    color: "#17313C",
    fontSize: 29,
    fontWeight: "900",
    marginTop: 5,
  },

  subtitle: {
    color: "#84969E",
    fontSize: 12,
    marginTop: 5,
  },

  logoutButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    justifyContent: "center",
    alignItems: "center",
  },

  center: {
    paddingVertical: 90,
    alignItems: "center",
  },

  helperText: {
    color: "#81939C",
    fontSize: 12,
    marginTop: 12,
    textAlign: "center",
  },

  sectionTitle: {
    color: "#17313C",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 14,
  },

  statsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },

  statCard: {
    width: "48%",
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E3EAED",
    padding: 18,
    minHeight: 130,
  },

  statValue: {
    color: "#17313C",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 12,
  },

  statLabel: {
    color: "#81939C",
    fontSize: 11,
    marginTop: 5,
  },

  revenueCard: {
    backgroundColor: "#07869B",
    borderRadius: 22,
    padding: 22,
    marginTop: 18,
    marginBottom: 30,
  },

  revenueTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  revenueLabel: {
    color: "#DDF5F8",
    fontSize: 12,
    fontWeight: "700",
  },

  revenueAmount: {
    color: "#FFFFFF",
    fontSize: 27,
    fontWeight: "900",
    marginTop: 13,
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  sectionCount: {
    color: "#81939C",
    fontSize: 12,
    fontWeight: "800",
    marginBottom: 14,
  },

  bookingCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3EAED",
    padding: 16,
    marginBottom: 12,
  },

  bookingTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },

  bookingCode: {
    color: "#17313C",
    fontSize: 13,
    fontWeight: "900",
  },

  statusBadge: {
    backgroundColor: "#E6F7F9",
    borderRadius: 10,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },

  statusText: {
    color: "#07869B",
    fontSize: 9,
    fontWeight: "900",
  },

  bookingName: {
    color: "#617780",
    fontSize: 12,
    marginTop: 12,
  },

  bookingAmount: {
    color: "#17313C",
    fontSize: 14,
    fontWeight: "800",
    marginTop: 8,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E3EAED",
    padding: 28,
    alignItems: "center",
  },

  errorText: {
    color: "#D14343",
    textAlign: "center",
    marginTop: 12,
  },

  retryText: {
    color: "#07869B",
    fontWeight: "900",
    marginTop: 14,
  },

  notificationButton: {
  width: 46,
  height: 46,
  borderRadius: 15,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E3EAED",
  justifyContent: "center",
  alignItems: "center",
  marginRight: 10,
},

notificationDot: {
  position: "absolute",
  top: 9,
  right: 10,
  height: 9,
  width: 9,
  borderRadius: 5,
  backgroundColor: "#D14343",
  borderWidth: 1.5,
  borderColor: "#FFFFFF",
},
});
