import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState, type ComponentProps } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppText,
  Button,
  EmptyState,
  ErrorState,
  GlassCard,
  IconButton,
  SegmentedControl,
  Skeleton,
  SkeletonText,
  useToast,
  type SegmentOption,
} from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  getOperatorBookings,
  getOperatorNotifications,
  markAllOperatorNotificationsRead,
  markOperatorNotificationRead,
  type OperatorNotification,
} from "@/services/operatorApi";
import { formatMYT } from "@/utils/datetime";
import { logger } from "@/utils/logger";

type IconName = ComponentProps<typeof Ionicons>["name"];
type Filter = "ALL" | "UNREAD";

const FILTERS: readonly SegmentOption<Filter>[] = [
  { value: "ALL", label: "All" },
  { value: "UNREAD", label: "Unread" },
];

function contentOf(n: OperatorNotification) {
  return `${n.type || ""} ${n.title || ""}`.toUpperCase();
}

function iconFor(n: OperatorNotification): IconName {
  const t = contentOf(n);
  if (t.includes("PERMIT") || t.includes("LICENCE")) {return "card-outline";}
  if (t.includes("PAYMENT") || t.includes("RECEIPT") || t.includes("INVOICE")) return "wallet-outline";
  if (t.includes("ALTERNATIVE")) return "swap-horizontal-outline";
  if (t.includes("CANCEL") || t.includes("REJECT") || t.includes("EXPIRED")) return "close-circle-outline";
  if (t.includes("SUBSCRIPTION")) return "ribbon-outline";
  if (t.includes("BOOKING") || t.includes("REQUEST")) return "car-outline";
  return "notifications-outline";
}

/** Operator notifications (plan phase 4). Tapping one opens what it's about. */
export default function OperatorNotificationsScreen() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  const [items, setItems] = useState<OperatorNotification[] | null>(null);
  const [filter, setFilter] = useState<Filter>("ALL");
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      const response = await getOperatorNotifications();
      setItems(Array.isArray(response?.notifications) ? response.notifications : []);
    } catch (err) {
      logger.debug("Failed to load operator notifications:", err);
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

  const open = async (n: OperatorNotification) => {
    if (!n.isRead) {
      setItems((current) => current?.map((i) => (i.id === n.id ? { ...i, isRead: true } : i)) ?? current);
      markOperatorNotificationRead(n.id).catch((err) => logger.debug("Failed to mark notification read:", err));
    }

    const t = contentOf(n);
    if (t.includes("PERMIT")) {return router.push("/operator/permit-checks" as Href);}
    if (t.includes("LICENCE")) return router.push("/operator/licence-checks" as Href);
    if (t.includes("PAYMENT") || t.includes("RECEIPT") || t.includes("INVOICE")) {
      return router.push("/operator/(tabs)/payments" as Href);
    }

    // The booking code from the text; never guess an ID.
    const code = `${n.title} ${n.message}`.match(/BNPL-[A-Za-z0-9]+/i)?.[0]?.toUpperCase();
    if (code) {
      try {
        const response = await getOperatorBookings("ALL");
        const match = response.bookings.find((b) => b.bookingCode?.toUpperCase() === code);
        if (match) return router.push(`/operator/booking/${match.id}` as Href);
      } catch (err) {
        logger.debug("Notification booking lookup failed:", err);
      }
    }
    router.push("/operator/(tabs)/bookings" as Href);
  };

  const markAll = async () => {
    try {
      await markAllOperatorNotificationsRead();
      setItems((current) => current?.map((i) => ({ ...i, isRead: true })) ?? current);
    } catch (err) {
      logger.debug("Failed to mark all operator notifications read:", err);
      toast.show("Couldn't mark them as read. Try again.", { tone: "err" });
    }
  };

  const unread = items?.filter((n) => !n.isRead).length ?? 0;
  const shown = filter === "UNREAD" ? items?.filter((n) => !n.isRead) ?? null : items;

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <AppText variant="largeTitle" accessibilityRole="header" style={styles.flex} numberOfLines={1} adjustsFontSizeToFit>
          Notifications
        </AppText>
      </View>
      {items && items.length > 0 ? (
        <>
          <SegmentedControl options={FILTERS} value={filter} onChange={setFilter} accessibilityLabel="Show" />
          <View style={styles.summary}>
            <AppText variant="caption" style={styles.flex}>
              {unread === 0 ? "All read" : unread === 1 ? "1 unread" : `${unread} unread`}
            </AppText>
            {unread > 0 ? <Button label="Mark all read" variant="text" size="sm" onPress={markAll} /> : null}
          </View>
        </>
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
        data={shown ?? []}
        keyExtractor={(n) => String(n.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={
          items ? (
            <EmptyState
              icon="notifications-outline"
              title={filter === "UNREAD" ? "Nothing unread" : "You're all caught up"}
              message="New requests, payments and licence uploads appear here."
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
          const fresh = !item.isRead;
          return (
            <Pressable
              onPress={() => open(item)}
              accessibilityRole="button"
              accessibilityLabel={[fresh ? "Unread" : null, item.title, item.message, formatMYT(item.createdAt, "dayDateTime")]
                .filter(Boolean)
                .join(". ")}
              style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            >
              <GlassCard strong={fresh}>
                <View style={styles.cardRow}>
                  <View style={[styles.icon, { backgroundColor: fresh ? tokens.infoBg : tokens.glassStrong }]}>
                    <Ionicons name={iconFor(item)} size={20} color={fresh ? tokens.infoFg : tokens.label} />
                  </View>
                  <View style={styles.flex}>
                    <View style={styles.titleRow}>
                      <AppText variant={fresh ? "headline" : "bodyStrong"} style={styles.flex}>
                        {item.title || "Notification"}
                      </AppText>
                      {fresh ? <View style={[styles.dot, { backgroundColor: tokens.cta }]} /> : null}
                    </View>
                    {item.message ? (
                      <AppText variant="body" style={styles.mt4}>
                        {item.message}
                      </AppText>
                    ) : null}
                    <AppText variant="caption" style={styles.mt8}>
                      {formatMYT(item.createdAt, "dayDateTime")}
                    </AppText>
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
    gap: 10,
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
  mt8: {
    marginTop: 8,
  },
});
