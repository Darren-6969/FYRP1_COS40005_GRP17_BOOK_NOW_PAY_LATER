import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import {
  getPublicCars,
} from "../../../services/carApi";

import {
  getCustomerBookings,
  getSavedListingIds,
  removeSavedListing,
  saveListing,
} from "../../../services/customerApi";

import CarFilterModal, {
  CarFilters,
  DEFAULT_CAR_FILTERS,
} from "../../../components/CarFilterModal";

import TripSearchModal, {
  TripSearch,
} from "../../../components/TripSearchModal";

import {
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";
import { logger } from "@/utils/logger";

export default function CustomerHome() {
  const router = useRouter();

  const handleToggleSaved =
  async (
    listingId: number
  ) => {
    if (
      savingListingId ===
      listingId
    ) {
      return;
    }

    const isSaved =
      savedListingIds.has(
        listingId
      );

    try {
      setSavingListingId(
        listingId
      );

      setSavedListingIds(
        (current) => {
          const next =
            new Set(current);

          if (isSaved) {
            next.delete(
              listingId
            );
          } else {
            next.add(
              listingId
            );
          }

          return next;
        }
      );

      if (isSaved) {
        await removeSavedListing(
          listingId
        );
      } else {
        await saveListing(
          listingId
        );
      }
    } catch (error) {
      logger.debug(
        "Failed to update saved listing:",
        error
      );

      setSavedListingIds(
        (current) => {
          const next =
            new Set(current);

          if (isSaved) {
            next.add(
              listingId
            );
          } else {
            next.delete(
              listingId
            );
          }

          return next;
        }
      );
    } finally {
      setSavingListingId(
        null
      );
    }
  };

  const scrollViewRef =
  useRef<any>(null);

  const carsSectionY =
    useRef(0);

  const [cars, setCars] = useState<any[]>([]);
  const [loadingCars, setLoadingCars] =
    useState(true);

  const [
    savedListingIds,
    setSavedListingIds,
  ] = useState<Set<number>>(
    new Set()
  );

  const [
    savingListingId,
    setSavingListingId,
  ] = useState<number | null>(
    null
  );

  const [filters, setFilters] =
    useState<CarFilters>(
      DEFAULT_CAR_FILTERS
    );

  const [trip, setTrip] =
  useState<TripSearch>({
    city: "",
    from: "",
    fromTime: "10:00",
    to: "",
    toTime: "10:00",
  });

  const [tripVisible, setTripVisible] =
  useState(false);

  const [filterVisible, setFilterVisible] =
    useState(false);

  const [searchText, setSearchText] =
    useState("");

  const openSearchResults = (
  nextFilters: CarFilters = filters,
  nextSearch: string = searchText,
  nextTrip: TripSearch = trip
) => {
  router.push({
    pathname: "/customer/cars",
    params: {
      search: nextSearch.trim(),
      filters: JSON.stringify(nextFilters),
      city: nextTrip.city || "",
      from: nextTrip.from || "",
      ft: nextTrip.fromTime || "",
      to: nextTrip.to || "",
      tt: nextTrip.toTime || "",
    },
  });
};

  const [latestBooking, setLatestBooking] =
    useState<any | null>(null);

  const [loadingBooking, setLoadingBooking] =
    useState(true);

  const scrollToCars = () => {
    scrollViewRef.current?.scrollTo({
      y: Math.max(
        carsSectionY.current - 20,
        0
      ),
      animated: true,
    });
  };

    useEffect(() => {
    const loadCars = async () => {
      try {
        setLoadingCars(true);

        const data = await getPublicCars();

        setCars(
          Array.isArray(data?.items)
            ? data.items
            : []
        );
      } catch (error) {
        logger.debug(
          "Failed to load cars:",
          error
        );

        setCars([]);
      } finally {
        setLoadingCars(false);
      }
    };

    loadCars();
  }, []);

  useEffect(() => {
  const loadSavedListings =
    async () => {
      try {
        const data =
          await getSavedListingIds();

        const ids =
          Array.isArray(data?.ids)
            ? data.ids.map(Number)
            : [];

        setSavedListingIds(
          new Set(ids)
        );
      } catch (error) {
        logger.debug(
          "Failed to load saved listings:",
          error
        );
      }
    };

  loadSavedListings();
}, []);

  useEffect(() => {
    const loadLatestBooking = async () => {
      try {
        setLoadingBooking(true);

        const data =
          await getCustomerBookings();

        if (
          Array.isArray(data) &&
          data.length > 0
        ) {
          setLatestBooking(data[0]);
        } else {
          setLatestBooking(null);
        }
      } catch (error) {
        logger.debug(
          "Failed to load latest booking:",
          error
        );

        setLatestBooking(null);
      } finally {
        setLoadingBooking(false);
      }
    };

    loadLatestBooking();
  }, []);

  function formatBookingDate(
    value?: string
  ) {
    if (!value) return "-";

    const date = new Date(value);

    if (Number.isNaN(date.getTime())) {
      return "-";
    }

    return date.toLocaleDateString(
      "en-MY",
      {
        day: "2-digit",
        month: "short",
        year: "numeric",
      }
    );
  }

  const VEHICLE_TYPE_ORDER = [
  "Compact",
  "Hatchback",
  "Sedan",
  "SUV",
  "MPV",
  "Pickup",
  "Van",
];

function normalizeVehicleType(
  value?: string
) {
  return String(
    value || ""
  )
    .trim()
    .toLowerCase();
}

  const vehicleTypes =
  useMemo(() => {
    const availableTypes =
      Array.from(
        new Set(
          cars
            .map((car) =>
              String(
                car.vehicleType ||
                  ""
              ).trim()
            )
            .filter(Boolean)
        )
      );

    const orderedTypes =
      VEHICLE_TYPE_ORDER.filter(
        (type) =>
          availableTypes.some(
            (availableType) =>
              normalizeVehicleType(
                availableType
              ) ===
              normalizeVehicleType(
                type
              )
          )
      );

    const extraTypes =
      availableTypes.filter(
        (type) =>
          !VEHICLE_TYPE_ORDER.some(
            (knownType) =>
              normalizeVehicleType(
                knownType
              ) ===
              normalizeVehicleType(
                type
              )
          )
      );

    return [
      "All",
      ...orderedTypes,
      ...extraTypes,
    ];
  }, [cars]);

  const filteredCars = useMemo(() => {
    const search =
      searchText.trim().toLowerCase();

    let result = cars.filter((car) => {
      const carName =
        car.name ||
        `${car.vehicleMake || ""} ${
          car.vehicleModel || ""
        }`;

      const searchMatch =
        !search ||
        carName
          .toLowerCase()
          .includes(search) ||
        car.vehicleMake
          ?.toLowerCase()
          .includes(search) ||
        car.vehicleModel
          ?.toLowerCase()
          .includes(search);

      if (!searchMatch) return false;

      if (
        trip.city &&
        car.branch?.city !== trip.city
      ) {
        return false;
      }

      if (
        filters.vehicleTypes.length
      ) {
        const selectedTypes =
          filters.vehicleTypes.map(
            normalizeVehicleType
          );

        const carType =
          normalizeVehicleType(
            car.vehicleType
          );

        if (
          !selectedTypes.includes(
            carType
          )
        ) {
          return false;
        }
      }

      if (filters.seats.length) {
        const minimumSeats = Math.min(
          ...filters.seats.map(Number)
        );

        if (
          Number(car.seats || 0) <
          minimumSeats
        ) {
          return false;
        }
      }

      if (
        filters.transmissions.length &&
        !filters.transmissions.includes(
          car.transmission
        )
      ) {
        return false;
      }

      if (
        filters.fuels.length &&
        !filters.fuels.includes(
          car.fuelType
        )
      ) {
        return false;
      }

      if (
        filters.drives.length &&
        !filters.drives.includes(
          car.driveType
        )
      ) {
        return false;
      }

      if (
        filters.brands.length &&
        !filters.brands.includes(
          car.vehicleMake
        )
      ) {
        return false;
      }

      if (
        filters.operators.length &&
        !filters.operators.includes(
          String(car.operator?.id)
        )
      ) {
        return false;
      }

      if (filters.refunds.length) {
        const refundType =
          car.booking?.refundRule
            ?.type === "PARTIAL"
            ? "partial"
            : "none";

        if (
          !filters.refunds.includes(
            refundType
          )
        ) {
          return false;
        }
      }

      const dailyRate =
        Number(
          car.booking?.dailyRateSen || 0
        ) / 100;

      if (
        filters.priceMin &&
        dailyRate <
          Number(filters.priceMin)
      ) {
        return false;
      }

      if (
        filters.priceMax &&
        dailyRate >
          Number(filters.priceMax)
      ) {
        return false;
      }

      return true;
    });

    result = [...result];

    switch (filters.sort) {
      case "daily":
        result.sort(
          (a, b) =>
            Number(
              a.booking?.dailyRateSen || 0
            ) -
            Number(
              b.booking?.dailyRateSen || 0
            )
        );
        break;

      case "payable":
        result.sort((a, b) => {
          const aDeposit =
            Number(
              a.booking?.dailyRateSen || 0
            ) *
            Number(
              a.booking
                ?.downPaymentPct || 0
            );

          const bDeposit =
            Number(
              b.booking?.dailyRateSen || 0
            ) *
            Number(
              b.booking
                ?.downPaymentPct || 0
            );

          return aDeposit - bDeposit;
        });
        break;

      case "seats":
        result.sort(
          (a, b) =>
            Number(a.seats || 0) -
            Number(b.seats || 0)
        );
        break;

      case "recent":
        result.sort(
          (a, b) =>
            new Date(
              b.createdAt
            ).getTime() -
            new Date(
              a.createdAt
            ).getTime()
        );
        break;

      default:
        break;
    }

    return result;
  }, [
    cars,
    searchText,
    filters,
    trip.city,
  ]);

  const hasActiveFilters =
  Boolean(searchText.trim()) ||
  Boolean(trip.city) ||
  filters.vehicleTypes.length > 0 ||
  filters.seats.length > 0 ||
  filters.transmissions.length > 0 ||
  filters.fuels.length > 0 ||
  filters.drives.length > 0 ||
  filters.brands.length > 0 ||
  filters.refunds.length > 0 ||
  filters.operators.length > 0 ||
  Boolean(filters.priceMin) ||
  Boolean(filters.priceMax) ||
  filters.sort !== "recommended";

const clearAllFilters = () => {
  setSearchText("");
  setFilters(DEFAULT_CAR_FILTERS);

  setTrip((current) => ({
    ...current,
    city: "",
  }));
};

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <ScrollView
        ref={scrollViewRef}
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <Pressable
            onPress={() =>
              setTripVisible(true)
            }
          >
            <Text style={styles.deliveryLabel}>
              Pick-up Location
            </Text>

            <Text style={styles.location}>
              {trip.city
                ? `${trip.city}, Malaysia`
                : "Choose location"}
              {" ▼"}
            </Text>
          </Pressable>

          <Pressable
            style={({ pressed }) => [
              styles.notificationButton,
              pressed && {
                opacity: 0.75,
                transform: [
                  {
                    scale: 0.95,
                  },
                ],
              },
            ]}
            onPress={() =>
              router.push(
                "/customer/notifications"
              )
            }
          >
            <Ionicons
              name="notifications-outline"
              size={23}
              color="#17313C"
            />

            <View
              style={styles.notificationDot}
            />
          </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>
              ⌕
            </Text>

            <TextInput
              placeholder="Search cars or brands..."
              placeholderTextColor="#90A0A8"
              style={styles.searchInput}
              value={searchText}
              onChangeText={setSearchText}
              returnKeyType="search"
              onSubmitEditing={() =>
                openSearchResults()
              }
            />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.filterButton,
              pressed && {
                opacity: 0.75,
              },
            ]}
            onPress={() =>
              setFilterVisible(true)
            }
          >
            <Ionicons
              name="options-outline"
              size={23}
              color="#17313C"
            />

            {Object.values(filters).some(
              (value) =>
                Array.isArray(value)
                  ? value.length > 0
                  : Boolean(value) &&
                    value !== "recommended"
            ) && (
              <View
                style={styles.filterDot}
              />
            )}
          </Pressable>
        </View>

        <Pressable
          style={styles.tripSummary}
          onPress={() =>
            setTripVisible(true)
          }
        >
          <View style={styles.tripSummaryItem}>
            <Ionicons
              name="calendar-outline"
              size={19}
              color="#07869B"
            />

            <View>
              <Text style={styles.tripSummaryLabel}>
                Pick-up
              </Text>

              <Text style={styles.tripSummaryValue}>
                {trip.from
                  ? `${trip.from} · ${trip.fromTime}`
                  : "Select date & time"}
              </Text>
            </View>
          </View>

          <Ionicons
            name="arrow-forward"
            size={17}
            color="#9AABB2"
          />

          <View style={styles.tripSummaryItem}>
            <Ionicons
              name="calendar-outline"
              size={19}
              color="#07869B"
            />

            <View>
              <Text style={styles.tripSummaryLabel}>
                Return
              </Text>

              <Text style={styles.tripSummaryValue}>
                {trip.to
                  ? `${trip.to} · ${trip.toTime}`
                  : "Select date & time"}
              </Text>
            </View>
          </View>
        </Pressable>

        {/* Hero Banner */}
        <View style={styles.heroBanner}>
        <View style={styles.heroTextArea}>
          <Text style={styles.heroTitle}>
            Book Now{"\n"}Pay Later
          </Text>

          <Text style={styles.heroSubtitle}>
            Flexible car rental with BNPL payment options.
          </Text>

          <Pressable
            style={({ pressed }) => [
              styles.heroButton,

              pressed && {
                opacity: 0.8,
              },
            ]}
            onPress={scrollToCars}
          >
            <Text
              style={
                styles.heroButtonText
              }
            >
              Browse Cars
            </Text>

            <Text
              style={
                styles.heroArrow
              }
            >
              →
            </Text>
          </Pressable>
        </View>

        <Image
          source={{
            uri: "https://images.unsplash.com/photo-1504215680853-026ed2a45def?auto=format&fit=crop&w=900&q=80",
          }}
          style={styles.heroImage}
        />
      </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.categories}
        >
          {vehicleTypes.map((category) => {
            const selected =
            category === "All"
              ? filters.vehicleTypes.length === 0
              : filters.vehicleTypes.some(
                  (type) =>
                    normalizeVehicleType(
                      type
                    ) ===
                    normalizeVehicleType(
                      category
                    )
                );

            return (
              <Pressable
                key={category}
                style={[
                  styles.category,
                  selected && styles.categorySelected,
                ]}
                onPress={() => {
                const nextFilters = {
                  ...filters,
                  vehicleTypes:
                    category === "All"
                      ? []
                      : [category],
                };

                openSearchResults(nextFilters);
              }}
              >
                <View
                  style={[
                    styles.categoryIcon,
                    selected &&
                      styles.categoryIconSelected,
                  ]}
                >
                  <Ionicons
                    name={
                      category === "All"
                        ? "apps-outline"
                        : "car-sport-outline"
                    }
                    size={23}
                    color={
                      selected
                        ? "#FFFFFF"
                        : "#07869B"
                    }
                  />
                </View>

                <Text
                  style={[
                    styles.categoryText,
                    selected &&
                      styles.categoryTextSelected,
                  ]}
                >
                  {category}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
        
    
{/* Car Results Section */}
<View
  style={styles.sectionHeader}
  onLayout={(event) => {
    carsSectionY.current =
      event.nativeEvent.layout.y;
  }}
>
  <Text style={styles.sectionTitle}>
    {hasActiveFilters
      ? "Search Results"
      : "Featured Cars"}
  </Text>

  {hasActiveFilters ? (
    <Pressable onPress={clearAllFilters}>
      <Text style={styles.seeAll}>
        Clear Filters
      </Text>
    </Pressable>
  ) : (
    <Pressable
      onPress={() =>
        router.push({
          pathname: "/customer/cars",
          params: {
            city: trip.city || "",
            from: trip.from || "",
            ft: trip.fromTime || "",
            to: trip.to || "",
            tt: trip.toTime || "",
          },
        })
      }
    >
      <Text style={styles.seeAll}>
        See All
      </Text>
    </Pressable>
  )}
</View>

{hasActiveFilters && !loadingCars && (
  <Text style={styles.resultsCount}>
    {filteredCars.length} vehicles found
  </Text>
)}

{loadingCars ? (
  <View style={styles.loadingCars}>
    <Text style={styles.loadingCarsText}>
      Loading cars...
    </Text>
  </View>
) : hasActiveFilters ? (
  cars.length === 0 ? (
    <View style={styles.noCarsCard}>
      <Ionicons
        name="search-outline"
        size={30}
        color="#81939C"
      />

      <Text style={styles.noCarsTitle}>
        No matching cars
      </Text>

      <Text style={styles.noCarsText}>
        Try changing or clearing your filters.
      </Text>
    </View>
  ) : (
    <View style={styles.resultsList}>
      {cars.map((car) => {
        const imageUrl =
          car.images?.[0]?.imageUrl;

        const dailyRate =
          Number(
            car.booking?.dailyRateSen || 0
          ) / 100;

        const isSaved =
          savedListingIds.has(Number(car.id));

        return (
          <Pressable
            key={car.id}
            style={({ pressed }) => [
              styles.resultCard,
              pressed && { opacity: 0.85 },
            ]}
            onPress={() =>
              router.push({
                pathname: "/customer/car-details",
                params: {
                  id: String(car.id),
                  city: trip.city || "",
                  from: trip.from || "",
                  ft: trip.fromTime || "",
                  to: trip.to || "",
                  tt: trip.toTime || "",
                },
              })
            }
          >
            <View style={styles.resultImageBox}>
              {imageUrl ? (
                <Image
                  source={{ uri: imageUrl }}
                  style={styles.resultImage}
                  resizeMode="cover"
                />
              ) : (
                <View
                  style={styles.resultPlaceholder}
                >
                  <Ionicons
                    name="car-sport-outline"
                    size={35}
                    color="#91A5AD"
                  />
                </View>
              )}
            </View>

            <View style={styles.resultInfo}>
              <Text
                style={styles.resultName}
                numberOfLines={2}
              >
                {car.name ||
                  `${car.vehicleMake || ""} ${
                    car.vehicleModel || ""
                  }`.trim()}
              </Text>

              <Text
                style={styles.resultDetails}
                numberOfLines={2}
              >
                {car.vehicleType || "Car"}
                {" · "}
                {car.transmission || "N/A"}
              </Text>

              {car.seats ? (
                <Text style={styles.resultDetails}>
                  {car.seats} seats
                </Text>
              ) : null}

              <View style={styles.resultPriceRow}>
                <Text style={styles.resultPrice}>
                  RM {dailyRate.toFixed(2)}
                </Text>

                <Text style={styles.resultPerDay}>
                  {" "}/ day
                </Text>
              </View>
            </View>

            <Pressable
              style={styles.resultHeart}
              disabled={
                savingListingId === Number(car.id)
              }
              onPress={(event) => {
                event.stopPropagation();

                handleToggleSaved(Number(car.id));
              }}
            >
              <Ionicons
                name={
                  isSaved ? "heart" : "heart-outline"
                }
                size={20}
                color={
                  isSaved ? "#E84B4B" : "#17313C"
                }
              />
            </Pressable>
          </Pressable>
        );
      })}
    </View>
  )
) : cars.length === 0 ? (
  <View style={styles.noCarsCard}>
    <Ionicons
      name="car-outline"
      size={30}
      color="#81939C"
    />

    <Text style={styles.noCarsTitle}>
      No cars available
    </Text>
  </View>
) : (
  <ScrollView
    horizontal
    showsHorizontalScrollIndicator={false}
    contentContainerStyle={styles.carList}
  >
    {cars.map((car) => {
      const imageUrl =
        car.images?.[0]?.imageUrl;

      const dailyRate =
        Number(
          car.booking?.dailyRateSen || 0
        ) / 100;

      const isSaved =
        savedListingIds.has(Number(car.id));

      return (
        <Pressable
          key={car.id}
          style={styles.carCard}
          onPress={() =>
            router.push({
              pathname: "/customer/car-details",
              params: {
                id: String(car.id),
                city: trip.city || "",
                from: trip.from || "",
                ft: trip.fromTime || "",
                to: trip.to || "",
                tt: trip.toTime || "",
              },
            })
          }
        >
          <View style={styles.carImageWrapper}>
            {imageUrl ? (
              <Image
                source={{ uri: imageUrl }}
                style={styles.carImage}
                resizeMode="cover"
              />
            ) : (
              <View
                style={styles.carImagePlaceholder}
              >
                <Ionicons
                  name="car-sport-outline"
                  size={45}
                  color="#91A5AD"
                />
              </View>
            )}

            <Pressable
              style={styles.heartButton}
              disabled={
                savingListingId === Number(car.id)
              }
              onPress={(event) => {
                event.stopPropagation();

                handleToggleSaved(Number(car.id));
              }}
            >
              <Ionicons
                name={
                  isSaved ? "heart" : "heart-outline"
                }
                size={20}
                color={
                  isSaved ? "#E84B4B" : "#17313C"
                }
              />
            </Pressable>
          </View>

          <View style={styles.carInfo}>
            <Text
              style={styles.carName}
              numberOfLines={1}
            >
              {car.name ||
                `${car.vehicleMake || ""} ${
                  car.vehicleModel || ""
                }`.trim()}
            </Text>

            <Text style={styles.carDetails}>
              {car.vehicleType || "Car"}
              {" · "}
              {car.transmission || "N/A"}
            </Text>

            <View style={styles.priceRow}>
              <Text style={styles.price}>
                RM {dailyRate.toFixed(2)}
              </Text>

              <Text style={styles.perDay}>
                {" "}/ day
              </Text>
            </View>
          </View>
        </Pressable>
      );
    })}
  </ScrollView>
)}


    {/* My Booking Header */}
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>
        My Booking
      </Text>

      <Pressable
        onPress={() =>
          router.push("/customer/bookings")
        }
      >
        <Text style={styles.seeAll}>
          View All
        </Text>
      </Pressable>
    </View>

    {loadingBooking ? (
      <View style={styles.bookingLoadingCard}>
        <Text style={styles.bookingLoadingText}>
          Loading booking...
        </Text>
      </View>
    ) : latestBooking ? (
      <Pressable
        style={({ pressed }) => [
          styles.bookingCard,
          pressed && {
            opacity: 0.82,
          },
        ]}
        onPress={() =>
          router.push(
            `/customer/booking/${latestBooking.id}`
          )
        }
      >
        <View style={styles.bookingImagePlaceholder}>
          <Ionicons
            name="car-sport-outline"
            size={30}
            color="#07869B"
          />
        </View>

        <View style={styles.bookingInfo}>
          <View style={styles.bookingTopRow}>
            <View
              style={[
                styles.statusBadge,

                latestBooking.status ===
                  "PENDING" && {
                  backgroundColor: "#FFF1CC",
                },

                latestBooking.status ===
                  "REJECTED" && {
                  backgroundColor: "#FDE3E3",
                },
              ]}
            >
              <Text
                style={[
                  styles.statusText,

                  latestBooking.status ===
                    "PENDING" && {
                    color: "#A46A00",
                  },

                  latestBooking.status ===
                    "REJECTED" && {
                    color: "#C83E3E",
                  },
                ]}
              >
                {latestBooking.status
                  ?.replaceAll("_", " ") ||
                  "UNKNOWN"}
              </Text>
            </View>

            <Text style={styles.bookingCode}>
              {latestBooking.bookingCode ||
                `BNPL-${latestBooking.id}`}
            </Text>
          </View>

          <Text
            style={styles.bookingCar}
            numberOfLines={1}
          >
            {latestBooking.serviceName ||
              "Car Rental"}
          </Text>

          <Text style={styles.bookingDate}>
            {formatBookingDate(
              latestBooking.pickupDate
            )}
            {" – "}
            {formatBookingDate(
              latestBooking.returnDate
            )}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={22}
          color="#7D919A"
        />
      </Pressable>
    ) : (
      <View style={styles.noBookingCard}>
        <View style={styles.noBookingIcon}>
          <Ionicons
            name="calendar-outline"
            size={28}
            color="#07869B"
          />
        </View>

        <View style={{ flex: 1 }}>
          <Text style={styles.noBookingTitle}>
            No bookings yet
          </Text>

          <Text style={styles.noBookingText}>
            Choose a car to start your first
            booking.
          </Text>
        </View>
      </View>
    )}
            </ScrollView>

      <TripSearchModal
        visible={tripVisible}
        value={trip}
        onClose={() =>
          setTripVisible(false)
        }
        onApply={(nextTrip) =>
          setTrip(nextTrip)
        }
      />

      <CarFilterModal
        visible={filterVisible}
        cars={cars}
        filters={filters}
        onClose={() =>
          setFilterVisible(false)
        }
        onApply={(nextFilters) => {
          setFilters(nextFilters);
          setFilterVisible(false);
          openSearchResults(nextFilters);
        }}
      />

    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },

  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 130,
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },

  deliveryLabel: {
    color: "#8698A1",
    fontSize: 12,
    marginBottom: 3,
  },

  location: {
    color: "#17313C",
    fontSize: 15,
    fontWeight: "800",
  },

  notificationButton: {
    width: 46,
    height: 46,
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "#E4ECEF",
    position: "relative",
  },

  notificationIcon: {
    fontSize: 25,
    color: "#17313C",
  },

  notificationDot: {
    width: 8,
    height: 8,
    borderRadius: 8,
    backgroundColor: "#F44545",
    position: "absolute",
    right: 10,
    top: 9,
  },

  searchRow: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 20,
  },

  searchBox: {
    flex: 1,
    height: 54,
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#E2EAED",
    paddingHorizontal: 15,
  },

  searchIcon: {
    fontSize: 24,
    color: "#6F828B",
    marginRight: 9,
  },

  searchInput: {
    flex: 1,
    fontSize: 14,
    color: "#17313C",
    outlineStyle: "none" as any,
  },

  filterButton: {
  width: 54,
  height: 54,
  borderRadius: 16,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E2EAED",
  alignItems: "center",
  justifyContent: "center",
  position: "relative",
  },

  filterText: {
    fontSize: 24,
    color: "#17313C",
  },

  heroBanner: {
    height: 185,
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#073E4B",
    flexDirection: "row",
    marginBottom: 22,
  },

  heroTextArea: {
    flex: 1.05,
    padding: 20,
    zIndex: 2,
  },

  heroTitle: {
    color: "#FFFFFF",
    fontSize: 27,
    lineHeight: 30,
    fontWeight: "900",
  },

  heroSubtitle: {
    color: "#D0E8ED",
    fontSize: 12,
    lineHeight: 17,
    marginTop: 9,
    maxWidth: 190,
  },

  heroButton: {
    backgroundColor: "#FFFFFF",
    alignSelf: "flex-start",
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 14,
    height: 34,
    borderRadius: 20,
    marginTop: 15,
  },

  heroButtonText: {
    color: "#087F93",
    fontWeight: "800",
    fontSize: 12,
  },

  heroArrow: {
    color: "#087F93",
    fontWeight: "900",
    marginLeft: 5,
  },

  heroImage: {
    flex: 1,
    height: "100%",
    opacity: 0.9,
  },

  categories: {
    gap: 15,
    paddingBottom: 22,
  },

  category: {
    alignItems: "center",
    width: 72,
  },

  categoryIcon: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: "#DFF5F8",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 7,
  },

  carEmoji: {
    fontSize: 25,
  },

  categoryText: {
    color: "#40555F",
    fontSize: 11,
    fontWeight: "700",
  },

  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 14,
  },

  sectionTitle: {
    color: "#172E38",
    fontSize: 19,
    fontWeight: "900",
  },

  seeAll: {
    color: "#07869B",
    fontWeight: "800",
    fontSize: 12,
  },

  carList: {
    gap: 14,
    paddingBottom: 25,
  },

  loadingCars: {
  minHeight: 150,
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#FFFFFF",
  borderRadius: 20,
  marginBottom: 25,
  borderWidth: 1,
  borderColor: "#E8EEF0",
},

