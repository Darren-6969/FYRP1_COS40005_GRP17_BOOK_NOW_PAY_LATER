import { useFocusEffect, useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useState } from "react";
import { FlatList, RefreshControl, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppText,
  Button,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  GlassCard,
  IconButton,
  Money,
  SkeletonText,
  StatusPill,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import {
  getOperatorBranches,
  updateOperatorBranchPoint,
  type OperatorBranch,
  type OperatorPickupPoint,
} from "@/services/operatorApi";
import { logger } from "@/utils/logger";

const USAGE_LABEL: Record<OperatorPickupPoint["usage"], string> = {
  PICKUP: "Pick-up only",
  DROPOFF: "Drop-off only",
  BOTH: "Pick-up and drop-off",
};

/** One branch's pick-up and drop-off points (plan phase 4). Each point carries its own charges. */
export default function BranchPointsScreen() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const params = useLocalSearchParams<{ branchId?: string }>();
  const parsed = Number(params.branchId);
  const branchId = Number.isInteger(parsed) && parsed > 0 ? parsed : null;

  const [branch, setBranch] = useState<OperatorBranch | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<OperatorPickupPoint | null>(null);

  const load = useCallback(
    async (refresh = false) => {
      if (refresh) setRefreshing(true);
      setError(null);
      try {
        if (!branchId) throw new Error("This branch link isn't valid.");
        const response = await getOperatorBranches();
        const found = (response?.branches ?? []).find((b) => b.id === branchId);
        if (!found) throw new Error("This branch wasn't found.");
        setBranch(found);
      } catch (err) {
        logger.debug("Failed to load branch points:", err);
        setError(err);
      } finally {
        setRefreshing(false);
      }
    },
    [branchId]
  );

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const toggle = async () => {
    if (!toggling || !branchId) return;
    const next = !toggling.isActive;
    await updateOperatorBranchPoint(branchId, toggling.id, { isActive: next });
    toast.show(next ? `${toggling.label} is offered again.` : `${toggling.label} is no longer offered.`, { tone: "ok" });
    setToggling(null);
    await load(true);
  };

  const points = [...(branch?.pickupPoints ?? [])].sort((a, b) => (a.sortOrder ?? 0) - (b.sortOrder ?? 0));

  const openForm = (pointId?: number) =>
    router.push({
      pathname: "/operator/branch/point-form",
      params: { branchId: String(branchId), ...(pointId ? { pointId: String(pointId) } : {}) },
    } as unknown as Href);

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <View style={styles.flex}>
          <AppText variant="title" accessibilityRole="header" numberOfLines={1}>
            Pick-up points
          </AppText>
          {branch ? (
            <AppText variant="caption" numberOfLines={1}>
              {branch.name}
            </AppText>
          ) : null}
        </View>
        {branch ? <IconButton icon="add" label="Add a point" onPress={() => openForm()} /> : null}
      </View>
      <AppText variant="caption">
        Places customers can choose for pick-up and drop-off, each with its own charge. A customer can also ask for an unlisted place, and you quote it.
      </AppText>
    </View>
  );

  if (error && !branch) {
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
        data={points}
        keyExtractor={(p) => String(p.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={
          branch ? (
            <EmptyState
              icon="location-outline"
              title="No points yet"
              message="Add the branch counter, the airport or other places you hand over cars."
              action={<Button label="Add a point" variant="brand" onPress={() => openForm()} />}
            />
          ) : (
            <View style={styles.list}>
              {[0, 1].map((i) => (
                <GlassCard key={i}>
                  <SkeletonText lines={3} />
                </GlassCard>
              ))}
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => (
          <GlassCard>
            <View style={styles.row}>
              <View style={styles.flex}>
                <AppText variant="headline">{item.label}</AppText>
                {item.address ? <AppText variant="caption">{item.address}</AppText> : null}
              </View>
              <StatusPill label={item.isActive ? "Offered" : "Off"} tone={item.isActive ? "ok" : "neutral"} />
            </View>
            {item.note ? (
              <AppText variant="body" style={styles.mt8}>
                {item.note}
              </AppText>
            ) : null}
            <View style={[styles.fees, { borderTopColor: tokens.line }]}>
              <StatusPill label={USAGE_LABEL[item.usage] ?? item.usage} tone="info" dot={false} />
              {item.usage !== "DROPOFF" ? (
                <View style={styles.fee}>
                  <AppText variant="caption">Pick-up </AppText>
                  <Money value={item.fee} variant="label" color="ink" />
                </View>
              ) : null}
              {item.usage !== "PICKUP" ? (
                <View style={styles.fee}>
                  <AppText variant="caption">Drop-off </AppText>
                  <Money value={item.dropoffFee} variant="label" color="ink" />
                </View>
              ) : null}
            </View>
            <View style={styles.actions}>
              <Button label="Edit" variant="line" size="sm" grow icon="create-outline" onPress={() => openForm(item.id)} />
              <Button
                label={item.isActive ? "Stop offering" : "Offer again"}
                variant="line"
                size="sm"
                grow
                onPress={() => setToggling(item)}
              />
            </View>
          </GlassCard>
        )}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tokens.label} colors={[tokens.brand]} />
        }
      />

      <ConfirmSheet
        visible={!!toggling}
        title={toggling?.isActive ? `Stop offering ${toggling?.label}?` : `Offer ${toggling?.label} again?`}
        message={
          toggling?.isActive
            ? "Customers can't choose it for new bookings."
            : "Customers can choose it again for new bookings."
        }
        confirmLabel={toggling?.isActive ? "Stop offering" : "Offer again"}
        confirmVariant={toggling?.isActive ? "danger" : "brand"}
        onConfirm={toggle}
        onCancel={() => setToggling(null)}
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
    gap: 8,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  list: {
    gap: 12,
  },
  separator: {
    height: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  mt8: {
    marginTop: 8,
  },
  fees: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fee: {
    flexDirection: "row",
    alignItems: "baseline",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
});
