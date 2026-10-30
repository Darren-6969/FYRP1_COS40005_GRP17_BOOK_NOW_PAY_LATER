import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { StatusBar } from "expo-status-bar";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getPublicCars,
} from "../../../services/carApi";

import {
  getCustomerBookings,
} from "../../../services/customerApi";

import CarFilterModal, {
  CarFilters,
  DEFAULT_CAR_FILTERS,
} from "../../../components/CarFilterModal";

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

export default function CustomerHome() {
  const router = useRouter();

  const [cars, setCars] = useState<any[]>([]);
  const [loadingCars, setLoadingCars] =
    useState(true);

  const [filters, setFilters] =
    useState<CarFilters>(
      DEFAULT_CAR_FILTERS
    );

  const [filterVisible, setFilterVisible] =
    useState(false);

  const [searchText, setSearchText] =
    useState("");

  const [latestBooking, setLatestBooking] =
    useState<any | null>(null);

  const [loadingBooking, setLoadingBooking] =
    useState(true);

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
        console.log(
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
        console.log(
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

  const VEHICLE_TYPES = [
  "All",
  "Compact",
  "Sedan",
  "SUV",
  "MPV",
  "Pickup",
];

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
        filters.vehicleTypes.length &&
        !filters.vehicleTypes.includes(
          car.vehicleType
        )
      ) {
        return false;
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
  ]);

  return (
    <SafeAreaView style={styles.safeArea}>
      <StatusBar style="dark" />

      <ScrollView
        contentContainerStyle={styles.scrollContent}
        showsVerticalScrollIndicator={false}
      >
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.deliveryLabel}>Current Location</Text>

            <Text style={styles.location}>
              Kuala Lumpur, Malaysia ▼
            </Text>
          </View>

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
            router.push("/customer/notifications")
          }
        >
          <Ionicons
            name="notifications-outline"
            size={23}
            color="#17313C"
          />

          <View style={styles.notificationDot} />
        </Pressable>
        </View>

        {/* Search */}
        <View style={styles.searchRow}>
          <View style={styles.searchBox}>
            <Text style={styles.searchIcon}>⌕</Text>

            <TextInput
            placeholder="Search cars or brands..."
            placeholderTextColor="#90A0A8"
            style={styles.searchInput}
            value={searchText}
            onChangeText={setSearchText}
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
              <View style={styles.filterDot} />
            )}
          </Pressable>
        </View>

        {/* Hero Banner */}
        <View style={styles.heroBanner}>
          <View style={styles.heroTextArea}>
            <Text style={styles.heroTitle}>
              Drive Now{"\n"}Pay Later
            </Text>

            <Text style={styles.heroSubtitle}>
              Flexible car rental with BNPL payment options.
            </Text>

            <Pressable style={styles.heroButton}>
              <Text style={styles.heroButtonText}>View Deals</Text>
              <Text style={styles.heroArrow}>→</Text>
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
          {VEHICLE_TYPES.map((category) => {
            const selected =
              category === "All"
                ? filters.vehicleTypes.length === 0
                : filters.vehicleTypes.includes(category);

            return (
              <Pressable
                key={category}
                style={[
                  styles.category,
                  selected && styles.categorySelected,
                ]}
                onPress={() => {
                  setFilters((current) => ({
                    ...current,
                    vehicleTypes:
                      category === "All"
                        ? []
                        : [category],
                  }));
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
        

        {/* Featured Cars Header */}
    <View style={styles.sectionHeader}>
      <Text style={styles.sectionTitle}>
        Featured Cars
      </Text>

      <Pressable>
        <Text style={styles.seeAll}>
          See All
        </Text>
      </Pressable>
    </View>

    {/* Loading Cars */}
    {loadingCars ? (
      <View style={styles.loadingCars}>
        <Text style={styles.loadingCarsText}>
          Loading cars...
        </Text>
      </View>
    ) : filteredCars.length === 0 ? (
      <View style={styles.noCarsCard}>
        <Ionicons
          name="car-outline"
          size={30}
          color="#81939C"
        />

        <Text style={styles.noCarsTitle}>
          No cars found
        </Text>

        <Text style={styles.noCarsText}>
          Try changing your search or vehicle type.
        </Text>
      </View>
    ) : (
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.carList}
      >
        {filteredCars.map((car) => {
          const imageUrl =
            car.images?.[0]?.imageUrl;

          const dailyRate =
            Number(
              car.booking?.dailyRateSen || 0
            ) / 100;

          return (
            <Pressable
              key={car.id}
              style={styles.carCard}
              onPress={() =>
                router.push({
                  pathname:
                    "/customer/car-details",
                  params: {
                    id: String(car.id),
                  },
                })
              }
            >
              <View
                style={
                  styles.carImageWrapper
                }
              >
                {imageUrl ? (
                  <Image
                    source={{
                      uri: imageUrl,
                    }}
                    style={styles.carImage}
                    resizeMode="cover"
                  />
                ) : (
                  <View
                    style={
                      styles.carImagePlaceholder
                    }
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
                  onPress={(event) => {
                    event.stopPropagation();
                  }}
                >
                  <Ionicons
                    name="heart-outline"
                    size={20}
                    color="#17313C"
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

                <Text
                  style={styles.carDetails}
                >
                  {car.vehicleType || "Car"}
                  {" · "}
                  {car.transmission ||
                    "Transmission N/A"}
                </Text>

                <View style={styles.priceRow}>
                  <Text style={styles.price}>
                    RM {dailyRate.toFixed(2)}
                  </Text>

                  <Text style={styles.perDay}>
                    {" "}
                    / day
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
      <CarFilterModal
        visible={filterVisible}
        cars={cars}
        filters={filters}
        onClose={() =>
          setFilterVisible(false)
        }
        onApply={(nextFilters) =>
          setFilters(nextFilters)
        }
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

});