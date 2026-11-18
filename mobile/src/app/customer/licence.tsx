import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useState, type ComponentProps, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { SaveError } from "@/components/account/AccountScreen";
import {
  AppText,
  Button,
  ErrorState,
  FieldError,
  FLOATING_BAR_CLEARANCE,
  FloatingActionBar,
  GlassCard,
  IconButton,
  SkeletonText,
  StatusPill,
  useToast,
} from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  getCustomerBookings,
  getMyLicence,
  uploadLicenceFile,
  type LicenceDocument,
  type MyLicenceResponse,
} from "@/services/customerApi";
import { bookingRef } from "@/utils/booking-view";
import { formatMYT } from "@/utils/datetime";
import { logger } from "@/utils/logger";
import { startAsync } from "@/utils/start-async";

type IconName = ComponentProps<typeof Ionicons>["name"];

/** The server's limit and types (licence_controller.js licenceUpload). */
const MAX_LICENCE_BYTES = 5 * 1024 * 1024;
const ACCEPTED_TYPES = new Set(["image/jpeg", "image/jpg", "image/png"]);

/**
 * Booking statuses where the licence is still to come: accepted, not yet
 * collected. The licence shares the balance deadline (CLAUDE.md).
 */
const LICENCE_PENDING_STATUSES = new Set(["ACCEPTED", "PENDING_PAYMENT", "CONFIRMED", "PAID"]);

type View_ = "none" | "review" | "approved" | "rejected" | "expired";

function viewOf(doc: LicenceDocument | null): View_ {
  if (!doc) return "none";
  if (doc.status === "UNDER_REVIEW") return "review";
  if (doc.status === "APPROVED") return "approved";
  return doc.rejectionReason === "EXPIRED" ? "expired" : "rejected";
}

function reasonText(reason: string | null) {
  switch (reason) {
    case "UNREADABLE":
      return "The photo was hard to read. Take a sharp, well-lit photo of the whole card.";
    case "NOT_A_LICENCE":
      return "The photo wasn't a driving licence. Upload a photo of your driving licence card.";
    case "EXPIRED":
      return "The licence had expired. Upload your current licence.";
    default:
      return "The operator couldn't verify it. Upload a clear photo of your current licence.";
  }
}

/** The booking a Profile upload should go to: the next car booking still waiting for its licence. */
function bookingNeedingLicence(bookings: any[]): any | null {
  const now = Date.now();
  const waiting = (bookings || []).filter(
    (b) =>
      (b?.serviceType ?? "CAR_RENTAL") === "CAR_RENTAL" &&
      LICENCE_PENDING_STATUSES.has(b?.status) &&
      (!b?.pickupDate || new Date(b.pickupDate).getTime() > now)
  );
  waiting.sort((a, b) => new Date(a.pickupDate ?? 0).getTime() - new Date(b.pickupDate ?? 0).getTime());
  return waiting[0] ?? null;
}

type Loaded = {
  mine: MyLicenceResponse;
  /** The account's latest licence (mine.document). */
  doc: LicenceDocument | null;
  /** When this was loaded; deadlines are compared with it, not with the clock during render. */
  loadedAt: number;
  /** Where an upload goes. Null: the account only. */
  target: { id: number | string; label: string } | null;
};

/**
 * F19: the customer's driving licence. Shows upload, under review,
 * approved, rejected with the reason, and expired.
 *
 * An approved licence on the account is reused for every car booking
 * (isLicenceSatisfied in booking_status_service.js). Uploads go against a
 * booking when there is one waiting, because the operator review queue only
 * lists licences linked to a booking. Opened from booking detail with
 * ?bookingId, or from Profile.
 */
