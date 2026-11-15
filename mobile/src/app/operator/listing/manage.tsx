import { Ionicons } from "@expo/vector-icons";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter, type Href } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";

import { AccountScreen } from "@/components/account/AccountScreen";
import { AppText, Button, ConfirmSheet, ErrorState, FieldError, GlassCard, SkeletonText, StatusPill, useToast } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import {
  attachOperatorListingImage,
  deleteOperatorListingImage,
  getOperatorListingById,
  publishOperatorListing,
  reorderOperatorListingImages,
  uploadOperatorListingImage,
  withdrawOperatorListing,
  type OperatorListing,
  type OperatorListingImage,
} from "@/services/operatorApi";
import { describeError } from "@/utils/errors";
import { logger } from "@/utils/logger";
import { startAsync } from "@/utils/start-async";

/** CLAUDE.md: up to 5 photos per listing. */
const MAX_PHOTOS = 5;
const MAX_PHOTO_BYTES = 5 * 1024 * 1024;

/**
 * Photos and status for one car (plan phase 4). The server re-encodes and
 * resizes every photo; the first one is the cover customers see. Publish
 * and withdraw ask first, and the server's message (for example the plan's
 * listing limit) shows in the sheet.
 */
export default function ManageListingScreen() {
  const router = useRouter();
  const toast = useToast();
  const { tokens } = useTheme();
  const params = useLocalSearchParams<{ id?: string }>();
  const parsed = Number(params.id);
  const listingId = Number.isInteger(parsed) && parsed > 0 ? parsed : null;

  const [listing, setListing] = useState<OperatorListing | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [photoError, setPhotoError] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);
  const [deleting, setDeleting] = useState<OperatorListingImage | null>(null);
  const [statusAction, setStatusAction] = useState<"publish" | "withdraw" | null>(null);
  // Blocks a second photo action before the first one's state lands (F17).
  const busy = useRef(false);

  const load = useCallback(() => startAsync(async () => {
    if (!listingId) return;
    try {
      const response = await getOperatorListingById(listingId);
      setListing(response.listing);
    } catch (err) {
      logger.debug("Failed to load listing:", err);
      setLoadError(err);
    }
  }), [listingId]);

  // Retry resets first; the first load needs no reset, so the effect's load
  // makes no synchronous state updates (react-hooks/set-state-in-effect).
  const retry = () => {
    setLoadError(null);
    return load();
  };

  useEffect(() => {
    load();
  }, [load]);

  const images = [...(listing?.images || [])].sort((a, b) => a.sortOrder - b.sortOrder);
  const full = images.length >= MAX_PHOTOS;

  const run = async (label: string, work: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    setWorking(label);
    setPhotoError(null);
    try {
      await work();
    } catch (err) {
      logger.debug(`Listing photo action failed (${label}):`, err);
      setPhotoError(describeError(err).message);
    } finally {
      busy.current = false;
      setWorking(null);
    }
  };

  const addPhoto = () =>
    run("upload", async () => {
      if (!listingId) return;
      const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
      if (!permission.granted) {
        setPhotoError("Allow photo access in your phone's settings to add photos.");
        return;
      }
      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: true,
        aspect: [4, 3],
        quality: 0.75,
      });
      if (result.canceled || !result.assets?.length) return;
      const asset = result.assets[0];
      if (asset.fileSize != null && asset.fileSize > MAX_PHOTO_BYTES) {
        setPhotoError("This photo is over 5 MB. Choose a smaller one.");
        return;
      }
      const uploaded = await uploadOperatorListingImage({ uri: asset.uri, fileName: "listing-photo.jpg", mimeType: "image/jpeg" });
      // Uploading alone doesn't add it to the listing.
      const updated = await attachOperatorListingImage(listingId, uploaded.url);
      setListing(updated.listing);
      toast.show("Photo added.", { tone: "ok" });
    });

  const move = (image: OperatorListingImage, direction: -1 | 1) =>
    run(`move-${image.id}`, async () => {
      if (!listingId) return;
      const from = images.findIndex((i) => i.id === image.id);
      const to = from + direction;
      if (from < 0 || to < 0 || to >= images.length) return;
      const order = [...images];
      [order[from], order[to]] = [order[to], order[from]];
      const response = await reorderOperatorListingImages(listingId, order.map((i) => i.id));
      setListing(response.listing);
    });

  const removePhoto = async () => {
    if (!deleting || !listingId) return;
    const response = await deleteOperatorListingImage(listingId, deleting.id);
    setListing(response.listing);
    setDeleting(null);
    toast.show("Photo removed.", { tone: "ok" });
  };

  const changeStatus = async () => {
    if (!listingId || !statusAction) return;
    const response = statusAction === "publish" ? await publishOperatorListing(listingId) : await withdrawOperatorListing(listingId);
    setListing(response.listing);
    toast.show(statusAction === "publish" ? "Published. Customers can now book this car." : "Withdrawn. Existing bookings still go ahead.", {
      tone: "ok",
    });
    setStatusAction(null);
  };

  // A bad link is an error straight away, with nothing to load.
  const shownLoadError = loadError ?? (listingId ? null : new Error("This listing link isn't valid."));

  if (shownLoadError && !listing) {
    return (
      <AccountScreen title="Photos & status">
        <ErrorState error={shownLoadError} onRetry={retry} />
      </AccountScreen>
    );
  }

  if (!listing) {
    return (
      <AccountScreen title="Photos & status">
        <GlassCard>
          <SkeletonText lines={5} />
        </GlassCard>
      </AccountScreen>
    );
  }

  const published = listing.status === "PUBLISHED";

  return (
    <AccountScreen title="Photos & status">
      <AppText variant="bodyStrong">{listing.name}</AppText>

      <GlassCard>
        <View style={styles.statusRow}>
          <View style={styles.flex}>
            <AppText variant="micro">On the platform</AppText>
            <StatusPill kind="listing" status={listing.status} style={styles.mt4} />
          </View>
          {published ? (
            <Button label="Withdraw" variant="line" size="sm" onPress={() => setStatusAction("withdraw")} />
          ) : listing.status !== "SUSPENDED" ? (
            <Button label="Publish" variant="brand" size="sm" onPress={() => setStatusAction("publish")} />
          ) : null}
        </View>
        <AppText variant="caption" style={styles.mt8}>
          {published
            ? "Customers can find and request this car."
            : listing.status === "SUSPENDED"
              ? "Suspended by the platform. Contact support."
              : "Customers can't see this car until you publish it."}
        </AppText>
      </GlassCard>

      <View style={styles.photosHead}>
        <AppText variant="headline" accessibilityRole="header" style={styles.flex}>
          Photos
        </AppText>
        <AppText variant="caption">
          {images.length} of {MAX_PHOTOS}
        </AppText>
      </View>
      <AppText variant="caption">The first photo is the cover customers see. JPEG, PNG or WebP, up to 5 MB.</AppText>

      {images.map((image, index) => (
        <GlassCard key={image.id} padding={8}>
          <View style={[styles.photo, { backgroundColor: tokens.glassStrong }]}>
            <Image source={{ uri: image.imageUrl }} style={StyleSheet.absoluteFill} contentFit="cover" accessible={false} />
            {index === 0 ? (
              <View style={styles.cover}>
                <StatusPill label="Cover" tone="ok" />
              </View>
            ) : null}
            {working === `move-${image.id}` ? (
              <View style={[styles.overlay, { backgroundColor: tokens.scrim }]}>
                <ActivityIndicator color="#FFFFFF" />
              </View>
            ) : null}
          </View>
          <View style={styles.photoActions}>
            <PhotoButton icon="arrow-up" label="Move up" disabled={index === 0 || !!working} onPress={() => move(image, -1)} />
            <PhotoButton icon="arrow-down" label="Move down" disabled={index === images.length - 1 || !!working} onPress={() => move(image, 1)} />
            <View style={styles.flex} />
            <PhotoButton icon="trash-outline" label="Remove photo" danger disabled={!!working} onPress={() => setDeleting(image)} />
          </View>
        </GlassCard>
      ))}

      <Button
        label={full ? "Photo limit reached" : images.length ? "Add another photo" : "Add a photo"}
        variant="line"
        icon="add"
        disabled={full || (!!working && working !== "upload")}
        loading={working === "upload"}
        onPress={addPhoto}
      />
      <FieldError message={photoError} />

      <Button
        label="Edit details"
        variant="text"
        icon="chevron-forward"
        iconPosition="end"
        style={styles.alignStart}
        onPress={() => router.push({ pathname: "/operator/listing/form", params: { id: String(listing.id) } } as unknown as Href)}
      />

      <ConfirmSheet
        visible={!!deleting}
        title="Remove this photo?"
        message="It's deleted from the listing. You can add it again later."
        confirmLabel="Remove photo"
        confirmVariant="danger"
        onConfirm={removePhoto}
        onCancel={() => setDeleting(null)}
      />

      <ConfirmSheet
        visible={!!statusAction}
        title={statusAction === "publish" ? "Publish this car?" : "Withdraw this car?"}
        message={
          statusAction === "publish"
            ? "Customers can find and request it. It counts towards your plan's listing limit."
            : "Customers can no longer find or request it. Bookings you've already accepted still go ahead, and the listing isn't deleted."
        }
        confirmLabel={statusAction === "publish" ? "Publish" : "Withdraw"}
        confirmVariant={statusAction === "publish" ? "brand" : "danger"}
        onConfirm={changeStatus}
        onCancel={() => setStatusAction(null)}
      />
    </AccountScreen>
  );
}

