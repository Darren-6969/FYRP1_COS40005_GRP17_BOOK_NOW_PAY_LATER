import { useFocusEffect, useRouter, type Href } from "expo-router";
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
  SkeletonText,
  StatusPill,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { getOperatorBranches, updateOperatorBranch, type OperatorBranch } from "@/services/operatorApi";
import { logger } from "@/utils/logger";

/** The operator's branches (plan phase 4). Forms are pushed screens; switching a branch off asks first. */
export default function OperatorBranchesScreen() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  const [branches, setBranches] = useState<OperatorBranch[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [toggling, setToggling] = useState<OperatorBranch | null>(null);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      const response = await getOperatorBranches();
      setBranches(Array.isArray(response?.branches) ? response.branches : []);
    } catch (err) {
      logger.debug("Failed to load branches:", err);
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

  const toggle = async () => {
    if (!toggling) return;
    const next = !toggling.isActive;
    await updateOperatorBranch(toggling.id, { isActive: next });
    toast.show(next ? `${toggling.name} is active.` : `${toggling.name} is switched off.`, { tone: "ok" });
    setToggling(null);
    await load(true);
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <AppText variant="largeTitle" accessibilityRole="header" style={styles.flex} numberOfLines={1}>
          Branches
        </AppText>
        <IconButton icon="add" label="Add a branch" onPress={() => router.push("/operator/branch/form" as Href)} />
      </View>
      <AppText variant="caption">Where customers collect and return your cars. Each branch has its own pick-up and drop-off points.</AppText>
    </View>
  );

  if (error && !branches) {
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
        data={branches ?? []}
        keyExtractor={(b) => String(b.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={
          branches ? (
            <EmptyState
              icon="business-outline"
              title="No branches yet"
              message="Add a branch before you add cars."
              action={<Button label="Add a branch" variant="brand" onPress={() => router.push("/operator/branch/form" as Href)} />}
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
        renderItem={({ item }) => {
          const points = item.pickupPoints ?? [];
          const activePoints = points.filter((p) => p.isActive).length;
          return (
            <GlassCard>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <AppText variant="headline">{item.name}</AppText>
                  <AppText variant="caption">{[item.address, item.city, item.state].filter(Boolean).join(", ")}</AppText>
                  {item.phone ? <AppText variant="caption">{item.phone}</AppText> : null}
                </View>
                <StatusPill label={item.isActive ? "Active" : "Off"} tone={item.isActive ? "ok" : "neutral"} />
              </View>
              <AppText variant="caption" style={[styles.points, { borderTopColor: tokens.line }]}>
                {points.length === 0
                  ? "No pick-up or drop-off points yet"
                  : `${activePoints} of ${points.length} ${points.length === 1 ? "point" : "points"} in use`}
              </AppText>
              <View style={styles.actions}>
                <Button
                  label="Points"
                  variant="line"
                  size="sm"
                  grow
                  icon="location-outline"
                  onPress={() => router.push({ pathname: "/operator/branch/points", params: { branchId: String(item.id) } } as unknown as Href)}
                />
                <Button
                  label="Edit"
                  variant="line"
                  size="sm"
                  grow
                  icon="create-outline"
                  onPress={() => router.push({ pathname: "/operator/branch/form", params: { id: String(item.id) } } as unknown as Href)}
                />
              </View>
              <Button
                label={item.isActive ? "Switch off this branch" : "Switch on this branch"}
                variant="text"
                size="sm"
                style={styles.alignStart}
                onPress={() => setToggling(item)}
              />
            </GlassCard>
          );
        }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tokens.label} colors={[tokens.brand]} />
        }
      />

      <ConfirmSheet
        visible={!!toggling}
        title={toggling?.isActive ? `Switch off ${toggling?.name}?` : `Switch on ${toggling?.name}?`}
        message={
          toggling?.isActive
            ? "Its pick-up and drop-off points may no longer be offered to customers on new bookings."
            : "Its active pick-up and drop-off points can be offered to customers again."
        }
        confirmLabel={toggling?.isActive ? "Switch off" : "Switch on"}
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
  points: {
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  alignStart: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
});
