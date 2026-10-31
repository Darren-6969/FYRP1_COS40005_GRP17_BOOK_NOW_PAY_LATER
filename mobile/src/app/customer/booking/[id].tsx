import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} 
from "expo-router";

import { Ionicons } from "@expo/vector-icons";

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  useCallback,
  useState,
} from "react";

import {
  getCustomerBookingById,
} from "../../../services/customerApi";

type Payment = {
  id?: number;
  status?: string;
  amount?: number;

  downPaymentAmount?: number;
  finalPaymentAmount?: number;

  downPaymentStatus?: string;
  finalPaymentStatus?: string;

  downPaymentDueDate?: string;
  finalPaymentDueDate?: string;

  paidAmount?: number;
};

type PaymentSchedule = {
  id: number;
  type?: string;
  paymentPart?: string;
  amount?: number;
  dueAt?: string;
  status?: string;
};

type Operator = {
  id?: number;
  companyName?: string;
  email?: string;
  phone?: string;
};

type Booking = {
  id: number;

  bookingCode?: string;
  serviceName?: string;
  serviceType?: string;

  bookingDate?: string;
  pickupDate?: string;
  returnDate?: string;

  location?: string;

  totalAmount?: number;

  status?: string;

  createdAt?: string;

  operator?: Operator | null;

  payment?: Payment | null;

  paymentSchedule?: PaymentSchedule[];

  invoice?: any;
  receipt?: any;
};

function money(value?: number) {
  return `RM ${Number(value || 0).toFixed(2)}`;
}

