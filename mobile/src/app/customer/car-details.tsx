import { Ionicons } from "@expo/vector-icons";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { StatusBar } from "expo-status-bar";
import {
  ActivityIndicator,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  getPublicCarById,
  quotePublicCar,
} from "../../services/carApi";

export default function CarDetails() {
  const router = useRouter();

  const params =
    useLocalSearchParams<{
      id?: string;
      city?: string;

      from?: string;
      ft?: string;

      to?: string;
      tt?: string;
    }>();

  const listingId = params.id;

  const [car, setCar] =
    useState<any | null>(null);

  const [quote, setQuote] =
    useState<any | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [quoteLoading, setQuoteLoading] =
    useState(false);

  const [error, setError] =
    useState("");

  /*
   * ----------------------------------------
   * Load real car details
   * ----------------------------------------
   */
  useEffect(() => {
    if (!listingId) {
      setLoading(false);
      setError("Car listing ID is missing.");
      return;
    }

    let active = true;

    const loadCar = async () => {
      try {
        setLoading(true);
        setError("");

        const data =
          await getPublicCarById(
            listingId
          );

        if (!active) return;

        setCar(data);
      } catch (err: any) {
        if (!active) return;

        setError(
          err?.message ||
            "Unable to load car details."
        );
      } finally {
        if (active) {
          setLoading(false);
        }
      }
    };

    loadCar();

    return () => {
      active = false;
    };
  }, [listingId]);

  /*
   * ----------------------------------------
   * Load real server quote
   * ----------------------------------------
   */
  useEffect(() => {
    if (
      !listingId ||
      !params.from ||
      !params.to
    ) {
      setQuote(null);
      return;
    }

    let active = true;

    const loadQuote = async () => {
      try {
        setQuoteLoading(true);

        const data =
          await quotePublicCar(
            listingId,
            {
              from: params.from,

              ft:
                params.ft ||
                "10:00",

              to: params.to,

              tt:
                params.tt ||
                "10:00",

              cdw: false,

              addOns: {},
            }
          );

        if (!active) return;

        setQuote(data);
      } catch (err) {
        console.log(
          "Failed to load car quote:",
          err
        );

        if (active) {
          setQuote(null);
        }
      } finally {
        if (active) {
          setQuoteLoading(false);
        }
      }
    };

    loadQuote();

    return () => {
      active = false;
    };
  }, [
    listingId,
    params.from,
    params.ft,
    params.to,
    params.tt,
  ]);

  /*
   * ----------------------------------------
   * Helpers
   * ----------------------------------------
   */

  const formatMoney = (
    sen?: number | null
  ) => {
    if (
      sen === undefined ||
      sen === null
    ) {
      return "—";
    }

    return `RM ${(
      Number(sen) / 100
    ).toFixed(2)}`;
  };

  const formatDate = (
    date?: string,
    time?: string
  ) => {
    if (!date) {
      return "Not selected";
    }

    const dateObject =
      new Date(
        `${date}T12:00:00`
      );

    const formatted =
      dateObject.toLocaleDateString(
        "en-MY",
        {
          day: "2-digit",
          month: "short",
          year: "numeric",
        }
      );

    return `${formatted} · ${
      time || "10:00"
    }`;
  };

  const rentalDays = useMemo(() => {
    if (
      !params.from ||
      !params.to
    ) {
      return 0;
    }

    const start = new Date(
      `${params.from}T${
        params.ft || "10:00"
      }:00`
    );

    const end = new Date(
      `${params.to}T${
        params.tt || "10:00"
      }:00`
    );

    const difference =
      end.getTime() -
      start.getTime();

    if (difference <= 0) {
      return 0;
    }

    return Math.max(
      1,
      Math.ceil(
        difference /
          (1000 *
            60 *
            60 *
            24)
      )
    );
  }, [
    params.from,
    params.ft,
    params.to,
    params.tt,
  ]);

  /*
   * ----------------------------------------
   * Real car fields
   * ----------------------------------------
   */

  const carName =
    car?.name ||
    [
      car?.vehicleMake,
      car?.vehicleModel,
    ]
      .filter(Boolean)
      .join(" ") ||
    "Car";

  const primaryImage =
    car?.images?.find(
      (image: any) =>
        image.isPrimary
    )?.imageUrl ||
    car?.images?.[0]?.imageUrl ||
    null;

  const dailyRateSen =
    car?.booking?.dailyRateSen;

  const quoteData =
  quote?.quote;

  const totalSen =
  quoteData?.totalSen;

  const depositSen =
  quoteData?.depositSen;

  const balanceSen =
  quoteData?.balanceSen;

  const depositPct =
  quoteData?.depositPct ??
  car?.booking?.downPaymentPct;

  const displayRentalDays =
  quoteData?.days ??
  rentalDays;

  /*
   * ----------------------------------------
   * Request booking
   * ----------------------------------------
   */

  const handleRequestBooking = () => {
  router.push({
    pathname:
      "/customer/booking-request",
    params: {
      listingId:
        String(listingId),

      city:
        params.city || "",

      from:
        params.from || "",

      ft:
        params.ft || "10:00",

      to:
        params.to || "",

      tt:
        params.tt || "10:00",
    },
  });
};

  /*
   * ----------------------------------------
   * Loading
   * ----------------------------------------
   */

  if (loading) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <StatusBar style="dark" />

        <View
          style={
            styles.centerState
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
            Loading car details...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  /*
   * ----------------------------------------
   * Error
   * ----------------------------------------
   */

  if (error || !car) {
    return (
      <SafeAreaView
        style={styles.safeArea}
      >
        <StatusBar style="dark" />

        <View
          style={
            styles.centerState
          }
        >
          <Ionicons
            name="alert-circle-outline"
            size={42}
            color="#C94B4B"
          />

          <Text
            style={
              styles.errorTitle
            }
          >
            Unable to load car
          </Text>

          <Text
            style={
              styles.errorMessage
            }
          >
            {error ||
              "This car is currently unavailable."}
          </Text>

          <Pressable
            style={
              styles.backButton
            }
            onPress={() =>
              router.back()
            }
          >
            <Text
              style={
                styles.backButtonText
              }
            >
              Go Back
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={styles.safeArea}
    >
      <StatusBar style="dark" />

      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        contentContainerStyle={
          styles.scrollContent
        }
      >
        {/* Header */}
        <View style={styles.header}>
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

          <Text
            style={
              styles.headerTitle
            }
          >
            Car Details
          </Text>

          <Pressable
            style={
              styles.headerButton
            }
          >
            <Ionicons
              name="heart-outline"
              size={21}
              color="#07869B"
            />
          </Pressable>
        </View>

        {/* Real Car Image */}
        <View
          style={styles.imageCard}
        >
          {primaryImage ? (
            <Image
              source={{
                uri: primaryImage,
              }}
              style={styles.carImage}
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
                size={58}
                color="#9AAEB5"
              />

              <Text
                style={
                  styles.imagePlaceholderText
                }
              >
                No vehicle image
              </Text>
            </View>
          )}

          {car.vehicleType &&
          car.vehicleType !==
            "Car" ? (
            <View
              style={
                styles.vehicleTypeBadge
              }
            >
              <Text
                style={
                  styles.vehicleTypeText
                }
              >
                {car.vehicleType}
              </Text>
            </View>
          ) : null}
        </View>

        {/* Real Vehicle Details */}
        <View
          style={
            styles.infoSection
          }
        >
          <Text
            style={styles.carName}
          >
            {carName}
          </Text>

          {car.operator
            ?.companyName ? (
            <View
              style={
                styles.operatorRow
              }
            >
              <Ionicons
                name="business-outline"
                size={15}
                color="#789098"
              />

              <Text
                style={
                  styles.operatorText
                }
              >
                {
                  car.operator
                    .companyName
                }
              </Text>

              {car.operator
                ?.verified ? (
                <Ionicons
                  name="checkmark-circle"
                  size={15}
                  color="#07869B"
                />
              ) : null}
            </View>
          ) : null}

          <View style={styles.tags}>
            {car.vehicleType &&
            car.vehicleType !==
              "Car" ? (
              <View style={styles.tag}>
                <Text
                  style={
                    styles.tagText
                  }
                >
                  {car.vehicleType}
                </Text>
              </View>
            ) : null}

            {car.transmission ? (
              <View style={styles.tag}>
                <Text
                  style={
                    styles.tagText
                  }
                >
                  {car.transmission ===
                  "AUTOMATIC"
                    ? "Automatic"
                    : car.transmission ===
                        "MANUAL"
                      ? "Manual"
                      : car.transmission}
                </Text>
              </View>
            ) : null}

            {car.seats ? (
              <View style={styles.tag}>
                <Text
                  style={
                    styles.tagText
                  }
                >
                  {car.seats} Seats
                </Text>
              </View>
            ) : null}

            {car.fuelType ? (
              <View style={styles.tag}>
                <Text
                  style={
                    styles.tagText
                  }
                >
                  {car.fuelType}
                </Text>
              </View>
            ) : null}

            {car.driveType ? (
              <View style={styles.tag}>
                <Text
                  style={
                    styles.tagText
                  }
                >
                  {car.driveType}
                </Text>
              </View>
            ) : null}
          </View>

          <View
            style={styles.priceRow}
          >
            <Text
              style={styles.price}
            >
              {formatMoney(
                dailyRateSen
              )}
            </Text>

            <Text
              style={styles.perDay}
            >
              {" "}
              / day
            </Text>
          </View>
        </View>

        {/* STEP 7 — REAL TRIP */}
        {params.from &&
        params.to ? (
          <View
            style={styles.section}
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Your Trip
            </Text>

            {/* Location */}
            <View
              style={styles.detailRow}
            >
              <View
                style={
                  styles.detailIcon
                }
              >
                <Ionicons
                  name="location-outline"
                  size={20}
                  color="#07869B"
                />
              </View>

              <View
                style={
                  styles.detailContent
                }
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Pick-up Location
                </Text>

                <Text
                  style={
                    styles.detailValue
                  }
                >
                  {car.branch
                    ?.name
                    ? `${car.branch.name}${
                        car.branch
                          ?.city
                          ? `, ${car.branch.city}`
                          : ""
                      }`
                    : params.city
                      ? `${params.city}, Malaysia`
                      : "Operator branch"}
                </Text>

                {car.branch
                  ?.address ? (
                  <Text
                    style={
                      styles.detailSubValue
                    }
                  >
                    {
                      car.branch
                        .address
                    }
                  </Text>
                ) : null}
              </View>
            </View>

            {/* Pickup */}
            <View
              style={styles.detailRow}
            >
              <View
                style={
                  styles.detailIcon
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color="#07869B"
                />
              </View>

              <View
                style={
                  styles.detailContent
                }
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Pick-up Date & Time
                </Text>

                <Text
                  style={
                    styles.detailValue
                  }
                >
                  {formatDate(
                    params.from,
                    params.ft
                  )}
                </Text>
              </View>
            </View>

            {/* Return */}
            <View
              style={styles.detailRow}
            >
              <View
                style={
                  styles.detailIcon
                }
              >
                <Ionicons
                  name="calendar-outline"
                  size={20}
                  color="#07869B"
                />
              </View>

              <View
                style={
                  styles.detailContent
                }
              >
                <Text
                  style={
                    styles.detailLabel
                  }
                >
                  Return Date & Time
                </Text>

                <Text
                  style={
                    styles.detailValue
                  }
                >
                  {formatDate(
                    params.to,
                    params.tt
                  )}
                </Text>
              </View>
            </View>

            {rentalDays > 0 ? (
              <View
                style={
                  styles.durationBadge
                }
              >
                <Ionicons
                  name="time-outline"
                  size={16}
                  color="#07869B"
                />

                <Text
                  style={
                    styles.durationText
                  }
                >
                  Estimated rental
                  duration:{" "}
                  {displayRentalDays}{" "}
                  {displayRentalDays === 1
                    ? "day"
                    : "days"}
                </Text>
              </View>
            ) : null}
          </View>
        ) : (
          <View
            style={styles.section}
          >
            <Text
              style={
                styles.sectionTitle
              }
            >
              Your Trip
            </Text>

            <View
              style={
                styles.noTripCard
              }
            >
              <Ionicons
                name="calendar-outline"
                size={25}
                color="#07869B"
              />

              <View
                style={{ flex: 1 }}
              >
                <Text
                  style={
                    styles.noTripTitle
                  }
                >
                  Rental dates not
                  selected
                </Text>

                <Text
                  style={
                    styles.noTripText
                  }
                >
                  Go back and select
                  your pick-up and
                  return dates to get
                  an exact quote.
                </Text>
              </View>
            </View>
          </View>
        )}

        {/* Real Quote */}
        <View
          style={styles.section}
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Price Summary
          </Text>

          {quoteLoading ? (
            <View
              style={
                styles.quoteLoading
              }
            >
              <ActivityIndicator
                color="#07869B"
              />

              <Text
                style={
                  styles.quoteLoadingText
                }
              >
                Calculating exact
                price...
              </Text>
            </View>
          ) : quoteData ? (
            <>
              <View
                style={
                  styles.summaryRow
                }
              >
                <Text
                  style={
                    styles.summaryLabel
                  }
                >
                  Daily rate
                </Text>

                <Text
                  style={
                    styles.summaryValue
                  }
                >
                  {formatMoney(
                    dailyRateSen
                  )}
                </Text>
              </View>

              {rentalDays > 0 ? (
                <View
                  style={
                    styles.summaryRow
                  }
                >
                  <Text
                    style={
                      styles.summaryLabel
                    }
                  >
                    Rental duration
                  </Text>

                  <Text
                    style={
                      styles.summaryValue
                    }
                  >
                    {displayRentalDays}{" "}
                    {displayRentalDays === 1
                      ? "day"
                      : "days"}
                  </Text>
                </View>
              ) : null}

              <View
                style={styles.divider}
              />

              <View
                style={
                  styles.summaryRow
                }
              >
                <Text
                  style={
                    styles.totalLabel
                  }
                >
                  Total Rental
                </Text>

                <Text
                  style={
                    styles.totalValue
                  }
                >
                  {formatMoney(
                    totalSen
                  )}
                </Text>
              </View>

              {depositSen !==
              undefined ? (
                <View
                  style={
                    styles.paymentCard
                  }
                >
                  <View
                    style={
                      styles.paymentCardHeader
                    }
                  >
                    <View>
                      <Text
                        style={
                          styles.paymentCardLabel
                        }
                      >
                        Deposit
                        {depositPct
                          ? ` (${depositPct}%)`
                          : ""}
                      </Text>

                      <Text
                        style={
                          styles.paymentCardValue
                        }
                      >
                        {formatMoney(
                          depositSen
                        )}
                      </Text>
                    </View>

                    <Ionicons
                      name="wallet-outline"
                      size={23}
                      color="#07869B"
                    />
                  </View>

                  <View
                    style={
                      styles.paymentDivider
                    }
                  />

                  <View
                    style={
                      styles.paymentCardHeader
                    }
                  >
                    <View>
                      <Text
                        style={
                          styles.paymentCardLabel
                        }
                      >
                        Remaining
                        Balance
                      </Text>

                      <Text
                        style={
                          styles.paymentCardValueSmall
                        }
                      >
                        {formatMoney(
                          balanceSen
                        )}
                      </Text>
                    </View>
                  </View>
                </View>
              ) : null}

              <View
                style={
                  styles.quoteNotice
                }
              >
                <Ionicons
                  name="shield-checkmark-outline"
                  size={18}
                  color="#07869B"
                />

                <Text
                  style={
                    styles.quoteNoticeText
                  }
                >
                  Price calculated by
                  the BNPL server for
                  your selected rental
                  period.
                </Text>
              </View>
            </>
          ) : (
            <View
              style={
                styles.noQuoteCard
              }
            >
              <Ionicons
                name="information-circle-outline"
                size={21}
                color="#07869B"
              />

              <Text
                style={
                  styles.noQuoteText
                }
              >
                Select valid pick-up
                and return dates to
                view the exact rental
                quote.
              </Text>
            </View>
          )}
        </View>

        {/* Branch / Operator */}
        <View
          style={styles.section}
        >
          <Text
            style={
              styles.sectionTitle
            }
          >
            Rental Provider
          </Text>

          <View
            style={
              styles.providerRow
            }
          >
            <View
              style={
                styles.providerIcon
              }
            >
              <Ionicons
                name="business-outline"
                size={23}
                color="#07869B"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={
                  styles.providerName
                }
              >
                {car.operator
                  ?.companyName ||
                  "Rental Operator"}
              </Text>

              <Text
                style={
                  styles.providerLocation
                }
              >
                {[
                  car.branch?.name,
                  car.branch?.city,
                  car.branch?.state,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </Text>
            </View>

            {car.operator
              ?.verified ? (
              <Ionicons
                name="checkmark-circle"
                size={21}
                color="#07869B"
              />
            ) : null}
          </View>
        </View>
      </ScrollView>

      {/* Bottom Bar */}
      <View
        style={styles.bottomBar}
      >
        <View style={{ flex: 1 }}>
          <Text
            style={
              styles.bottomLabel
            }
          >
            {quote
              ? "Estimated Total"
              : "Daily Rate"}
          </Text>

          <Text
            style={
              styles.bottomPrice
            }
          >
            {quoteData
              ? formatMoney(
                  totalSen
                )
              : formatMoney(
                  dailyRateSen
                )}
          </Text>

          {quoteData &&
          depositSen !==
            undefined ? (
            <Text
              style={
                styles.bottomDeposit
              }
            >
              Deposit{" "}
              {formatMoney(
                depositSen
              )}{" "}
              after operator approval
            </Text>
          ) : null}
        </View>

        <Pressable
          disabled={
            !params.from ||
            !params.to ||
            !quoteData
          }
          style={({
            pressed,
          }) => [
            styles.bnplButton,

            (!params.from ||
              !params.to ||
              !quoteData) &&
              styles.bnplButtonDisabled,

            pressed &&
              params.from &&
              params.to &&
              quoteData && {
                opacity: 0.8,
              },
          ]}
          onPress={
            handleRequestBooking
          }
        >
          <Text
            style={
              styles.bnplButtonText
            }
          >
            Request Booking
          </Text>

          <Ionicons
            name="arrow-forward"
            size={18}
            color="#FFFFFF"
          />
        </Pressable>
      </View>
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

    scrollContent: {
      paddingHorizontal: 20,
      paddingTop: 18,
      paddingBottom: 150,
      width: "100%",
      maxWidth: 700,
      alignSelf: "center",
    },

    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      marginBottom: 18,
    },

    headerButton: {
      width: 44,
      height: 44,
      borderRadius: 14,
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor: "#E3EBEE",
      justifyContent: "center",
      alignItems: "center",
    },

    headerTitle: {
      fontSize: 18,
      fontWeight: "900",
      color: "#17313C",
    },

    centerState: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      paddingHorizontal: 30,
    },

    loadingText: {
      marginTop: 14,
      fontSize: 13,
      fontWeight: "700",
      color: "#71858D",
    },

    errorTitle: {
      marginTop: 15,
      fontSize: 18,
      fontWeight: "900",
      color: "#17313C",
    },

    errorMessage: {
      textAlign: "center",
      color: "#7C8E96",
      marginTop: 7,
      lineHeight: 19,
    },

    backButton: {
      marginTop: 20,
      paddingHorizontal: 22,
      paddingVertical: 13,
      backgroundColor:
        "#07869B",
      borderRadius: 14,
    },

    backButtonText: {
      color: "#FFFFFF",
      fontWeight: "800",
    },

    imageCard: {
      height: 260,
      borderRadius: 24,
      overflow: "hidden",
      backgroundColor:
        "#EAF1F3",
      position: "relative",
    },

    carImage: {
      width: "100%",
      height: "100%",
    },

    imagePlaceholder: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },

    imagePlaceholderText: {
      marginTop: 10,
      color: "#8A9DA5",
      fontSize: 12,
    },

    vehicleTypeBadge: {
      position: "absolute",
      left: 14,
      bottom: 14,
      backgroundColor:
        "rgba(255,255,255,0.94)",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 12,
    },

    vehicleTypeText: {
      color: "#17313C",
      fontSize: 11,
      fontWeight: "900",
    },

    infoSection: {
      marginTop: 22,
    },

    carName: {
      fontSize: 28,
      fontWeight: "900",
      color: "#17313C",
    },

    operatorRow: {
      flexDirection: "row",
      alignItems: "center",
      gap: 5,
      marginTop: 7,
    },

    operatorText: {
      color: "#789098",
      fontSize: 12,
      fontWeight: "700",
    },

    tags: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
      marginTop: 12,
    },

    tag: {
      backgroundColor:
        "#EDF4F6",
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 12,
    },

    tagText: {
      fontSize: 12,
      fontWeight: "700",
      color: "#51666F",
    },

    priceRow: {
      flexDirection: "row",
      alignItems: "flex-end",
      marginTop: 18,
    },

    price: {
      fontSize: 25,
      fontWeight: "900",
      color: "#0B5363",
    },

    perDay: {
      fontSize: 13,
      color: "#83949C",
      marginBottom: 4,
    },

    section: {
      backgroundColor:
        "#FFFFFF",
      borderWidth: 1,
      borderColor: "#E5ECEF",
      borderRadius: 22,
      padding: 18,
      marginTop: 22,
    },

    sectionTitle: {
      fontSize: 17,
      fontWeight: "900",
      color: "#17313C",
      marginBottom: 18,
    },

    detailRow: {
      flexDirection: "row",
      marginBottom: 18,
    },

    detailIcon: {
      width: 42,
      height: 42,
      borderRadius: 14,
      backgroundColor:
        "#E4F6F8",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    detailContent: {
      flex: 1,
    },

    detailLabel: {
      fontSize: 11,
      color: "#8999A1",
      marginBottom: 4,
    },

    detailValue: {
      fontSize: 14,
      fontWeight: "700",
      color: "#253D47",
      lineHeight: 20,
    },

    detailSubValue: {
      marginTop: 3,
      color: "#84969E",
      fontSize: 11,
      lineHeight: 16,
    },

    durationBadge: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      backgroundColor:
        "#EAF8FA",
      padding: 11,
      borderRadius: 13,
    },

    durationText: {
      color: "#55747C",
      fontSize: 11,
      fontWeight: "700",
    },

    noTripCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 12,
      backgroundColor:
        "#F1F8F9",
      padding: 14,
      borderRadius: 15,
    },

    noTripTitle: {
      color: "#17313C",
      fontSize: 12,
      fontWeight: "800",
    },

    noTripText: {
      color: "#7D9098",
      fontSize: 10,
      lineHeight: 15,
      marginTop: 3,
    },

    quoteLoading: {
      alignItems: "center",
      paddingVertical: 20,
      gap: 10,
    },

    quoteLoadingText: {
      color: "#7D9098",
      fontSize: 11,
    },

    summaryRow: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
      marginTop: 14,
    },

    summaryLabel: {
      color: "#6E818A",
      fontSize: 13,
    },

    summaryValue: {
      color: "#253D47",
      fontSize: 13,
      fontWeight: "700",
    },

    divider: {
      height: 1,
      backgroundColor:
        "#E7ECEF",
      marginTop: 18,
    },

    totalLabel: {
      fontSize: 15,
      fontWeight: "900",
      color: "#17313C",
    },

    totalValue: {
      fontSize: 20,
      fontWeight: "900",
      color: "#07869B",
    },

    paymentCard: {
      marginTop: 18,
      borderRadius: 17,
      backgroundColor:
        "#F0F9FA",
      padding: 15,
    },

    paymentCardHeader: {
      flexDirection: "row",
      justifyContent:
        "space-between",
      alignItems: "center",
    },

    paymentCardLabel: {
      color: "#6E858D",
      fontSize: 10,
      fontWeight: "700",
    },

    paymentCardValue: {
      color: "#07869B",
      fontSize: 21,
      fontWeight: "900",
      marginTop: 3,
    },

    paymentCardValueSmall: {
      color: "#17313C",
      fontSize: 16,
      fontWeight: "900",
      marginTop: 3,
    },

    paymentDivider: {
      height: 1,
      backgroundColor:
        "#D7E9EB",
      marginVertical: 13,
    },

    quoteNotice: {
      flexDirection: "row",
      alignItems: "center",
      gap: 8,
      marginTop: 16,
    },

    quoteNoticeText: {
      flex: 1,
      color: "#70858D",
      fontSize: 10,
      lineHeight: 15,
    },

    noQuoteCard: {
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      backgroundColor:
        "#F2F8F9",
      padding: 14,
      borderRadius: 14,
    },

    noQuoteText: {
      flex: 1,
      color: "#71868E",
      fontSize: 11,
      lineHeight: 17,
    },

    providerRow: {
      flexDirection: "row",
      alignItems: "center",
    },

    providerIcon: {
      width: 46,
      height: 46,
      borderRadius: 15,
      backgroundColor:
        "#E7F7F9",
      alignItems: "center",
      justifyContent: "center",
      marginRight: 12,
    },

    providerName: {
      color: "#17313C",
      fontSize: 14,
      fontWeight: "900",
    },

    providerLocation: {
      color: "#81939B",
      fontSize: 10,
      marginTop: 4,
    },

    bottomBar: {
      position: "absolute",
      bottom: 0,
      left: 0,
      right: 0,
      backgroundColor:
        "#FFFFFF",
      borderTopWidth: 1,
      borderTopColor: "#E3EAED",
      paddingHorizontal: 20,
      paddingTop: 14,
      paddingBottom: 18,
      flexDirection: "row",
      alignItems: "center",
      justifyContent:
        "space-between",
      gap: 10,
    },

    bottomLabel: {
      color: "#84959D",
      fontSize: 10,
    },

    bottomPrice: {
      color: "#17313C",
      fontSize: 21,
      fontWeight: "900",
      marginTop: 2,
    },

    bottomDeposit: {
      color: "#71868E",
      fontSize: 8,
      marginTop: 2,
    },

    bnplButton: {
      minHeight: 54,
      paddingHorizontal: 18,
      borderRadius: 16,
      backgroundColor:
        "#07869B",
      flexDirection: "row",
      gap: 7,
      alignItems: "center",
      justifyContent: "center",
    },

    bnplButtonDisabled: {
      backgroundColor:
        "#A8BEC3",
    },

    bnplButtonText: {
      color: "#FFFFFF",
      fontWeight: "800",
      fontSize: 13,
    },
  });