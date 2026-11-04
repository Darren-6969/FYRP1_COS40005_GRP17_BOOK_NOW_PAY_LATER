
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";

import {
  ActivityIndicator,
  Alert,
  Image,
  Linking,
  Modal,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  View,
} from "react-native";

import {
  approveOperatorPayment,
  getOperatorPayments,
  OperatorPayment,
  rejectOperatorPayment,
} from "../../../services/operatorApi";

type PaymentTab = "PENDING" | "ALL";

function isPendingVerification(payment: OperatorPayment) {
  return (
    payment.status === "PENDING_VERIFICATION" ||
    payment.status === "DOWN_PAYMENT_PENDING_VERIFICATION" ||
    payment.status === "FINAL_PAYMENT_PENDING_VERIFICATION" ||
    payment.downPaymentStatus === "PENDING_VERIFICATION" ||
    payment.finalPaymentStatus === "PENDING_VERIFICATION"
  );
}

function isReviewable(payment: OperatorPayment) {
  return (
    isPendingVerification(payment) &&
    payment.status !== "PAID" &&
    payment.booking?.receipt?.status === "PENDING" &&
    Boolean(payment.booking?.receipt?.imageUrl)
  );
}

function formatMoney(value?: number | string | null) {
  return `RM ${Number(value || 0).toLocaleString(
    "en-MY",
    {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }
  )}`;
}