export default function LicenceScreen() {
  const router = useRouter();
  const toast = useToast();
  const insets = useSafeAreaInsets();
  const { tokens } = useTheme();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const bookingId = params.bookingId || null;

  const [data, setData] = useState<Loaded | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [photo, setPhoto] = useState<{ uri: string } | null>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<unknown>(null);
  const [replacing, setReplacing] = useState(false);

  const load = useCallback(
    () =>
      startAsync(async () => {
    try {
      // The account's latest licence, from any booking. An approved one is
      // reused for every car booking, so it is what this screen shows.
      const mine = await getMyLicence();
      let target: Loaded["target"] = null;

      if (bookingId) {
        target = { id: bookingId, label: "this booking" };
      } else {
        try {
          const bookings = await getCustomerBookings();
          const waiting = bookingNeedingLicence(Array.isArray(bookings) ? bookings : []);
          if (waiting) {
            const operator = waiting.operator?.companyName;
            target = {
              id: waiting.id,
              label: operator ? `booking ${bookingRef(waiting)} with ${operator}` : `booking ${bookingRef(waiting)}`,
            };
          }
        } catch (err) {
          // Without the list the upload goes on the account, as on the website.
          logger.debug("Couldn't load bookings for the licence target:", err);
        }
      }
      const doc = mine.document;
      setData({ mine, doc, target, loadedAt: Date.now() });
    } catch (err) {
      logger.debug("Failed to load licence:", err);
      setLoadError(err);
    }
      }),
    [bookingId]
  );

  // Retry resets first; the first load needs no reset, so the effect's load
  // makes no synchronous state updates (react-hooks/set-state-in-effect).
  const retry = () => {
    setLoadError(null);
    return load();
  };

  useEffect(() => {
    load();
  }, [load]);

  const pickPhoto = async () => {
    setPhotoError(null);
    setSendError(null);
    try {
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhotoError("Allow photo access in your phone's settings to upload your licence.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        quality: 0.7,
      });
      if (result.canceled) return;
      const asset = result.assets?.[0];
      if (!asset?.uri) {
        setPhotoError("We couldn't read that photo. Please choose another one.");
        return;
      }
      if (asset.mimeType && !ACCEPTED_TYPES.has(asset.mimeType.toLowerCase())) {
        setPhotoError("Use a JPEG or PNG photo of your licence.");
        return;
      }
      if (asset.fileSize && asset.fileSize > MAX_LICENCE_BYTES) {
        setPhotoError("This photo is over 5 MB. Crop it closer to the licence and try again.");
        return;
      }
      setPhoto({ uri: asset.uri });
    } catch (err) {
      logger.debug("Licence photo picker failed:", err);
      setPhotoError("We couldn't open your photos. Please try again.");
    }
  };

  const send = async () => {
    if (!photo) {
      setPhotoError("Add a photo of your driving licence.");
      return;
    }
    setSendError(null);
    try {
      await uploadLicenceFile({ uri: photo.uri, bookingId: data?.target?.id ?? null });
      toast.show("Licence sent. The operator will check it.", { tone: "ok" });
      setPhoto(null);
      setReplacing(false);
      await load();
    } catch (err) {
      logger.debug("Licence upload failed:", err);
      setSendError(err);
    }
  };

  const header = (
    <View style={styles.topRow}>
      <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
      <AppText variant="largeTitle" accessibilityRole="header" style={styles.flex} numberOfLines={1} adjustsFontSizeToFit>
        Driving licence
      </AppText>
    </View>
  );

  if (loadError) {
    return (
      <View style={[styles.screen, styles.pad, { paddingTop: insets.top + 8 }]}>
        {header}
        <ErrorState error={loadError} onRetry={retry} />
      </View>
    );
  }

  const view = data ? viewOf(data.doc) : null;
  const doc = data?.doc ?? null;
  // The server applies the window per booking: a rejection on another
  // booking doesn't block an upload for the booking that is due now.
  const sameBooking = !data?.target || String(doc?.bookingId ?? "") === String(data.target.id);
  const windowClosed =
    !!data && !!doc && (view === "rejected" || view === "expired") && sameBooking && !data.mine.canReupload;
  // The re-upload deadline only applies to the same booking, and only while ahead.
  const endsAt = data?.mine.reuploadWindowEndsAt ?? null;
  const uploadBy = sameBooking && endsAt && new Date(endsAt).getTime() > (data?.loadedAt ?? 0) ? endsAt : null;
  // An upload that isn't linked to a booking (the website's route) never
  // reaches an operator's review queue; let it be sent again for the booking.
  const unlinkedReview = view === "review" && !!doc && doc.bookingId == null && !!data?.target;
  const canUpload =
    !!data &&
    (view === "none" ||
      unlinkedReview ||
      ((view === "rejected" || view === "expired") && !windowClosed) ||
      (view === "approved" && replacing));

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          { paddingTop: insets.top + 8, paddingBottom: (canUpload ? FLOATING_BAR_CLEARANCE : 0) + insets.bottom + 16 },
        ]}
        showsVerticalScrollIndicator={false}
      >
        {header}

        <GlassCard>
  <View style={{ gap: 10 }}>
    <AppText variant="headline">
      International Driving Permit
    </AppText>

    <AppText variant="caption">
      Travelling with an overseas driving licence?
      You may need an International Driving Permit
      for your car rental.
    </AppText>

    <Button
      label="Manage International Permit"
      variant="line"
      icon="document-text-outline"
      onPress={() =>
        router.push({
          pathname: "../customer/permit",
          params: bookingId ? { bookingId } : {},
        })
      }
    />
  </View>