loadingCarsText: {
  color: "#81939C",
  fontSize: 12,
  fontWeight: "700",
},

noCarsCard: {
  minHeight: 150,
  backgroundColor: "#FFFFFF",
  borderRadius: 20,
  borderWidth: 1,
  borderColor: "#E8EEF0",
  marginBottom: 25,
  alignItems: "center",
  justifyContent: "center",
  padding: 20,
},

noCarsTitle: {
  color: "#17313C",
  fontSize: 15,
  fontWeight: "900",
  marginTop: 9,
},

noCarsText: {
  color: "#8798A1",
  fontSize: 11,
  marginTop: 5,
  textAlign: "center",
},

carImagePlaceholder: {
  width: "100%",
  height: "100%",
  alignItems: "center",
  justifyContent: "center",
  backgroundColor: "#EDF3F4",
},

  carCard: {
    width: 210,
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E8EEF0",
  },

  carImageWrapper: {
    height: 125,
    backgroundColor: "#EEF4F5",
    position: "relative",
  },

  carImage: {
    width: "100%",
    height: "100%",
  },

  heartButton: {
    position: "absolute",
    right: 10,
    top: 10,
    width: 32,
    height: 32,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.92)",
    alignItems: "center",
    justifyContent: "center",
  },

  heart: {
    fontSize: 21,
    color: "#17313C",
  },

  carInfo: {
    padding: 14,
  },

  carName: {
    color: "#17313C",
    fontSize: 15,
    fontWeight: "900",
  },

  carDetails: {
    color: "#8798A1",
    fontSize: 11,
    marginTop: 4,
  },

  priceRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    marginTop: 11,
  },

  price: {
    color: "#0B5363",
    fontSize: 17,
    fontWeight: "900",
  },

  perDay: {
    color: "#84969E",
    fontSize: 11,
    marginBottom: 2,
  },

  bookingCard: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E4EBEE",
    borderRadius: 20,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
  },

  bookingImage: {
    width: 82,
    height: 68,
    borderRadius: 14,
    backgroundColor: "#E9F0F2",
  },

  bookingInfo: {
    flex: 1,
    paddingHorizontal: 12,
  },

  bookingTopRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },

  statusBadge: {
    backgroundColor: "#D6F6E7",
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 10,
  },

  statusText: {
    color: "#159D66",
    fontWeight: "800",
    fontSize: 10,
  },

  bookingCode: {
    color: "#536872",
    fontWeight: "800",
    fontSize: 11,
  },

  bookingCar: {
    color: "#17313C",
    fontWeight: "900",
    fontSize: 14,
    marginTop: 7,
  },

  bookingDate: {
    color: "#899AA2",
    fontSize: 10,
    marginTop: 4,
  },

  chevron: {
    color: "#7D919A",
    fontSize: 28,
  },

  categorySelected: {
  opacity: 1,
},

