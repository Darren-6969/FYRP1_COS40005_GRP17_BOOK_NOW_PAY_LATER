
import { File } from "expo-file-system";
import {
  useFocusEffect,
  useRouter,
  type Href,
} from "expo-router";
import {
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppText,
  Button,
  ConfirmSheet,
  EmptyState,
  ErrorState,
  FieldError,
  GlassCard,
  IconButton,
  SkeletonText,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import {
  downloadOperatorPermitDocument,
  getOperatorPermitQueue,
  reviewOperatorPermit,
  type OperatorPermitDocument,
  type PermitRejectionReason,
} from "@/services/operatorApi";
import { formatMYT } from "@/utils/datetime";
import { describeError } from "@/utils/errors";

const REASONS: {
  value: PermitRejectionReason;
  label: string;
}[] = [
  { value: "EXPIRED", label: "Expired permit" },
  { value: "UNREADABLE", label: "Unreadable document" },
  { value: "NOT_A_PERMIT", label: "Not an international permit" },
  { value: "DETAILS_MISMATCH", label: "Details do not match" },
];

export default function OperatorPermitChecksScreen() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  const [documents, setDocuments] =
    useState<OperatorPermitDocument[] | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const [reviewing, setReviewing] = useState(false);

  const [openedIds, setOpenedIds] = useState<number[]>([]);
  const [viewErrors, setViewErrors] =
    useState<Record<number, string>>({});
  const [approveDoc, setApproveDoc] =
    useState<OperatorPermitDocument | null>(null);
  const [rejectDoc, setRejectDoc] =
    useState<OperatorPermitDocument | null>(null);
  const [reason, setReason] =
    useState<PermitRejectionReason | null>(null);
  const [reasonError, setReasonError] =
    useState<string | null>(null);

  const temporaryFiles = useRef<File[]>([]);

  // Delete downloaded documents on screen unmount.
  useEffect(() => {
    return () => {
      for (const file of temporaryFiles.current) {
        try {
          if (file.exists) file.delete();
        } catch {
          // Ignore cache cleanup errors.
        }
      }
      temporaryFiles.current = [];
    };
  }, []);

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);

    try {
      const response = await getOperatorPermitQueue();
      setDocuments(
        Array.isArray(response.documents)
          ? response.documents
          : []
      );
    } catch (err) {
      setError(err);
    } finally {
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const viewPermit = async (doc: OperatorPermitDocument) => {
    if (opening !== null) return;

    setOpening(doc.id);

    try {
      const { file, mimeType } =
        await downloadOperatorPermitDocument(doc.id);

      temporaryFiles.current.push(file);

      const canPreview = await File.canPreview(
        file,
        { mimeType }
      );

      if (!canPreview) {
        throw new Error(
          "This phone cannot preview the document."
        );
      }

      await File.preview(file, {
        title: "International Driving Permit",
        mimeType,
      });

      setOpenedIds((current) =>
        current.includes(doc.id)
          ? current
          : [...current, doc.id]
      );

      setViewErrors((current) => {
        const next = { ...current };
        delete next[doc.id];
        return next;
      });
    } catch (err) {
      setViewErrors((current) => ({
        ...current,
        [doc.id]: describeError(err).message,
      }));
    } finally {
      setOpening(null);
    }
  };

  const approve = async () => {
    if (!approveDoc || reviewing) return;

    try {
      setReviewing(true);

      await reviewOperatorPermit(
        approveDoc.id,
        "APPROVED"
      );

      toast.show("International Permit approved.", {
        tone: "ok",
      });

      setApproveDoc(null);
      await load(true);
    } catch (err) {
      toast.show(describeError(err).message, {
        tone: "err",
      });
    } finally {
      setReviewing(false);
    }
  };

  const reject = async () => {
    if (!rejectDoc || reviewing) return;

    if (!reason) {
      setReasonError("Select a rejection reason.");
      return;
    }

    try {
      setReviewing(true);

      await reviewOperatorPermit(
        rejectDoc.id,
        "REJECTED",
        reason
      );

      toast.show(
        "Permit rejected. Customer can re-upload.",
        { tone: "ok" }
      );

      setRejectDoc(null);
      setReason(null);
      await load(true);
    } catch (err) {
      toast.show(describeError(err).message, {
        tone: "err",
      });
    } finally {
      setReviewing(false);
    }
  };

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <IconButton
          icon="chevron-back"
          label="Back"
          onPress={() => router.back()}
        />

        <AppText
          variant="largeTitle"
          style={styles.flex}
        >
          Permit checks
        </AppText>
      </View>

      <AppText variant="caption">
        Review International Driving Permits submitted
        for your company's bookings.
      </AppText>

      <AppText variant="bodyStrong">
        {documents?.length ?? 0} permits waiting
      </AppText>
    </View>
  );

  if (error && !documents) {
    return (
      <View
        style={[
          styles.screen,
          {
            paddingTop: insets.top + 8,
            paddingHorizontal: 18,
          },
        ]}
      >
        {header}
        <ErrorState
          error={error}
          onRetry={() => load()}
        />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={documents ?? []}
        keyExtractor={(item) => String(item.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={
          documents ? (
            <EmptyState
              icon="document-text-outline"
              title="No permits to review"
              message="New International Permit submissions will appear here."
            />
          ) : (
            <GlassCard>
              <SkeletonText lines={4} />
            </GlassCard>
          )
        }
        ItemSeparatorComponent={() => (
          <View style={{ height: 12 }} />
        )}
        renderItem={({ item }) => {
          const opened = openedIds.includes(item.id);

          return (
            <GlassCard>
              <AppText variant="bodyStrong">
                {item.customer?.name || "Customer"}
              </AppText>

              {item.customer?.email ? (
                <AppText variant="caption">
                  {item.customer.email}
                </AppText>
              ) : null}

              <View style={styles.details}>
                {item.booking && (
                  <Pressable
                    onPress={() =>
                      router.push(
                        `/operator/booking/${item.booking!.id}` as Href
                      )
                    }
                  >
                    <AppText variant="mono" color="leafInk">
                      {item.booking.bookingCode}
                    </AppText>
                  </Pressable>
                )}

                <AppText variant="caption">
                  Document: {item.originalName}
                </AppText>

                <AppText variant="caption">
                  Expiry:{" "}
                  {item.permitExpiryDate
                    ? formatMYT(
                        item.permitExpiryDate,
                        "dayDate"
                      )
                    : "Not provided"}
                </AppText>

                <AppText variant="caption">
                  Submitted:{" "}
                  {formatMYT(
                    item.submittedAt,
                    "dayDateTime"
                  )}
                </AppText>
              </View>

              <Button
                label={
                  opened ? "View permit again" : "View permit"
                }
                icon="document-text-outline"
                variant="line"
                size="sm"
                loading={opening === item.id}
                disabled={opening !== null || reviewing}
                onPress={() => viewPermit(item)}
              />

              <FieldError message={viewErrors[item.id]} />

              <View style={styles.actions}>
                <Button
                  label="Reject"
                  variant="line"
                  size="sm"
                  grow
                  disabled={!opened || reviewing}
                  onPress={() => {
                    setReason(null);
                    setReasonError(null);
                    setRejectDoc(item);
                  }}
                />

                <Button
                  label="Approve"
                  variant="brand"
                  size="sm"
                  grow
                  disabled={!opened || reviewing}
                  onPress={() => setApproveDoc(item)}
                />
              </View>

              {!opened && (
                <AppText variant="caption">
                  Open the permit before reviewing.
                </AppText>
              )}
            </GlassCard>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => load(true)}
            tintColor={tokens.label}
            colors={[tokens.brand]}
          />
        }
        contentContainerStyle={{
          paddingHorizontal: 18,
          paddingTop: insets.top + 8,
          paddingBottom: insets.bottom + 24,
        }}
        showsVerticalScrollIndicator={false}
      />

      <ConfirmSheet
        visible={!!approveDoc}
        title="Approve International Permit?"
        message={`Confirm that you inspected the permit for ${
          approveDoc?.customer?.name || "this customer"
        }, verified the driver's details, and checked its validity for the rental period.`}
        confirmLabel="Approve permit"
        onConfirm={approve}
        onCancel={() => setApproveDoc(null)}
      />

      <ConfirmSheet
        visible={!!rejectDoc}
        title="Reject International Permit?"
        message="Choose the reason for rejection."
        confirmLabel="Reject permit"
        confirmVariant="danger"
        onConfirm={reject}
        onCancel={() => setRejectDoc(null)}
      >
        <View>
          {REASONS.map((item) => (
            <Pressable
              key={item.value}
              onPress={() => {
                setReason(item.value);
                setReasonError(null);
              }}
              style={styles.reasonRow}
            >
              <AppText variant="bodyStrong">
                {reason === item.value ? "◉" : "○"}{" "}
                {item.label}
              </AppText>
            </Pressable>
          ))}

          <FieldError message={reasonError} />
        </View>
      </ConfirmSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  header: {
    gap: 10,
    marginBottom: 18,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  details: {
    gap: 8,
    marginVertical: 14,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "transparent",
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 12,
  },
  reasonRow: {
    paddingVertical: 14,
  },
});
