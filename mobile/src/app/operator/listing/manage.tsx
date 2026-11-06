
import { Ionicons } from "@expo/vector-icons";
import * as ImagePicker from "expo-image-picker";
import {
  useLocalSearchParams,
  useRouter,
} from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
  Pressable,
  SafeAreaView,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import {
  attachOperatorListingImage,
  deleteOperatorListingImage,
  getOperatorListingById,
  OperatorListing,
  publishOperatorListing,
  reorderOperatorListingImages,
  uploadOperatorListingImage,
  withdrawOperatorListing,
} from "../../../services/operatorApi";

export default function ManageListingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams<{ id?: string }>();
  const listingId = Number(params.id);

  const [listing, setListing] =
    useState<OperatorListing | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const loadListing = useCallback(async () => {
    if (!Number.isInteger(listingId) || listingId <= 0) {
      setError("Invalid listing ID.");
      setLoading(false);
      return;
    }

    try {
      setError("");
      const response = await getOperatorListingById(listingId);
      setListing(response.listing);
    } catch (err: any) {
      setError(err?.message || "Failed to load listing.");
    } finally {
      setLoading(false);
    }
  }, [listingId]);

  useEffect(() => {
    loadListing();
  }, [loadListing]);

  const images = [...(listing?.images || [])].sort(
    (a, b) => a.sortOrder - b.sortOrder
  );

  const uploadPhoto = async () => {
    if (!listing || busy) return;

    try {
      const permission =
        await ImagePicker.requestMediaLibraryPermissionsAsync();

      if (!permission.granted) {
        Alert.alert(
          "Photo Access Required",
          "Please allow access to your photos."
        );
        return;
      }

      const result =
        await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ["images"],
          allowsEditing: true,
          aspect: [4, 3],
          quality: 0.75,
        });

      if (result.canceled || !result.assets.length) {
        return;
      }

      const asset = result.assets[0];

      if (
        asset.fileSize != null &&
        asset.fileSize > 5 * 1024 * 1024
      ) {
        Alert.alert(
          "Image Too Large",
          "Please select an image smaller than 5 MB."
        );
        return;
      }

      setBusy(true);

      const uploaded = await uploadOperatorListingImage({
        uri: asset.uri,
        fileName: "listing-photo.jpg",
        mimeType: "image/jpeg",
      });

      // Upload alone does not add the photo to the listing.
      const updated = await attachOperatorListingImage(
        listingId,
        uploaded.url
      );

      setListing(updated.listing);

      Alert.alert(
        "Success",
        "Photo uploaded and added to this listing."
      );
    } catch (err: any) {
      Alert.alert(
        "Upload Failed",
        err?.message || "Unable to upload photo."
      );
    } finally {
      setBusy(false);
    }
  };

  const moveImage = async (
    imageId: number,
    direction: -1 | 1
  ) => {
    if (busy || !listing) return;

    const currentIndex = images.findIndex(
      (image) => image.id === imageId
    );

    const nextIndex = currentIndex + direction;

    if (
      currentIndex < 0 ||
      nextIndex < 0 ||
      nextIndex >= images.length
    ) {
      return;
    }

    const reordered = [...images];

    [reordered[currentIndex], reordered[nextIndex]] = [
      reordered[nextIndex],
      reordered[currentIndex],
    ];

    try {
      setBusy(true);

      const response =
        await reorderOperatorListingImages(
          listingId,
          reordered.map((image) => image.id)
        );

      setListing(response.listing);
    } catch (err: any) {
      Alert.alert(
        "Reorder Failed",
        err?.message || "Unable to reorder photos."
      );
    } finally {
      setBusy(false);
    }
  };

  const removeImage = (imageId: number) => {
    if (busy) return;

    Alert.alert(
      "Delete Photo",
      "Remove this photo from the listing?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            try {
              setBusy(true);

              const response =
                await deleteOperatorListingImage(
                  listingId,
                  imageId
                );

              setListing(response.listing);
            } catch (err: any) {
              Alert.alert(
                "Delete Failed",
                err?.message || "Unable to delete photo."
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  const changeStatus = (publish: boolean) => {
    if (busy || !listing) return;

    Alert.alert(
      publish ? "Publish Listing" : "Withdraw Listing",
      publish
        ? "Make this vehicle available to customers?"
        : "Remove this vehicle from public listings?",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Confirm",
          onPress: async () => {
            try {
              setBusy(true);

              const response = publish
                ? await publishOperatorListing(listingId)
                : await withdrawOperatorListing(listingId);

              setListing(response.listing);

              Alert.alert(
                "Success",
                publish
                  ? "Listing published successfully."
                  : "Listing withdrawn successfully."
              );
            } catch (err: any) {
              Alert.alert(
                "Action Failed",
                err?.message ||
                  "Unable to change listing status."
              );
            } finally {
              setBusy(false);
            }
          },
        },
      ]
    );
  };

  return (
    <SafeAreaView style={styles.screen}>
      <View style={styles.header}>
        <Pressable
          style={styles.back}
          onPress={() => router.back()}
          disabled={busy}
        >
          <Ionicons
            name="arrow-back"
            size={22}
            color="#17313C"
          />
        </Pressable>

        <View style={{ flex: 1 }}>
          <Text style={styles.eyebrow}>
            VEHICLE MANAGEMENT
          </Text>
          <Text style={styles.title}>
            Manage Listing
          </Text>
        </View>
      </View>

      {loading ? (
        <View style={styles.center}>
          <ActivityIndicator
            size="large"
            color="#07869B"
          />
        </View>
      ) : error || !listing ? (
        <View style={styles.center}>
          <Text style={styles.error}>
            {error || "Listing not found."}
          </Text>
          <Pressable onPress={loadListing}>
            <Text style={styles.link}>Try Again</Text>
          </Pressable>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={styles.content}
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.summary}>
            <Text style={styles.listingName}>
              {listing.name}
            </Text>
            <Text style={styles.status}>
              {listing.status.replace(/_/g, " ")}
            </Text>
          </View>

          <View style={styles.sectionTop}>
            <Text style={styles.sectionTitle}>
              Vehicle Photos
            </Text>
            <Text style={styles.count}>
              {images.length} photos
            </Text>
          </View>

          <Text style={styles.description}>
            The first photo is the cover image.
            Use the arrows to change display order.
          </Text>

          <Pressable
            style={styles.uploadButton}
            disabled={busy}
            onPress={uploadPhoto}
          >
            {busy ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons
                  name="cloud-upload-outline"
                  size={20}
                  color="#FFFFFF"
                />
                <Text style={styles.uploadText}>
                  Add Photo
                </Text>
              </>
            )}
          </Pressable>

          {images.length === 0 ? (
            <View style={styles.empty}>
              <Ionicons
                name="images-outline"
                size={34}
                color="#81939C"
              />
              <Text style={styles.description}>
                No photos uploaded yet.
              </Text>
            </View>
          ) : (
            images.map((image, index) => (
              <View
                key={image.id}
                style={styles.imageCard}
              >
                <Image
                  source={{ uri: image.imageUrl }}
                  style={styles.photo}
                  resizeMode="contain"
                />

                <View style={styles.imageContent}>
                  <View style={styles.imageTitleRow}>
                    <Text style={styles.imageTitle}>
                      Photo {index + 1}
                    </Text>

                    {index === 0 && (
                      <Text style={styles.primary}>
                        COVER
                      </Text>
                    )}
                  </View>

                  <View style={styles.actions}>
                    <Pressable
                      style={styles.smallButton}
                      disabled={busy || index === 0}
                      onPress={() =>
                        moveImage(image.id, -1)
                      }
                    >
                      <Ionicons
                        name="arrow-up"
                        size={19}
                        color="#07869B"
                      />
                    </Pressable>

                    <Pressable
                      style={styles.smallButton}
                      disabled={
                        busy || index === images.length - 1
                      }
                      onPress={() =>
                        moveImage(image.id, 1)
                      }
                    >
                      <Ionicons
                        name="arrow-down"
                        size={19}
                        color="#07869B"
                      />
                    </Pressable>

                    <Pressable
                      style={styles.deleteButton}
                      disabled={busy}
                      onPress={() => removeImage(image.id)}
                    >
                      <Ionicons
                        name="trash-outline"
                        size={19}
                        color="#D14343"
                      />
                    </Pressable>
                  </View>
                </View>
              </View>
            ))
          )}

          <View style={styles.separator} />

          <Text style={styles.sectionTitle}>
            Publication Status
          </Text>

          <Text style={styles.description}>
            Published vehicles are visible to customers.
            Withdrawn vehicles are hidden from new bookings.
          </Text>

          {listing.status === "PUBLISHED" ? (
            <Pressable
              style={styles.withdrawButton}
              disabled={busy}
              onPress={() => changeStatus(false)}
            >
              <Text style={styles.withdrawText}>
                Withdraw Listing
              </Text>
            </Pressable>
          ) : listing.status === "DRAFT" ||
            listing.status === "WITHDRAWN" ? (
            <Pressable
              style={styles.publishButton}
              disabled={busy}
              onPress={() => changeStatus(true)}
            >
              <Text style={styles.publishText}>
                Publish Listing
              </Text>
            </Pressable>
          ) : (
            <Text style={styles.error}>
              This listing cannot be published from
              its current status.
            </Text>
          )}

          <Text style={styles.description}>
            Publishing is subject to your operator
            subscription limit and backend validation.
          </Text>
        </ScrollView>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },
  header: {
    padding: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 13,
  },
  back: {
    width: 43,
    height: 43,
    borderRadius: 13,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
    borderColor: "#E3EAED",
  },
  eyebrow: {
    color: "#07869B",
    fontSize: 10,
    fontWeight: "900",
  },
  title: {
    color: "#17313C",
    fontSize: 23,
    fontWeight: "900",
    marginTop: 5,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 25,
  },
  error: {
    color: "#D14343",
    fontSize: 13,
    lineHeight: 20,
  },
  link: {
    color: "#07869B",
    fontWeight: "900",
    marginTop: 15,
  },
  content: {
    paddingHorizontal: 20,
    paddingBottom: 70,
  },
  summary: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    padding: 18,
    marginBottom: 25,
    borderWidth: 1,
    borderColor: "#E3EAED",
  },
  listingName: {
    fontSize: 18,
    fontWeight: "900",
    color: "#17313C",
  },
  status: {
    fontSize: 11,
    fontWeight: "900",
    color: "#07869B",
    marginTop: 9,
  },
  sectionTop: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#17313C",
  },
  count: {
    color: "#81939C",
    fontSize: 12,
  },
  description: {
    color: "#81939C",
    fontSize: 12,
    lineHeight: 19,
    marginTop: 10,
    marginBottom: 15,
  },
  uploadButton: {
    backgroundColor: "#07869B",
    borderRadius: 14,
    minHeight: 50,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 9,
    marginBottom: 20,
  },
  uploadText: {
    color: "#FFFFFF",
    fontSize: 13,
    fontWeight: "900",
  },
  empty: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    borderWidth: 1,
    borderColor: "#E3EAED",
    padding: 36,
    alignItems: "center",
  },
  imageCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 17,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "#E3EAED",
    marginBottom: 15,
  },
  photo: {
  width: "100%",
  aspectRatio: 4 / 3,
  backgroundColor: "#F3F6F8",
},
  imageContent: {
    padding: 15,
  },
  imageTitleRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  imageTitle: {
    fontSize: 14,
    fontWeight: "900",
    color: "#17313C",
  },
  primary: {
    backgroundColor: "#E6F7F9",
    color: "#07869B",
    paddingHorizontal: 9,
    paddingVertical: 5,
    borderRadius: 8,
    overflow: "hidden",
    fontSize: 10,
    fontWeight: "900",
  },
  actions: {
    flexDirection: "row",
    gap: 10,
    marginTop: 14,
  },
  smallButton: {
    width: 44,
    height: 41,
    backgroundColor: "#E6F7F9",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
  },
  deleteButton: {
    width: 44,
    height: 41,
    backgroundColor: "#FFF0F0",
    borderRadius: 11,
    alignItems: "center",
    justifyContent: "center",
    marginLeft: "auto",
  },
  separator: {
    height: 1,
    backgroundColor: "#E3EAED",
    marginVertical: 25,
  },
  publishButton: {
    backgroundColor: "#07869B",
    borderRadius: 14,
    padding: 16,
    alignItems: "center",
  },
  publishText: {
    color: "#FFFFFF",
    fontWeight: "900",
    fontSize: 13,
  },
  withdrawButton: {
    backgroundColor: "#FFF0F0",
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#F0CDCD",
    padding: 16,
    alignItems: "center",
  },
  withdrawText: {
    color: "#D14343",
    fontSize: 13,
    fontWeight: "900",
  },
});
