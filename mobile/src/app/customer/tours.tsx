import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import { FlatList, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { TourCard } from "@/components/booking/TourCard";
import { AppText, Chip, EmptyState, ErrorState, IconButton, Skeleton } from "@/components/ui";
import { FontFamily, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getTours, type Tour } from "@/services/tourApi";
import { logger } from "@/utils/logger";
import { startAsync } from "@/utils/start-async";

const KINDS = [
  { value: "", label: "All tours" },
  { value: "CHARTER", label: "With a car" },
  { value: "GUIDED", label: "With a guide" },
] as const;

/**
 * Tours (operator types plan, Phase 3): charter tours by car rental
 * operators and private packages by licensed guides. One price for the
 * group, never per person. Opened from the Tours entry on Home.
 */
export default function ToursScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  const [kind, setKind] = useState<string>("");
  const [search, setSearch] = useState("");
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<{ key: string; items: Tour[]; error: unknown }>({ key: "", items: [], error: null });

  const key = `${kind}|${query}`;
  const load = useCallback(
    () =>
      startAsync(async () => {
        try {
          const data = await getTours({ kind: kind || undefined, q: query || undefined });
          setResult({ key, items: data.items || [], error: null });
        } catch (err) {
          logger.debug("Failed to load tours:", err);
          setResult({ key, items: [], error: err });
        }
      }),
    [key, kind, query]
  );

  useEffect(() => {
    load();
  }, [load]);

  const loading = result.key !== key;
  const openTour = useCallback(
    (tour: Tour) => router.push({ pathname: "/customer/tour-details", params: { id: String(tour.id) } } as unknown as Href),
    [router]
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <View style={styles.flex}>
          <AppText variant="largeTitle" accessibilityRole="header">
            Tours
          </AppText>
        </View>
      </View>
      <AppText variant="caption">
        Private tours with a car and driver, or with a licensed guide. One price for your group, never per person.
      </AppText>
      <View style={[styles.search, { backgroundColor: tokens.glass, borderColor: tokens.glassLine }]}>
        <Ionicons name="search" size={18} color={tokens.label} />
        <TextInput
          value={search}
          onChangeText={setSearch}
          onSubmitEditing={() => setQuery(search.trim())}
          placeholder="Place or tour name"
          placeholderTextColor={tokens.label}
          returnKeyType="search"
          accessibilityLabel="Search tours"
          style={[styles.searchInput, { color: tokens.ink }]}
        />
      </View>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
        {KINDS.map((option) => (
          <Chip key={option.value} label={option.label} selected={kind === option.value} onPress={() => setKind(option.value)} />
        ))}
      </ScrollView>
    </View>
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={loading ? [] : result.items}
        keyExtractor={(tour) => String(tour.id)}
        renderItem={({ item }) => <TourCard tour={item} onPress={openTour} />}
        ListHeaderComponent={header}
        ListEmptyComponent={
          loading ? (
            <View style={styles.gap}>
              <Skeleton height={260} radius={Radius.card} />
              <Skeleton height={260} radius={Radius.card} />
            </View>
          ) : result.error ? (
            <ErrorState error={result.error} onRetry={() => setResult((r) => ({ ...r, key: "" }))} compact />
          ) : (
            <EmptyState icon="map-outline" title="No tours match" message="Try another search, or show all tours." />
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: { paddingHorizontal: 18 },
  header: { gap: 14, marginBottom: 16 },
  topRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  flex: { flex: 1 },
  gap: { gap: 14 },
  separator: { height: 14 },
  chips: { gap: 8 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: { flex: 1, fontFamily: FontFamily.regular, fontSize: 16, paddingVertical: 10 },
});
