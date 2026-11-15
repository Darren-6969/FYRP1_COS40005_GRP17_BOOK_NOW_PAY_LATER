import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Pressable, RefreshControl, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AccountSheet } from "@/components/operator/AccountSheet";
import { OperatorBookingCard } from "@/components/operator/OperatorBookingCard";
import { ResponseSheets, type BookingResponse } from "@/components/operator/ResponseSheets";
import { AppText, Button, ErrorState, Figure, GlassCard, HeroCard, IconButton, Money, Skeleton, SkeletonText } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTabBarInset } from "@/hooks/use-tab-bar-inset";
import { useTheme } from "@/hooks/use-theme";
import {
  getOperatorBookings,
  getOperatorDashboard,
  getOperatorNotifications,
  type OperatorBooking,
  type OperatorDashboard,
} from "@/services/operatorApi";
import { getStoredUser } from "@/services/session";
import { formatMYT } from "@/utils/datetime";
import { logger } from "@/utils/logger";
import { nextReplyDue, replyByText, todayCounts } from "@/utils/operator-booking";

/** How many requests the dashboard shows before "See all". */
const REQUEST_COUNT = 3;

/**
 * Operator dashboard (plan phase 4 mock): a Today card with the requests
 * waiting and the nearest reply deadline, then the requests themselves
 * with Accept, Suggest and Decline. Totals are the server's; today's
 * pick-ups and returns are counted from the bookings list (no money).
 */