function date(value?: string) {
  if (!value) return "-";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleDateString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

function dateTime(value?: string) {
  if (!value) return "-";

  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return "-";
  }

  return parsed.toLocaleString("en-MY", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function readableStatus(value?: string) {
  if (!value) return "UNKNOWN";

  return value.replaceAll("_", " ");
}

function getStatusAppearance(status?: string) {
  switch (status) {
    case "PENDING":
      return {
        background: "#FFF4D6",
        color: "#A86D00",
        icon: "time-outline" as const,
      };

    case "ACCEPTED":
    case "CONFIRMED":
    case "PENDING_PAYMENT":
      return {
        background: "#E6F7FA",
        color: "#07869B",
        icon: "checkmark-circle-outline" as const,
      };

    case "PAID":
    case "READY_FOR_PICKUP":
      return {
        background: "#E9F8EF",
        color: "#258552",
        icon: "checkmark-done-circle-outline" as const,
      };

    case "COMPLETED":
      return {
        background: "#EEF2F4",
        color: "#526973",
        icon: "flag-outline" as const,
      };

    case "REJECTED":
    case "CANCELLED":
    case "OVERDUE":
    case "EXPIRED":
      return {
        background: "#FDEDED",
        color: "#D14343",
        icon: "close-circle-outline" as const,
      };

    default:
      return {
        background: "#EEF2F4",
        color: "#657983",
        icon: "information-circle-outline" as const,
      };
  }
}

function InfoRow({
  icon,
  label,
  value,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <View style={styles.infoIcon}>
        <Ionicons
          name={icon}
          size={18}
          color="#07869B"
        />
      </View>

      <View style={styles.infoContent}>
        <Text style={styles.infoLabel}>
          {label}
        </Text>

        <Text style={styles.infoValue}>
          {value}
        </Text>
      </View>
    </View>
  );
}

export default function BookingDetailScreen() {
  const router = useRouter();

  const params =
    useLocalSearchParams<{ id: string }>();

  const bookingId = params.id;

  const [booking, setBooking] =
    useState<Booking | null>(null);

  const [loading, setLoading] =
    useState(true);

  const [refreshing, setRefreshing] =
    useState(false);

  const [error, setError] =
    useState("");

  const loadBooking = async (
    refresh = false
  ) => {
    if (!bookingId) return;

    try {
      setError("");

      if (refresh) {
        setRefreshing(true);
      } else {
        setLoading(true);
      }

      const data =
        await getCustomerBookingById(
          bookingId
        );

      setBooking(data);
    } catch (err: any) {
      setError(
        err?.message ||
          "Failed to load booking."
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      loadBooking();
    }, [bookingId])
  );

  if (loading) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.loadingContainer}>
          <ActivityIndicator
            size="large"
            color="#07869B"
          />

          <Text style={styles.loadingText}>
            Loading booking...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (!booking || error) {
    return (
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.errorContainer}>
          <Ionicons
            name="alert-circle-outline"
            size={48}
            color="#D14343"
          />

          <Text style={styles.errorTitle}>
            Booking unavailable
          </Text>

          <Text style={styles.errorText}>
            {error ||
              "Booking could not be found."}
          </Text>

          <Pressable
            style={styles.retryButton}
            onPress={() =>
              loadBooking()
            }
          >
            <Text
              style={
                styles.retryButtonText
              }
            >
              Try Again
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const appearance =
    getStatusAppearance(
      booking.status
    );

  const payment =
    booking.payment;

  const paidAmount =
    Number(
      payment?.paidAmount || 0
    );

  const total =
    Number(
      booking.totalAmount || 0
    );

  const progress =
    total > 0
      ? Math.min(
          (paidAmount / total) * 100,
          100
        )
      : 0;

  const canPay = [
    "ACCEPTED",
    "CONFIRMED",
    "PENDING_PAYMENT",
  ].includes(
    booking.status || ""
  );

  const waitingForOperator =
    booking.status === "PENDING";

  const paymentComplete = [
    "PAID",
    "READY_FOR_PICKUP",
    "COMPLETED",
  ].includes(
    booking.status || ""
  );

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        style={styles.screen}
        contentContainerStyle={
          styles.container
        }
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() =>
              loadBooking(true)
            }
          />
        }
      >
        {/* HEADER */}
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

          <Text style={styles.headerTitle}>
            Booking Details
          </Text>

          <Pressable
            style={styles.headerButton}
            onPress={() =>
              loadBooking(true)
            }
          >
            <Ionicons
              name="refresh-outline"
              size={20}
              color="#17313C"
            />
          </Pressable>
        </View>

        {/* HERO */}
        <View style={styles.heroCard}>
          <View style={styles.heroTop}>
            <View style={{ flex: 1 }}>
              <Text style={styles.heroLabel}>
                BOOKING REFERENCE
              </Text>

              <Text
                style={styles.bookingCode}
              >
                {booking.bookingCode ||
                  `BNPL-${booking.id}`}
              </Text>
            </View>

            <View
              style={[
                styles.statusBadge,
                {
                  backgroundColor:
                    appearance.background,
                },
              ]}
            >
              <Ionicons
                name={appearance.icon}
                size={15}
                color={
                  appearance.color
                }
              />

              <Text
                style={[
                  styles.statusText,
                  {
                    color:
                      appearance.color,
                  },
                ]}
              >
                {readableStatus(
                  booking.status
                )}
              </Text>
            </View>
          </View>

          <View style={styles.heroDivider} />

          <Text style={styles.carName}>
            {booking.serviceName ||
              "Car Rental"}
          </Text>

          <Text style={styles.carType}>
            {booking.serviceType ||
              "Vehicle Rental"}
          </Text>

          <View style={styles.priceRow}>
            <View>
              <Text style={styles.priceLabel}>
                Total Booking
              </Text>

              <Text style={styles.price}>
                {money(
                  booking.totalAmount
                )}
              </Text>
            </View>

            <View style={styles.createdArea}>
              <Text
                style={styles.priceLabel}
              >
                Booked On
              </Text>

              <Text
                style={styles.createdText}
              >
                {date(
                  booking.createdAt
                )}
              </Text>
            </View>
          </View>
        </View>

        {/* STATUS MESSAGE */}
        {waitingForOperator && (
          <View style={styles.pendingBanner}>
            <View
              style={
                styles.bannerIconCircle
              }
            >
              <Ionicons
                name="time-outline"
                size={22}
                color="#B37400"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={
                  styles.bannerTitle
                }
              >
                Waiting for operator
              </Text>

              <Text
                style={
                  styles.bannerText
                }
              >
                Your booking request has
                been submitted. Payment
                will become available after
                the operator accepts it.
              </Text>
            </View>
          </View>
        )}

        {paymentComplete && (
          <View style={styles.successBanner}>
            <View
              style={
                styles.successIconCircle
              }
            >
              <Ionicons
                name="checkmark"
                size={21}
                color="#21804D"
              />
            </View>

            <View style={{ flex: 1 }}>
              <Text
                style={
                  styles.successTitle
                }
              >
                Payment completed
              </Text>

              <Text
                style={
                  styles.successText
                }
              >
                Your payment has been
                recorded successfully.
              </Text>
            </View>
          </View>
        )}

        {/* RENTAL */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View
              style={
                styles.sectionIconBox
              }
            >
              <Ionicons
                name="car-sport-outline"
                size={20}
                color="#07869B"
              />
            </View>

            <Text
              style={styles.sectionTitle}
            >
              Rental Information
            </Text>
          </View>

          <InfoRow
            icon="calendar-outline"
            label="Pick-up"
            value={dateTime(
              booking.pickupDate
            )}
          />

          <InfoRow
            icon="calendar-number-outline"
            label="Return"
            value={dateTime(
              booking.returnDate
            )}
          />

          <InfoRow
            icon="location-outline"
            label="Location"
            value={
              booking.location || "-"
            }
          />
        </View>

        {/* PAYMENT */}
        <View style={styles.sectionCard}>
          <View style={styles.sectionHeader}>
            <View
              style={
                styles.sectionIconBox
              }
            >
              <Ionicons
                name="wallet-outline"
                size={20}
                color="#07869B"
              />
            </View>

            <Text
              style={styles.sectionTitle}
            >
              Payment Overview
            </Text>
          </View>

          {payment ? (
            <>
              <View
                style={
                  styles.paymentSummary
                }
              >
                <View>
                  <Text
                    style={
                      styles.paymentLabel
                    }
                  >
                    Paid
                  </Text>

                  <Text
                    style={
                      styles.paymentPaid
                    }
                  >
                    {money(paidAmount)}
                  </Text>
                </View>

                <View
                  style={{
                    alignItems: "flex-end",
                  }}
                >
                  <Text
                    style={
                      styles.paymentLabel
                    }
                  >
                    Total
                  </Text>

                  <Text
                    style={
                      styles.paymentTotal
                    }
                  >
                    {money(total)}
                  </Text>
                </View>
              </View>

              <View
                style={
                  styles.progressBackground
                }
              >
                <View
                  style={[
                    styles.progressBar,
                    {
                      width: `${progress}%`,
                    },
                  ]}
                />
              </View>

              <Text
                style={
                  styles.progressText
                }
              >
                {Math.round(progress)}%
                paid
              </Text>

              <View
                style={
                  styles.paymentBreakdown
                }
              >
                <View
                  style={
                    styles.paymentPart
                  }
                >
                  <Text
                    style={
                      styles.paymentPartLabel
                    }
                  >
                    Down Payment
                  </Text>

                  <Text
                    style={
                      styles.paymentPartAmount
                    }
                  >
                    {money(
                      payment.downPaymentAmount
                    )}
                  </Text>

                  <Text
                    style={
                      styles.paymentPartStatus
                    }
                  >
                    {readableStatus(
                      payment.downPaymentStatus
                    )}
                  </Text>
                </View>

                <View
                  style={
                    styles.paymentPart
                  }
                >
                  <Text
                    style={
                      styles.paymentPartLabel
                    }
                  >
                    Final Payment
                  </Text>

                  <Text
                    style={
                      styles.paymentPartAmount
                    }
                  >
                    {money(
                      payment.finalPaymentAmount
                    )}
                  </Text>

                  <Text
                    style={
                      styles.paymentPartStatus
                    }
                  >
                    {readableStatus(
                      payment.finalPaymentStatus
                    )}
                  </Text>
                </View>
              </View>
            </>
          ) : (
            <View
              style={
                styles.noPaymentBox
              }
            >
              <Ionicons
                name="hourglass-outline"
                size={22}
                color="#B27A00"
              />

              <Text
                style={
                  styles.noPaymentText
                }
              >
                Payment schedule will be
                created after operator
                approval.
              </Text>
            </View>
          )}
        </View>

        {/* PAYMENT SCHEDULE */}
        {booking.paymentSchedule &&
          booking.paymentSchedule
            .length > 0 && (
            <View
              style={styles.sectionCard}
            >
              <View
                style={
                  styles.sectionHeader
                }
              >
                <View
                  style={
                    styles.sectionIconBox
                  }
                >
                  <Ionicons
                    name="list-outline"
                    size={20}
                    color="#07869B"
                  />
                </View>

                <Text
                  style={
                    styles.sectionTitle
                  }
                >
                  Payment Schedule
                </Text>
              </View>

              {booking.paymentSchedule.map(
                (item, index) => (
                  <View
                    key={item.id}
                    style={
                      styles.scheduleRow
                    }
                  >
                    <View
                      style={
                        styles.scheduleIndex
                      }
                    >
                      <Text
                        style={
                          styles.scheduleIndexText
                        }
                      >
                        {index + 1}
                      </Text>
                    </View>

                    <View
                      style={{
                        flex: 1,
                      }}
                    >
                      <Text
                        style={
                          styles.scheduleName
                        }
                      >
                        {item.paymentPart ===
                        "DOWN_PAYMENT"
                          ? "Down Payment"
                          : item.paymentPart ===
                            "FINAL_PAYMENT"
                          ? "Final Payment"
                          : item.type ===
                            "LICENCE"
                          ? "Driving Licence"
                          : "Payment"}
                      </Text>

                      <Text
                        style={
                          styles.scheduleDate
                        }
                      >
                        Due{" "}
                        {date(item.dueAt)}
                      </Text>
                    </View>

                    <View
                      style={{
                        alignItems:
                          "flex-end",
                      }}
                    >
                      {item.amount ? (
                        <Text
                          style={
                            styles.scheduleAmount
                          }
                        >
                          {money(
                            item.amount
                          )}
                        </Text>
                      ) : null}

                      <Text
                        style={
                          styles.scheduleStatus
                        }
                      >
                        {readableStatus(
                          item.status
                        )}
                      </Text>
                    </View>
                  </View>
                )
              )}
            </View>
          )}

        {/* OPERATOR */}
        {booking.operator && (
          <View style={styles.sectionCard}>
            <View style={styles.sectionHeader}>
              <View
                style={
                  styles.sectionIconBox
                }
              >
                <Ionicons
                  name="business-outline"
                  size={20}
                  color="#07869B"
                />
              </View>

              <Text
                style={styles.sectionTitle}
              >
                Rental Operator
              </Text>
            </View>

            <Text
              style={
                styles.operatorName
              }
            >
              {booking.operator
                .companyName ||
                "Rental Operator"}
            </Text>

            {booking.operator.email ? (
              <InfoRow
                icon="mail-outline"
                label="Email"
                value={
                  booking.operator.email
                }
              />
            ) : null}

            {booking.operator.phone ? (
              <InfoRow
                icon="call-outline"
                label="Phone"
                value={
                  booking.operator.phone
                }
              />
            ) : null}
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* BOTTOM ACTION */}
      <View style={styles.bottomBar}>
        {canPay ? (
          <Pressable
            style={({ pressed }) => [
              styles.primaryButton,
              pressed && {
                opacity: 0.85,
              },
            ]}
            onPress={() =>
              router.push({
                pathname:
                  "/customer/checkout",
                params: {
                  bookingId:
                    String(
                      booking.id
                    ),
                },
              })
            }
          >
            <View>
              <Text
                style={
                  styles.primarySmall
                }
              >
                PAYMENT AVAILABLE
              </Text>

              <Text
                style={
                  styles.primaryText
                }
              >
                Continue to Payment
              </Text>
            </View>

            <Ionicons
              name="arrow-forward"
              size={21}
              color="#FFFFFF"
            />
          </Pressable>
        ) : (
          <View
            style={
              styles.bottomStatus
            }
          >
            <Ionicons
              name={
                waitingForOperator
                  ? "time-outline"
                  : paymentComplete
                  ? "checkmark-circle-outline"
                  : "information-circle-outline"
              }
              size={21}
              color="#07869B"
            />

            <Text
              style={
                styles.bottomStatusText
              }
            >
              {waitingForOperator
                ? "Waiting for operator approval"
                : paymentComplete
                ? "Booking payment completed"
                : readableStatus(
                    booking.status
                  )}
            </Text>
          </View>
        )}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F5F8F9",
  },

  screen: {
    flex: 1,
  },

  container: {
    width: "100%",
    maxWidth: 700,
    alignSelf: "center",
    paddingHorizontal: 18,
    paddingTop: 14,
  },

  loadingContainer: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
  },

  loadingText: {
    marginTop: 12,
    color: "#7D9098",
    fontSize: 13,
  },

  errorContainer: {
    flex: 1,
    padding: 30,
    alignItems: "center",
    justifyContent: "center",
  },

  errorTitle: {
    marginTop: 14,
    color: "#17313C",
    fontWeight: "900",
    fontSize: 21,
  },

  errorText: {
    color: "#81939C",
    fontSize: 13,
    marginTop: 8,
    textAlign: "center",
  },

  retryButton: {
    backgroundColor: "#07869B",
    borderRadius: 15,
    paddingHorizontal: 24,
    paddingVertical: 14,
    marginTop: 20,
  },

  retryButtonText: {
    color: "#FFFFFF",
    fontWeight: "900",
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
    borderRadius: 15,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E4EBED",
  },

  headerTitle: {
    color: "#17313C",
    fontSize: 17,
    fontWeight: "900",
  },

  heroCard: {
    backgroundColor: "#123A46",
    borderRadius: 26,
    padding: 21,
    marginBottom: 16,
  },

  heroTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },

  heroLabel: {
    color: "#8CB3BC",
    fontSize: 9,
    fontWeight: "900",
  },

  bookingCode: {
    color: "#FFFFFF",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 4,
  },

  statusBadge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    borderRadius: 12,
    paddingVertical: 7,
    paddingHorizontal: 10,
  },

  statusText: {
    fontSize: 9,
    fontWeight: "900",
  },

  heroDivider: {
    height: 1,
    backgroundColor: "#31545E",
    marginVertical: 18,
  },

  carName: {
    color: "#FFFFFF",
    fontSize: 21,
    fontWeight: "900",
  },

  carType: {
    color: "#A6C1C8",
    fontSize: 12,
    marginTop: 4,
  },

  priceRow: {
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "flex-end",
    marginTop: 24,
  },

  priceLabel: {
    color: "#8FB0B8",
    fontSize: 9,
  },

  price: {
    color: "#4FD1C5",
    fontWeight: "900",
    fontSize: 23,
    marginTop: 4,
  },

  createdArea: {
    alignItems: "flex-end",
  },

  createdText: {
    color: "#FFFFFF",
    fontWeight: "800",
    fontSize: 11,
    marginTop: 5,
  },

  pendingBanner: {
    backgroundColor: "#FFF7E5",
    borderRadius: 19,
    padding: 16,
    flexDirection: "row",
    gap: 13,
    marginBottom: 16,
  },

  bannerIconCircle: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#FFE9B2",
    alignItems: "center",
    justifyContent: "center",
  },

  bannerTitle: {
    color: "#825500",
    fontWeight: "900",
    fontSize: 13,
  },

  bannerText: {
    color: "#936F27",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  successBanner: {
    backgroundColor: "#ECF9F1",
    borderRadius: 19,
    padding: 16,
    flexDirection: "row",
    gap: 13,
    marginBottom: 16,
  },

  successIconCircle: {
    width: 43,
    height: 43,
    borderRadius: 14,
    backgroundColor: "#D8F1E2",
    alignItems: "center",
    justifyContent: "center",
  },

  successTitle: {
    color: "#21804D",
    fontWeight: "900",
    fontSize: 13,
  },

  successText: {
    color: "#4D8463",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 4,
  },

  sectionCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 23,
    padding: 18,
    marginBottom: 16,
    borderWidth: 1,
    borderColor: "#E6ECEE",
  },

  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
  },

  sectionIconBox: {
    width: 38,
    height: 38,
    borderRadius: 12,
    backgroundColor: "#EAF7F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 11,
  },

  sectionTitle: {
    color: "#17313C",
    fontSize: 15,
    fontWeight: "900",
  },

  infoRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 11,
  },

  infoIcon: {
    width: 34,
    height: 34,
    backgroundColor: "#F1F6F7",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },

  infoContent: {
    flex: 1,
    marginLeft: 12,
  },

  infoLabel: {
    color: "#8A9BA3",
    fontSize: 9,
  },

  infoValue: {
    color: "#28434D",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 3,
  },

  paymentSummary: {
    flexDirection: "row",
    justifyContent:
      "space-between",
  },

  paymentLabel: {
    color: "#8A9BA3",
    fontSize: 10,
  },

  paymentPaid: {
    color: "#07869B",
    fontSize: 20,
    fontWeight: "900",
    marginTop: 3,
  },

  paymentTotal: {
    color: "#17313C",
    fontSize: 18,
    fontWeight: "900",
    marginTop: 3,
  },

  progressBackground: {
    height: 9,
    backgroundColor: "#E8EEF0",
    borderRadius: 20,
    marginTop: 18,
    overflow: "hidden",
  },

  progressBar: {
    height: "100%",
    backgroundColor: "#07869B",
    borderRadius: 20,
  },

  progressText: {
    color: "#778B94",
    fontSize: 9,
    marginTop: 7,
  },

  paymentBreakdown: {
    flexDirection: "row",
    gap: 10,
    marginTop: 17,
  },

  paymentPart: {
    flex: 1,
    backgroundColor: "#F7FAFB",
    borderRadius: 15,
    padding: 13,
  },

  paymentPartLabel: {
    color: "#81939C",
    fontSize: 9,
  },

  paymentPartAmount: {
    color: "#17313C",
    fontWeight: "900",
    fontSize: 14,
    marginTop: 5,
  },

  paymentPartStatus: {
    color: "#07869B",
    fontWeight: "800",
    fontSize: 9,
    marginTop: 5,
  },

  noPaymentBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    backgroundColor: "#FFF8E8",
    padding: 14,
    borderRadius: 15,
  },

  noPaymentText: {
    flex: 1,
    color: "#886726",
    fontSize: 11,
    lineHeight: 17,
  },

  scheduleRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingVertical: 13,
    borderBottomWidth: 1,
    borderBottomColor: "#EDF1F3",
  },

  scheduleIndex: {
    width: 31,
    height: 31,
    borderRadius: 10,
    backgroundColor: "#EAF7F9",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 11,
  },

  scheduleIndexText: {
    color: "#07869B",
    fontWeight: "900",
    fontSize: 11,
  },

  scheduleName: {
    color: "#17313C",
    fontSize: 12,
    fontWeight: "900",
  },

  scheduleDate: {
    color: "#8A9BA3",
    fontSize: 9,
    marginTop: 4,
  },

  scheduleAmount: {
    color: "#17313C",
    fontWeight: "900",
    fontSize: 12,
  },

  scheduleStatus: {
    color: "#07869B",
    fontWeight: "800",
    fontSize: 9,
    marginTop: 4,
  },

  operatorName: {
    color: "#17313C",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 6,
  },

  bottomBar: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#FFFFFF",
    borderTopWidth: 1,
    borderTopColor: "#E2E9EB",
    paddingHorizontal: 18,
    paddingTop: 13,
    paddingBottom: 20,
  },

  primaryButton: {
    maxWidth: 700,
    width: "100%",
    alignSelf: "center",
    backgroundColor: "#07869B",
    borderRadius: 18,
    minHeight: 62,
    paddingHorizontal: 20,
    flexDirection: "row",
    justifyContent:
      "space-between",
    alignItems: "center",
  },

  primarySmall: {
    color: "#B9E8ED",
    fontSize: 8,
    fontWeight: "900",
  },

  primaryText: {
    color: "#FFFFFF",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 3,
  },

  bottomStatus: {
    maxWidth: 700,
    width: "100%",
    alignSelf: "center",
    minHeight: 56,
    backgroundColor: "#F1F7F8",
    borderRadius: 16,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 9,
  },

  bottomStatusText: {
    color: "#315762",
    fontWeight: "800",
    fontSize: 12,
  },
});