</GlassCard>

        {!data || !view ? (
          <GlassCard>
            <SkeletonText lines={4} />
          </GlassCard>
        ) : (
          <>
            <StateCard view={view} doc={doc} reuploadEndsAt={uploadBy} windowClosed={windowClosed} />

            {unlinkedReview ? (
              <AppText variant="caption">
                Your earlier upload isn&apos;t linked to a booking, so no operator can check it yet. Send it again for{" "}
                {data.target?.label} below.
              </AppText>
            ) : null}

            {view === "approved" && !replacing ? (
              <Button
                label="Upload a renewed licence"
                variant="line"
                icon="refresh"
                onPress={() => setReplacing(true)}
              />
            ) : null}

            {windowClosed ? (
              <Button
                label="Contact support"
                variant="line"
                icon="chatbubbles-outline"
                onPress={() => router.push("/customer/support-chat" as Href)}
              />
            ) : null}

            {canUpload ? (
              <View style={styles.section}>
                <AppText variant="headline" accessibilityRole="header">
                  {view === "approved" ? "Your renewed licence" : unlinkedReview ? "Send it for your booking" : "Upload your licence"}
                </AppText>
                <Pressable
                  onPress={pickPhoto}
                  accessibilityRole="button"
                  accessibilityLabel={photo ? "Change licence photo" : "Add licence photo"}
                  style={[
                    styles.photo,
                    {
                      backgroundColor: tokens.glass,
                      borderColor: photoError ? tokens.errFg : tokens.glassLine,
                      borderWidth: photoError ? 1.5 : StyleSheet.hairlineWidth,
                    },
                  ]}
                >
                  {photo ? (
                    <>
                      <Image source={{ uri: photo.uri }} style={styles.photoImage} contentFit="contain" />
                      <View style={[styles.change, { backgroundColor: tokens.glassStrong }]}>
                        <Ionicons name="swap-horizontal" size={16} color={tokens.ink} />
                        <AppText variant="label" color="ink">
                          Change
                        </AppText>
                      </View>
                    </>
                  ) : (
                    <View style={styles.photoEmpty}>
                      <Ionicons name="card-outline" size={30} color={tokens.label} />
                      <AppText variant="bodyStrong">Add a photo of your licence</AppText>
                      <AppText variant="caption" align="center">
                        The front of the card, flat and in good light. JPEG or PNG, up to 5 MB.
                      </AppText>
                    </View>
                  )}
                </Pressable>
                <FieldError message={photoError} />
                <AppText variant="caption">
                  {data.target
                    ? `It will be checked for ${data.target.label}. Once verified, it's used for your other car bookings too.`
                    : "Once verified, it's used for all your car bookings."}{" "}
                  Only operators you book with can see it. Bring the card itself when you pick up the car.
                </AppText>
                {view === "approved" ? (
                  <Button label="Keep my current licence" variant="text" size="sm" onPress={() => {
                    setReplacing(false);
                    setPhoto(null);
                    setPhotoError(null);
                  }} />
                ) : null}
                <SaveError error={sendError} />
              </View>
            ) : null}
          </>
        )}
      </ScrollView>

      {canUpload ? (
        <FloatingActionBar action={<Button label="Send licence" variant="brand" grow disabled={!photo} onPress={send} />}>
          <AppText variant="bodyStrong">{photo ? "Ready to send" : "No photo yet"}</AppText>
          <AppText variant="caption">Checked by the operator</AppText>
        </FloatingActionBar>
      ) : null}
    </View>
  );
}

