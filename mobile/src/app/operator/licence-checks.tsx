
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { File } from "expo-file-system";

import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
  Alert,
  Modal,
} from "react-native";

import {
  downloadOperatorLicenceDocument,
  getOperatorLicenceQueue,
  reviewOperatorLicence,
  OperatorLicenceQueue,
  LicenceRejectionReason,
} from "../../services/operatorApi";

function formatDate(value?: string | null) {
  if (!value) return "—";

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";

  return date.toLocaleString("en-MY", {
    timeZone: "Asia/Kuala_Lumpur",
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}

export default function OperatorLicenceChecksScreen() {
  const router = useRouter();

  const [queue, setQueue] =
    useState<OperatorLicenceQueue | null>(null);

  
const [openingDocumentId, setOpeningDocumentId] =
  useState<number | null>(null);


const [reviewingDocumentId, setReviewingDocumentId] =
  useState<number | null>(null);

const [rejectDocumentId, setRejectDocumentId] =
  useState<number | null>(null);

const [rejectionReason, setRejectionReason] =
  useState<LicenceRejectionReason | null>(null);

const [reviewError, setReviewError] = useState("");


const temporaryFiles = useRef<File[]>([]);

useEffect(() => {
  return () => {
    // Remove temporary licence files when leaving this screen.
    for (const file of temporaryFiles.current) {
      try {
        if (file.exists) {
          file.delete();
        }
      } catch {
        // Cache cleanup should not crash navigation.
      }
    }

    temporaryFiles.current = [];
  };
}, []);

const handleViewDocument = async (documentId: number) => {
  if (openingDocumentId !== null) return;

  try {
    setOpeningDocumentId(documentId);

    const { file, mimeType } =
      await downloadOperatorLicenceDocument(documentId);

    temporaryFiles.current.push(file);

    const canPreview = await File.canPreview(file, {
      mimeType,
    });

    if (!canPreview) {
      throw new Error(
        "This device cannot preview the selected document."
      );
    }

    await File.preview(file, {
      title: "Driving Licence",
      mimeType,
    });
  } catch (error: any) {
    Alert.alert(
      "Unable to View Document",
      error?.message || "Document preview failed."
    );
  } finally {
    setOpeningDocumentId(null);
  }
};


const submitLicenceReview = async (
  documentId: number,
  decision: "APPROVED" | "REJECTED",
  reason?: LicenceRejectionReason
) => {
  if (reviewingDocumentId !== null) return;

  try {
    setReviewingDocumentId(documentId);
    setReviewError("");

    const response = await reviewOperatorLicence(
      documentId,
      decision,
      reason
    );

    setRejectDocumentId(null);
    setRejectionReason(null);

    // Refresh the queue after a successful review.
    await loadQueue(true);

    Alert.alert(
      "Review Completed",
      response.message ||
        (decision === "APPROVED"
          ? "Driving licence approved."
          : "Customer will be asked to re-upload the licence.")
    );
  } catch (error: any) {
    const message =
      error?.message || "Unable to review driving licence.";

    setReviewError(message);
    Alert.alert("Review Failed", message);
  } finally {
    setReviewingDocumentId(null);
  }
};

const handleApproveLicence = (documentId: number) => {
  Alert.alert(
    "Approve Driving Licence",
    "Confirm that you have reviewed the document and it meets the verification requirements.",
    [
      { text: "Cancel", style: "cancel" },
      {
        text: "Approve",
        onPress: () => {
          void submitLicenceReview(documentId, "APPROVED");
        },
      },
    ]
  );
};

const handleOpenReject = (documentId: number) => {
  setRejectionReason(null);
  setReviewError("");
  setRejectDocumentId(documentId);
};

const handleConfirmReject = () => {
  if (rejectDocumentId === null || !rejectionReason) {
    Alert.alert(
      "Reason Required",
      "Please select why the driving licence was rejected."
    );
    return;
  }

  void submitLicenceReview(
    rejectDocumentId,
    "REJECTED",
    rejectionReason
  );
};



  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const loadQueue = useCallback(
    async (refresh = false) => {
      try {
        setError("");

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const data = await getOperatorLicenceQueue();
        setQueue(data);
      } catch (err: any) {
        setError(
          err?.message || "Unable to load licence queue."
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
      loadQueue();
    }, [loadQueue])
  );

  const documents = queue?.documents || [];

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color="#17313C"
          />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            OPERATOR VERIFICATION
          </Text>
          <Text style={styles.title}>
            Licence Checks
          </Text>
          <Text style={styles.subtitle}>
            Review customer driving licences
          </Text>
        </View>
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadQueue(true)}
          />
        }
      >
        <View style={styles.statsRow}>
          <View style={styles.statCard}>
            <Text style={styles.statLabel}>
              Pending Review
            </Text>
            <Text style={styles.statValue}>
              {queue?.queueDepth ?? "—"}
            </Text>
          </View>

          <View style={styles.statCard}>
            <Text style={styles.statLabel}>
              Oldest Submission
            </Text>
            <Text style={styles.statValueSmall}>
              {queue?.oldestSubmittedAt
                ? formatDate(queue.oldestSubmittedAt)
                : "—"}
            </Text>
          </View>
        </View>

        <Text style={styles.sectionTitle}>
          Awaiting Verification
        </Text>

        {loading ? (
          <ActivityIndicator
            size="large"
            color="#07869B"
            style={{ marginTop: 50 }}
          />
        ) : error ? (
          <View style={styles.emptyCard}>
            <Text style={styles.error}>{error}</Text>
            <Pressable onPress={() => loadQueue()}>
              <Text style={styles.retry}>Try Again</Text>
            </Pressable>
          </View>
        ) : documents.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="checkmark-circle-outline"
              size={38}
              color="#07869B"
            />
            <Text style={styles.emptyTitle}>
              No licences awaiting review
            </Text>
            <Text style={styles.muted}>
              New submissions will appear here.
            </Text>
          </View>
        ) : (
          documents.map((document) => (
            <View key={document.id} style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.customerName}>
                  {document.customer?.name || "Customer"}
                </Text>

                <Text style={styles.statusBadge}>
                  UNDER REVIEW
                </Text>
              </View>

              <InfoRow
                label="Booking"
                value={
                  document.booking?.bookingCode ||
                  "Not available"
                }
              />

              <InfoRow
                label="File"
                value={document.originalName}
              />

              <InfoRow
                label="Submitted"
                value={formatDate(document.submittedAt)}
              />

              <InfoRow
                label="Review Deadline"
                value={formatDate(document.reviewDueAt)}
              />

              {document.sla?.overdue && (
                <Text style={styles.overdue}>
                  Review deadline exceeded
                </Text>
              )}

              
                <View style={styles.notice}>
                <Ionicons
                    name="shield-checkmark-outline"
                    size={18}
                    color="#07869B"
                />
                <Text style={styles.noticeText}>
                    This licence is awaiting verification.
                    Open the document to review its details.
                </Text>
                </View>

                <Pressable
                style={styles.viewDocumentButton}
                disabled={openingDocumentId !== null}
                onPress={() => handleViewDocument(document.id)}
                >
                {openingDocumentId === document.id ? (
                    <ActivityIndicator color="#FFFFFF" />
                ) : (
                    <>
                    <Ionicons
                        name="eye-outline"
                        size={19}
                        color="#FFFFFF"
                    />
                    <Text style={styles.viewDocumentText}>
                        View Document
                    </Text>
                    </>
                )}
                </Pressable>


                <View style={styles.reviewActions}>
                <Pressable
                    style={[
                    styles.approveButton,
                    reviewingDocumentId !== null && styles.disabledButton,
                    ]}
                    disabled={reviewingDocumentId !== null}
                    onPress={() => handleApproveLicence(document.id)}
                >
                    {reviewingDocumentId === document.id ? (
                    <ActivityIndicator color="#FFFFFF" />
                    ) : (
                    <>
                        <Ionicons
                        name="checkmark-circle-outline"
                        size={19}
                        color="#FFFFFF"
                        />
                        <Text style={styles.actionButtonText}>
                        Approve
                        </Text>
                    </>
                    )}
                </Pressable>

                <Pressable
                    style={[
                    styles.rejectButton,
                    reviewingDocumentId !== null && styles.disabledButton,
                    ]}
                    disabled={reviewingDocumentId !== null}
                    onPress={() => handleOpenReject(document.id)}
                >
                    <Ionicons
                    name="close-circle-outline"
                    size={19}
                    color="#C64F4F"
                    />
                    <Text style={styles.rejectButtonText}>
                    Reject
                    </Text>
                </Pressable>
                </View>


            </View>
          ))
        )}
      </ScrollView>

        
