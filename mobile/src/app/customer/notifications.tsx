import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useRouter,
} from "expo-router";

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
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
  getCustomerNotifications,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
} 
from "../../services/customerApi";

type Notification = {
  id: number;
  title?: string;
  message?: string;
  type?: string;
  isRead?: boolean;
  bookingRef?: string | null;
  createdAt?: string;
};

function formatDate(value?: string) {
  if (!value) return "";

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function getNotificationIcon(type?: string) {
  switch (type) {
    case "BOOKING_SUBMITTED":
    case "BOOKING_REQUEST_RECEIVED":
      return "car-outline";

    case "PAYMENT_REQUEST":
    case "PAYMENT_CONFIRMED":
      return "wallet-outline";

    case "INVOICE_SENT":
      return "document-text-outline";

    case "BOOKING_ACCEPTED":
      return "checkmark-circle-outline";

    case "BOOKING_REJECTED":
      return "close-circle-outline";

    default:
      return "notifications-outline";
  }
}

export default function NotificationsScreen() {
  const router = useRouter();

  const [notifications, setNotifications] =
    useState<Notification[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const loadNotifications = async (
    refresh = false
  ) => {
    try {
      setError("");

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data =
        await getCustomerNotifications();

      setNotifications(
        Array.isArray(data) ? data : []
      );
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to load notifications."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadNotifications();
    }, [])
  );

  const handleNotificationPress =
    async (item: Notification) => {
      try {
        if (!item.isRead) {
          await markCustomerNotificationRead(
            item.id
          );
        }

        setNotifications((current) =>
          current.map((notification) =>
            notification.id === item.id
              ? {
                  ...notification,
                  isRead: true,
                }
              : notification
          )
        );

        if (item.bookingRef) {
          const booking = item.bookingRef;

          const numericId =
            booking.match(/\d+/)?.[0];

          if (numericId) {
            router.push(
              `/customer/booking/${numericId}`
            );
          }
        }
      } catch (err) {
        console.log(err);
      }
    };

  const handleReadAll = async () => {
    try {
      await markAllCustomerNotificationsRead();

      setNotifications((current) =>
        current.map((item) => ({
          ...item,
          isRead: true,
        }))
      );
    } catch (err) {
      console.log(err);
    }
  };

  const unreadCount =
    notifications.filter(
      (item) => !item.isRead
    ).length;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color="#17313C"
          />
        </Pressable>

        <View>
          <Text style={styles.title}>
            Notifications
          </Text>

          <Text style={styles.subtitle}>
            {unreadCount} unread
          </Text>
        </View>

        <Pressable
          style={styles.headerButton}
          onPress={handleReadAll}
        >
          <Ionicons
            name="checkmark-done-outline"
            size={21}
            color="#07869B"
          />
        </Pressable>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color="#07869B"
          />

          <Text style={styles.loadingText}>
            Loading notifications...
          </Text>
        </View>
      ) : (
        <ScrollView
          style={styles.screen}
          contentContainerStyle={
            styles.container
          }
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={() =>
                loadNotifications(true)
              }
            />
          }
        >
          {error ? (
            <View style={styles.errorCard}>
              <Text style={styles.errorText}>
                {error}
              </Text>
            </View>
          ) : null}

          {!error &&
            notifications.length === 0 && (
              <View style={styles.emptyCard}>
                <View
                  style={styles.emptyIcon}
                >
                  <Ionicons
                    name="notifications-outline"
                    size={30}
                    color="#07869B"
                  />
                </View>

                <Text
                  style={styles.emptyTitle}
                >
                  You're all caught up
                </Text>

                <Text
                  style={styles.emptyText}
                >
                  Booking, payment and
                  invoice updates will
                  appear here.
                </Text>
              </View>
            )}

          {notifications.map((item) => (
            <Pressable
              key={item.id}
              style={({ pressed }) => [
                styles.notificationCard,

                !item.isRead &&
                  styles.unreadCard,

                pressed && {
                  opacity: 0.8,
                },
              ]}
              onPress={() =>
                handleNotificationPress(
                  item
                )
              }
            >
              <View
                style={styles.iconBox}
              >
                <Ionicons
                  name={getNotificationIcon(
                    item.type
                  )}
                  size={21}
                  color="#07869B"
                />
              </View>

              <View
                style={
                  styles.notificationContent
                }
              >
                <View
                  style={styles.titleRow}
                >
                  <Text
                    style={
                      styles.notificationTitle
                    }
                  >
                    {item.title ||
                      "Notification"}
                  </Text>

                  {!item.isRead && (
                    <View
                      style={
                        styles.unreadDot
                      }
                    />
                  )}
                </View>

                <Text
                  style={
                    styles.notificationMessage
                  }
                >
                  {item.message}
                </Text>

                <View
                  style={styles.metaRow}
                >
                  <Text
                    style={
                      styles.notificationDate
                    }
                  >
                    {formatDate(
                      item.createdAt
                    )}
                  </Text>

                  {item.bookingRef ? (
                    <Text
                      style={
                        styles.bookingRef
                      }
                    >
                      {item.bookingRef}
                    </Text>
                  ) : null}
                </View>
              </View>

              <Ionicons
                name="chevron-forward"
                size={18}
                color="#A1B0B6"
              />
            </Pressable>
          ))}
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },

  screen: {
    flex: 1,
  },

  container: {
    paddingHorizontal: 18,
    paddingBottom: 40,
  },

  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 10,
    color: "#81939C",
  },

  header: {
    paddingHorizontal: 18,
    paddingVertical: 14,
    flexDirection: "row",
    alignItems: "center",
    justifyContent:
      "space-between",
  },

  headerButton: {
    width: 44,
    height: 44,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EBED",
    justifyContent: "center",
    alignItems: "center",
  },

  title: {
    color: "#17313C",
    fontSize: 18,
    fontWeight: "900",
    textAlign: "center",
  },

  subtitle: {
    color: "#8799A1",
    fontSize: 10,
    textAlign: "center",
    marginTop: 2,
  },

  errorCard: {
    backgroundColor: "#FDEDED",
    borderRadius: 16,
    padding: 15,
    marginBottom: 15,
  },

  errorText: {
    color: "#D14343",
    textAlign: "center",
    fontSize: 12,
  },

  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 24,
    alignItems: "center",
    padding: 30,
    marginTop: 80,
    borderWidth: 1,
    borderColor: "#E5ECEF",
  },

  emptyIcon: {
    width: 64,
    height: 64,
    borderRadius: 22,
    backgroundColor: "#E5F7F9",
    alignItems: "center",
    justifyContent: "center",
  },

  emptyTitle: {
    color: "#17313C",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 16,
  },

  emptyText: {
    color: "#84969E",
    fontSize: 11,
    textAlign: "center",
    marginTop: 7,
    lineHeight: 17,
  },

  notificationCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    padding: 15,
    marginBottom: 11,

    borderWidth: 1,
    borderColor: "#E5ECEF",

    flexDirection: "row",
    alignItems: "center",
  },

  unreadCard: {
    backgroundColor: "#F0FAFB",
    borderColor: "#CBECEF",
  },

  iconBox: {
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "#E6F7F9",
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },

  notificationContent: {
    flex: 1,
  },

  titleRow: {
    flexDirection: "row",
    alignItems: "center",
  },

  notificationTitle: {
    flex: 1,
    color: "#17313C",
    fontSize: 13,
    fontWeight: "900",
  },

  unreadDot: {
    width: 7,
    height: 7,
    borderRadius: 7,
    backgroundColor: "#E84B4B",
    marginLeft: 7,
  },

  notificationMessage: {
    color: "#667C85",
    fontSize: 11,
    lineHeight: 16,
    marginTop: 5,
  },

  metaRow: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 8,
  },

  notificationDate: {
    color: "#9AABB2",
    fontSize: 9,
  },

  bookingRef: {
    marginLeft: 10,
    color: "#07869B",
    fontSize: 9,
    fontWeight: "800",
  },
});