function StateCard({
  view,
  doc,
  reuploadEndsAt,
  windowClosed,
}: {
  view: View_;
  doc: LicenceDocument | null;
  reuploadEndsAt: string | null;
  windowClosed: boolean;
}) {
  const { tokens } = useTheme();

  const content: { icon: IconName; tone: { bg: string; fg: string }; title: string; body: ReactNode } = (() => {
    switch (view) {
      case "review":
        return {
          icon: "time-outline",
          tone: { bg: tokens.infoBg, fg: tokens.infoFg },
          title: "Being checked",
          body: `Sent ${formatMYT(doc?.submittedAt, "dayDateTime")}. The operator checks it before your pick-up${
            doc?.reviewDueAt ? `, usually by ${formatMYT(doc.reviewDueAt, "dayDateTime")}` : ""
          }. You don't need to do anything else.`,
        };
      case "approved":
        return {
          icon: "checkmark-circle-outline",
          tone: { bg: tokens.okBg, fg: tokens.okFg },
          title: "Verified",
          body: `Verified ${formatMYT(doc?.reviewedAt ?? doc?.submittedAt, "dayDate")}. It's used for all your car bookings, so you don't need to upload it again unless it changes.`,
        };
      case "expired":
        return {
          icon: "calendar-outline",
          tone: { bg: tokens.errBg, fg: tokens.errFg },
          title: "Your licence has expired",
          body: windowClosed
            ? "The time to upload a new one has passed. Contact support about your booking."
            : `Upload your current licence${reuploadEndsAt ? ` by ${formatMYT(reuploadEndsAt, "dayDateTime")}` : ""}.`,
        };
      case "rejected":
        return {
          icon: "alert-circle-outline",
          tone: { bg: tokens.errBg, fg: tokens.errFg },
          title: "Please upload it again",
          body: windowClosed
            ? `${reasonText(doc?.rejectionReason ?? null)} The time to upload a new one has passed, so contact support.`
            : `${reasonText(doc?.rejectionReason ?? null)}${
                reuploadEndsAt ? ` Upload it by ${formatMYT(reuploadEndsAt, "dayDateTime")}.` : ""
              }`,
        };
      default:
        return {
          icon: "card-outline",
          tone: { bg: tokens.warnBg, fg: tokens.warnFg },
          title: "No licence yet",
          body: "Car bookings need a verified driving licence, due by the same deadline as the balance.",
        };
    }
  })();

  return (
    <GlassCard>
      <View style={styles.stateTop}>
        <View style={[styles.stateIcon, { backgroundColor: content.tone.bg }]}>
          <Ionicons name={content.icon} size={22} color={content.tone.fg} />
        </View>
        <AppText variant="headline" style={styles.flex}>
          {content.title}
        </AppText>
        <StatusPill kind="licence" status={doc?.status} />
      </View>
      <AppText variant="body" style={styles.mt8}>
        {content.body}
      </AppText>
    </GlassCard>
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
    gap: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  mt8: {
    marginTop: 8,
  },
  section: {
    gap: 10,
  },
  stateTop: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  stateIcon: {
    width: 40,
    height: 40,
    borderRadius: Radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  photo: {
    height: 220,
    borderRadius: Radius.card,
    overflow: "hidden",
    alignItems: "center",
    justifyContent: "center",
  },
  photoImage: {
    width: "100%",
    height: "100%",
  },
  photoEmpty: {
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 24,
  },
  change: {
    position: "absolute",
    right: 10,
    bottom: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    height: 36,
    borderRadius: Radius.pill,
  },
});