<Modal
  visible={rejectDocumentId !== null}
  transparent
  animationType="fade"
  onRequestClose={() => {
    if (reviewingDocumentId === null) {
      setRejectDocumentId(null);
    }
  }}
>
  <View style={styles.modalOverlay}>
    <View style={styles.modalCard}>
      <View style={styles.modalHeader}>
        <Ionicons
          name="alert-circle-outline"
          size={25}
          color="#C64F4F"
        />

        <Text style={styles.modalTitle}>
          Reject Driving Licence
        </Text>
      </View>

      <Text style={styles.modalDescription}>
        Select the reason for rejection.
        The customer will be notified and
        asked to upload a new document.
      </Text>

      {([
        ["EXPIRED", "Expired licence"],
        ["UNREADABLE", "Unclear or unreadable document"],
        ["NOT_A_LICENCE", "Not a driving licence"],
      ] as [LicenceRejectionReason, string][]).map(
        ([value, label]) => (
          <Pressable
            key={value}
            disabled={reviewingDocumentId !== null}
            style={[
              styles.reasonOption,
              rejectionReason === value &&
                styles.reasonOptionSelected,
            ]}
            onPress={() => setRejectionReason(value)}
          >
            <Ionicons
              name={
                rejectionReason === value
                  ? "radio-button-on"
                  : "radio-button-off"
              }
              size={21}
              color="#07869B"
            />

            <Text style={styles.reasonLabel}>
              {label}
            </Text>
          </Pressable>
        )
      )}

      {!!reviewError && (
        <Text style={styles.reviewError}>
          {reviewError}
        </Text>
      )}

      <View style={styles.modalActions}>
        <Pressable
          style={styles.cancelButton}
          disabled={reviewingDocumentId !== null}
          onPress={() => {
            setRejectDocumentId(null);
            setRejectionReason(null);
          }}
        >
          <Text style={styles.cancelButtonText}>
            Cancel
          </Text>
        </Pressable>

        <Pressable
          style={[
            styles.confirmRejectButton,
            (!rejectionReason ||
              reviewingDocumentId !== null) &&
              styles.disabledButton,
          ]}
          disabled={
            !rejectionReason ||
            reviewingDocumentId !== null
          }
          onPress={handleConfirmReject}
        >
          {reviewingDocumentId !== null ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.actionButtonText}>
              Confirm Reject
            </Text>
          )}
        </Pressable>
      </View>
    </View>
  </View>
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
  screen: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 20,
  },
  backButton: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: {
    fontSize: 10,
    color: "#07869B",
    fontWeight: "900",
  },
  title: {
    fontSize: 24,
    fontWeight: "900",
    color: "#17313C",
    marginTop: 5,
  },
  subtitle: {
    fontSize: 12,
    color: "#81939C",
    marginTop: 5,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 80,
  },
  statsRow: {
    flexDirection: "row",
    gap: 12,
    marginBottom: 24,
  },
  statCard: {
    flex: 1,
    borderRadius: 16,
    padding: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
  },
  statLabel: {
    color: "#81939C",
    fontSize: 11,
  },
  statValue: {
    color: "#17313C",
    fontSize: 25,
    fontWeight: "900",
    marginTop: 8,
  },
  statValueSmall: {
    color: "#17313C",
    fontSize: 12,
    fontWeight: "800",
    marginTop: 12,
  },
  sectionTitle: {
    color: "#17313C",
    fontSize: 17,
    fontWeight: "900",
    marginBottom: 15,
  },
  card: {
    padding: 17,
    borderRadius: 18,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    marginBottom: 14,
  },
  cardHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 9,
    alignItems: "center",
    marginBottom: 15,
  },
  customerName: {
    flex: 1,
    fontWeight: "900",
    fontSize: 16,
    color: "#17313C",
  },
  statusBadge: {
    fontSize: 9,
    fontWeight: "900",
    color: "#07869B",
  },
  infoRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: 12,
    marginVertical: 8,
  },
  infoLabel: {
    flex: 1,
    color: "#81939C",
    fontSize: 12,
  },
  infoValue: {
    flex: 1.5,
    textAlign: "right",
    color: "#17313C",
    fontSize: 12,
    fontWeight: "800",
  },
  overdue: {
    marginTop: 12,
    color: "#D14343",
    fontWeight: "800",
    fontSize: 11,
  },
  notice: {
    flexDirection: "row",
    gap: 10,
    backgroundColor: "#E6F7F9",
    borderRadius: 12,
    padding: 13,
    marginTop: 14,
  },
  noticeText: {
    flex: 1,
    color: "#617780",
    fontSize: 11,
    lineHeight: 18,
  },
  emptyCard: {
    padding: 35,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    borderRadius: 18,
    alignItems: "center",
  },
  emptyTitle: {
    color: "#17313C",
    fontSize: 15,
    fontWeight: "900",
    marginTop: 12,
  },
  muted: {
    color: "#81939C",
    textAlign: "center",
    fontSize: 12,
    marginTop: 9,
  },
  error: {
    color: "#D14343",
    fontSize: 12,
    textAlign: "center",
  },
  retry: {
    color: "#07869B",
    fontWeight: "900",
    marginTop: 12,
  },

  viewDocumentButton: {
  backgroundColor: "#07869B",
  borderRadius: 13,
  minHeight: 48,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 9,
  marginTop: 13,
},

