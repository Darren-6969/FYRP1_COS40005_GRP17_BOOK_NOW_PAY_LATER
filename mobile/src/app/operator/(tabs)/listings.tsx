
import { Ionicons } from "@expo/vector-icons";
import { useFocusEffect, useRouter, } from "expo-router";
import { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Image,
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
  getOperatorListings,
  OperatorListing,
  OperatorListingSubscription,
  quickEditOperatorListing,
} from "../../../services/operatorApi";

type ListingFilter =
  | "ALL"
  | "PUBLISHED"
  | "DRAFT"
  | "WITHDRAWN";

const FILTERS: ListingFilter[] = [
  "ALL",
  "PUBLISHED",
  "DRAFT",
  "WITHDRAWN",
];

const money = (value?: number | null) =>
  `RM ${Number(value || 0).toLocaleString("en-MY", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export default function OperatorListingsScreen() {
  const [listings, setListings] = useState<OperatorListing[]>([]);
  const [subscription, setSubscription] =
    useState<OperatorListingSubscription | null>(null);

  const router = useRouter();

  const [filter, setFilter] = useState<ListingFilter>("ALL");
  const [search, setSearch] = useState("");

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const [editing, setEditing] =
    useState<OperatorListing | null>(null);
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [saving, setSaving] = useState(false);

  const loadListings = useCallback(
    async (refresh = false) => {
      try {
        setError("");

        if (refresh) {
          setRefreshing(true);
        } else {
          setLoading(true);
        }

        const response = await getOperatorListings();

        setListings(
          Array.isArray(response?.listings)
            ? response.listings
            : []
        );

        setSubscription(response?.subscription || null);
      } catch (err: any) {
        setError(
          err?.message || "Unable to load listings."
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
      loadListings();
    }, [loadListings])
  );

  const normalizedSearch = search.trim().toLowerCase();

  const visibleListings = listings.filter((listing) => {
    const statusMatches =
      filter === "ALL" || listing.status === filter;

    const searchable = [
      listing.name,
      listing.vehicleMake,
      listing.vehicleModel,
      listing.branch?.name,
    ]
      .filter(Boolean)
      .join(" ")
      .toLowerCase();

    return (
      statusMatches &&
      (!normalizedSearch ||
        searchable.includes(normalizedSearch))
    );
  });

  const publishedCount = listings.filter(
    (listing) => listing.status === "PUBLISHED"
  ).length;

  const draftCount = listings.filter(
    (listing) => listing.status === "DRAFT"
  ).length;

  const openQuickEdit = (listing: OperatorListing) => {
    setEditing(listing);
    setPrice(String(listing.price ?? ""));
    setQuantity(String(listing.quantity ?? ""));
  };

  const closeQuickEdit = () => {
    if (!saving) {
      setEditing(null);
    }
  };

  const saveQuickEdit = async () => {
    if (!editing || saving) return;

    const parsedPrice = Number(price.trim());
    const parsedQuantity = Number(quantity.trim());

    if (
      !price.trim() ||
      !Number.isFinite(parsedPrice) ||
      parsedPrice <= 0
    ) {
      Alert.alert(
        "Invalid Price",
        "Enter a daily rate greater than RM 0."
      );
      return;
    }

    if (
      !quantity.trim() ||
      !Number.isInteger(parsedQuantity) ||
      parsedQuantity < 0
    ) {
      Alert.alert(
        "Invalid Quantity",
        "Quantity must be a whole number of zero or more."
      );
      return;
    }

    try {
      setSaving(true);

      const response = await quickEditOperatorListing(
        editing.id,
        {
          price: parsedPrice,
          quantity: parsedQuantity,
        }
      );

      setListings((previous) =>
        previous.map((item) =>
          item.id === editing.id
            ? response.listing
            : item
        )
      );

      setEditing(null);

      Alert.alert(
        "Updated",
        "Listing price and quantity updated successfully."
      );
    } catch (err: any) {
      Alert.alert(
        "Update Failed",
        err?.message || "Unable to update listing."
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.safeArea}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => loadListings(true)}
          />
        }
      >
        <View style={styles.header}>
          <View style={{ flex: 1 }}>
            <Text style={styles.eyebrow}>
              VEHICLE MANAGEMENT
            </Text>
            <Text style={styles.title}>
              My Listings
            </Text>
            <Text style={styles.subtitle}>
              Manage your rental fleet
            </Text>
          </View>

          <Pressable
            style={styles.addButton}
            onPress={() => router.push("/operator/listing/form")}
            >
            <Ionicons
                name="add"
                size={21}
                color="#FFFFFF"
            />
            <Text style={styles.addButtonText}>
                Add
            </Text>
            </Pressable>
        </View>

        <View style={styles.stats}>
          <StatCard
            label="Total"
            value={listings.length}
          />
          <StatCard
            label="Published"
            value={publishedCount}
          />
          <StatCard
            label="Draft"
            value={draftCount}
          />
        </View>

        <Pressable
            style={styles.branchesButton}
            onPress={() => router.push("/operator/branches")}
            >
            <Ionicons
                name="business-outline"
                size={20}
                color="#07869B"
            />

            <View style={{ flex: 1 }}>
                <Text style={styles.branchesTitle}>
                Branch Management
                </Text>
                <Text style={styles.branchesSubtitle}>
                Manage rental branches and pickup locations
                </Text>
            </View>

            <Ionicons
                name="chevron-forward"
                size={19}
                color="#81939C"
            />
            </Pressable>

        {subscription && (
          <View style={styles.subscriptionCard}>
            <View style={{ flex: 1 }}>
              <Text style={styles.subscriptionLabel}>
                {subscription.plan} PLAN
              </Text>
              <Text style={styles.subscriptionValue}>
                {subscription.publishedCount} /{" "}
                {subscription.listingLimit} Published
              </Text>
            </View>
            <Text style={styles.remaining}>
              {subscription.remaining} remaining
            </Text>
          </View>
        )}

        <View style={styles.searchBox}>
          <Ionicons
            name="search-outline"
            size={19}
            color="#81939C"
          />
          <TextInput
            style={styles.searchInput}
            placeholder="Search vehicles..."
            placeholderTextColor="#91A2A9"
            value={search}
            onChangeText={setSearch}
          />

          {search.length > 0 && (
            <Pressable onPress={() => setSearch("")}>
              <Ionicons
                name="close-circle"
                size={19}
                color="#81939C"
              />
            </Pressable>
          )}
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filters}
          style={styles.filterScroll}
        >
          {FILTERS.map((value) => (
            <Pressable
              key={value}
              style={[
                styles.filter,
                filter === value && styles.activeFilter,
              ]}
              onPress={() => setFilter(value)}
            >
              <Text
                style={[
                  styles.filterText,
                  filter === value && styles.activeFilterText,
                ]}
              >
                {value === "ALL"
                  ? "All"
                  : value.charAt(0) +
                    value.slice(1).toLowerCase()}
              </Text>
            </Pressable>
          ))}
        </ScrollView>

        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            Vehicle Listings
          </Text>
          <Text style={styles.count}>
            {visibleListings.length} listings
          </Text>
        </View>

        {!!error && (
          <View style={styles.emptyCard}>
            <Text style={styles.errorText}>
              {error}
            </Text>
            <Pressable onPress={() => loadListings()}>
              <Text style={styles.retryText}>
                Try Again
              </Text>
            </Pressable>
          </View>
        )}

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator
              size="large"
              color="#07869B"
            />
          </View>
        ) : !error && visibleListings.length === 0 ? (
          <View style={styles.emptyCard}>
            <Ionicons
              name="car-outline"
              size={35}
              color="#81939C"
            />
            <Text style={styles.emptyTitle}>
              No listings found
            </Text>
            <Text style={styles.emptySubtitle}>
              Try another search or status filter.
            </Text>
          </View>
        ) : !error ? (
          visibleListings.map((listing) => {
            const sortedImages = [...(listing.images || [])]
              .sort((a, b) => a.sortOrder - b.sortOrder);

            const cover =
              sortedImages.find((image) => image.isPrimary) ||
              sortedImages[0];

            return (
              <View
                key={listing.id}
                style={styles.listingCard}
              >
                {cover?.imageUrl ? (
                  <Image
                    source={{ uri: cover.imageUrl }}
                    style={styles.coverImage}
                    resizeMode="contain"
                    />
                ) : (
                  <View style={styles.noImage}>
                    <Ionicons
                      name="car-sport-outline"
                      size={42}
                      color="#81939C"
                    />
                  </View>
                )}

                <View style={styles.cardContent}>
                  <View style={styles.cardTop}>
                    <Text style={styles.listingName}>
                      {listing.name}
                    </Text>
                    <View style={styles.statusBadge}>
                      <Text style={styles.statusText}>
                        {listing.status.replace(/_/g, " ")}
                      </Text>
                    </View>
                  </View>

                  <Text style={styles.vehicleInfo}>
                    {[
                      listing.vehicleType,
                      listing.transmission,
                      listing.seats
                        ? `${listing.seats} seats`
                        : null,
                    ]
                      .filter(Boolean)
                      .join(" · ") || listing.category}
                  </Text>

                  {!!listing.branch?.name && (
                    <Text style={styles.branchText}>
                      {listing.branch.name}
                    </Text>
                  )}

                  <View style={styles.divider} />

                  <View style={styles.priceRow}>
                    <View>
                      <Text style={styles.smallLabel}>
                        Daily Rate
                      </Text>
                      <Text style={styles.price}>
                        {money(listing.price)}
                      </Text>
                    </View>

                    <View style={{ alignItems: "flex-end" }}>
                      <Text style={styles.smallLabel}>
                        Fleet Quantity
                      </Text>
                      <Text style={styles.quantity}>
                        {listing.quantity}
                      </Text>
                    </View>
                  </View>

                  
                  <Pressable
                    style={styles.editButton}
                    onPress={() => openQuickEdit(listing)}
                  >
                    <Ionicons
                      name="create-outline"
                      size={18}
                      color="#07869B"
                    />
                    <Text style={styles.editText}>
                      Quick Edit
                    </Text>
                  </Pressable>

                  <Pressable
                    style={styles.detailsButton}
                    onPress={() =>
                      router.push({
                        pathname: "/operator/listing/form",
                        params: {
                          id: String(listing.id),
                        },
                      })
                    }
                  >
                    <Ionicons
                      name="options-outline"
                      size={18}
                      color="#17313C"
                    />
                    <Text style={styles.detailsText}>
                      Edit Details
                    </Text>
                  </Pressable>

                  
                    <Pressable
                    style={styles.manageButton}
                    onPress={() =>
                        router.push({
                        pathname: "/operator/listing/manage",
                        params: {
                            id: String(listing.id),
                        },
                        })
                    }
                    >
                    <Ionicons
                        name="images-outline"
                        size={18}
                        color="#07869B"
                    />
                    <Text style={styles.manageButtonText}>
                        Manage Photos & Status
                    </Text>
                    </Pressable>


                </View>
              </View>
            );
          })
        ) : null}
      </ScrollView>


      <Modal
        visible={editing !== null}
        transparent
        animationType="fade"
        onRequestClose={closeQuickEdit}
      >
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flex: 1 }}>
                <Text style={styles.modalTitle}>
                  Quick Edit
                </Text>
                <Text style={styles.modalSubtitle}>
                  {editing?.name}
                </Text>
              </View>

              <Pressable
                onPress={closeQuickEdit}
                disabled={saving}
              >
                <Ionicons
                  name="close"
                  size={24}
                  color="#17313C"
                />
              </Pressable>
            </View>

            <Text style={styles.inputLabel}>
              Daily Rate (RM)
            </Text>
            <TextInput
              style={styles.input}
              value={price}
              onChangeText={setPrice}
              keyboardType="decimal-pad"
              placeholder="0.00"
            />

            <Text style={styles.inputLabel}>
              Fleet Quantity
            </Text>
            <TextInput
              style={styles.input}
              value={quantity}
              onChangeText={setQuantity}
              keyboardType="number-pad"
              placeholder="0"
            />

            <Text style={styles.modalNotice}>
              These changes update the existing listing
              shared by the website and mobile app.
            </Text>

            <View style={styles.modalActions}>
              <Pressable
                style={styles.cancelButton}
                onPress={closeQuickEdit}
                disabled={saving}
              >
                <Text style={styles.cancelText}>
                  Cancel
                </Text>
              </Pressable>

              <Pressable
                style={styles.saveButton}
                onPress={saveQuickEdit}
                disabled={saving}
              >
                {saving ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.saveText}>
                    Save Changes
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

function StatCard({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <View style={styles.statCard}>
      <Text style={styles.statNumber}>
        {value}
      </Text>
      <Text style={styles.statLabel}>
        {label}
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  safeArea: {
    flex: 1,
    backgroundColor: "#F7FAFB",
  },
  content: {
    paddingHorizontal: 20,
    paddingTop: 18,
    paddingBottom: 130,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 20,
  },
  eyebrow: {
    fontSize: 10,
    fontWeight: "900",
    color: "#07869B",
    letterSpacing: 1.1,
  },
  title: {
    fontSize: 27,
    fontWeight: "900",
    color: "#17313C",
    marginTop: 5,
  },
  subtitle: {
    fontSize: 12,
    color: "#81939C",
    marginTop: 5,
  },
  headerIcon: {
    width: 49,
    height: 49,
    borderRadius: 15,
    backgroundColor: "#E6F7F9",
    alignItems: "center",
    justifyContent: "center",
  },
  stats: {
    flexDirection: "row",
    gap: 10,
    marginBottom: 14,
  },
  statCard: {
    flex: 1,
    backgroundColor: "#FFFFFF",
    borderRadius: 15,
    borderWidth: 1,
    borderColor: "#E3EAED",
    padding: 14,
  },
  statNumber: {
    fontSize: 22,
    fontWeight: "900",
    color: "#17313C",
  },
  statLabel: {
    fontSize: 10,
    color: "#81939C",
    marginTop: 5,
  },
  subscriptionCard: {
    backgroundColor: "#E6F7F9",
    borderRadius: 15,
    padding: 15,
    marginBottom: 20,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  subscriptionLabel: {
    color: "#07869B",
    fontSize: 10,
    fontWeight: "900",
  },
  subscriptionValue: {
    color: "#17313C",
    fontSize: 13,
    fontWeight: "800",
    marginTop: 5,
  },
  remaining: {
    fontSize: 11,
    color: "#07869B",
    fontWeight: "800",
  },
  searchBox: {
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    borderRadius: 14,
    paddingHorizontal: 14,
    height: 50,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginBottom: 15,
  },
  searchInput: {
    flex: 1,
    color: "#17313C",
    fontSize: 13,
  },
  filterScroll: {
    flexGrow: 0,
    marginBottom: 18,
  },
  filters: {
    gap: 9,
    paddingBottom: 3,
  },
  filter: {
    height: 39,
    paddingHorizontal: 15,
    borderRadius: 12,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    alignItems: "center",
    justifyContent: "center",
  },
  activeFilter: {
    backgroundColor: "#07869B",
    borderColor: "#07869B",
  },
  filterText: {
    fontSize: 12,
    fontWeight: "800",
    color: "#617780",
  },
  activeFilterText: {
    color: "#FFFFFF",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  sectionTitle: {
    fontSize: 17,
    fontWeight: "900",
    color: "#17313C",
  },
  count: {
    color: "#81939C",
    fontSize: 11,
  },
  listingCard: {
    borderRadius: 19,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "#E3EAED",
    overflow: "hidden",
    marginBottom: 15,
  },
  coverImage: {
  width: "100%",
  aspectRatio: 4 / 3,
  backgroundColor: "#F3F6F8",
},
  noImage: {
    aspectRatio: 4 / 3,
    backgroundColor: "#EDF2F4",
    alignItems: "center",
    justifyContent: "center",
  },
  cardContent: {
    padding: 16,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: 8,
  },
  listingName: {
    flex: 1,
    fontSize: 16,
    fontWeight: "900",
    color: "#17313C",
  },
  statusBadge: {
    backgroundColor: "#E6F7F9",
    paddingHorizontal: 8,
    paddingVertical: 6,
    borderRadius: 9,
  },
  statusText: {
    fontSize: 9,
    fontWeight: "900",
    color: "#07869B",
  },
  vehicleInfo: {
    fontSize: 12,
    color: "#6F838C",
    marginTop: 10,
  },
  branchText: {
    fontSize: 11,
    color: "#81939C",
    marginTop: 5,
  },
  divider: {
    height: 1,
    backgroundColor: "#EDF1F3",
    marginVertical: 15,
  },
  priceRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  smallLabel: {
    fontSize: 11,
    color: "#81939C",
  },
  price: {
    fontSize: 17,
    fontWeight: "900",
    color: "#17313C",
    marginTop: 5,
  },
  quantity: {
    fontSize: 17,
    fontWeight: "900",
    color: "#17313C",
    marginTop: 5,
  },
  editButton: {
    backgroundColor: "#E6F7F9",
    paddingVertical: 13,
    borderRadius: 12,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 7,
    marginTop: 16,
  },
  editText: {
    color: "#07869B",
    fontSize: 12,
    fontWeight: "900",
  },
  loading: {
    paddingVertical: 75,
  },
  emptyCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 19,
    borderWidth: 1,
    borderColor: "#E3EAED",
    padding: 30,
    alignItems: "center",
  },
  emptyTitle: {
    fontSize: 15,
    fontWeight: "900",
    color: "#17313C",
    marginTop: 12,
  },
  emptySubtitle: {
    color: "#81939C",
    fontSize: 12,
    marginTop: 10,
    textAlign: "center",
  },
  errorText: {
    fontSize: 12,
    color: "#D14343",
  },
  retryText: {
    color: "#07869B",
    marginTop: 10,
    fontWeight: "900",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(8,26,35,0.55)",
    justifyContent: "center",
    padding: 22,
  },
  modalCard: {
    backgroundColor: "#FFFFFF",
    borderRadius: 22,
    padding: 20,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginBottom: 17,
  },
  modalTitle: {
    fontSize: 20,
    fontWeight: "900",
    color: "#17313C",
  },
  modalSubtitle: {
    fontSize: 12,
    color: "#81939C",
    marginTop: 5,
  },
  inputLabel: {
    color: "#17313C",
    fontWeight: "800",
    fontSize: 12,
    marginBottom: 8,
    marginTop: 12,
  },
  input: {
    borderRadius: 13,
    borderWidth: 1,
    borderColor: "#E3EAED",
    backgroundColor: "#F7FAFB",
    padding: 13,
    color: "#17313C",
    fontSize: 14,
  },
  modalNotice: {
    color: "#81939C",
    fontSize: 11,
    lineHeight: 17,
    marginTop: 17,
    marginBottom: 20,
  },
  modalActions: {
    flexDirection: "row",
    gap: 10,
  },
  cancelButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#F0F4F5",
    paddingVertical: 14,
    alignItems: "center",
  },
  cancelText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#617780",
  },
  saveButton: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#07869B",
    paddingVertical: 14,
    alignItems: "center",
  },
  saveText: {
    fontSize: 12,
    fontWeight: "900",
    color: "#FFFFFF",
  },

addButton: {
  backgroundColor: "#07869B",
  borderRadius: 14,
  paddingHorizontal: 15,
  height: 45,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 5,
},

addButtonText: {
  color: "#FFFFFF",
  fontSize: 12,
  fontWeight: "900",
},

detailsButton: {
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E3EAED",
  borderRadius: 12,
  paddingVertical: 13,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  marginTop: 9,
},

detailsText: {
  color: "#17313C",
  fontSize: 12,
  fontWeight: "900",
},

manageButton: {
  backgroundColor: "#E6F7F9",
  borderRadius: 12,
  paddingVertical: 13,
  flexDirection: "row",
  alignItems: "center",
  justifyContent: "center",
  gap: 8,
  marginTop: 9,
},

manageButtonText: {
  color: "#07869B",
  fontSize: 12,
  fontWeight: "900",
},


branchesButton: {
  flexDirection: "row",
  alignItems: "center",
  gap: 12,
  backgroundColor: "#FFFFFF",
  borderWidth: 1,
  borderColor: "#E3EAED",
  borderRadius: 15,
  padding: 16,
  marginBottom: 18,
},

branchesTitle: {
  color: "#17313C",
  fontSize: 13,
  fontWeight: "900",
},

branchesSubtitle: {
  color: "#81939C",
  fontSize: 11,
  marginTop: 5,
},
});
