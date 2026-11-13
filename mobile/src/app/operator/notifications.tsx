
import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
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
  getOperatorBookings,
  getOperatorNotifications,
  markAllOperatorNotificationsRead,
  markOperatorNotificationRead,
  OperatorNotification,
} from "../../services/operatorApi";
import { logger } from "@/utils/logger";

type NotificationFilter = "ALL" | "UNREAD";

function formatDate(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return value;
  }

  return date.toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function isPaymentNotification(
  notification: OperatorNotification
) {
  const content =
    `${notification.type} ${notification.title}`.toUpperCase();

  return (
    content.includes("PAYMENT") ||
    content.includes("RECEIPT") ||
    content.includes("INVOICE")
  );
}

export default function OperatorNotificationsScreen() {
  const router = useRouter();

  const [notifications, setNotifications] =
    useState<OperatorNotification[]>([]);

  const [filter, setFilter] =
    useState<NotificationFilter>("ALL");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const loadNotifications = useCallback(
    async (refresh = false) => {
      try {
        setError("");

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await getOperatorNotifications();

        setNotifications(
          Array.isArray(response?.notifications)
            ? response.notifications
            : []
        );
      } catch (err: any) {
        setError(
          err?.message ||
            "Unable to load notifications."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [loadNotifications])
  );

  const unreadCount = notifications.filter(
    (item) => !item.isRead
  ).length;

  const visibleNotifications =
    filter === "UNREAD"
      ? notifications.filter((item) => !item.isRead)
      : notifications;

  const handleNotification = async (
    notification: OperatorNotification
  ) => {
    if (processing) return;

    try {
      setProcessing(true);

      if (!notification.isRead) {
        await markOperatorNotificationRead(
          notification.id
        );

        setNotifications((previous) =>
          previous.map((item) =>
            item.id === notification.id
              ? { ...item, isRead: true }
              : item
          )
        );
      }

      // Payment-related notifications open Payments.
      if (isPaymentNotification(notification)) {
        router.push("/operator/payments");
        return;
      }

      // Extract a booking code, never guess an ID.
      const content =
        `${notification.title} ${notification.message}`;

      const codeMatch = content.match(
        /BNPL-[A-Za-z0-9]+/i
      );

      if (codeMatch) {
        try {
          const response = await getOperatorBookings("ALL");

          const match = response.bookings.find(
            (booking) =>
              booking.bookingCode?.toUpperCase() ===
              codeMatch[0].toUpperCase()
          );

          if (match) {
            router.push({
              pathname: "/operator/booking/[id]",
              params: { id: String(match.id) },
            });
            return;
          }
        } catch (lookupError) {
          logger.debug(
            "Notification booking lookup failed:",
            lookupError
          );
        }
      }

      // Safe fallback when a notification has no booking ID.
      router.push("/operator/bookings");
    } catch (err: any) {
      Alert.alert(
        "Notification Error",
        err?.message ||
          "Unable to open notification."
      );
    } finally {
      setProcessing(false);
    }
  };

  const markAllRead = () => {
    if (processing || unreadCount === 0) return;

    Alert.alert(
      "Mark All as Read",
      "Mark all your notifications as read?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Mark All Read",
          onPress: async () => {
            try {
              setProcessing(true);

              await markAllOperatorNotificationsRead();

              setNotifications((previous) =>
                previous.map((item) => ({
                  ...item,
                  isRead: true,
                }))
              );
            } catch (err: any) {
              Alert.alert(
                "Error",
                err?.message ||
                  "Unable to update notifications."
              );
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
          disabled={processing}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color="#17313C"
          />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            OPERATOR ACTIVITY
          </Text>
          <Text style={styles.title}>
            Notifications
          </Text>
        </View>

        <View style={styles.unreadBadge}>
          <Text style={styles.unreadCount}>
            {unreadCount}
          </Text>
        </View>
      </View>

      <View style={styles.toolbar}>
        <View style={styles.filters}>
          <Pressable
            style={[
              styles.filter,
              filter === "ALL" && styles.filterActive,
            ]}
            onPress={() => setFilter("ALL")}
          >
            <Text
              style={[
                styles.filterText,
                filter === "ALL" &&
                  styles.filterTextActive,
              ]}
            >
              All
            </Text>
          </Pressable>

          <Pressable
            style={[
              styles.filter,
              filter === "UNREAD" &&
                styles.filterActive,
            ]}
            onPress={() => setFilter("UNREAD")}
          >
            <Text
              style={[
                styles.filterText,
                filter === "UNREAD" &&
                  styles.filterTextActive,
              ]}
            >
              Unread
            </Text>
          </Pressable>
        </View>

        <Pressable
          onPress={markAllRead}
          disabled={processing || unreadCount === 0}
        >
          <Text
            style={[
              styles.markAllText,
              unreadCount === 0 && styles.disabledText,
            ]}
          >
            Mark all read
          </Text>
        </Pressable>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadNotifications(true)}
          />
        }
      >
        {!!error && (
          <View style={styles.emptyCard}>
            <Text style={styles.errorText}>
              {error}
            </Text>

            <Pressable
              onPress={() => loadNotifications()}
            >
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <View style={styles.center}>
            <ActivityIndicator
              size="large"
              color="#07869B"
            />
            <Text style={styles.helperText}>
              Loading notifications...
            </Text>
          </View>
        ) : !error &&
          visibleNotifications.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="notifications-off-outline"
              size={37}
              color="#81939C"
            />

            <Text style={styles.emptyTitle}>
              No notifications
            </Text>

            <Text style={styles.helperText}>
              {filter === "UNREAD"
                ? "You have no unread notifications."
                : "Operator notifications will appear here."}
            </Text>
          </View>
        ) : !error ? (
          visibleNotifications.map((notification) => (
            <Pressable
              key={notification.id}
              onPress={() =>
                handleNotification(notification)
              }
              disabled={processing}
              style={[
                styles.notificationCard,
                !notification.isRead &&
                  styles.unreadCard,
              ]}
            >
              <View style={styles.iconContainer}>
                <Ionicons
                  name={
                    isPaymentNotification(notification)
                      ? "wallet-outline"
                      : "notifications-outline"
                  }
                  size={21}
                  color="#07869B"
                />
              </View>

              <View style={{ flex: 1 }}>
                <View style={styles.notificationTop}>
                  <Text style={styles.notificationTitle}>
                    {notification.title}
                  </Text>

                  {!notification.isRead && (
                    <View style={styles.unreadDot} />
                  )}
                </View>

                <Text style={styles.message}>
                  {notification.message}
                </Text>

                <Text style={styles.date}>
                  {formatDate(notification.createdAt)}
                </Text>
              </View>

              <Ionicons
                name="chevron-forward"
                size={17}
                color="#A1B0B6"
              />
            </Pressable>
          ))
        ) : null}
      </ScrollView>
    </SafeAreaView>
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
    paddingTop: 18,
    paddingBottom: 20,
    gap: 13,
  },
  backButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    justifyContent: "center",
    alignItems: "center",
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    color: "#07869B",
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 25,
    fontWeight: "900",
    color: "#17313C",
    marginTop: 4,
  },
  unreadBadge: {
    minWidth: 30,
    height: 30,
    borderRadius: 15,
    backgroundColor: "#E6F7F9",
    justifyContent: "center",
    alignItems: "center",
    paddingHorizontal: 7,
  },
  unreadCount: {
    color: "#07869B",
    fontSize: 12,
    fontWeight: "900",
  },
  toolbar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingBottom: 17,
  },
  filters: {
    flexDirection: "row",
    gap: 8,
  },
  filter: {
    backgroundColor: "#FFFFFF",
    borderRadius: 12,
    borderWidth: 1,
    borderColor: "#E3EAED",
    paddingHorizontal: 15,
    paddingVertical: 10,
  },
  filterActive: {
    backgroundColor: "#07869B",
    borderColor: "#07869B",
  },
  filterText: {
    color: "#617780",
    fontSize: 12,
    fontWeight: "800",
  },
  filterTextActive: {
    color: "#FFFFFF",
  },
  markAllText: {
    color: "#07869B",
    fontSize: 11,
    fontWeight: "800",
  },
  disabledText: {
    opacity: 0.4,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 75,
  },
  center: {
    paddingTop: 85,
    alignItems: "center",
  },
  helperText: {
    color: "#81939C",
    fontSize: 12,
    textAlign: "center",
    marginTop: 12,
  },
  notificationCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 15,
    gap: 12,
    borderWidth: 1,
    borderColor: "#E3EAED",
    marginBottom: 12,
  },
  unreadCard: {
    backgroundColor: "#F1FBFC",
    borderColor: "#C6E8ED",
  },
  iconContainer: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#E6F7F9",
    alignItems: "center",
    justifyContent: "center",
  },
  notificationTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  notificationTitle: {
    color: "#17313C",
    fontSize: 13,
    fontWeight: "900",
    flex: 1,
  },
  unreadDot: {
    height: 8,
    width: 8,
    borderRadius: 4,
    backgroundColor: "#D14343",
  },
  message: {
    color: "#6F838C",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 6,
  },
  date: {
    color: "#9AABB2",
    fontSize: 10,
    marginTop: 9,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#E3EAED",
    padding: 35,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#17313C",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 13,
  },
  errorText: {
    color: "#D14343",
    fontSize: 12,
    textAlign: "center",
  },
  retryText: {
    color: "#07869B",
    fontWeight: "800",
    marginTop: 10,
  },
});
