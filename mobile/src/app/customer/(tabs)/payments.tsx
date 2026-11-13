import { Ionicons } from "@expo/vector-icons";

import {
  useFocusEffect,
  useRouter,
} from "expo-router";

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
  useMemo,
  useState,
} from "react";

import {
  getCustomerPayments,
} from "../../../services/customerApi";
import { logger } from "@/utils/logger";

type Payment = {
  id: number;

  bookingId: number;

  amount?: number;

  paidAmount?: number;

  method?: string;

  status?: string;

  paidAt?: string | null;

  createdAt?: string;

  updatedAt?: string;

  downPaymentAmount?: number;

  finalPaymentAmount?: number;

  downPaymentStatus?: string;

  finalPaymentStatus?: string;

  downPaymentDueDate?: string | null;

  finalPaymentDueDate?: string | null;

  downPaymentPaidAt?: string | null;

  finalPaymentPaidAt?: string | null;

  booking?: {
    id?: number;

    bookingCode?: string;

    serviceName?: string;

    totalAmount?: number;

    status?: string;

    pickupDate?: string;

    returnDate?: string;

    operator?: {
      companyName?: string;

      name?: string;
    } | null;

    receipt?: {
      status?: string;

      paymentType?: string;

      expectedAmount?: number;

      uploadedAt?: string;

      verifiedAt?: string;
    } | null;

    invoice?: {
      invoiceNo?: string;

      status?: string;
    } | null;
  };
};

type FilterType =
  | "ALL"
  | "PENDING"
  | "VERIFYING"
  | "PARTIAL"
  | "PAID";

function money(
  value?: number
) {
  return `RM ${Number(
    value || 0
  ).toFixed(2)}`;
}

