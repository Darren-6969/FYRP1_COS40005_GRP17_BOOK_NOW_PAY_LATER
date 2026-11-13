import { Ionicons } from "@expo/vector-icons";
import {
  useFocusEffect,
  useRouter,
} from "expo-router";

import {
  useCallback,
  useState,
} from "react";

import {
  ActivityIndicator,
  Image,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  getSavedListings,
  removeSavedListing,
} from "../../services/customerApi";
import { logger } from "@/utils/logger";

type SavedCar = {
  listingId: number;
  savedAt?: string;
  available?: boolean;

  car?: {
    title?: string;
    modelYear?: number;
    vehicleType?: string;
    seats?: number;
    transmission?: string;
    imageUrl?: string | null;
    dailyRateSen?: number;

    operator?: {
      id?: number;
      companyName?: string;
    };

    branch?: {
      name?: string;
      city?: string;
    };
  };
};

export default function SavedCarsScreen() {
  const router = useRouter();

  const [items, setItems] =
    useState<SavedCar[]>([]);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [
    removingId,
    setRemovingId,
  ] = useState<number | null>(
    null
  );

  const loadSavedCars =
    async (
      refresh = false
    ) => {
      try {
        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const data =
          await getSavedListings();

        setItems(
          Array.isArray(data?.items)
            ? data.items
            : []
        );
      } catch (error) {
        logger.debug(
          "Failed to load saved cars:",
          error
        );

        setItems([]);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    };

  useFocusEffect(
    useCallback(() => {
      loadSavedCars();
    }, [])
  );

  const handleRemove =
    async (
      listingId: number
    ) => {
      if (
        removingId ===
        listingId
      ) {
        return;
      }

      try {
        setRemovingId(
          listingId
        );

        await removeSavedListing(
          listingId
        );

        setItems(
          (current) =>
            current.filter(
              (item) =>
                item.listingId !==
                listingId
            )
        );
      } catch (error) {
        logger.debug(
          "Failed to remove saved car:",
          error
        );
      } finally {
        setRemovingId(null);
      }
    };

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <View style={styles.header}>
        <Pressable
          style={styles.headerButton}
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
          style={styles.headerText}
        >
          <Text
            style={styles.title}
          >
            Saved Cars
          </Text>

          <Text
            style={styles.subtitle}
          >
            Vehicles you saved for later
          </Text>
        </View>

        <View
          style={styles.headerSpacer}
        />
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color="#07869B"
          />

          <Text
            style={styles.loadingText}
          >
            Loading saved cars...
          </Text>
        </View>
      ) : (
        <ScrollView
          showsVerticalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.content
          }
          refreshControl={
            <RefreshControl
              refreshing={
                refreshing
              }
              onRefresh={() =>
                loadSavedCars(
                  true
                )
              }
            />
          }
        >
          {items.length === 0 ? (
            <View
              style={styles.emptyCard}
            >
              <View
                style={styles.emptyIcon}
              >
                <Ionicons
                  name="heart-outline"
                  size={32}
                  color="#07869B"
                />
              </View>

              <Text
                style={styles.emptyTitle}
              >
                No saved cars yet
              </Text>

              <Text
                style={styles.emptyText}
              >
                Tap the heart icon on a vehicle to save it here.
              </Text>

              <Pressable
                style={styles.browseButton}
                onPress={() =>
                  router.push(
                    "/customer/cars"
                  )
                }
              >
                <Text
                  style={
                    styles.browseButtonText
                  }
                >
                  Browse Cars
                </Text>
              </Pressable>
            </View>
          ) : (
            items.map((item) => {
              const car =
                item.car || {};

              const dailyRate =
                Number(
                  car.dailyRateSen ||
                    0
                ) / 100;

              return (
                <Pressable
                  key={
                    item.listingId
                  }
                  style={({
                    pressed,
                  }) => [
                    styles.carCard,

                    pressed &&
                      item.available !==
                        false && {
                        opacity: 0.85,
                      },
                  ]}
                  disabled={
                    item.available ===
                    false
                  }
                  onPress={() =>
                    router.push({
                      pathname:
                        "/customer/car-details",

                      params: {
                        id: String(
                          item.listingId
                        ),
                      },
                    })
                  }
                >
                  <View
                    style={
                      styles.imageWrapper
                    }
                  >
                    {car.imageUrl ? (
                      <Image
                        source={{
                          uri: car.imageUrl,
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
                          size={40}
                          color="#91A5AD"
                        />
                      </View>
                    )}

                    <Pressable
                      style={
                        styles.heartButton
                      }
                      disabled={
                        removingId ===
                        item.listingId
                      }
                      onPress={(
                        event
                      ) => {
                        event.stopPropagation();

                        handleRemove(
                          item.listingId
                        );
                      }}
                    >
                      <Ionicons
                        name="heart"
                        size={20}
                        color="#E84B4B"
                      />
                    </Pressable>

                    {item.available ===
                      false && (
                      <View
                        style={
                          styles.unavailableBadge
                        }
                      >
                        <Text
                          style={
                            styles.unavailableText
                          }
                        >
                          Unavailable
                        </Text>
                      </View>
                    )}
                  </View>

                  <View
                    style={styles.carInfo}
                  >
                    <Text
                      style={styles.carName}
                      numberOfLines={1}
                    >
                      {car.title ||
                        "Vehicle"}
                    </Text>

                    <Text
                      style={styles.carMeta}
                      numberOfLines={1}
                    >
                      {car.vehicleType ||
                        "Car"}

                      {car.transmission
                        ? ` · ${car.transmission}`
                        : ""}

                      {car.seats
                        ? ` · ${car.seats} seats`
                        : ""}
                    </Text>

                    {car.branch?.city ? (
                      <View
                        style={
                          styles.locationRow
                        }
                      >
                        <Ionicons
                          name="location-outline"
                          size={13}
                          color="#81939C"
                        />

                        <Text
                          style={
                            styles.locationText
                          }
                        >
                          {
                            car.branch
                              .city
                          }
                        </Text>
                      </View>
                    ) : null}

                    <View
                      style={styles.priceRow}
                    >
                      <Text
                        style={styles.price}
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
            })
          )}
        </ScrollView>
      )}
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

    center: {
      flex: 1,
      alignItems: "center",
      justifyContent:
        "center",
    },

    loadingText: {
      marginTop: 10,
      color: "#81939C",
      fontSize: 11,
    },

    content: {
      paddingHorizontal: 18,
      paddingBottom: 45,
    },

    emptyCard: {
      marginTop: 70,
      padding: 30,
      borderRadius: 24,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E3EAED",
      alignItems: "center",
    },

    emptyIcon: {
      width: 68,
      height: 68,
      borderRadius: 22,
      backgroundColor:
        "#E8F7F9",
      alignItems: "center",
      justifyContent:
        "center",
    },

    emptyTitle: {
      marginTop: 16,
      color: "#17313C",
      fontSize: 17,
      fontWeight: "900",
    },

    emptyText: {
      marginTop: 7,
      color: "#81939C",
      fontSize: 11,
      lineHeight: 17,
      textAlign: "center",
    },

    browseButton: {
      marginTop: 20,
      paddingHorizontal: 20,
      paddingVertical: 12,
      borderRadius: 14,
      backgroundColor:
        "#07869B",
    },

    browseButtonText: {
      color: "#FFFFFF",
      fontSize: 11,
      fontWeight: "900",
    },

    carCard: {
      marginBottom: 14,
      borderRadius: 22,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor:
        "#E3EAED",
      overflow: "hidden",
    },

    imageWrapper: {
      height: 185,
      backgroundColor:
        "#EEF3F5",
      position: "relative",
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
      top: 12,
      right: 12,
      width: 38,
      height: 38,
      borderRadius: 14,
      backgroundColor:
        "rgba(255,255,255,0.94)",
      alignItems: "center",
      justifyContent:
        "center",
    },

    unavailableBadge: {
      position: "absolute",
      left: 12,
      bottom: 12,
      paddingHorizontal: 10,
      paddingVertical: 6,
      borderRadius: 10,
      backgroundColor:
        "rgba(23,49,60,0.85)",
    },

    unavailableText: {
      color: "#FFFFFF",
      fontSize: 9,
      fontWeight: "800",
    },

    carInfo: {
      padding: 15,
    },

    carName: {
      color: "#17313C",
      fontSize: 15,
      fontWeight: "900",
    },

    carMeta: {
      marginTop: 5,
      color: "#81939C",
      fontSize: 10,
    },

    locationRow: {
      flexDirection: "row",
      alignItems: "center",
      marginTop: 9,
      gap: 4,
    },

    locationText: {
      color: "#81939C",
      fontSize: 10,
    },

    priceRow: {
      flexDirection: "row",
      alignItems: "baseline",
      marginTop: 12,
    },

    price: {
      color: "#07869B",
      fontSize: 16,
      fontWeight: "900",
    },

    perDay: {
      color: "#8C9BA2",
      fontSize: 9,
    },
  });