export default function OperatorDashboardScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomInset = useTabBarInset();
  const { tokens } = useTheme();

  const [dashboard, setDashboard] = useState<OperatorDashboard | null>(null);
  const [bookings, setBookings] = useState<OperatorBooking[]>([]);
  const [unread, setUnread] = useState(0);
  const [user, setUser] = useState<{ name?: string; email?: string } | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [accountOpen, setAccountOpen] = useState(false);
  const [respond, setRespond] = useState<{ booking: OperatorBooking; action: BookingResponse } | null>(null);
  const [now, setNow] = useState(() => new Date());

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    setNow(new Date());
    try {
      getStoredUser().then(setUser).catch(() => {});
      const [summary, list] = await Promise.all([getOperatorDashboard(), getOperatorBookings("ALL")]);
      setDashboard(summary);
      setBookings(Array.isArray(list?.bookings) ? list.bookings : []);
      // The bell's dot only; a failure here shouldn't hide the dashboard.
      getOperatorNotifications()
        .then((r) => setUnread((r.notifications || []).filter((n: any) => !n.isRead).length))
        .catch((err) => logger.debug("Unable to load notification count:", err));
    } catch (err) {
      logger.debug("Failed to load operator dashboard:", err);
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

  const requests = useMemo(
    () =>
      bookings
        .filter((b) => b.status === "PENDING")
        .sort(
          (a, b) =>
            new Date(a.car?.responseDueAt ?? a.createdAt ?? 0).getTime() -
            new Date(b.car?.responseDueAt ?? b.createdAt ?? 0).getTime()
        ),
    [bookings]
  );
  const today = useMemo(() => todayCounts(bookings, now), [bookings, now]);
  const nextDue = useMemo(() => nextReplyDue(bookings), [bookings]);
  const summary = dashboard?.summary;
  const waiting = summary?.pendingRequests ?? requests.length;

  const openBooking = (b: OperatorBooking) => router.push(`/operator/booking/${b.id}` as Href);

  const header = (
    <View style={styles.header}>
      <View style={styles.flex}>
        <AppText variant="largeTitle" accessibilityRole="header">
          Today
        </AppText>
        <AppText variant="caption">{formatMYT(now, "dayDate")}</AppText>
      </View>
      <IconButton icon="notifications-outline" label="Notifications" dot={unread > 0} onPress={() => router.push("/operator/notifications" as Href)} />
      <IconButton icon="person-circle-outline" label="Account" onPress={() => setAccountOpen(true)} />
    </View>
  );

  if (error && !dashboard) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8 }]}>
        {header}
        <ErrorState error={error} onRetry={() => load()} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tokens.label} colors={[tokens.brand]} />
        }
      >
        {header}

        {!dashboard ? (
          <>
            <Skeleton height={190} radius={Radius.hero} />
            <GlassCard>
              <SkeletonText lines={4} />
            </GlassCard>
          </>
        ) : (
          <>
            <HeroCard tag="Requests waiting">
              <Figure size="xl" style={{ color: tokens.onHero }}>
                {waiting}
              </Figure>
              <AppText variant="caption" style={{ color: tokens.onHeroSoft }}>
                {waiting === 0
                  ? "Nothing to answer right now."
                  : nextDue
                    ? `${replyByText(nextDue.car?.responseDueAt, now)}.${nextDue.car?.autoRejectOnTimeout === false ? "" : " Unanswered requests are declined automatically."}`
                    : "Answer them before they expire."}
              </AppText>
              <View style={styles.metrics}>
                <Metric value={today.pickups} label={today.pickups === 1 ? "Pick-up today" : "Pick-ups today"} />
                <Metric value={today.returns} label={today.returns === 1 ? "Return today" : "Returns today"} />
                <Metric value={summary?.expiredBookings ?? 0} label="Overdue" />
              </View>
            </HeroCard>

            <View style={styles.section}>
              <View style={styles.sectionHead}>
                <AppText variant="headline" accessibilityRole="header" style={styles.flex}>
                  Requests
                </AppText>
                {requests.length > REQUEST_COUNT ? (
                  <Button
                    label={`See all ${requests.length}`}
                    variant="text"
                    size="sm"
                    onPress={() => router.push("/operator/(tabs)/bookings" as Href)}
                  />
                ) : null}
              </View>
              {requests.length === 0 ? (
                <GlassCard>
                  <AppText variant="body">No requests waiting. New ones appear here.</AppText>
                </GlassCard>
              ) : (
                requests.slice(0, REQUEST_COUNT).map((b) => (
                  <OperatorBookingCard
                    key={b.id}
                    booking={b}
                    now={now}
                    onOpen={openBooking}
                    onRespond={(booking, action) => setRespond({ booking, action })}
                  />
                ))
              )}
            </View>

            <View style={styles.stats}>
              <GlassCard style={styles.stat}>
                <AppText variant="micro">Total revenue</AppText>
                <Money value={summary?.totalRevenue} variant="figureL" style={styles.mt4} />
                <AppText variant="caption">{summary?.paidBookings ?? 0} paid bookings</AppText>
              </GlassCard>
              <GlassCard style={styles.stat}>
                <AppText variant="micro">Payments due</AppText>
                <Figure style={styles.mt4}>{summary?.paymentPending ?? 0}</Figure>
                <AppText variant="caption">waiting for customers</AppText>
              </GlassCard>
            </View>

            <Pressable
              onPress={() => router.push("/operator/licence-checks" as Href)}
              accessibilityRole="button"
              accessibilityLabel="Licence checks. Review customers' driving licences"
              style={({ pressed }) => [pressed && { opacity: 0.75 }]}
            >
              <GlassCard>
                <View style={styles.linkRow}>
                  <View style={[styles.linkIcon, { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine }]}>
                    <Ionicons name="card-outline" size={20} color={tokens.ink} />
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">Licence checks</AppText>
                    <AppText variant="caption">Review customers&apos; driving licences</AppText>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={tokens.label} />
                </View>
              </GlassCard>
            </Pressable>
          </>
        )}
      </ScrollView>

      <ResponseSheets
        booking={respond?.booking ?? null}
        action={respond?.action ?? null}
        onClose={() => setRespond(null)}
        onDone={() => load(true)}
      />
      <AccountSheet visible={accountOpen} onClose={() => setAccountOpen(false)} name={user?.name} email={user?.email} />
    </View>
  );
}

function Metric({ value, label }: { value: number; label: string }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.metric} accessible accessibilityLabel={`${value} ${label}`}>
      <AppText variant="title" style={{ color: tokens.onHero }}>
        {value}
      </AppText>
      <AppText variant="caption" style={{ color: tokens.onHeroSoft }}>
        {label}
      </AppText>
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
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  flex: {
    flex: 1,
  },
  mt4: {
    marginTop: 4,
  },
  metrics: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  metric: {
    flex: 1,
  },
  section: {
    gap: 10,
  },
  sectionHead: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 44,
  },
  stats: {
    flexDirection: "row",
    gap: 10,
  },
  stat: {
    flex: 1,
  },
  linkRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  linkIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