viewDocumentText: {
  color: "#FFFFFF",
  fontSize: 12,
  fontWeight: "900",
},


reviewActions: {
  flexDirection: "row",
  gap: 10,
  marginTop: 12,
},

approveButton: {
  flex: 1,
  minHeight: 48,
  borderRadius: 13,
  backgroundColor: "#1E946C",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
},

rejectButton: {
  flex: 1,
  minHeight: 48,
  borderRadius: 13,
  backgroundColor: "#FFF4F4",
  borderWidth: 1,
  borderColor: "#E7BBBB",
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 7,
},

actionButtonText: {
  color: "#FFFFFF",
  fontSize: 12,
  fontWeight: "900",
},

rejectButtonText: {
  color: "#C64F4F",
  fontSize: 12,
  fontWeight: "900",
},

disabledButton: {
  opacity: 0.5,
},

modalOverlay: {
  flex: 1,
  backgroundColor: "rgba(0, 0, 0, 0.5)",
  justifyContent: "center",
  padding: 22,
},

modalCard: {
  backgroundColor: "#FFFFFF",
  borderRadius: 22,
  padding: 22,
},

modalHeader: {
  flexDirection: "row",
  alignItems: "center",
  gap: 10,
  marginBottom: 12,
},

modalTitle: {
  flex: 1,
  fontSize: 18,
  fontWeight: "900",
  color: "#17313C",
},

modalDescription: {
  color: "#617780",
  fontSize: 12,
  lineHeight: 19,
  marginBottom: 19,
},

reasonOption: {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  padding: 15,
  borderWidth: 1,
  borderColor: "#E3EAED",
  borderRadius: 13,
  marginBottom: 10,
},

reasonOptionSelected: {
  borderColor: "#07869B",
  backgroundColor: "#EAF8FA",
},

reasonLabel: {
  flex: 1,
  color: "#17313C",
  fontSize: 12,
  fontWeight: "700",
},

modalActions: {
  flexDirection: "row",
  gap: 10,
  marginTop: 12,
},

cancelButton: {
  flex: 1,
  minHeight: 48,
  borderRadius: 13,
  backgroundColor: "#F1F5F6",
  justifyContent: "center",
  alignItems: "center",
},

cancelButtonText: {
  color: "#617780",
  fontSize: 12,
  fontWeight: "900",
},

confirmRejectButton: {
  flex: 1,
  minHeight: 48,
  borderRadius: 13,
  backgroundColor: "#C64F4F",
  justifyContent: "center",
  alignItems: "center",
},

reviewError: {
  color: "#C64F4F",
  fontSize: 12,
  marginTop: 8,
},


});
