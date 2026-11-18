import { File } from "expo-file-system";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { FlatList, Pressable, RefreshControl, StyleSheet, View } from "react-native";
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
  StatusPill,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import {
  downloadOperatorLicenceDocument,
  getOperatorLicenceQueue,
  reviewOperatorLicence,
  type LicenceRejectionReason,
  type OperatorLicenceDocument,
  type OperatorLicenceQueue,
} from "@/services/operatorApi";
import { formatMYT } from "@/utils/datetime";
import { describeError } from "@/utils/errors";
import { logger } from "@/utils/logger";

const REASONS: { value: LicenceRejectionReason; label: string; detail: string }[] = [
  { value: "EXPIRED", label: "Expired", detail: "The licence is past its expiry date." },
  { value: "UNREADABLE", label: "Can't read it", detail: "Blurry, cut off or too dark to check." },
  { value: "NOT_A_LICENCE", label: "Not a driving licence", detail: "The upload is a different document." },
];

/**
 * Licence checks (plan phase 4): the customers' licences waiting for this
 * operator. The document is fetched with the login token into the app's
 * cache only and deleted when the screen closes. Approve asks once;
 * Reject needs one of the server's three reasons.
 */
export default function OperatorLicenceChecksScreen() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();

  const [queue, setQueue] = useState<OperatorLicenceQueue | null>(null);
  const [error, setError] = useState<unknown>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [opening, setOpening] = useState<number | null>(null);
  const [viewErrors, setViewErrors] = useState<Record<number, string>>({});
  const [approveDoc, setApproveDoc] = useState<OperatorLicenceDocument | null>(null);
  const [rejectDoc, setRejectDoc] = useState<OperatorLicenceDocument | null>(null);
  const [reason, setReason] = useState<LicenceRejectionReason | null>(null);
  const [reasonError, setReasonError] = useState<string | null>(null);
  const temporaryFiles = useRef<File[]>([]);

  // Delete the cached licence copies when leaving this screen.
  useEffect(
    () => () => {
      for (const file of temporaryFiles.current) {
        try {
          if (file.exists) file.delete();
        } catch {
          // Cache clean-up must not break navigation.
        }
      }
      temporaryFiles.current = [];
    },
    []
  );

  const load = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    setError(null);
    try {
      setQueue(await getOperatorLicenceQueue());
    } catch (err) {
      logger.debug("Failed to load the licence queue:", err);
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

  const view = async (doc: OperatorLicenceDocument) => {
    if (opening !== null) return;
    setOpening(doc.id);
    setViewErrors((current) => {
      const next = { ...current };
      delete next[doc.id];
      return next;
    });
    try {
      const { file, mimeType } = await downloadOperatorLicenceDocument(doc.id);
      temporaryFiles.current.push(file);
      const canPreview = await File.canPreview(file, { mimeType });
      if (!canPreview) throw new Error("This phone can't open this kind of document.");
      await File.preview(file, { title: "Driving licence", mimeType });
    } catch (err) {
      logger.debug("Licence preview failed:", err);
      setViewErrors((e) => ({ ...e, [doc.id]: describeError(err).message }));
    } finally {
      setOpening(null);
    }
  };

  const approve = async () => {
    if (!approveDoc) return;
    await reviewOperatorLicence(approveDoc.id, "APPROVED");
    toast.show(`${approveDoc.customer?.name || "The customer"}'s licence is verified.`, { tone: "ok" });
    setApproveDoc(null);
    await load(true);
  };

  const reject = async () => {
    if (!rejectDoc) return;
    if (!reason) {
      setReasonError("Choose why the licence can't be accepted.");
      return;
    }
    await reviewOperatorLicence(rejectDoc.id, "REJECTED", reason);
    toast.show("The customer has been asked to upload it again.", { tone: "ok" });
    setRejectDoc(null);
    await load(true);
  };

  const docs = queue?.documents ?? [];

  const header = (
    <View style={styles.header}>
      <View style={styles.topRow}>
        <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
        <AppText variant="largeTitle" accessibilityRole="header" style={styles.flex} numberOfLines={1} adjustsFontSizeToFit>
          Licence checks
        </AppText>
      </View>
      {queue && docs.length > 0 ? (
        <AppText variant="caption">
          {docs.length === 1 ? "1 licence waiting" : `${docs.length} licences waiting`}
          {queue.oldestSubmittedAt ? ` · oldest sent ${formatMYT(queue.oldestSubmittedAt, "dayDateTime")}` : ""}
        </AppText>
      ) : null}


      <GlassCard>
        <View style={{ gap: 10 }}>
          <AppText variant="bodyStrong">
            International Driving Permit
          </AppText>

          <AppText variant="caption">
            Review and verify IDP documents uploaded
            by customers for car rental bookings.
          </AppText>

          <Button
            label="International Permit Checks"
            variant="line"
            size="sm"
            icon="document-text-outline"
            onPress={() =>
              router.push("/operator/permit-checks" as Href)
            }
          />
        </View>
      </GlassCard>

    </View>
  );

  if (error && !queue) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8 }]}>
        {header}
        <ErrorState error={error} onRetry={() => load()} />
      </View>
    );
  }

  return (
    <View style={styles.screen}>
      <FlatList
        data={docs}
        keyExtractor={(d) => String(d.id)}
        ListHeaderComponent={header}
        ListEmptyComponent={
          queue ? (
            <EmptyState icon="card-outline" title="No licences to check" message="When a customer uploads a licence for one of your bookings, it appears here." />
          ) : (
            <View style={styles.list}>
              {[0, 1].map((i) => (
                <GlassCard key={i}>
                  <SkeletonText lines={4} />
                </GlassCard>
              ))}
            </View>
          )
        }
        ItemSeparatorComponent={() => <View style={styles.separator} />}
        renderItem={({ item }) => {
          const overdue = !!item.sla?.overdue;
          return (
            <GlassCard>
              <View style={styles.row}>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{item.customer?.name || "Customer"}</AppText>
                  {item.customer?.email ? <AppText variant="caption">{item.customer.email}</AppText> : null}
                </View>
                <StatusPill
                  label={
                    overdue
                      ? "Check overdue"
                      : item.sla
                        ? `Check within ${Math.max(item.sla.hoursRemaining, 0)} h`
                        : `By ${formatMYT(item.reviewDueAt, "dayDateTime")}`
                  }
                  tone={overdue ? "err" : "warn"}
                />
              </View>

              <View style={[styles.meta, { borderTopColor: tokens.line }]}>
                {item.booking ? (
                  <Pressable
                    onPress={() => router.push(`/operator/booking/${item.booking!.id}` as Href)}
                    accessibilityRole="link"
                    accessibilityLabel={`Open booking ${item.booking.bookingCode}`}
                  >
                    <AppText variant="mono" color="leafInk">
                      {item.booking.bookingCode}
                    </AppText>
                  </Pressable>
                ) : null}
                <AppText variant="caption">Sent {formatMYT(item.submittedAt, "dayDateTime")}</AppText>
              </View>

              <Button
                label="View licence"
                variant="line"
                size="sm"
                icon="document-text-outline"
                loading={opening === item.id}
                disabled={opening !== null && opening !== item.id}
                style={styles.mt12}
                onPress={() => view(item)}
              />
              <FieldError message={viewErrors[item.id]} />

              <View style={styles.actions}>
                <Button
                  label="Reject"
                  variant="line"
                  size="sm"
                  grow
                  onPress={() => {
                    setReason(null);
                    setReasonError(null);
                    setRejectDoc(item);
                  }}
                />
                <Button label="Approve" variant="brand" size="sm" grow onPress={() => setApproveDoc(item)} />
              </View>
            </GlassCard>
          );
        }}
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: insets.bottom + 24 }]}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => load(true)} tintColor={tokens.label} colors={[tokens.brand]} />
        }
      />

      <ConfirmSheet
        visible={!!approveDoc}
        title="Approve this licence?"
        message={`Approve only if you've opened the document and it's a valid, current driving licence for ${approveDoc?.customer?.name || "the customer"}. It's then used for their car bookings, and a paid booking moves to ready for pick-up.`}
        confirmLabel="Approve licence"
        onConfirm={approve}
        onCancel={() => setApproveDoc(null)}
      />

      <ConfirmSheet
        visible={!!rejectDoc}
        title="Reject this licence?"
        message="The customer is asked to upload it again, with your reason."
        confirmLabel="Reject licence"
        confirmVariant="danger"
        onConfirm={reject}
        onCancel={() => setRejectDoc(null)}
      >
        <View accessibilityRole="radiogroup">
          {REASONS.map((r) => {
            const on = reason === r.value;
            return (
              <Pressable
                key={r.value}
                onPress={() => {
                  setReason(r.value);
                  setReasonError(null);
                }}
                accessibilityRole="radio"
                accessibilityState={{ checked: on }}
                style={styles.choice}
              >
                <View style={[styles.radio, { borderColor: on ? tokens.brand : tokens.label }]}>
                  {on ? <View style={[styles.radioDot, { backgroundColor: tokens.brand }]} /> : null}
                </View>
                <View style={styles.flex}>
                  <AppText variant="bodyStrong">{r.label}</AppText>
                  <AppText variant="caption">{r.detail}</AppText>
                </View>
              </Pressable>
            );
          })}
        </View>
        <FieldError message={reasonError} />
      </ConfirmSheet>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  pad: {
    paddingHorizontal: 18,
  },
  content: {
    paddingHorizontal: 18,
  },
  header: {
    gap: 8,
    marginBottom: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  list: {
    gap: 12,
  },
  separator: {
    height: 12,
  },
  row: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
  },
  meta: {
    flexDirection: "row",
    flexWrap: "wrap",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  mt12: {
    marginTop: 12,
  },
  actions: {
    flexDirection: "row",
    gap: 8,
    marginTop: 10,
  },
  choice: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
  },
  radio: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  radioDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
});