function formatDate(
  value?: string | null
) {
  if (!value) {
    return "-";
  }

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

function getPaymentCategory(
  payment: Payment
): FilterType {
  const status =
    payment.status || "";

  const downStatus =
    payment.downPaymentStatus || "";

  const finalStatus =
    payment.finalPaymentStatus || "";

  if (
    status === "PAID"
  ) {
    return "PAID";
  }

  if (
    status.includes(
      "PENDING_VERIFICATION"
    ) ||
    downStatus.includes(
      "PENDING_VERIFICATION"
    ) ||
    finalStatus.includes(
      "PENDING_VERIFICATION"
    )
  ) {
    return "VERIFYING";
  }

  if (
    downStatus === "PAID" &&
    finalStatus !== "PAID"
  ) {
    return "PARTIAL";
  }

  return "PENDING";
}

function getStatusStyle(
  category: FilterType
) {
  switch (
    category
  ) {
    case "PAID":
      return {
        background:
          "#E8F7EF",

        text:
          "#258552",

        icon:
          "checkmark-circle" as const,
      };

    case "VERIFYING":
      return {
        background:
          "#FFF5D9",

        text:
          "#A56A00",

        icon:
          "time" as const,
      };

    case "PARTIAL":
      return {
        background:
          "#EAF4FF",

        text:
          "#2B70B8",

        icon:
          "pie-chart" as const,
      };

    default:
      return {
        background:
          "#FDEEEE",

        text:
          "#BB4545",

        icon:
          "card-outline" as const,
      };
  }
}

function getDisplayStatus(
  payment: Payment
) {
  const category =
    getPaymentCategory(
      payment
    );

  if (
    category ===
    "VERIFYING"
  ) {
    return "Pending Verification";
  }

  if (
    category ===
    "PARTIAL"
  ) {
    return "Partially Paid";
  }

  if (
    category ===
    "PAID"
  ) {
    return "Paid";
  }

  return "Payment Pending";
}

function getNextPaymentType(
  payment: Payment
):
  | "DOWN_PAYMENT"
  | "FINAL_PAYMENT"
  | "FULL_PAYMENT"
  | null {
  const overallStatus =
    payment.status || "";

  const downStatus =
    payment.downPaymentStatus || "";

  const finalStatus =
    payment.finalPaymentStatus || "";

  const downAmount =
    Number(
      payment.downPaymentAmount || 0
    );

  const finalAmount =
    Number(
      payment.finalPaymentAmount || 0
    );

  // Payment is fully completed
  if (
    overallStatus === "PAID"
  ) {
    return null;
  }

  // Prevent duplicate payment while receipt verification is pending
  if (
    overallStatus.includes(
      "PENDING_VERIFICATION"
    ) ||
    downStatus.includes(
      "PENDING_VERIFICATION"
    ) ||
    finalStatus.includes(
      "PENDING_VERIFICATION"
    )
  ) {
    return null;
  }

  // Down payment must be completed first
  if (
    downAmount > 0 &&
    downStatus !== "PAID"
  ) {
    return "DOWN_PAYMENT";
  }

  // Final payment becomes available after down payment is completed
  if (
    finalAmount > 0 &&
    downStatus === "PAID" &&
    finalStatus !== "PAID"
  ) {
    return "FINAL_PAYMENT";
  }

  // Fallback for bookings without split payment
  if (
    downAmount <= 0 &&
    finalAmount <= 0
  ) {
    return "FULL_PAYMENT";
  }

  return null;
}

export default function PaymentsScreen() {
  const router =
    useRouter();

  const [
    payments,
    setPayments,
  ] =
    useState<
      Payment[]
    >([]);

  const [
    loading,
    setLoading,
  ] =
    useState(
      true
    );

  const [
    refreshing,
    setRefreshing,
  ] =
    useState(
      false
    );

  const [
    error,
    setError,
  ] =
    useState("");

  const [
    activeFilter,
    setActiveFilter,
  ] =
    useState<FilterType>(
      "ALL"
    );

  const loadPayments =
    async (
      isRefresh =
        false
    ) => {
      try {
        if (
          isRefresh
        ) {
          setRefreshing(
            true
          );
        } else {
          setLoading(
            true
          );
        }

        setError("");

        const response =
          await getCustomerPayments();

        setPayments(
          Array.isArray(
            response
          )
            ? response
            : []
        );
      } catch (
        err: any
      ) {
        logger.debug(
          "Failed to load payments:",
          err
        );

        setError(
          err?.message ||
            "Unable to load payments."
        );
      } finally {
        setLoading(
          false
        );

        setRefreshing(
          false
        );
      }
    };

  useFocusEffect(
    useCallback(
      () => {
        loadPayments();
      },
      []
    )
  );

  const summary =
    useMemo(() => {
      const totalPaid =
        payments.reduce(
          (
            total,
            payment
          ) =>
            total +
            Number(
              payment.paidAmount ||
                0
            ),
          0
        );

      const pending =
        payments.filter(
          (payment) =>
            getPaymentCategory(
              payment
            ) ===
            "PENDING"
        ).length;

      const verifying =
        payments.filter(
          (payment) =>
            getPaymentCategory(
              payment
            ) ===
            "VERIFYING"
        ).length;

      const paid =
        payments.filter(
          (payment) =>
            getPaymentCategory(
              payment
            ) ===
            "PAID"
        ).length;

      return {
        totalPaid,
        pending,
        verifying,
        paid,
      };
    }, [
      payments,
    ]);

  const filteredPayments =
    useMemo(() => {
      if (
        activeFilter ===
        "ALL"
      ) {
        return payments;
      }

      return payments.filter(
        (payment) =>
          getPaymentCategory(
            payment
          ) ===
          activeFilter
      );
    }, [
      payments,
      activeFilter,
    ]);

  if (
    loading
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
          <ActivityIndicator
            size="large"
            color="#07869B"
          />

          <Text
            style={
              styles.loadingText
            }
          >
            Loading payments...
          </Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView
      style={
        styles.safeArea
      }
    >
      <ScrollView
        showsVerticalScrollIndicator={
          false
        }
        refreshControl={
          <RefreshControl
            refreshing={
              refreshing
            }
            onRefresh={() =>
              loadPayments(
                true
              )
            }
          />
        }
        contentContainerStyle={
          styles.content
        }
      >
        {/* HEADER */}
        <View
          style={
            styles.header
          }
        >
          <View>
            <Text
              style={
                styles.eyebrow
              }
            >
              BNPL PAYMENTS
            </Text>

            <Text
              style={
                styles.title
              }
            >
              Payments
            </Text>

            <Text
              style={
                styles.subtitle
              }
            >
              Track your payment progress and history
            </Text>
          </View>

          <View
            style={
              styles.headerIcon
            }
          >
            <Ionicons
              name="wallet-outline"
              size={24}
              color="#07869B"
            />
          </View>
        </View>

        {/* SUMMARY */}
        <View
          style={
            styles.totalCard
          }
        >
          <View>
            <Text
              style={
                styles.totalLabel
              }
            >
              Total Paid
            </Text>

            <Text
              style={
                styles.totalAmount
              }
            >
              {money(
                summary.totalPaid
              )}
            </Text>

            <Text
              style={
                styles.totalSubtitle
              }
            >
              Across all your bookings
            </Text>
          </View>

          <View
            style={
              styles.totalIcon
            }
          >
            <Ionicons
              name="checkmark-done-outline"
              size={26}
              color="#FFFFFF"
            />
          </View>
        </View>

        <View
          style={
            styles.statsRow
          }
        >
          <SummaryCard
            icon="card-outline"
            label="Pending"
            value={
              summary.pending
            }
          />

          <SummaryCard
            icon="time-outline"
            label="Verifying"
            value={
              summary.verifying
            }
          />

          <SummaryCard
            icon="checkmark-circle-outline"
            label="Paid"
            value={
              summary.paid
            }
          />
        </View>

        {/* ERROR */}
        {error ? (
          <View
            style={
              styles.errorBox
            }
          >
            <Ionicons
              name="alert-circle-outline"
              size={18}
              color="#C84242"
            />

            <Text
              style={
                styles.errorText
              }
            >
              {error}
            </Text>
          </View>
        ) : null}

        {/* FILTER */}
        <Text
          style={
            styles.sectionTitle
          }
        >
          Payment Activity
        </Text>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={
            false
          }
          contentContainerStyle={
            styles.filterRow
          }
        >
          <FilterChip
            label="All"
            selected={
              activeFilter ===
              "ALL"
            }
            onPress={() =>
              setActiveFilter(
                "ALL"
              )
            }
          />

          <FilterChip
            label="Pending"
            selected={
              activeFilter ===
              "PENDING"
            }
            onPress={() =>
              setActiveFilter(
                "PENDING"
              )
            }
          />

          <FilterChip
            label="Verifying"
            selected={
              activeFilter ===
              "VERIFYING"
            }
            onPress={() =>
              setActiveFilter(
                "VERIFYING"
              )
            }
          />

          <FilterChip
            label="Partial"
            selected={
              activeFilter ===
              "PARTIAL"
            }
            onPress={() =>
              setActiveFilter(
                "PARTIAL"
              )
            }
          />

          <FilterChip
            label="Paid"
            selected={
              activeFilter ===
              "PAID"
            }
            onPress={() =>
              setActiveFilter(
                "PAID"
              )
            }
          />
        </ScrollView>

        {/* PAYMENT LIST */}
        {filteredPayments.length ===
        0 ? (
          <View
            style={
              styles.emptyCard
            }
          >
            <View
              style={
                styles.emptyIcon
              }
            >
              <Ionicons
                name="wallet-outline"
                size={30}
                color="#82949C"
              />
            </View>

            <Text
              style={
                styles.emptyTitle
              }
            >
              No payments found
            </Text>

            <Text
              style={
                styles.emptyText
              }
            >
              There are no payments in this category yet.
            </Text>
          </View>
        ) : (
          filteredPayments.map(
            (
              payment
            ) => (
              <PaymentCard
              key={payment.id}
              payment={payment}

              onViewBooking={() =>
                router.push({
                  pathname:
                    "/customer/booking/[id]",
                  params: {
                    id: String(
                      payment.booking?.id ||
                      payment.bookingId
                    ),
                  },
                })
              }

              onPayNow={() => {
                const paymentType =
                  getNextPaymentType(
                    payment
                  );

                if (!paymentType) {
                  return;
                }

                router.push({
                  pathname:
                    "/customer/checkout",
                  params: {
                    bookingId:
                      String(
                        payment.booking?.id ||
                        payment.bookingId
                      ),

                    type:
                      paymentType,
                  },
                });
              }}

              onViewInvoice={() =>
                router.push({
                  pathname:
                    "/customer/invoice/[id]",
                  params: {
                    id: String(
                      payment.booking?.id ||
                      payment.bookingId
                    ),
                  },
                })
              }
            />
            )
          )
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

function SummaryCard({
  icon,
  label,
  value,
}: {
  icon:
    | "card-outline"
    | "time-outline"
    | "checkmark-circle-outline";

  label: string;

  value: number;
}) {
  return (
    <View
      style={
        styles.summaryCard
      }
    >
      <View
        style={
          styles.summaryIcon
        }
      >
        <Ionicons
          name={
            icon
          }
          size={18}
          color="#07869B"
        />
      </View>

      <Text
        style={
          styles.summaryValue
        }
      >
        {value}
      </Text>

      <Text
        style={
          styles.summaryLabel
        }
      >
        {label}
      </Text>
    </View>
  );
}

function FilterChip({
  label,
  selected,
  onPress,
}: {
  label: string;

  selected: boolean;

  onPress: () => void;
}) {
  return (
    <Pressable
      style={[
        styles.filterChip,

        selected &&
          styles.filterChipSelected,
      ]}
      onPress={
        onPress
      }
    >
      <Text
        style={[
          styles.filterText,

          selected &&
            styles.filterTextSelected,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function PaymentCard({
  payment,
  onViewBooking,
  onPayNow,
  onViewInvoice,
}: {
  payment: Payment;

  onViewBooking: () => void;

  onPayNow: () => void;

  onViewInvoice: () => void;
}) {
  const category =
    getPaymentCategory(
      payment
    );

  const statusStyle =
    getStatusStyle(
      category
    );

  const total =
    Number(
      payment.amount ||
        payment.booking
          ?.totalAmount ||
        0
    );

  const paid =
    Number(
      payment.paidAmount ||
        0
    );

  const progress =
    total > 0
      ? Math.min(
          paid / total,
          1
        )
      : 0;

  const nextPaymentType =
    getNextPaymentType(
      payment
    );

  const hasInvoice =
    Boolean(
      payment.booking
        ?.invoice
    );

  const hasReceipt =
    Boolean(
      payment.booking
        ?.receipt
    );

  return (
    <View
      style={
        styles.paymentCard
      }
    >
      {/* Booking Header */}
      <Pressable
        style={({ pressed }) => [
          styles.paymentTop,

          pressed && {
            opacity: 0.65,
          },
        ]}
        onPress={
          onViewBooking
        }
      >
        <View
          style={
            styles.bookingIcon
          }
        >
          <Ionicons
            name="car-sport-outline"
            size={22}
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
              styles.bookingCode
            }
          >
            {payment.booking
              ?.bookingCode ||
              `BNPL-${payment.bookingId}`}
          </Text>

          <Text
            style={
              styles.serviceName
            }
            numberOfLines={
              1
            }
          >
            {payment.booking
              ?.serviceName ||
              "Car Rental"}
          </Text>
        </View>

        <Ionicons
          name="chevron-forward"
          size={19}
          color="#91A1A7"
        />
      </Pressable>

      <View
        style={
          styles.paymentDivider
        }
      />

      {/* Payment Amount */}
      <View
        style={
          styles.amountRow
        }
      >
        <View>
          <Text
            style={
              styles.smallLabel
            }
          >
            Paid
          </Text>

          <Text
            style={
              styles.paidAmount
            }
          >
            {money(
              paid
            )}
          </Text>
        </View>

        <View
          style={{
            alignItems:
              "flex-end",
          }}
        >
          <Text
            style={
              styles.smallLabel
            }
          >
            Total
          </Text>

          <Text
            style={
              styles.bookingTotal
            }
          >
            {money(
              total
            )}
          </Text>
        </View>
      </View>

      {/* Payment Progress */}
      <View
        style={
          styles.progressTrack
        }
      >
        <View
          style={[
            styles.progressFill,

            {
              width:
                `${progress * 100}%`,
            },
          ]}
        />
      </View>

      {/* Payment Status */}
      <View
        style={
          styles.paymentInfoRow
        }
      >
        <View
          style={[
            styles.statusBadge,

            {
              backgroundColor:
                statusStyle.background,
            },
          ]}
        >
          <Ionicons
            name={
              statusStyle.icon
            }
            size={13}
            color={
              statusStyle.text
            }
          />

          <Text
            style={[
              styles.statusText,

              {
                color:
                  statusStyle.text,
              },
            ]}
          >
            {getDisplayStatus(
              payment
            )}
          </Text>
        </View>

        <Text
          style={
            styles.methodText
          }
        >
          {payment.method &&
          payment.method !==
            "PENDING"
            ? readableStatus(
                payment.method
              )
            : "Payment method not selected"}
        </Text>
      </View>

      {/* Payment Breakdown */}
      <View
        style={
          styles.installmentBox
        }
      >
        <InstallmentRow
          label="Down Payment"
          amount={
            payment.downPaymentAmount
          }
          status={
            payment.downPaymentStatus
          }
          date={
            payment.downPaymentPaidAt ||
            payment.downPaymentDueDate
          }
        />

        <View
          style={
            styles.installmentDivider
          }
        />

        <InstallmentRow
          label="Final Payment"
          amount={
            payment.finalPaymentAmount
          }
          status={
            payment.finalPaymentStatus
          }
          date={
            payment.finalPaymentPaidAt ||
            payment.finalPaymentDueDate
          }
        />
      </View>

      {/* Quick Actions */}
      <View
        style={
          styles.quickActionsSection
        }
      >
        <Text
          style={
            styles.quickActionsTitle
          }
        >
          Quick Actions
        </Text>

        <View
          style={
            styles.quickActionsRow
          }
        >
          {nextPaymentType ? (
            <QuickAction
              icon="card-outline"
              label={
                nextPaymentType ===
                "FINAL_PAYMENT"
                  ? "Pay Balance"
                  : "Pay Now"
              }
              primary
              onPress={
                onPayNow
              }
            />
          ) : null}

          {hasInvoice ? (
            <QuickAction
              icon="document-text-outline"
              label="Invoice"
              onPress={
                onViewInvoice
              }
            />
          ) : null}

          {hasReceipt ? (
            <QuickAction
              icon="receipt-outline"
              label="Receipt"
              onPress={
                onViewBooking
              }
            />
          ) : null}

          <QuickAction
            icon="car-outline"
            label="Booking"
            onPress={
              onViewBooking
            }
          />
        </View>

        {/* Receipt Verification Status */}
        {payment.booking
          ?.receipt ? (
          <View
            style={
              styles.receiptStatusRow
            }
          >
            <View
              style={
                styles.receiptStatusLeft
              }
            >
              <Ionicons
                name={
                  payment.booking
                    .receipt
                    .status ===
                  "VERIFIED"
                    ? "checkmark-circle"
                    : payment.booking
                          .receipt
                          .status ===
                        "REJECTED"
                    ? "close-circle"
                    : "time"
                }
                size={16}
                color={
                  payment.booking
                    .receipt
                    .status ===
                  "VERIFIED"
                    ? "#258552"
                    : payment.booking
                          .receipt
                          .status ===
                        "REJECTED"
                    ? "#C84242"
                    : "#A56A00"
                }
              />

              <Text
                style={
                  styles.receiptStatusLabel
                }
              >
                Receipt
              </Text>
            </View>

            <Text
              style={[
                styles.receiptStatusValue,

                {
                  color:
                    payment.booking
                      .receipt
                      .status ===
                    "VERIFIED"
                      ? "#258552"
                      : payment.booking
                            .receipt
                            .status ===
                          "REJECTED"
                      ? "#C84242"
                      : "#A56A00",
                },
              ]}
            >
              {readableStatus(
                payment.booking
                  .receipt
                  .status
              )}
            </Text>
          </View>
        ) : null}
      </View>
    </View>
  );
}

function QuickAction({
  icon,
  label,
  onPress,
  primary = false,
}: {
  icon:
    | "card-outline"
    | "document-text-outline"
    | "receipt-outline"
    | "car-outline";

  label: string;

  onPress: () => void;

  primary?: boolean;
}) {
  return (
    <Pressable
      style={({ pressed }) => [
        styles.quickActionButton,

        primary &&
          styles.quickActionPrimary,

        pressed && {
          opacity: 0.7,
        },
      ]}
      onPress={
        onPress
      }
    >
      <View
        style={[
          styles.quickActionIcon,

          primary &&
            styles.quickActionIconPrimary,
        ]}
      >
        <Ionicons
          name={
            icon
          }
          size={17}
          color={
            primary
              ? "#FFFFFF"
              : "#07869B"
          }
        />
      </View>

      <Text
        style={[
          styles.quickActionText,

          primary &&
            styles.quickActionTextPrimary,
        ]}
      >
        {label}
      </Text>
    </Pressable>
  );
}

function InstallmentRow({
  label,
  amount,
  status,
  date,
}: {
  label: string;

  amount?: number;

  status?: string;

  date?: string | null;
}) {
  const paid =
    status === "PAID";

  const verifying =
    status?.includes(
      "PENDING_VERIFICATION"
    );

  return (
    <View
      style={
        styles.installmentRow
      }
    >
      <View
        style={
          styles.installmentLeft
        }
      >
        <View
          style={[
            styles.installmentDot,

            {
              backgroundColor:
                paid
                  ? "#258552"
                  : verifying
                  ? "#E2A72E"
                  : "#C8D1D5",
            },
          ]}
        />

        <View>
          <Text
            style={
              styles.installmentLabel
            }
          >
            {label}
          </Text>

          <Text
            style={
              styles.installmentDate
            }
          >
            {paid
              ? "Paid "
              : "Due "}

            {formatDate(
              date
            )}
          </Text>
        </View>
      </View>

      <View
        style={{
          alignItems:
            "flex-end",
        }}
      >
        <Text
          style={
            styles.installmentAmount
          }
        >
          {money(
            amount
          )}
        </Text>

        <Text
          style={[
            styles.installmentStatus,

            {
              color:
                paid
                  ? "#258552"
                  : verifying
                  ? "#A56A00"
                  : "#86969D",
            },
          ]}
        >
          {readableStatus(
            status
          )}
        </Text>
      </View>
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

    content: {
      paddingHorizontal:
        18,

      paddingTop: 18,

      paddingBottom:
        120,
    },

    center: {
      flex: 1,

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    loadingText: {
      marginTop: 12,

      color:
        "#82949C",

      fontWeight:
        "700",
    },

    header: {
      flexDirection:
        "row",

      justifyContent:
        "space-between",

      alignItems:
        "center",

      marginBottom:
        18,
    },

    eyebrow: {
      color:
        "#07869B",

      fontSize: 9,

      fontWeight:
        "900",

      letterSpacing:
        1,
    },

    title: {
      marginTop: 4,

      color:
        "#17313C",

      fontSize: 27,

      fontWeight:
        "900",
    },

    subtitle: {
      marginTop: 4,

      color:
        "#81939B",

      fontSize: 11,
    },

    headerIcon: {
      width: 48,

      height: 48,

      borderRadius: 16,

      backgroundColor:
        "#EAF8FA",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    totalCard: {
      minHeight: 135,

      flexDirection:
        "row",

      justifyContent:
        "space-between",

      alignItems:
        "center",

      backgroundColor:
        "#07869B",

      borderRadius: 22,

      padding: 20,

      marginBottom: 12,
    },

    totalLabel: {
      color:
        "#CDECF1",

      fontSize: 10,

      fontWeight:
        "700",
    },

    totalAmount: {
      marginTop: 6,

      color:
        "#FFFFFF",

      fontSize: 29,

      fontWeight:
        "900",
    },

    totalSubtitle: {
      marginTop: 5,

      color:
        "#D5EEF2",

      fontSize: 9,
    },

    totalIcon: {
      width: 52,

      height: 52,

      borderRadius: 17,

      backgroundColor:
        "rgba(255,255,255,0.15)",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    statsRow: {
      flexDirection:
        "row",

      gap: 9,

      marginBottom: 18,
    },

    summaryCard: {
      flex: 1,

      padding: 12,

      borderRadius: 16,

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        "#E2E9EC",
    },

    summaryIcon: {
      width: 32,

      height: 32,

      borderRadius: 10,

      backgroundColor:
        "#EAF8FA",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    summaryValue: {
      marginTop: 9,

      color:
        "#17313C",

      fontSize: 18,

      fontWeight:
        "900",
    },

    summaryLabel: {
      marginTop: 2,

      color:
        "#87989F",

      fontSize: 9,
    },

    errorBox: {
      flexDirection:
        "row",

      gap: 8,

      padding: 12,

      backgroundColor:
        "#FDEEEE",

      borderRadius: 13,

      marginBottom: 15,
    },

    errorText: {
      flex: 1,

      color:
        "#A43D3D",

      fontSize: 10,
    },

    sectionTitle: {
      color:
        "#17313C",

      fontSize: 15,

      fontWeight:
        "900",

      marginBottom: 11,
    },

    filterRow: {
      gap: 8,

      paddingBottom: 15,
    },

    filterChip: {
      paddingHorizontal:
        15,

      paddingVertical:
        9,

      borderRadius: 20,

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        "#DEE6E9",
    },

    filterChipSelected: {
      backgroundColor:
        "#07869B",

      borderColor:
        "#07869B",
    },

    filterText: {
      color:
        "#748991",

      fontSize: 10,

      fontWeight:
        "800",
    },

    filterTextSelected: {
      color:
        "#FFFFFF",
    },

    paymentCard: {
      padding: 16,

      borderRadius: 20,

      backgroundColor:
        "#FFFFFF",

      borderWidth: 1,

      borderColor:
        "#E1E8EB",

      marginBottom: 13,
    },

    paymentTop: {
      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 11,
    },

    bookingIcon: {
      width: 43,

      height: 43,

      borderRadius: 14,

      backgroundColor:
        "#EAF8FA",

      alignItems:
        "center",

      justifyContent:
        "center",
    },

    bookingCode: {
      color:
        "#17313C",

      fontSize: 12,

      fontWeight:
        "900",
    },

    serviceName: {
      marginTop: 3,

      color:
        "#82949C",

      fontSize: 10,
    },

    paymentDivider: {
      height: 1,

      backgroundColor:
        "#E8EDEF",

      marginVertical: 14,
    },

    amountRow: {
      flexDirection:
        "row",

      justifyContent:
        "space-between",
    },

    smallLabel: {
      color:
        "#899AA1",

      fontSize: 9,
    },

    paidAmount: {
      marginTop: 3,

      color:
        "#258552",

      fontSize: 15,

      fontWeight:
        "900",
    },

    bookingTotal: {
      marginTop: 3,

      color:
        "#17313C",

      fontSize: 15,

      fontWeight:
        "900",
    },

    progressTrack: {
      height: 7,

      borderRadius: 10,

      backgroundColor:
        "#E8EEF0",

      marginTop: 13,

      overflow:
        "hidden",
    },

    progressFill: {
      height:
        "100%",

      borderRadius: 10,

      backgroundColor:
        "#07869B",
    },

    paymentInfoRow: {
      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap: 10,

      marginTop: 12,
    },

    statusBadge: {
      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 5,

      paddingHorizontal:
        9,

      paddingVertical:
        6,

      borderRadius: 20,
    },

    statusText: {
      fontSize: 8,

      fontWeight:
        "900",
    },

    methodText: {
      flex: 1,

      textAlign:
        "right",

      color:
        "#87989F",

      fontSize: 8,

      fontWeight:
        "700",
    },

    installmentBox: {
      marginTop: 14,

      backgroundColor:
        "#F7FAFB",

      borderRadius: 15,

      padding: 12,
    },

    installmentRow: {
      flexDirection:
        "row",

      alignItems:
        "center",

      justifyContent:
        "space-between",

      gap: 12,
    },

    installmentLeft: {
      flexDirection:
        "row",

      alignItems:
        "center",

      gap: 9,
    },

    installmentDot: {
      width: 8,

      height: 8,

      borderRadius: 4,
    },

    installmentLabel: {
      color:
        "#17313C",

      fontSize: 10,

      fontWeight:
        "800",
    },

    installmentDate: {
      marginTop: 2,

      color:
        "#8A9AA1",

      fontSize: 8,
    },

    installmentAmount: {
      color:
        "#17313C",

      fontSize: 10,

      fontWeight:
        "900",
    },

    installmentStatus: {
      marginTop: 2,

      fontSize: 7,

      fontWeight:
        "900",
    },

    installmentDivider: {
      height: 1,

      backgroundColor:
        "#E3E9EB",

      marginVertical: 10,
    },

    emptyCard: {
      marginTop: 10,

      alignItems:
        "center",

      padding: 30,

      backgroundColor:
        "#FFFFFF",

      borderRadius: 20,

      borderWidth: 1,

      borderColor:
        "#E1E8EB",
    },

    emptyIcon: {
      width: 55,

      height: 55,

      borderRadius: 18,

      alignItems:
        "center",

      justifyContent:
        "center",

      backgroundColor:
        "#F0F5F6",
    },

    emptyTitle: {
      marginTop: 13,

      color:
        "#17313C",

      fontSize: 14,

      fontWeight:
        "900",
    },

    emptyText: {
      marginTop: 5,

      color:
        "#86979E",

      fontSize: 10,

      textAlign:
        "center",
    },

    quickActionsSection: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderTopColor: "#E8EDEF",
    },

    quickActionsTitle: {
      color: "#80939B",
      fontSize: 9,
      fontWeight: "900",
      letterSpacing: 0.5,
      textTransform: "uppercase",
      marginBottom: 10,
    },

    quickActionsRow: {
      flexDirection: "row",
      flexWrap: "wrap",
      gap: 8,
    },

    quickActionButton: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
      paddingHorizontal: 10,
      paddingVertical: 8,
      borderRadius: 12,
      backgroundColor: "#F2F8F9",
      borderWidth: 1,
      borderColor: "#D8E8EB",
    },

    quickActionPrimary: {
      backgroundColor: "#07869B",
      borderColor: "#07869B",
    },

    quickActionIcon: {
      width: 27,
      height: 27,
      borderRadius: 9,
      backgroundColor: "#E2F3F5",
      alignItems: "center",
      justifyContent: "center",
    },

    quickActionIconPrimary: {
      backgroundColor:
        "rgba(255,255,255,0.17)",
    },

    quickActionText: {
      color: "#17313C",
      fontSize: 9,
      fontWeight: "900",
    },

    quickActionTextPrimary: {
      color: "#FFFFFF",
    },

    receiptStatusRow: {
      marginTop: 10,
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 11,
      paddingVertical: 9,
      borderRadius: 11,
      backgroundColor: "#F7FAFB",
    },

    receiptStatusLeft: {
      flexDirection: "row",
      alignItems: "center",
      gap: 7,
    },

    receiptStatusLabel: {
      color: "#667D86",
      fontSize: 9,
      fontWeight: "800",
    },

    receiptStatusValue: {
      fontSize: 8,
      fontWeight: "900",
    },
  });