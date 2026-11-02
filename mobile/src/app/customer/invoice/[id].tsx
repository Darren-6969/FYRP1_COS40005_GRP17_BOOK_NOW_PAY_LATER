import { Ionicons } from "@expo/vector-icons";

import {
  useFocusEffect,
  useLocalSearchParams,
  useRouter,
} from "expo-router";

import {
  ActivityIndicator,
  Pressable,
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

function money(value?: number) {
  return `RM ${Number(
    value || 0
  ).toFixed(2)}`;
}

function date(value?: string) {
  if (!value) return "-";

  const parsed =
    new Date(value);

  if (
    Number.isNaN(
      parsed.getTime()
    )
  ) {
    return "-";
  }

  return parsed.toLocaleDateString(
    "en-MY",
    {
      day: "2-digit",
      month: "short",
      year: "numeric",
    }
  );
}

function readableStatus(
  value?: string
) {
  if (!value) {
    return "UNKNOWN";
  }

  return value.replaceAll(
    "_",
    " "
  );
}

export default function InvoiceDetailScreen() {
  const router =
    useRouter();

  const params =
    useLocalSearchParams<{
      id: string;
    }>();

  const bookingId =
    params.id;

  const [booking, setBooking] =
    useState<any>(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  const loadInvoice =
    async () => {
      if (!bookingId) {
        return;
      }

      try {
        setLoading(true);
        setError("");

        const data =
          await getCustomerBookingById(
            bookingId
          );

        setBooking(data);
      } catch (
        err: any
      ) {
        console.log(
          "Failed to load invoice:",
          err
        );

        setError(
          err?.message ||
            "Unable to load invoice."
        );
      } finally {
        setLoading(false);
      }
    };

  useFocusEffect(
    useCallback(() => {
      loadInvoice();
    }, [bookingId])
  );

  if (loading) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.center
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
            Loading invoice...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  if (
    error ||
    !booking
  ) {
    return (
      <SafeAreaView
        style={
          styles.safeArea
        }
      >
        <View
          style={
            styles.center
          }
        >
          <Ionicons
            name="alert-circle-outline"
            size={46}
            color="#D14343"
          />

          <Text
            style={
              styles.errorTitle
            }
          >
            Invoice unavailable
          </Text>

          <Text
            style={
              styles.errorText
            }
          >
            {error ||
              "Unable to load invoice."}
          </Text>

          <Pressable
            style={
              styles.retryButton
            }
            onPress={
              loadInvoice
            }
          >
            <Text
              style={
                styles.retryText
              }
            >
              Try Again
            </Text>
          </Pressable>
        </View>
      </SafeAreaView>
    );
  }

  const invoice =
    booking?.invoice;

  const payment =
    booking?.payment || {};

  const downPayment =
    Number(
      payment
        ?.downPaymentAmount ||
        0
    );

  const finalPayment =
    Number(
      payment
        ?.finalPaymentAmount ||
        0
    );

  const total =
    Number(
      booking
        ?.totalAmount ||
        payment?.amount ||
        0
    );

  const paid =
    Number(
      payment
        ?.paidAmount ||
        0
    );

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
          style={{
            flex: 1,
          }}
        >
          <Text
            style={
              styles.headerTitle
            }
          >
            Invoice
          </Text>

          <Text
            style={
              styles.headerSubtitle
            }
          >
            Payment document
          </Text>
        </View>
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
            styles.invoiceCard
          }
        >
          {/* BRAND */}
          <View
            style={
              styles.brandRow
            }
          >
            <View
              style={
                styles.logoBox
              }
            >
              <Text
                style={
                  styles.logoText
                }
              >
                BNPL
              </Text>
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.invoiceTitle
                }
              >
                INVOICE
              </Text>

              <Text
                style={
                  styles.invoiceSubtitle
                }
              >
                Book Now Pay Later
              </Text>
            </View>

            <View
              style={
                styles.paidBadge
              }
            >
              <Ionicons
                name="checkmark-circle"
                size={16}
                color="#258552"
              />

              <Text
                style={
                  styles.paidBadgeText
                }
              >
                {readableStatus(
                  invoice?.status ||
                    payment?.status
                )}
              </Text>
            </View>
          </View>

          <View
            style={
              styles.divider
            }
          />

          {/* IDENTIFIERS */}
          <View
            style={
              styles.metaGrid
            }
          >
            <InvoiceField
              label="Invoice No."
              value={
                invoice
                  ?.invoiceNo ||
                "-"
              }
            />

            <InvoiceField
              label="Booking Ref."
              value={
                booking
                  ?.bookingCode ||
                `BNPL-${booking?.id}`
              }
            />

            <InvoiceField
              label="Issued"
              value={date(
                invoice
                  ?.issuedAt
              )}
            />

            <InvoiceField
              label="Booking Date"
              value={date(
                booking
                  ?.bookingDate ||
                  booking
                    ?.createdAt
              )}
            />
          </View>

          {/* OPERATOR */}
          <View
            style={
              styles.section
            }
          >
            <Text
              style={
                styles.sectionLabel
              }
            >
              RENTAL OPERATOR
            </Text>

            <Text
              style={
                styles.operatorName
              }
            >
              {booking
                ?.operator
                ?.companyName ||
                "Rental Operator"}
            </Text>

            {booking
              ?.operator
              ?.email ? (
              <Text
                style={
                  styles.mutedText
                }
              >
                {
                  booking
                    .operator
                    .email
                }
              </Text>
            ) : null}
          </View>

          {/* CUSTOMER / BOOKING */}
          <View
            style={
              styles.section
            }
          >
            <Text
              style={
                styles.sectionLabel
              }
            >
              BOOKING DETAILS
            </Text>

            <InvoiceRow
              label="Service"
              value={
                booking
                  ?.serviceName ||
                "Car Rental"
              }
            />

            <InvoiceRow
              label="Pick-up"
              value={date(
                booking
                  ?.pickupDate
              )}
            />

            <InvoiceRow
              label="Return"
              value={date(
                booking
                  ?.returnDate
              )}
            />

            <InvoiceRow
              label="Location"
              value={
                booking
                  ?.location ||
                "-"
              }
            />
          </View>

          {/* PAYMENT BREAKDOWN */}
          <View
            style={
              styles.section
            }
          >
            <Text
              style={
                styles.sectionLabel
              }
            >
              PAYMENT BREAKDOWN
            </Text>

            <InvoiceRow
              label="Down Payment"
              value={money(
                downPayment
              )}
            />

            <InvoiceRow
              label="Final Payment"
              value={money(
                finalPayment
              )}
            />

            <View
              style={
                styles.line
              }
            />

            <InvoiceRow
              label="Paid"
              value={money(
                paid
              )}
              bold
            />

            <InvoiceRow
              label="Total"
              value={money(
                total
              )}
              bold
            />
          </View>

          {/* TOTAL */}
          <View
            style={
              styles.totalBox
            }
          >
            <View>
              <Text
                style={
                  styles.totalLabel
                }
              >
                Invoice Total
              </Text>

              <Text
                style={
                  styles.totalHint
                }
              >
                Total booking amount
              </Text>
            </View>

            <Text
              style={
                styles.totalValue
              }
            >
              {money(
                invoice
                  ?.amount ??
                  total
              )}
            </Text>
          </View>

          {/* PAYMENT STATUS */}
          <View
            style={
              styles.statusBox
            }
          >
            <View
              style={
                styles.statusIcon
              }
            >
              <Ionicons
                name="shield-checkmark-outline"
                size={21}
                color="#07869B"
              />
            </View>

            <View
              style={{
                flex: 1,
              }}
            >
              <Text
                style={
                  styles.statusTitle
                }
              >
                Payment Status
              </Text>

              <Text
                style={
                  styles.statusText
                }
              >
                {readableStatus(
                  payment
                    ?.status
                )}
              </Text>
            </View>
          </View>

          <Text
            style={
              styles.footerText
            }
          >
            This invoice was generated
            electronically by the BNPL
            platform.
          </Text>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

function InvoiceField({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View
      style={
        styles.metaItem
      }
    >
      <Text
        style={
          styles.metaLabel
        }
      >
        {label}
      </Text>

      <Text
        style={
          styles.metaValue
        }
      >
        {value}
      </Text>
    </View>
  );
}

function InvoiceRow({
  label,
  value,
  bold = false,
}: {
  label: string;
  value: string;
  bold?: boolean;
}) {
  return (
    <View
      style={
        styles.invoiceRow
      }
    >
      <Text
        style={[
          styles.rowLabel,
          bold &&
            styles.boldText,
        ]}
      >
        {label}
      </Text>

      <Text
        style={[
          styles.rowValue,
          bold &&
            styles.boldText,
        ]}
      >
        {value}
      </Text>
    </View>
  );
}

const styles =
  StyleSheet.create({
    safeArea: {
      flex: 1,
      backgroundColor:
        "#F5F8F9",
    },

    center: {
      flex: 1,
      alignItems:
        "center",
      justifyContent:
        "center",
      padding: 24,
    },

    loadingText: {
      marginTop: 12,
      color:
        "#70858E",
      fontWeight:
        "700",
    },

    errorTitle: {
      marginTop: 12,
      fontSize: 18,
      fontWeight:
        "900",
      color:
        "#17313C",
    },

    errorText: {
      marginTop: 6,
      fontSize: 12,
      textAlign:
        "center",
      color:
        "#7A8E96",
    },

    retryButton: {
      marginTop: 18,
      height: 46,
      paddingHorizontal:
        22,
      borderRadius:
        14,
      backgroundColor:
        "#07869B",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    retryText: {
      color:
        "#FFFFFF",
      fontWeight:
        "900",
    },

    header: {
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 12,
      paddingHorizontal:
        18,
      paddingVertical:
        14,
      backgroundColor:
        "#FFFFFF",
      borderBottomWidth:
        1,
      borderBottomColor:
        "#E3EAED",
    },

    headerButton: {
      width: 42,
      height: 42,
      borderRadius:
        14,
      backgroundColor:
        "#F3F7F8",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    headerTitle: {
      color:
        "#17313C",
      fontSize: 18,
      fontWeight:
        "900",
    },

    headerSubtitle: {
      marginTop: 2,
      color:
        "#83969E",
      fontSize: 10,
    },

    content: {
      padding: 18,
      paddingBottom:
        40,
    },

    invoiceCard: {
      backgroundColor:
        "#FFFFFF",
      borderRadius:
        22,
      padding: 20,
      borderWidth: 1,
      borderColor:
        "#DFE7EA",
    },

    brandRow: {
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 12,
    },

    logoBox: {
      width: 50,
      height: 50,
      borderRadius:
        15,
      backgroundColor:
        "#07869B",
      alignItems:
        "center",
      justifyContent:
        "center",
    },

    logoText: {
      color:
        "#FFFFFF",
      fontSize: 14,
      fontWeight:
        "900",
    },

    invoiceTitle: {
      color:
        "#17313C",
      fontSize: 20,
      fontWeight:
        "900",
      letterSpacing:
        1,
    },

    invoiceSubtitle: {
      color:
        "#82949C",
      fontSize: 10,
      marginTop: 2,
    },

    paidBadge: {
      flexDirection:
        "row",
      gap: 5,
      alignItems:
        "center",
      paddingHorizontal:
        9,
      paddingVertical:
        6,
      borderRadius:
        20,
      backgroundColor:
        "#E9F8EF",
    },

    paidBadgeText: {
      color:
        "#258552",
      fontSize: 9,
      fontWeight:
        "900",
    },

    divider: {
      height: 1,
      backgroundColor:
        "#E7ECEF",
      marginVertical:
        18,
    },

    metaGrid: {
      flexDirection:
        "row",
      flexWrap:
        "wrap",
      marginHorizontal:
        -5,
    },

    metaItem: {
      width: "50%",
      paddingHorizontal:
        5,
      marginBottom:
        15,
    },

    metaLabel: {
      color:
        "#8A9AA2",
      fontSize: 9,
      textTransform:
        "uppercase",
      fontWeight:
        "800",
    },

    metaValue: {
      marginTop: 4,
      color:
        "#17313C",
      fontSize: 11,
      fontWeight:
        "800",
    },

    section: {
      marginTop: 16,
      paddingTop: 16,
      borderTopWidth:
        1,
      borderTopColor:
        "#E7ECEF",
    },

    sectionLabel: {
      color:
        "#07869B",
      fontSize: 9,
      fontWeight:
        "900",
      letterSpacing:
        0.7,
      marginBottom:
        10,
    },

    operatorName: {
      color:
        "#17313C",
      fontSize: 14,
      fontWeight:
        "900",
    },

    mutedText: {
      marginTop: 4,
      color:
        "#81949B",
      fontSize: 10,
    },

    invoiceRow: {
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      alignItems:
        "center",
      gap: 20,
      paddingVertical:
        7,
    },

    rowLabel: {
      color:
        "#7C9098",
      fontSize: 11,
    },

    rowValue: {
      color:
        "#17313C",
      fontSize: 11,
      fontWeight:
        "700",
      textAlign:
        "right",
      flex: 1,
    },

    boldText: {
      fontWeight:
        "900",
      color:
        "#17313C",
    },

    line: {
      height: 1,
      backgroundColor:
        "#E7ECEF",
      marginVertical:
        7,
    },

    totalBox: {
      marginTop: 20,
      backgroundColor:
        "#EAF8FA",
      borderRadius:
        17,
      padding: 16,
      flexDirection:
        "row",
      justifyContent:
        "space-between",
      alignItems:
        "center",
      gap: 15,
    },

    totalLabel: {
      color:
        "#17313C",
      fontSize: 12,
      fontWeight:
        "900",
    },

    totalHint: {
      color:
        "#759099",
      fontSize: 9,
      marginTop: 3,
    },

    totalValue: {
      color:
        "#07869B",
      fontSize: 22,
      fontWeight:
        "900",
    },

    statusBox: {
      marginTop: 16,
      flexDirection:
        "row",
      alignItems:
        "center",
      gap: 11,
      padding: 13,
      borderRadius:
        15,
      backgroundColor:
        "#F7FAFB",
      borderWidth: 1,
      borderColor:
        "#E2E9EC",
    },

    statusIcon: {
      width: 40,
      height: 40,
      borderRadius:
        13,
      alignItems:
        "center",
      justifyContent:
        "center",
      backgroundColor:
        "#EAF8FA",
    },

    statusTitle: {
      color:
        "#17313C",
      fontSize: 11,
      fontWeight:
        "900",
    },

    statusText: {
      marginTop: 2,
      color:
        "#258552",
      fontSize: 10,
      fontWeight:
        "800",
    },

    footerText: {
      marginTop: 22,
      textAlign:
        "center",
      color:
        "#9AA8AE",
      fontSize: 9,
      lineHeight: 14,
    },
  });