categoryIconSelected: {
  backgroundColor: "#07869B",
},

categoryTextSelected: {
  color: "#07869B",
  fontWeight: "900",
},

bookingLoadingCard: {
  height: 90,
  backgroundColor: "#FFFFFF",
  borderRadius: 20,
  borderWidth: 1,
  borderColor: "#E4EBEE",
  alignItems: "center",
  justifyContent: "center",
},

bookingLoadingText: {
  color: "#84969E",
  fontSize: 12,
  fontWeight: "700",
},

bookingImagePlaceholder: {
  width: 82,
  height: 68,
  borderRadius: 14,
  backgroundColor: "#E5F7F9",
  alignItems: "center",
  justifyContent: "center",
},

noBookingCard: {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E4EBEE",
  borderRadius: 20,
  padding: 16,

  flexDirection: "row",
  alignItems: "center",
  gap: 13,
},

noBookingIcon: {
  width: 52,
  height: 52,
  borderRadius: 16,
  backgroundColor: "#E6F7F9",
  alignItems: "center",
  justifyContent: "center",
},

noBookingTitle: {
  color: "#17313C",
  fontSize: 14,
  fontWeight: "900",
},

noBookingText: {
  color: "#8798A1",
  fontSize: 11,
  marginTop: 4,
},

filterDot: {
  width: 8,
  height: 8,
  borderRadius: 8,
  backgroundColor: "#07869B",
  position: "absolute",
  right: 9,
  top: 8,
},

