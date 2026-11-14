import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import { FlatList, Pressable, ScrollView, StyleSheet, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { CarCard, type CarSummary } from "@/components/booking/CarCard";
import { TripCard } from "@/components/booking/TripCard";
import CarFilterModal, { DEFAULT_CAR_FILTERS, type CarFilters } from "@/components/CarFilterModal";
import TripSearchModal, { type TripSearch } from "@/components/TripSearchModal";
import {
  AppText,
  Chip,
  EmptyState,
  ErrorState,
  Figure,
  HeroCard,
  IconButton,
  Skeleton,
} from "@/components/ui";
import { FontFamily, Radius } from "@/constants/theme";
import { useTabBarInset } from "@/hooks/use-tab-bar-inset";
import { useTheme } from "@/hooks/use-theme";
import { getPublicCars } from "@/services/carApi";
import {
  getCustomerBookings,
  getSavedListingIds,
  removeSavedListing,
  saveListing,
} from "@/services/customerApi";
import { applyCarFilters, vehicleTypesOf } from "@/utils/car-filters";
import { formatMYT } from "@/utils/datetime";
import { logger } from "@/utils/logger";
import { formatRM } from "@/utils/money";
import { nextPaymentOf, type NextPayment } from "@/utils/next-payment";

/** How many cars Home shows before "See all". */
const HOME_CAR_COUNT = 6;

const EMPTY_TRIP: TripSearch = { city: "", from: "", fromTime: "10:00", to: "", toTime: "10:00" };

export default function CustomerHome() {
  const router = useRouter();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const bottomInset = useTabBarInset();

  const [cars, setCars] = useState<any[]>([]);
  const [carsLoading, setCarsLoading] = useState(true);
  const [carsError, setCarsError] = useState<unknown>(null);

  const [bookings, setBookings] = useState<any[] | null>(null);
  const [savedIds, setSavedIds] = useState<Set<number>>(new Set());

  const [trip, setTrip] = useState<TripSearch>(EMPTY_TRIP);
  const [filters, setFilters] = useState<CarFilters>(DEFAULT_CAR_FILTERS);
  const [search, setSearch] = useState("");
  const [tripOpen, setTripOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const loadCars = useCallback(async () => {
    setCarsLoading(true);
    setCarsError(null);
    try {
      const data = await getPublicCars();
      setCars(Array.isArray(data?.items) ? data.items : []);
    } catch (err) {
      logger.debug("Failed to load cars:", err);
      setCarsError(err);
    } finally {
      setCarsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadCars();
    getSavedListingIds()
      .then((data) => setSavedIds(new Set(Array.isArray(data?.ids) ? data.ids.map(Number) : [])))
      .catch((err) => logger.debug("Failed to load saved listings:", err));
  }, [loadCars]);

  // Refresh the hero card whenever Home comes back into view (after paying).
  useFocusEffect(
    useCallback(() => {
      let active = true;
      getCustomerBookings()
        .then((data) => active && setBookings(Array.isArray(data) ? data : []))
        .catch((err) => {
          logger.debug("Failed to load bookings:", err);
          if (active) setBookings((current) => current ?? []);
        });
      return () => {
        active = false;
      };
    }, [])
  );

  const nextPayment = useMemo(() => (bookings ? nextPaymentOf(bookings) : null), [bookings]);
  const types = useMemo(() => vehicleTypesOf(cars), [cars]);
  const homeCars = useMemo(
    () => applyCarFilters(cars, { city: trip.city, filters: DEFAULT_CAR_FILTERS }).slice(0, HOME_CAR_COUNT),
    [cars, trip.city]
  );

  const tripParams = {
    city: trip.city || "",
    from: trip.from || "",
    ft: trip.fromTime || "",
    to: trip.to || "",
    tt: trip.toTime || "",
  };

  // Search, a type chip or applied filters open the full list with them.
  const openResults = (nextFilters: CarFilters = filters, nextSearch: string = search) =>
    router.push({
      pathname: "/customer/cars",
      params: { search: nextSearch.trim(), filters: JSON.stringify(nextFilters), ...tripParams },
    } as unknown as Href);

  const openCar = useCallback(
    (car: CarSummary) =>
      router.push({ pathname: "/customer/car-details", params: { id: String(car.id), ...tripParams } } as unknown as Href),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [router, trip]
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
      setSavedIds(flip); // optimistic
      try {
        if (wasSaved) await removeSavedListing(id);
        else await saveListing(id);
      } catch (err) {
        logger.debug("Failed to update saved listing:", err);
        setSavedIds(flip); // undo
      }
    },
    [savedIds]
  );

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <Pressable
          onPress={() => setTripOpen(true)}
          accessibilityRole="button"
          accessibilityLabel={`Pick up in ${trip.city || "any city"}. Change`}
          style={styles.city}
        >
          <AppText variant="caption">Pick up in</AppText>
          <View style={styles.cityRow}>
            <AppText variant="title" style={styles.cityName}>
              {trip.city || "Anywhere"}
            </AppText>
            <Ionicons name="chevron-down" size={18} color={tokens.ink} />
          </View>
        </Pressable>
        <IconButton icon="notifications-outline" label="Notifications" onPress={() => router.push("/customer/notifications")} />
      </View>

      {bookings === null ? (
        <Skeleton height={190} radius={Radius.hero} />
      ) : nextPayment ? (
        <NextPaymentHero
          payment={nextPayment}
          onPay={() =>
            router.push({
              pathname: "/customer/checkout",
              params: { bookingId: String(nextPayment.booking.id), type: nextPayment.part },
            } as unknown as Href)
          }
        />
      ) : (
        <HowItWorksHero />
      )}

      <TripCard
        fromDate={trip.from}
        fromTime={trip.fromTime}
        toDate={trip.to}
        toTime={trip.toTime}
        onPress={() => setTripOpen(true)}
      />

      <View style={styles.searchRow}>
        <SearchField value={search} onChange={setSearch} onSubmit={() => openResults(filters, search)} />
        <IconButton icon="options-outline" label="Filters" onPress={() => setFiltersOpen(true)} style={styles.filterButton} />
      </View>

      {types.length > 1 ? (
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.chips}>
          {types.map((type) => (
            <Chip
              key={type}
              label={type}
              selected={type === "All"}
              onPress={() => {
                if (type === "All") return openResults(DEFAULT_CAR_FILTERS, "");
                openResults({ ...DEFAULT_CAR_FILTERS, vehicleTypes: [type] }, "");
              }}
            />
          ))}
        </ScrollView>
      ) : null}

      <View style={styles.sectionHead}>
        <AppText variant="headline" accessibilityRole="header">
          {trip.from ? "Available for your dates" : "Cars near you"}
        </AppText>
        <Pressable
          onPress={() => router.push({ pathname: "/customer/cars", params: tripParams } as unknown as Href)}
          accessibilityRole="button"
          hitSlop={10}
        >
          <AppText variant="label" color="leafInk">
            See all
          </AppText>
        </Pressable>
      </View>
    </View>
  );

  const empty = carsLoading ? (
    <View style={styles.list}>
      <Skeleton height={260} radius={Radius.card} />
      <Skeleton height={260} radius={Radius.card} />
    </View>
  ) : carsError ? (
    <ErrorState error={carsError} onRetry={loadCars} compact />
  ) : (
    <EmptyState
      icon="car-sport-outline"
      title={trip.city ? `No cars in ${trip.city} yet` : "No cars listed yet"}
      message="Try another city, or check back soon."
    />
  );

  return (
    <View style={styles.screen}>
      <FlatList
        data={homeCars}
        keyExtractor={(car) => String(car.id)}
        renderItem={({ item }) => (
          <CarCard car={item} onPress={openCar} saved={savedIds.has(Number(item.id))} onToggleSaved={toggleSaved} />
        )}
        ListHeaderComponent={header}
        ListEmptyComponent={empty}
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: bottomInset },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      />

      <TripSearchModal visible={tripOpen} value={trip} onClose={() => setTripOpen(false)} onApply={setTrip} />
      <CarFilterModal
        visible={filtersOpen}
        cars={cars}
        filters={filters}
        onClose={() => setFiltersOpen(false)}
        onApply={(next) => {
          setFilters(next);
          setFiltersOpen(false);
          openResults(next);
        }}
      />
    </View>
  );
}

