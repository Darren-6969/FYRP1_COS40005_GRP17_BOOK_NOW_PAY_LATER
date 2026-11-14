import { Ionicons } from "@expo/vector-icons";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CarCard, type CarSummary } from "@/components/booking/CarCard";
import CarFilterModal, { DEFAULT_CAR_FILTERS, type CarFilters } from "@/components/CarFilterModal";
import { AppText, Chip, EmptyState, ErrorState, IconButton, Skeleton } from "@/components/ui";
import { FontFamily, Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { getPublicCars } from "@/services/carApi";
import { getSavedListingIds, removeSavedListing, saveListing } from "@/services/customerApi";
import { applyCarFilters, hasActiveFilters, vehicleTypesOf } from "@/utils/car-filters";
import { logger } from "@/utils/logger";

type Params = {
  city?: string;
  from?: string;
  ft?: string;
  to?: string;
  tt?: string;
  search?: string;
  filters?: string;
};

function parseFilters(raw?: string): CarFilters {
  try {
    return { ...DEFAULT_CAR_FILTERS, ...(raw ? JSON.parse(raw) : {}) };
  } catch {
    return DEFAULT_CAR_FILTERS;
  }
}

/** All cars, with the search, type and filters Home sent (or none). */
export default function CarsScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<Params>();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  const [cars, setCars] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<unknown>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const [search, setSearch] = useState(params.search || "");
  const [filters, setFilters] = useState<CarFilters>(() => parseFilters(params.filters));
  const [filtersOpen, setFiltersOpen] = useState(false);

  const city = params.city || "";

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await getPublicCars();
      setCars(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      logger.debug("Failed to load cars:", err);
      setError(err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    getSavedListingIds()
      .then((data) => setSavedIds(new Set(Array.isArray(data?.ids) ? data.ids.map(Number) : [])))
      .catch((err) => logger.debug("Failed to load saved listings:", err));
  }, [load]);

  const types = useMemo(() => vehicleTypesOf(cars), [cars]);
  const results = useMemo(() => applyCarFilters(cars, { search, city, filters }), [cars, search, city, filters]);
  const active = hasActiveFilters(filters, search, city);
  const selectedType = filters.vehicleTypes.length === 1 ? filters.vehicleTypes[0] : filters.vehicleTypes.length ? null : "All";

  const openCar = useCallback(
    (car: CarSummary) =>
      router.push({
        pathname: "/customer/car-details",
        params: {
          id: String(car.id),
          city,
          from: params.from || "",
          ft: params.ft || "",
          to: params.to || "",
          tt: params.tt || "",
        },
      } as unknown as Href),
    [router, city, params.from, params.ft, params.to, params.tt]
  );

  const toggleSaved = useCallback(
    async (car: CarSummary) => {
      const id = Number(car.id);
      const wasSaved = savedIds.has(id);
      const flip = (set: Set<number>) => {
        const next = new Set(set);
        if (next.has(id)) next.delete(id);
        else next.add(id);
        return next;
      };
      setSavedIds(flip);
      try {
        if (wasSaved) await removeSavedListing(id);
        else await saveListing(id);
      } catch (err) {
        logger.debug("Failed to update saved listing:", err);
        setSavedIds(flip);
      }
    },
    [savedIds]
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <View style={styles.titleBlock}>
          <AppText variant="largeTitle" accessibilityRole="header">
            {city ? `Cars in ${city}` : "All cars"}
          </AppText>
          {!loading && !error ? (
            <AppText variant="caption">
              {results.length} {results.length === 1 ? "car" : "cars"}
            </AppText>
          ) : null}
        </View>
      </View>

      <View style={styles.searchRow}>
        <View style={[styles.search, { backgroundColor: tokens.glass, borderColor: tokens.glassLine }]}>
          <Ionicons name="search" size={18} color={tokens.label} />
          <TextInput
            value={search}
            onChangeText={setSearch}
            placeholder="Search cars or brands"
            placeholderTextColor={tokens.label}
            returnKeyType="search"
            accessibilityLabel="Search cars or brands"
            style={[styles.searchInput, { color: tokens.ink }]}
          />
          {search ? (
            <Pressable onPress={() => setSearch("")} accessibilityRole="button" accessibilityLabel="Clear search" hitSlop={10}>
              <Ionicons name="close-circle" size={18} color={tokens.label} />
            </Pressable>
          ) : null}
        </View>
        <IconButton icon="options-outline" label="Filters" onPress={() => setFiltersOpen(true)} style={styles.filterButton} />
      </View>

      {types.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {types.map((type) => (
            <Chip
              key={type}
              label={type}
              selected={selectedType === type}
              onPress={() =>
                setFilters((current) => ({ ...current, vehicleTypes: type === "All" ? [] : [type] }))
              }
            />
          ))}
        </ScrollView>
      ) : null}

      {active ? (
        <Pressable
          onPress={() => {
            setSearch("");
            setFilters(DEFAULT_CAR_FILTERS);
          }}
          accessibilityRole="button"
          style={styles.clear}
          hitSlop={8}
        >
          <Ionicons name="close" size={15} color={tokens.leafInk} />
          <AppText variant="label" color="leafInk">
            Clear search and filters
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );

  const empty = loading ? (
    <View style={styles.gap}>
      <Skeleton height={260} radius={Radius.card} />
      <Skeleton height={260} radius={Radius.card} />
    </View>
  ) : error ? (
    <ErrorState error={error} onRetry={load} compact />
  ) : (
    <EmptyState
      icon="search-outline"
      title="No cars match"
      message={active ? "Try fewer filters or a different search." : "No cars are listed yet."}
    />
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={loading || error ? [] : results}
        keyExtractor={(car) => String(car.id)}
        renderItem={({ item }) => (
          <CarCard car={item} onPress={openCar} saved={savedIds.has(Number(item.id))} onToggleSaved={toggleSaved} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      />

      <CarFilterModal
        visible={filtersOpen}
        cars={cars}
        filters={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={setFilters}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
  },
  header: {
    gap: 14,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  titleBlock: {
    flex: 1,
  },
  searchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  search: {
    flex: 1,
    height: 48,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 16,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  searchInput: {
    flex: 1,
    fontFamily: FontFamily.regular,
    fontSize: 15,
    paddingVertical: 0,
  },
  filterButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
  },
  chips: {
    gap: 8,
    paddingRight: 18,
  },
  clear: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    alignSelf: "flex-start",
    minHeight: 32,
  },
  gap: {
    gap: 16,
  },
  separator: {
    height: 16,
  },
});