function PhotoButton({
  icon,
  label,
  onPress,
  disabled,
  danger = false,
}: {
  icon: "arrow-up" | "arrow-down" | "trash-outline";
  label: string;
  onPress: () => void;
  disabled?: boolean;
  danger?: boolean;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      disabled={disabled}
      accessibilityRole="button"
      accessibilityLabel={label}
      accessibilityState={{ disabled }}
      style={({ pressed }) => [
        styles.photoButton,
        { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine, opacity: disabled ? 0.35 : pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={danger ? tokens.errFg : tokens.ink} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  mt4: {
    marginTop: 4,
    alignSelf: "flex-start",
  },
  mt8: {
    marginTop: 8,
  },
  alignStart: {
    alignSelf: "flex-start",
  },
  statusRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  photosHead: {
    flexDirection: "row",
    alignItems: "center",
  },
  photo: {
    height: 180,
    borderRadius: Radius.md,
    overflow: "hidden",
  },
  cover: {
    position: "absolute",
    top: 10,
    left: 10,
  },
  overlay: {
    position: "absolute",
    top: 0,
    right: 0,
    bottom: 0,
    left: 0,
    alignItems: "center",
    justifyContent: "center",
  },
  photoActions: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingTop: 8,
    paddingHorizontal: 4,
  },
  photoButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
