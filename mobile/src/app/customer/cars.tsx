import { Ionicons } from "@expo/vector-icons";

import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  getPublicCars,
} from "../../services/carApi";

import {
  CarFilters,
  DEFAULT_CAR_FILTERS,
} from "../../components/CarFilterModal";

import {
  getSavedListingIds,
  removeSavedListing,
  saveListing,
} from "../../services/customerApi";
import { logger } from "@/utils/logger";

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

export default function CarsScreen() {
  const router =
    useRouter();

  const params =
  useLocalSearchParams<{
    city?: string;
    from?: string;
    ft?: string;
    to?: string;
    tt?: string;
    search?: string;
    filters?: string;
  }>();

  const [cars, setCars] =
    useState<any[]>([]);

  const [loading, setLoading] =
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

  const [searchText, setSearchText] =
  useState(params.search || "");

  const [activeFilters, setActiveFilters] =
  useState<CarFilters>(() => {
    try {
      const parsed = params.filters
        ? JSON.parse(params.filters)
        : {};

      return {
        ...DEFAULT_CAR_FILTERS,
        ...parsed,
      };
    } catch {
      return DEFAULT_CAR_FILTERS;
    }
  });

  const [
  selectedVehicleType,
  setSelectedVehicleType,
    ] = useState(
    activeFilters.vehicleTypes[0] || "All"
    );

  useEffect(() => {
    const loadCars =
      async () => {
        try {
          setLoading(true);

          const data =
            await getPublicCars();

          setCars(
            Array.isArray(
              data?.items
            )
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
          setLoading(false);
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
              .filter(
                (type) =>
                  type &&
                  normalizeVehicleType(
                    type
                  ) !== "car"
              )
          )
        );

      const orderedTypes =
        VEHICLE_TYPE_ORDER.filter(
          (type) =>
            availableTypes.some(
              (
                availableType
              ) =>
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
  const search = searchText.trim().toLowerCase();

  const result = cars.filter((car) => {
    const carName =
      car.name ||
      `${car.vehicleMake || ""} ${car.vehicleModel || ""}`;

    const searchMatch =
      !search ||
      String(carName).toLowerCase().includes(search) ||
      String(car.vehicleMake || "").toLowerCase().includes(search) ||
      String(car.vehicleModel || "").toLowerCase().includes(search);

    if (!searchMatch) return false;

    if (
      params.city &&
      String(car.branch?.city || "").toLowerCase() !==
        String(params.city).toLowerCase()
    ) {
      return false;
    }

    const selectedTypes =
      selectedVehicleType === "All"
        ? []
        : [selectedVehicleType];

    if (
      selectedTypes.length &&
      !selectedTypes.some(
        (type) =>
          normalizeVehicleType(type) ===
          normalizeVehicleType(car.vehicleType)
      )
    ) {
      return false;
    }

    if (activeFilters.seats.length) {
      const minimumSeats = Math.min(
        ...activeFilters.seats.map(Number)
      );

      if (Number(car.seats || 0) < minimumSeats) {
        return false;
      }
    }

    if (
      activeFilters.transmissions.length &&
      !activeFilters.transmissions.includes(
        car.transmission
      )
    ) {
      return false;
    }

    if (
      activeFilters.fuels.length &&
      !activeFilters.fuels.includes(car.fuelType)
    ) {
      return false;
    }

    if (
      activeFilters.drives.length &&
      !activeFilters.drives.includes(car.driveType)
    ) {
      return false;
    }

    if (
      activeFilters.brands.length &&
      !activeFilters.brands.includes(car.vehicleMake)
    ) {
      return false;
    }

    if (
      activeFilters.operators.length &&
      !activeFilters.operators.includes(
        String(car.operator?.id)
      )
    ) {
      return false;
    }

    if (activeFilters.refunds.length) {
      const refundType =
        car.booking?.refundRule?.type === "PARTIAL"
          ? "partial"
          : "none";

      if (!activeFilters.refunds.includes(refundType)) {
        return false;
      }
    }

    const dailyRate =
      Number(car.booking?.dailyRateSen || 0) / 100;

    if (
      activeFilters.priceMin &&
      dailyRate < Number(activeFilters.priceMin)
    ) {
      return false;
    }

    if (
      activeFilters.priceMax &&
      dailyRate > Number(activeFilters.priceMax)
    ) {
      return false;
    }

    return true;
  });

  switch (activeFilters.sort) {
    case "daily":
      result.sort(
        (a, b) =>
          Number(a.booking?.dailyRateSen || 0) -
          Number(b.booking?.dailyRateSen || 0)
      );
      break;

    case "payable":
      result.sort((a, b) => {
        const aPayable =
          Number(a.booking?.dailyRateSen || 0) *
          Number(a.booking?.downPaymentPct || 0);

        const bPayable =
          Number(b.booking?.dailyRateSen || 0) *
          Number(b.booking?.downPaymentPct || 0);

        return aPayable - bPayable;
      });
      break;

    case "seats":
      result.sort(
        (a, b) =>
          Number(a.seats || 0) - Number(b.seats || 0)
      );
      break;

    case "recent":
      result.sort(
        (a, b) =>
          new Date(b.createdAt).getTime() -
          new Date(a.createdAt).getTime()
      );
      break;
  }

  return result;
}, [
  cars,
  searchText,
  selectedVehicleType,
  activeFilters,
  params.city,
]);


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

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <View
        style={
          styles.header
        }
      >
        <Pressable
          style={
            styles.headerButton
          }
          onPress={() =>
            router.back()
          }
        >
          <Ionicons
            name="chevron-back"
            size={22}
            color="#17313C"
          />
        </Pressable>

        <View
          style={
            styles.headerText
          }
        >
          <Text
            style={
              styles.title
            }
          >
            Search Results
          </Text>

          <Text
            style={
              styles.subtitle
            }
          >
            Browse available vehicles
          </Text>
        </View>

        <View
          style={
            styles.headerSpacer
          }
        />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.content
        }
      >
        <View
          style={
            styles.searchBox
          }
        >
          <Ionicons
            name="search-outline"
            size={20}
            color="#81939C"
          />

          <TextInput
            value={
              searchText
            }
            onChangeText={
              setSearchText
            }
            placeholder="Search cars or brands..."
            placeholderTextColor="#91A2A9"
            style={
              styles.searchInput
            }
          />
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.categories
          }
        >
          {vehicleTypes.map(
            (type) => {
              const selected =
                selectedVehicleType ===
                type;

              return (
                <Pressable
                  key={type}
                  style={[
                    styles.category,

                    selected &&
                      styles.categorySelected,
                  ]}
                  onPress={() =>
                    setSelectedVehicleType(
                      type
                    )
                  }
                >
                  <Text
                    style={[
                      styles.categoryText,

                      selected &&
                        styles.categoryTextSelected,
                    ]}
                  >
                    {type}
                  </Text>
                </Pressable>
              );
            }
          )}
        </ScrollView>

        <View
          style={
            styles.resultHeader
          }
        >
          <Text
            style={
              styles.resultTitle
            }
          >
            Available Cars
          </Text>

          <Text
            style={
              styles.resultCount
            }
          >
            {
              filteredCars.length
            }{" "}
            vehicles
          </Text>
        </View>

        {loading ? (
          <View
            style={
              styles.loading
            }
          >
            <ActivityIndicator
              size="large"
              color="#07869B"
            />

            <Text
              style={
                styles.loadingText
              }
            >
              Loading cars...
            </Text>
          </View>
        ) : filteredCars.length ===
          0 ? (
          <View
            style={
              styles.emptyCard
            }
          >
            <Ionicons
              name="car-outline"
              size={36}
              color="#81939C"
            />

            <Text
              style={
                styles.emptyTitle
              }
            >
              No cars found
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              Try another search or vehicle type.
            </Text>
          </View>
        ) : (
          <View
            style={
              styles.carGrid
            }
          >
            {filteredCars.map(
              (car) => {
                const imageUrl =
                  car.images?.[0]
                    ?.imageUrl;

                const dailyRate =
                  Number(
                    car.booking
                      ?.dailyRateSen ||
                      0
                  ) / 100;

                return (
                  <Pressable
                    key={
                      car.id
                    }
                    style={({
                      pressed,
                    }) => [
                      styles.carCard,

                      pressed && {
                        opacity: 0.85,
                      },
                    ]}
                    onPress={() =>
                      router.push({
                        pathname:
                          "/customer/car-details",

                        params: {
                          id: String(
                            car.id
                          ),

                          city:
                            params.city ||
                            "",

                          from:
                            params.from ||
                            "",

                          ft:
                            params.ft ||
                            "",

                          to:
                            params.to ||
                            "",

                          tt:
                            params.tt ||
                            "",
                        },
                      })
                    }
                  >
                    <View
                      style={
                        styles.imageWrapper
                      }
                    >
                      {imageUrl ? (
                        <Image
                          source={{
                            uri: imageUrl,
                          }}
                          style={
                            styles.carImage
                          }
                          resizeMode="cover"
                        />
                      ) : (
                        <View
                          style={
                            styles.imagePlaceholder
                          }
                        >
                          <Ionicons
                            name="car-sport-outline"
                            size={42}
                            color="#91A5AD"
                          />
                        </View>
                      )}

                      <Pressable
                        style={styles.heartButton}
                        disabled={
                            savingListingId ===
                            Number(car.id)
                        }
                        onPress={(event) => {
                            event.stopPropagation();

                            handleToggleSaved(
                            Number(car.id)
                            );
                        }}
                        >
                        <Ionicons
                            name={
                            savedListingIds.has(
                                Number(car.id)
                            )
                                ? "heart"
                                : "heart-outline"
                            }
                            size={20}
                            color={
                            savedListingIds.has(
                                Number(car.id)
                            )
                                ? "#E84B4B"
                                : "#17313C"
                            }
                        />
                        </Pressable>
                    </View>

                    <View
                      style={
                        styles.carInfo
                      }
                    >
                      <Text
                        style={
                          styles.carName
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {car.name ||
                          `${car.vehicleMake || ""} ${
                            car.vehicleModel ||
                            ""
                          }`.trim()}
                      </Text>

                      <Text
                        style={
                          styles.carMeta
                        }
                        numberOfLines={
                          1
                        }
                      >
                        {car.vehicleType ||
                          "Car"}
                        {" · "}
                        {car.transmission ||
                          "N/A"}
                      </Text>

                      <View
                        style={
                          styles.priceRow
                        }
                      >
                        <Text
                          style={
                            styles.price
                          }
                        >
                          RM{" "}
                          {dailyRate.toFixed(
                            2
                          )}
                        </Text>

                        <Text
                          style={
                            styles.perDay
                          }
                        >
                          {" "}
                          / day
                        </Text>
                      </View>
                    </View>
                  </Pressable>
                );
              }
            )}
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        "#F7FAFB",
    },

    header: {
      paddingHorizontal: 18,
      paddingVertical: 14,
      flexDirection: "row",
      alignItems: "center",
      backgroundColor:
        "#F7FAFB",
    },

    headerButton: {
      width: 44,
      height: 44,
      borderRadius: 15,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E4EBED",
      alignItems: "center",
      justifyContent:
        "center",
    },

    headerText: {
      flex: 1,
      alignItems: "center",
    },

    headerSpacer: {
      width: 44,
    },

    title: {
      color: "#17313C",
      fontSize: 18,
      fontWeight: "900",
    },

    subtitle: {
      marginTop: 2,
      color: "#8799A1",
      fontSize: 10,
    },

    content: {
      paddingHorizontal: 18,
      paddingBottom: 45,
    },

    searchBox: {
      height: 52,
      borderRadius: 18,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E2E9EC",
      flexDirection: "row",
      alignItems: "center",
      paddingHorizontal: 15,
      gap: 10,
    },

    searchInput: {
      flex: 1,
      color: "#17313C",
      fontSize: 12,
    },

    categories: {
      gap: 8,
      paddingVertical: 15,
    },

    category: {
      paddingHorizontal: 15,
      paddingVertical: 9,
      borderRadius: 14,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#DFE8EB",
    },

    categorySelected: {
      backgroundColor:
        "#07869B",
      borderColor:
        "#07869B",
    },

    categoryText: {
      color: "#526871",
      fontSize: 11,
      fontWeight: "800",
    },

    categoryTextSelected: {
      color: "#FFFFFF",
    },

    resultHeader: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginBottom: 13,
    },

    resultTitle: {
      color: "#17313C",
      fontSize: 16,
      fontWeight: "900",
    },

    resultCount: {
      color: "#81939C",
      fontSize: 10,
      fontWeight: "700",
    },

    loading: {
      paddingVertical: 70,
      alignItems: "center",
    },

    loadingText: {
      marginTop: 10,
      color: "#81939C",
      fontSize: 11,
    },

    emptyCard: {
      paddingVertical: 50,
      alignItems: "center",
      backgroundColor:
        "#FFFFFF",
      borderRadius: 22,
      borderWidth: 1,
      borderColor:
        "#E3EAED",
    },

    emptyTitle: {
      marginTop: 10,
      color: "#17313C",
      fontSize: 15,
      fontWeight: "900",
    },

    emptyText: {
      marginTop: 5,
      color: "#81939C",
      fontSize: 10,
    },

    carGrid: {
    flexDirection: "column",
    gap: 12,
    },

    carCard: {
    width: "100%",
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFFFFF",
    borderRadius: 18,
    borderWidth: 1,
    borderColor: "#E3EAED",
    overflow: "hidden",
    minHeight: 125,
    },

    imageWrapper: {
    width: 125,
    height: 125,
    position: "relative",
    backgroundColor: "#EEF3F5",
    },

    carImage: {
      width: "100%",
      height: "100%",
    },

    imagePlaceholder: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
    },

    heartButton: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 32,
    height: 32,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.94)",
    alignItems: "center",
    justifyContent: "center",
    },

    carInfo: {
    flex: 1,
    padding: 13,
    justifyContent: "center",
    },

    carName: {
    color: "#17313C",
    fontSize: 14,
    fontWeight: "900",
    },

    carMeta: {
      marginTop: 4,
      color: "#81939C",
      fontSize: 9,
    },

    priceRow: {
      flexDirection: "row",
      alignItems: "baseline",
      marginTop: 9,
    },

    price: {
      color: "#07869B",
      fontSize: 13,
      fontWeight: "900",
    },

    perDay: {
      color: "#8C9BA2",
      fontSize: 8,
    },
  });