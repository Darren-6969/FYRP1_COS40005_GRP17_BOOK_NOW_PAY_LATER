import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState, type ComponentProps } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button, EmptyState, ErrorState, GlassCard, IconButton, Skeleton, SkeletonText, useToast } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  getCustomerBookings,
  getCustomerNotifications,
  markAllCustomerNotificationsRead,
  markCustomerNotificationRead,
} from "@/services/customerApi";
import { formatMYT } from "@/utils/datetime";
import { logger } from "@/utils/logger";

type IconName = ComponentProps<typeof Ionicons>["name"];

type Notification = {
  id: number;
  title?: string;
  message?: string;
  type?: string;
  isRead?: boolean;
  bookingRef?: string | null;
  bookingId?: number | null;
  createdAt?: string;
};

/** An icon for the notification's type; unknown types get a bell. */
function iconFor(type?: string): IconName {
  const t = String(type || "").toUpperCase();
  if (t.includes("PERMIT") || t.includes("LICENCE")) {
  return "card-outline";
  }
  if (t.includes("INVOICE")) return "document-text-outline";
  if (t.includes("REFUND")) return "return-down-back-outline";
  if (t.includes("PAYMENT") || t.includes("RECEIPT")) return "wallet-outline";
  if (t.includes("ALTERNATIVE")) return "swap-horizontal-outline";
  if (t.includes("ACCEPTED") || t.includes("CONFIRMED")) return "checkmark-circle-outline";
  if (t.includes("REJECTED") || t.includes("CANCELLED") || t.includes("EXPIRED")) return "close-circle-outline";
  if (t.includes("BOOKING")) return "car-outline";
  return "notifications-outline";
}

/** "BNPL-0202" from the reference, title or message, for older notifications without a bookingId. */
function bookingCodeOf(item: Notification) {
  const text = [item.bookingRef, item.title, item.message].filter(Boolean).join(" ");
  const match = text.match(/\bBNPL-\d+\b/i);
  return match ? match[0].toUpperCase() : null;
}

/** Customer notifications (plan phase 3). Tapping one opens what it's about. */
export default function NotificationsScreen() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  const [items, setItems] = useState<Notification[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      const data = await getCustomerNotifications();
      setItems(Array.isArray(data) ? data : []);
    } catch (err) {
      logger.debug("Failed to load notifications:", err);
      setError(err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const open = async (item: Notification) => {
    if (!item.isRead) {
      setItems((current) => current?.map((n) => (n.id === item.id ? { ...n, isRead: true } : n)) ?? current);
      markCustomerNotificationRead(item.id).catch((err) => logger.debug("Failed to mark notification read:", err));
    }

    const type = String(item.type || "").toUpperCase();
    if (type.includes("PERMIT")) {
      return router.push("/customer/permit" as Href);
    }
    const isInvoice = type.includes("INVOICE");
    const isPayment = type.includes("PAYMENT") || type.includes("RECEIPT") || type.includes("REFUND");
    const isLicence = type.includes("LICENCE");

    let bookingId = Number(item.bookingId) > 0 ? Number(item.bookingId) : null;
    const code = bookingCodeOf(item);
    if (!bookingId && code) {
      try {
        const bookings = await getCustomerBookings();
        const match = Array.isArray(bookings)
          ? bookings.find((b: any) => String(b.bookingCode || "").toUpperCase() === code)
          : null;
        if (match) bookingId = Number(match.id);
      } catch (err) {
        logger.debug("Failed to resolve notification booking:", err);
      }
    }

    if (isLicence && !bookingId) return router.push("/customer/licence" as Href);
    if (bookingId) {
      if (isInvoice) return router.push(`/customer/invoice/${bookingId}` as Href);
      return router.push(`/customer/booking/${bookingId}` as Href);
    }
    if (isPayment || isInvoice) return router.push("/customer/(tabs)/payments" as Href);
    router.push("/customer/(tabs)/bookings" as Href);
  };

  const markAll = async () => {
    try {
      await markAllCustomerNotificationsRead();
      setItems((current) => current?.map((n) => ({ ...n, isRead: true })) ?? current);
    } catch (err) {
      logger.debug("Failed to mark all notifications read:", err);
      toast.show("Couldn't mark them as read. Try again.", { tone: "err" });
    }
  };

  const unread = items?.filter((n) => !n.isRead).length ?? 0;

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <View style={styles.flex}>
          <AppText variant="largeTitle" accessibilityRole="header" numberOfLines={1} adjustsFontSizeToFit>
            Notifications
          </AppText>
        </View>
      </View>
      {items && items.length > 0 ? (
        <View style={styles.summary}>
          <AppText variant="caption" style={styles.flex}>
            {unread === 0 ? "All read" : unread === 1 ? "1 unread" : `${unread} unread`}
          </AppText>
          {unread > 0 ? <Button label="Mark all read" variant="text" size="sm" onPress={markAll} /> : null}
        </View>
      ) : null}
    </View>
  );

  if (error && !items) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8 }]}>
        {header}
        <ErrorState error={error} onRetry={() => load()} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={items ?? []}
        keyExtractor={(n) => String(n.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={
          items ? (
            <EmptyState
              icon="notifications-outline"
              title="You're all caught up"
              message="Updates about your bookings, payments and invoices appear here."
            />
          ) : (
            <View style={styles.list}>
              {[0, 1, 2].map((i) => (
                <GlassCard key={i}>
                  <View style={styles.cardRow}>
                    <Skeleton width={40} height={40} radius={Radius.sm} />
                    <View style={styles.flex}>
                      <SkeletonText lines={3} />
                    </View>
                  </View>
                </GlassCard>
              ))}
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const unreadItem = !item.isRead;
          return (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={[unreadItem ? "Unread" : null, item.title, item.message, formatMYT(item.createdAt, "dayDateTime")]
                .filter(Boolean)
                .join(". ")}
              style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            >
              <GlassCard strong={unreadItem}>
                <View style={styles.cardRow}>
                  <View style={[styles.icon, { backgroundColor: unreadItem ? tokens.infoBg : tokens.glassStrong }]}>
                    <Ionicons name={iconFor(item.type)} size={20} color={unreadItem ? tokens.infoFg : tokens.label} />
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.titleRow}>
                      <AppText variant={unreadItem ? "headline" : "bodyStrong"} style={styles.flex}>
                        {item.title || "Notification"}
                      </AppText>
                      {unreadItem ? <View style={[styles.dot, { backgroundColor: tokens.cta }]} /> : null}
                    </View>
                    {item.message ? (
                      <AppText variant="body" style={styles.mt4}>
                        {item.message}
                      </AppText>
                    ) : null}
                    <View style={styles.meta}>
                      <AppText variant="caption">{formatMYT(item.createdAt, "dayDateTime")}</AppText>
                      {item.bookingRef ? (
                        <AppText variant="mono" color="label">
                          {item.bookingRef}
                        </AppText>
                      ) : null}
                    </View>
                  </View>
                </View>
              </GlassCard>
            </Pressable>
          );
        }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tokens.label} colors={[tokens.brand]} />
        }
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: 18,
  },
  content: {
    paddingHorizontal: 18,
  },
  header: {
    gap: 6,
    marginBottom: 12,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  summary: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  flex: {
    flex: 1,
  },
  list: {
    gap: 10,
  },
  separator: {
    height: 10,
  },
  cardRow: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  titleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  mt4: {
    marginTop: 4,
  },
  meta: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
    flexWrap: "wrap",
  },
});