tripSummary: {
  backgroundColor: "#FFFFFF",
  borderRadius: 18,
  borderWidth: 1,
  borderColor: "#E3EBED",
  padding: 13,
  marginBottom: 18,

  flexDirection: "row",
  alignItems: "center",
  justifyContent: "space-between",
},

tripSummaryItem: {
  flex: 1,
  flexDirection: "row",
  alignItems: "center",
  gap: 8,
},

tripSummaryLabel: {
  color: "#8A9AA2",
  fontSize: 9,
  fontWeight: "700",
},

tripSummaryValue: {
  color: "#17313C",
  fontSize: 10,
  fontWeight: "800",
  marginTop: 2,
},


resultsCount: {
  fontSize: 12,
  color: "#81939C",
  marginBottom: 14,
  marginTop: -4,
},

resultsList: {
  gap: 12,
  marginBottom: 10,
},

resultCard: {
  backgroundColor: "#FFFFFF",
  borderRadius: 18,
  borderWidth: 1,
  borderColor: "#E3EAED",
  flexDirection: "row",
  alignItems: "center",
  padding: 10,
  minHeight: 128,
},

resultImageBox: {
  width: 118,
  height: 105,
  borderRadius: 13,
  backgroundColor: "#EEF3F5",
  overflow: "hidden",
},

resultImage: {
  width: "100%",
  height: "100%",
},

resultPlaceholder: {
  flex: 1,
  alignItems: "center",
  justifyContent: "center",
},

resultInfo: {
  flex: 1,
  paddingLeft: 13,
  paddingRight: 5,
  justifyContent: "center",
},

resultName: {
  color: "#17313C",
  fontSize: 14,
  fontWeight: "900",
},

resultDetails: {
  color: "#81939C",
  fontSize: 10,
  marginTop: 5,
},

resultPriceRow: {
  flexDirection: "row",
  alignItems: "baseline",
  marginTop: 11,
},

resultPrice: {
  color: "#07869B",
  fontSize: 15,
  fontWeight: "900",
},

resultPerDay: {
  color: "#8C9BA2",
  fontSize: 9,
},

resultHeart: {
  width: 35,
  height: 35,
  borderRadius: 12,
  backgroundColor: "#F4F8F9",
  justifyContent: "center",
  alignItems: "center",
  alignSelf: "flex-start",
},


});