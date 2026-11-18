
import { Ionicons } from "@expo/vector-icons";
import DateTimePicker from "@react-native-community/datetimepicker";
import { Image } from "expo-image";
import * as ImagePicker from "expo-image-picker";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppText,
  Button,
  GlassCard,
  IconButton,
  useToast,
} from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import {
  getCustomerBookings,
  getMyPermit,
  uploadPermitFile,
  type PermitDocument,
} from "@/services/customerApi";

const MAX_BYTES = 5 * 1024 * 1024;

const TERMINAL = new Set([
  "CANCELLED",
  "REJECTED",
  "COMPLETED",
  "EXPIRED",
  "NO_SHOW",
  "NO_SHOW_UNPAID",
]);

type Booking = {
  id: number;
  bookingCode?: string;
  serviceName?: string;
  serviceType?: string;
  status?: string;
  returnDate?: string | null;
  listing?: { name?: string };
};

function dateString(date: Date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function statusLabel(status?: string) {
  switch (status) {
    case "APPROVED":
      return "Approved";
    case "UNDER_REVIEW":
      return "Under Review";
    case "REUPLOAD_REQUIRED":
    case "REJECTED":
      return "Re-upload Required";
    default:
      return "Not Submitted";
  }
}

export default function PermitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ bookingId?: string }>();
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [bookings, setBookings] = useState<Booking[]>([]);
  const [bookingId, setBookingId] = useState("");
  const [document, setDocument] =
    useState<PermitDocument | null>(null);
  const [canReupload, setCanReupload] = useState(true);

  const [photo, setPhoto] = useState<{
    uri: string;
  } | null>(null);

  const [expiryDate, setExpiryDate] = useState<Date | null>(null);
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [showBookings, setShowBookings] = useState(false);

  const [loadingBookings, setLoadingBookings] = useState(true);
  const [loadingPermit, setLoadingPermit] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState("");

  const loadBookings = useCallback(async () => {
    try {
      setLoadingBookings(true);
      setError("");

      const result = await getCustomerBookings();
      const records: Booking[] = Array.isArray(result) ? result : [];

      const active = records.filter(
        (booking) =>
          booking.serviceType === "CAR_RENTAL" &&
          !TERMINAL.has(booking.status ?? "")
      );

      setBookings(active);

      const requested = active.find(
        (item) => String(item.id) === params.bookingId
      );

      setBookingId(
        String(requested?.id ?? active[0]?.id ?? "")
      );
    } catch (err: any) {
      setError(err?.message || "Unable to load bookings.");
    } finally {
      setLoadingBookings(false);
    }
  }, [params.bookingId]);

  useEffect(() => {
    loadBookings();
  }, [loadBookings]);

  const loadPermit = useCallback(async () => {
    if (!bookingId) {
      setDocument(null);
      return;
    }

    try {
      setLoadingPermit(true);
      setError("");

      const result = await getMyPermit(bookingId);

      setDocument(result.document);
      setCanReupload(result.canReupload);
    } catch (err: any) {
      setDocument(null);
      setCanReupload(false);
      setError(err?.message || "Unable to load permit.");
    } finally {
      setLoadingPermit(false);
    }
  }, [bookingId]);

  useEffect(() => {
    loadPermit();
  }, [loadPermit]);

  const selectedBooking = bookings.find(
    (item) => String(item.id) === bookingId
  );

  const pickPhoto = async () => {
    try {
      setError("");

      const result = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ["images"],
        allowsEditing: false,
        quality: 0.85,
      });

      if (result.canceled) return;

      const asset = result.assets[0];

      if (!asset?.uri) {
        setError("Unable to read selected image.");
        return;
      }

      if (
        asset.mimeType &&
        !["image/jpeg", "image/png"].includes(
          asset.mimeType.toLowerCase()
        )
      ) {
        setError("Choose a JPG or PNG image.");
        return;
      }

      if (asset.fileSize && asset.fileSize > MAX_BYTES) {
        setError("Maximum file size is 5 MB.");
        return;
      }

      setPhoto({ uri: asset.uri });
    } catch (err: any) {
      setError(err?.message || "Could not open photo library.");
    }
  };

  const submit = async () => {
    if (!bookingId || !photo || !expiryDate) {
      setError("Select a booking, expiry date and permit photo.");
      return;
    }

    const expiry = dateString(expiryDate);
    const today = dateString(new Date());

    if (expiry < today) {
      setError("Your permit has already expired.");
      return;
    }

    if (
      selectedBooking?.returnDate &&
      expiry < selectedBooking.returnDate.slice(0, 10)
    ) {
      setError(
        "The permit must be valid through the rental return date."
      );
      return;
    }

    try {
      setUploading(true);
      setError("");

      await uploadPermitFile({
        bookingId,
        uri: photo.uri,
        permitExpiryDate: expiry,
      });

      setPhoto(null);
      setExpiryDate(null);

      await loadPermit();

      toast.show("Permit submitted for review.", {
        tone: "ok",
      });
    } catch (err: any) {
      setError(err?.message || "Permit upload failed.");
    } finally {
      setUploading(false);
    }
  };

  const status = document?.status || "NOT_SUBMITTED";
  const busy = loadingBookings || loadingPermit;

  return (
    <View
      style={[
        styles.screen,
        { backgroundColor: tokens.background },
      ]}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 8,
            paddingBottom: insets.bottom + 36,
          },
        ]}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.header}>
          <IconButton
            icon="chevron-back"
            label="Back"
            onPress={() => router.back()}
          />

          <View style={styles.flex}>
            <AppText variant="largeTitle">
              International Permit
            </AppText>
            <AppText variant="caption">
              Driving document verification
            </AppText>
          </View>
        </View>

        <GlassCard>
          <View style={styles.heading}>
            <Ionicons
              name="shield-checkmark-outline"
              size={25}
              color={tokens.brand}
            />

            <View style={styles.flex}>
              <AppText variant="headline">
                International Driving Permit
              </AppText>
              <AppText variant="caption">
                Upload an IDP when required for your rental.
              </AppText>
            </View>
          </View>
        </GlassCard>

        {error ? (
          <GlassCard>
            <AppText style={{ color: tokens.errFg }}>
              {error}
            </AppText>
            <Button
              label="Retry"
              variant="text"
              size="sm"
              onPress={loadBookings}
            />
          </GlassCard>
        ) : null}

        <GlassCard>
          <AppText variant="headline">
            Related booking
          </AppText>

          {loadingBookings ? (
            <ActivityIndicator color={tokens.brand} />
          ) : bookings.length === 0 ? (
            <AppText variant="caption">
              No active car rental bookings found.
            </AppText>
          ) : (
            <>
              <Pressable
                style={[
                  styles.select,
                  {
                    backgroundColor: tokens.glassStrong,
                    borderColor: tokens.glassLine,
                  },
                ]}
                onPress={() => setShowBookings(!showBookings)}
              >
                <AppText variant="bodyStrong" style={styles.flex}>
                  {selectedBooking?.bookingCode ||
                    `BNPL-${bookingId}`}
                </AppText>

                <Ionicons
                  name={showBookings ? "chevron-up" : "chevron-down"}
                  size={19}
                  color={tokens.ink}
                />
              </Pressable>

              {showBookings &&
                bookings.map((item) => (
                  <Pressable
                    key={item.id}
                    style={styles.bookingOption}
                    onPress={() => {
                      setBookingId(String(item.id));
                      setDocument(null);
                      setPhoto(null);
                      setExpiryDate(null);
                      setShowBookings(false);
                    }}
                  >
                    <AppText variant="body">
                      {item.bookingCode || `BNPL-${item.id}`}
                      {" — "}
                      {item.listing?.name ||
                        item.serviceName ||
                        "Car Rental"}
                    </AppText>
                  </Pressable>
                ))}
            </>
          )}
        </GlassCard>

        {bookingId && (
          <GlassCard>
            <View style={styles.heading}>
              <Ionicons
                name={
                  status === "APPROVED"
                    ? "checkmark-circle"
                    : status === "UNDER_REVIEW"
                    ? "time-outline"
                    : "document-text-outline"
                }
                size={26}
                color={
                  status === "APPROVED"
                    ? tokens.okFg
                    : tokens.brand
                }
              />

              <View style={styles.flex}>
                <AppText variant="headline">
                  {statusLabel(status)}
                </AppText>
                <AppText variant="caption">
                  {status === "APPROVED"
                    ? "Your permit has been verified."
                    : status === "UNDER_REVIEW"
                    ? "Waiting for operator verification."
                    : status === "NOT_SUBMITTED"
                    ? "No permit submitted for this booking."
                    : "Please submit a new permit."}
                </AppText>
              </View>
            </View>

            {document?.permitExpiryDate && (
              <AppText variant="caption" style={styles.mt}>
                Expiry: {document.permitExpiryDate.slice(0, 10)}
              </AppText>
            )}

            {document?.rejectionReason && (
              <AppText
                variant="caption"
                style={[styles.mt, { color: tokens.errFg }]}
              >
                Reason:{" "}
                {document.rejectionReason.replaceAll("_", " ")}
              </AppText>
            )}

            {loadingPermit && (
              <ActivityIndicator color={tokens.brand} />
            )}
          </GlassCard>
        )}

        {bookingId && !busy && canReupload && (
          <GlassCard>
            <View style={styles.section}>
              <AppText variant="headline">
                Upload permit
              </AppText>

              <AppText variant="bodyStrong">
                Permit expiry date
              </AppText>

              <Pressable
                style={[
                  styles.select,
                  {
                    backgroundColor: tokens.glassStrong,
                    borderColor: tokens.glassLine,
                  },
                ]}
                onPress={() => setShowDatePicker(true)}
              >
                <Ionicons
                  name="calendar-outline"
                  size={19}
                  color={tokens.brand}
                />
                <AppText variant="body" style={styles.flex}>
                  {expiryDate
                    ? dateString(expiryDate)
                    : "Select expiry date"}
                </AppText>
              </Pressable>

              {showDatePicker && (
                <View>
                  <DateTimePicker
                    value={expiryDate || new Date()}
                    mode="date"
                    display={
                      Platform.OS === "ios"
                        ? "spinner"
                        : "default"
                    }
                    minimumDate={new Date()}
                    onChange={(event, date) => {
                      if (Platform.OS === "android") {
                        setShowDatePicker(false);
                      }

                      if (event.type === "set" && date) {
                        setExpiryDate(date);
                      }
                    }}
                  />

                  {Platform.OS === "ios" && (
                    <Button
                      label="Done"
                      variant="text"
                      size="sm"
                      onPress={() => setShowDatePicker(false)}
                    />
                  )}
                </View>
              )}

              <AppText variant="bodyStrong">
                Permit document
              </AppText>

              <Pressable
                onPress={pickPhoto}
                style={[
                  styles.uploadBox,
                  {
                    backgroundColor: tokens.glass,
                    borderColor: tokens.glassLine,
                  },
                ]}
              >
                {photo ? (
                  <Image
                    source={{ uri: photo.uri }}
                    style={styles.preview}
                    contentFit="contain"
                  />
                ) : (
                  <View style={styles.uploadEmpty}>
                    <Ionicons
                      name="cloud-upload-outline"
                      size={34}
                      color={tokens.brand}
                    />
                    <AppText variant="bodyStrong">
                      Choose permit photo
                    </AppText>
                    <AppText variant="caption">
                      JPG or PNG, maximum 5 MB
                    </AppText>
                  </View>
                )}
              </Pressable>

              <Button
                label={
                  uploading
                    ? "Uploading..."
                    : "Submit International Permit"
                }
                variant="brand"
                loading={uploading}
                disabled={!photo || !expiryDate || uploading}
                onPress={submit}
              />
            </View>
          </GlassCard>
        )}

        <AppText variant="caption">
          Your original driving licence and permit may also
          need to be presented during vehicle collection.
          Permit requirements depend on the applicable
          driving licence rules.
        </AppText>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1 },
  content: {
    paddingHorizontal: 18,
    gap: 16,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  heading: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: { flex: 1 },
  mt: { marginTop: 10 },
  section: { gap: 14 },
  select: {
    minHeight: 50,
    borderRadius: 12,
    borderWidth: 1,
    paddingHorizontal: 14,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  bookingOption: {
    paddingVertical: 13,
    paddingHorizontal: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#88888855",
  },
  uploadBox: {
    height: 190,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: "dashed",
    overflow: "hidden",
    justifyContent: "center",
  },
  uploadEmpty: {
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
  },
  preview: {
    width: "100%",
    height: "100%",
  },
});