function SearchField({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  const { tokens } = useTheme();
  return (
    <View style={[styles.search, { backgroundColor: tokens.glass, borderColor: tokens.glassLine }]}>
      <Ionicons name="search" size={18} color={tokens.label} />
      <TextInput
        value={value}
        onChangeText={onChange}
        onSubmitEditing={onSubmit}
        placeholder="Myvi, X50, Vios…"
        placeholderTextColor={tokens.label}
        returnKeyType="search"
        accessibilityLabel="Search cars or brands"
        style={[styles.searchInput, { color: tokens.ink }]}
      />
    </View>
  );
}

/** Splits "RM 1,234.50" into the currency and the figure for the big number. */
function amountParts(amount: string | number) {
  const text = formatRM(amount);
  return text.startsWith("RM ") ? text.slice(3) : text;
}

function ProgressSegment({ state }: { state: "done" | "now" | "todo" }) {
  const { tokens } = useTheme();
  return (
    <View style={styles.segTrack}>
      <View
        style={[
          styles.segFill,
          {
            backgroundColor: tokens.leaf,
            width: state === "done" ? "100%" : state === "now" ? "40%" : "0%",
          },
        ]}
      />
    </View>
  );
}

function NextPaymentHero({ payment, onPay }: { payment: NextPayment; onPay: () => void }) {
  const { tokens } = useTheme();
  const isDown = payment.part === "DOWN_PAYMENT";
  const partName = isDown ? "Down payment" : "Balance";
  const car = payment.booking.serviceName || "your booking";
  const due = payment.dueAt ? formatMYT(payment.dueAt, "dayDateTime") : null;
  const p = payment.booking.payment || {};

  return (
    <Pressable
      onPress={onPay}
      accessibilityRole="button"
      accessibilityLabel={`Next payment ${formatRM(payment.amount)}, ${partName} for ${car}${due ? `, due ${due}` : ""}. Pay now`}
    >
      <HeroCard
        tag="Next payment"
        corner={<IconButton icon="arrow-forward" label="Pay now" variant="onHero" onPress={onPay} />}
      >
        <View style={styles.amountRow}>
          <AppText style={[styles.currency, { color: tokens.onHero }]}>RM</AppText>
          <Figure size="xl" style={{ color: tokens.onHero }}>
            {amountParts(payment.amount)}
          </Figure>
        </View>
        <AppText variant="caption" style={{ color: tokens.onHeroSoft }}>
          {partName} for {car}
          {due ? ` · due ${due}` : ""}
        </AppText>

        <View style={styles.metrics}>
          <View style={styles.metric}>
            <AppText variant="bodyStrong" style={{ color: tokens.onHero }}>
              Done
            </AppText>
            <AppText variant="micro" style={{ color: tokens.onHeroSoft }}>
              Request
            </AppText>
            <ProgressSegment state="done" />
          </View>
          <View style={styles.metric}>
            <AppText variant="bodyStrong" style={{ color: tokens.onHero }} numberOfLines={1}>
              {formatRM(p.downPaymentAmount)}
            </AppText>
            <AppText variant="micro" style={{ color: tokens.onHeroSoft }}>
              Down payment
            </AppText>
            <ProgressSegment state={isDown ? "now" : "done"} />
          </View>
          <View style={styles.metric}>
            <AppText variant="bodyStrong" style={{ color: tokens.onHero }} numberOfLines={1}>
              {formatRM(p.finalPaymentAmount)}
            </AppText>
            <AppText variant="micro" style={{ color: tokens.onHeroSoft }}>
              Balance
            </AppText>
            <ProgressSegment state={isDown ? "todo" : "now"} />
          </View>
        </View>
      </HeroCard>
    </Pressable>
  );
}

function HowItWorksHero() {
  const { tokens } = useTheme();
  const steps = [
    { title: "Request a car", body: "Free. Nothing to pay yet." },
    { title: "Operator accepts", body: "Usually within a few hours." },
    { title: "Pay in two parts", body: "A down payment, then the balance before pick-up." },
  ];

  return (
    <HeroCard tag="How it works">
      <View style={styles.steps}>
        {steps.map((step, i) => (
          <View key={step.title} style={styles.step} accessible accessibilityLabel={`Step ${i + 1}. ${step.title}. ${step.body}`}>
            <View style={styles.stepNum}>
              <AppText style={{ color: tokens.onHero, fontFamily: FontFamily.monoMedium, fontSize: 12 }}>{i + 1}</AppText>
            </View>
            <View style={styles.stepText}>
              <AppText variant="bodyStrong" style={{ color: tokens.onHero }}>
                {step.title}
              </AppText>
              <AppText variant="caption" style={{ color: tokens.onHeroSoft }}>
                {step.body}
              </AppText>
            </View>
          </View>
        ))}
      </View>
    </HeroCard>
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
    gap: 16,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  city: {
    minHeight: 44,
    justifyContent: "center",
  },
  cityRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  cityName: {
    fontSize: 19,
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
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
  },
  list: {
    gap: 16,
  },
  separator: {
    height: 16,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 4,
  },
  currency: {
    fontFamily: FontFamily.regular,
    fontSize: 20,
    marginTop: 4,
  },
  metrics: {
    flexDirection: "row",
    gap: 10,
  },
  metric: {
    flex: 1,
    gap: 1,
  },
  segTrack: {
    height: 5,
    borderRadius: 3,
    marginTop: 6,
    backgroundColor: "rgba(255,255,255,0.14)",
    overflow: "hidden",
  },
  segFill: {
    height: "100%",
    borderRadius: 3,
  },
  steps: {
    gap: 12,
  },
  step: {
    flexDirection: "row",
    gap: 12,
    alignItems: "flex-start",
  },
  stepNum: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: "rgba(255,255,255,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  stepText: {
    flex: 1,
    gap: 1,
  },
});