export default function OperatorPaymentsScreen() {
  const [tab, setTab] = useState<PaymentTab>("PENDING");
  const [payments, setPayments] =
    useState<OperatorPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState("");

  const [selected, setSelected] =
    useState<OperatorPayment | null>(null);
  const [rejectMode, setRejectMode] = useState(false);
  const [remarks, setRemarks] = useState("");

  const loadPayments = useCallback(
    async (refresh = false) => {
      try {
        setError("");

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await getOperatorPayments();

        setPayments(
          Array.isArray(response?.payments)
            ? response.payments
            : []
        );
      } catch (err: any) {
        setError(
          err?.message || "Failed to load payments."
        );
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    []
  );

  useFocusEffect(
    useCallback(() => {
      loadPayments();
    }, [loadPayments])
  );

  const visiblePayments =
    tab === "PENDING"
      ? payments.filter(isReviewable)
      : payments;

  const openReview = (payment: OperatorPayment) => {
    setSelected(payment);
    setRejectMode(false);
    setRemarks("");
    setError("");
  };

  const closeReview = () => {
    if (processing) return;
    setSelected(null);
    setRejectMode(false);
    setRemarks("");
  };

  const handleApprove = () => {
    if (!selected || processing || !isReviewable(selected)) {
      return;
    }

    const paymentId = selected.id;

    Alert.alert(
      "Approve Payment",
      "Confirm that you have checked the receipt and verified that the payment was actually received.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Approve Payment",
          onPress: async () => {
            try {
              setProcessing(true);
              await approveOperatorPayment(paymentId);
              setSelected(null);
              await loadPayments(true);

              Alert.alert(
                "Success",
                "Payment verification approved."
              );
            } catch (err: any) {
              Alert.alert(
                "Approval Failed",
                err?.message || "Unable to approve payment."
              );
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const handleReject = () => {
    if (
      !selected ||
      processing ||
      !isReviewable(selected) ||
      !remarks.trim()
    ) {
      return;
    }

    const paymentId = selected.id;
    const reason = remarks.trim();

    Alert.alert(
      "Reject Payment Receipt",
      "The customer will be notified to upload a valid receipt again.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Reject Receipt",
          style: "destructive",
          onPress: async () => {
            try {
              setProcessing(true);
              await rejectOperatorPayment(
                paymentId,
                reason
              );

              setSelected(null);
              setRejectMode(false);
              setRemarks("");
              await loadPayments(true);

              Alert.alert(
                "Success",
                "Payment receipt rejected."
              );
            } catch (err: any) {
              Alert.alert(
                "Rejection Failed",
                err?.message || "Unable to reject receipt."
              );
            } finally {
              setProcessing(false);
            }
          },
        },
      ]
    );
  };

  const receipt = selected?.booking?.receipt;

  return (
    <SafeAreaView style={styles.safeArea}>
      <View style={styles.header}>
        <Text style={styles.eyebrow}>
          PAYMENT MANAGEMENT
        </Text>

        <Text style={styles.title}>Payments</Text>

        <Text style={styles.subtitle}>
          Review customer payment receipts
        </Text>
      </View>

      <View style={styles.tabs}>
        {(["PENDING", "ALL"] as PaymentTab[]).map(
          (value) => (
            <Pressable
              key={value}
              style={[
                styles.tab,
                tab === value && styles.activeTab,
              ]}
              onPress={() => setTab(value)}
            >
              <Text
                style={[
                  styles.tabText,
                  tab === value && styles.activeTabText,
                ]}
              >
                {value === "PENDING"
                  ? "Pending Review"
                  : "All Payments"}
              </Text>
            </Pressable>
          )
        )}
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadPayments(true)}
          />
        }
      >
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            {tab === "PENDING"
              ? "Pending Verification"
              : "Payment Records"}
          </Text>

          <Text style={styles.count}>
            {!loading && !error
              ? `${visiblePayments.length} records`
              : ""}
          </Text>
        </View>

        {!!error && (
          <View style={styles.emptyCard}>
            <Text style={styles.errorText}>{error}</Text>
            <Pressable onPress={() => loadPayments()}>
              <Text style={styles.link}>Try Again</Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#07869B"
            style={{ marginTop: 70 }}
          />
        ) : !error && visiblePayments.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="receipt-outline"
              size={35}
              color="#81939C"
            />
            <Text style={styles.emptyTitle}>
              No payments found
            </Text>
            <Text style={styles.muted}>
              Payment records will appear here.
            </Text>
          </View>
        ) : !error ? (
          visiblePayments.map((payment) => {
            const booking = payment.booking;
            const proof = booking?.receipt;
            const reviewable = isReviewable(payment);

            return (
              <View key={payment.id} style={styles.card}>
                <View style={styles.cardHeader}>
                  <Text style={styles.bookingCode}>
                    {booking?.bookingCode ||
                      `Booking #${payment.bookingId}`}
                  </Text>

                  <Text style={styles.statusText}>
                    {payment.status.replace(/_/g, " ")}
                  </Text>
                </View>

                <Text style={styles.carName}>
                  {booking?.serviceName || "Car Rental"}
                </Text>

                <Text style={styles.muted}>
                  {booking?.customer?.name || "Customer"}
                </Text>

                <View style={styles.divider} />

                <InfoRow
                  label="Payment Method"
                  value={payment.method || "N/A"}
                />

                <InfoRow
                  label="Total Payment"
                  value={formatMoney(payment.amount)}
                />

                <InfoRow
                  label="Down Payment"
                  value={`${formatMoney(
                    payment.downPaymentAmount
                  )} · ${
                    payment.downPaymentStatus || "N/A"
                  }`}
                />

                <InfoRow
                  label="Final Payment"
                  value={`${formatMoney(
                    payment.finalPaymentAmount
                  )} · ${
                    payment.finalPaymentStatus || "N/A"
                  }`}
                />

                <InfoRow
                  label="Receipt"
                  value={proof?.status || "Not uploaded"}
                />

                {reviewable && (
                  <Pressable
                    style={styles.reviewButton}
                    onPress={() => openReview(payment)}
                  >
                    <Ionicons
                      name="eye-outline"
                      size={18}
                      color="#FFFFFF"
                    />
                    <Text style={styles.reviewText}>
                      Review Receipt
                    </Text>
                  </Pressable>
                )}
              </View>
            );
          })
        ) : null}
      </ScrollView>

      <Modal
        visible={selected !== null}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={closeReview}
      >
        <SafeAreaView style={styles.modalPage}>
          <View style={styles.modalHeader}>
            <View style={{ flex: 1 }}>
              <Text style={styles.eyebrow}>
                MANUAL PAYMENT REVIEW
              </Text>
              <Text style={styles.modalTitle}>
                Verify Receipt
              </Text>
            </View>

            <Pressable
              style={styles.closeButton}
              onPress={closeReview}
              disabled={processing}
            >
              <Ionicons
                name="close"
                size={22}
                color="#17313C"
              />
            </Pressable>
          </View>

          <ScrollView
            contentContainerStyle={styles.modalContent}
            keyboardShouldPersistTaps="handled"
          >
            <Text style={styles.bookingCode}>
              {selected?.booking?.bookingCode ||
                `Booking #${selected?.bookingId || ""}`}
            </Text>

            <Text style={styles.muted}>
              {selected?.booking?.customer?.name ||
                "Customer"}
            </Text>

            {receipt?.imageUrl ? (
              <>
                <Image
                  source={{ uri: receipt.imageUrl }}
                  style={styles.receiptImage}
                  resizeMode="contain"
                />

                <Pressable
                  onPress={() => {
                    const url = receipt.imageUrl;
                    if (/^https?:\/\//i.test(url)) {
                      Linking.openURL(url).catch(() => {
                        Alert.alert(
                          "Error",
                          "Unable to open receipt."
                        );
                      });
                    }
                  }}
                >
                  <Text style={styles.link}>
                    Open Full Receipt
                  </Text>
                </Pressable>
              </>
            ) : (
              <Text style={styles.errorText}>
                Receipt image unavailable.
              </Text>
            )}

            <View style={styles.card}>
              <InfoRow
                label="Payment Type"
                value={receipt?.paymentType || "N/A"}
              />
              <InfoRow
                label="Expected Amount"
                value={
                  receipt?.expectedAmount != null
                    ? formatMoney(receipt.expectedAmount)
                    : "Not available"
                }
              />
              <InfoRow
                label="Receipt Status"
                value={receipt?.status || "N/A"}
              />
            </View>

            {rejectMode && (
              <TextInput
                value={remarks}
                onChangeText={setRemarks}
                placeholder="Reason for rejection *"
                placeholderTextColor="#91A2A9"
                multiline
                style={styles.reasonInput}
              />
            )}

            <Text style={styles.notice}>
              Verify the receipt against the payment
              amount and your actual transaction records.
              Approval must not be based on the uploaded
              image alone.
            </Text>

            {selected && isReviewable(selected) && (
              <View style={styles.actions}>
                <Pressable
                  style={styles.rejectButton}
                  disabled={processing}
                  onPress={() => {
                    if (!rejectMode) {
                      setRejectMode(true);
                    } else {
                      handleReject();
                    }
                  }}
                >
                  <Text style={styles.rejectText}>
                    {rejectMode
                      ? "Confirm Reject"
                      : "Reject"}
                  </Text>
                </Pressable>

                <Pressable
                  style={styles.approveButton}
                  disabled={processing}
                  onPress={
                    rejectMode
                      ? () => setRejectMode(false)
                      : handleApprove
                  }
                >
                  {processing ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <Text style={styles.approveText}>
                      {rejectMode
                        ? "Cancel Rejection"
                        : "Approve"}
                    </Text>
                  )}
                </Pressable>
              </View>
            )}
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <View style={styles.infoRow}>
      <Text style={styles.infoLabel}>{label}</Text>
      <Text style={styles.infoValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 20,
    paddingBottom: 15,
  },
  eyebrow: {
    color: "#07869B",
    fontSize: 10,
    fontWeight: "900",
    letterSpacing: 1.2,
  },
  title: {
    color: "#17313C",
    fontSize: 28,
    fontWeight: "900",
    marginTop: 5,
  },
  subtitle: {
    color: "#81939C",
    fontSize: 12,
    marginTop: 5,
  },
  tabs: {
    flexDirection: "row",
    paddingHorizontal: 20,
    gap: 10,
    paddingBottom: 12,
  },
  tab: {
    paddingHorizontal: 16,
    height: 44,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
  },
  activeTab: {
    backgroundColor: "#07869B",
    borderColor: "#07869B",
  },
  tabText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#617780",
  },
  activeTabText: {
    color: "#FFFFFF",
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 130,
    paddingTop: 12,
  },
  sectionHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 16,
    alignItems: "center",
  },
  sectionTitle: {
    color: "#17313C",
    fontSize: 17,
    fontWeight: "900",
  },
  count: {
    color: "#81939C",
    fontSize: 11,
  },
  card: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    borderRadius: 19,
    padding: 17,
    marginBottom: 13,
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  bookingCode: {
    color: "#17313C",
    fontSize: 14,
    fontWeight: "900",
  },
  statusText: {
    color: "#07869B",
    fontSize: 9,
    fontWeight: "800",
    flexShrink: 1,
  },
  carName: {
    color: "#17313C",
    fontSize: 16,
    fontWeight: "900",
    marginTop: 13,
  },
  muted: {
    color: "#81939C",
    fontSize: 12,
    marginTop: 8,
  },
  divider: {
    height: 1,
    backgroundColor: "#EDF1F3",
    marginVertical: 14,
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 10,
    marginVertical: 8,
  },
  infoLabel: {
    color: "#81939C",
    fontSize: 12,
    flex: 1,
  },
  infoValue: {
    color: "#17313C",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "right",
    flex: 1.6,
  },
  reviewButton: {
    backgroundColor: "#07869B",
    borderRadius: 13,
    paddingVertical: 14,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 8,
    marginTop: 15,
  },
  reviewText: {
    color: "#FFFFFF",
    fontSize: 12,
    fontWeight: "900",
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 20,
    borderWidth: 1,
    borderColor: "#E3EAED",
    padding: 30,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#17313C",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 12,
  },
  errorText: {
    color: "#D14343",
    fontSize: 12,
    textAlign: "center",
  },
  link: {
    color: "#07869B",
    fontSize: 13,
    fontWeight: "900",
    marginVertical: 12,
    textAlign: "center",
  },
  modalPage: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    padding: 20,
  },
  modalTitle: {
    color: "#17313C",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 5,
  },
  closeButton: {
    width: 42,
    height: 42,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    alignItems: "center",
    justifyContent: "center",
  },
  modalContent: {
    paddingHorizontal: 20,
    paddingBottom: 60,
  },
  receiptImage: {
    width: "100%",
    height: 330,
    marginTop: 15,
    borderRadius: 15,
    backgroundColor: "#EDF2F4",
  },
  reasonInput: {
    minHeight: 95,
    borderWidth: 1,
    borderColor: "#E3EAED",
    backgroundColor: "#FFFFFF",
    borderRadius: 14,
    padding: 14,
    textAlignVertical: "top",
    color: "#17313C",
    marginBottom: 15,
  },
  notice: {
    color: "#81939C",
    fontSize: 11,
    lineHeight: 18,
    marginBottom: 20,
  },
  actions: {
    flexDirection: "row",
    gap: 12,
  },
  rejectButton: {
    flex: 1,
    borderRadius: 13,
    backgroundColor: "#FFF0F0",
    borderWidth: 1,
    borderColor: "#F4CDCD",
    paddingVertical: 15,
    alignItems: "center",
  },
  rejectText: {
    color: "#D14343",
    fontWeight: "900",
    fontSize: 12,
  },
  approveButton: {
    flex: 1,
    borderRadius: 13,
    backgroundColor: "#07869B",
    paddingVertical: 15,
    alignItems: "center",
  },
  approveText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 12,
  },
});
