
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import {
  AppText,
  Button,
  GlassCard,
  TextField,
  useToast,
} from "@/components/ui";

import {
  getOperatorBranches,
  getOperatorListings,
  getOperatorBranchTransfers,
  transferOperatorBranchStock,
  type OperatorBranch,
  type OperatorListing,
  type BranchStockTransfer,
} from "@/services/operatorApi";

import { describeError } from "@/utils/errors";
import { useTheme } from "@/hooks/use-theme";

function vehicleKey(listing: OperatorListing) {
  return [
    listing.vehicleMake,
    listing.vehicleModel,
    listing.vehicleType,
    listing.modelYear,
    listing.transmission,
    listing.seats,
  ]
    .map((value) =>
      String(value ?? "").trim().toLowerCase()
    )
    .join("|");
}

function vehicleName(listing: OperatorListing) {
  return [
    listing.name,
    listing.vehicleMake,
    listing.vehicleModel,
  ]
    .filter(Boolean)
    .join(" · ");
}

type SelectionItem = {
  id: number;
  label: string;
};

function Selection({
  title,
  items,
  selectedId,
  onSelect,
}: {
  title: string;
  items: SelectionItem[];
  selectedId: number | null;
  onSelect: (id: number) => void;
}) {
  const { tokens } = useTheme();

  return (
    <View style={styles.section}>
      <AppText variant="bodyStrong">
        {title}
      </AppText>

      {items.length === 0 ? (
        <AppText variant="caption">
          No available options.
        </AppText>
      ) : (
        items.map((item) => {
          const active = item.id === selectedId;

          return (
            <Pressable
              key={item.id}
              accessibilityRole="radio"
              accessibilityState={{
                selected: active,
              }}
              onPress={() => onSelect(item.id)}
              style={[
                styles.option,
                {
                  borderColor: active
                    ? tokens.brand
                    : tokens.glassLine,
                  backgroundColor:
                    tokens.glass,
                },
              ]}
            >
              <View style={styles.flex}>
                <AppText variant="body">
                  {item.label}
                </AppText>
              </View>

              <Ionicons
                name={
                  active
                    ? "radio-button-on"
                    : "radio-button-off"
                }
                size={22}
                color={
                  active
                    ? tokens.brand
                    : tokens.label
                }
              />
            </Pressable>
          );
        })
      )}
    </View>
  );
}

export default function BranchTransferScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const toast = useToast();

  const [branches, setBranches] = useState<
    OperatorBranch[]
  >([]);

  const [listings, setListings] = useState<
    OperatorListing[]
  >([]);

  const [history, setHistory] = useState<
    BranchStockTransfer[]
  >([]);

  const [sourceBranchId, setSourceBranchId] =
    useState<number | null>(null);

  const [destinationBranchId, setDestinationBranchId] =
    useState<number | null>(null);

  const [sourceListingId, setSourceListingId] =
    useState<number | null>(null);

  const [destinationListingId, setDestinationListingId] =
    useState<number | null>(null);

  const [quantity, setQuantity] = useState("1");
  const [reason, setReason] = useState("");

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setLoading(true);
    setError("");

    try {
      const [branchData, listingData, historyData] =
        await Promise.all([
          getOperatorBranches(),
          getOperatorListings(),
          getOperatorBranchTransfers(),
        ]);

      setBranches(branchData.branches ?? []);
      setListings(listingData.listings ?? []);
      setHistory(historyData.transfers ?? []);
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const source = listings.find(
    (item) => item.id === sourceListingId
  );

  const destination = listings.find(
    (item) => item.id === destinationListingId
  );

  const sourceListings = useMemo(
    () =>
      listings.filter(
        (item) =>
          item.branchId === sourceBranchId &&
          item.category === "CAR_RENTAL" &&
          item.quantity > 0
      ),
    [listings, sourceBranchId]
  );

  const destinationBranches = useMemo(
    () =>
      branches.filter(
        (branch) =>
          branch.isActive &&
          branch.id !== sourceBranchId
      ),
    [branches, sourceBranchId]
  );

  const destinationListings = useMemo(() => {
    if (!source) return [];

    return listings.filter(
      (item) =>
        item.branchId === destinationBranchId &&
        item.category === "CAR_RENTAL" &&
        vehicleKey(item) === vehicleKey(source)
    );
  }, [listings, source, destinationBranchId]);

  const amount = Number(quantity);

  const valid =
    source &&
    destination &&
    destinationListings.some(
      (item) => item.id === destination.id
    ) &&
    Number.isSafeInteger(amount) &&
    amount >= 1 &&
    amount <= source.quantity &&
    reason.trim().length >= 5 &&
    reason.trim().length <= 300;

  const transfer = async () => {
    if (!valid || saving || !source || !destination) {
      return;
    }

    setSaving(true);
    setError("");

    try {
      await transferOperatorBranchStock({
        sourceListingId: source.id,
        destinationListingId: destination.id,
        quantity: amount,
        reason: reason.trim(),
      });

      toast.show(
        "Vehicle transfer completed.",
        { tone: "ok" }
      );

      setQuantity("1");
      setReason("");
      setSourceListingId(null);
      setDestinationListingId(null);

      await load();
    } catch (err) {
      const message = describeError(err).message;
      setError(message);
      toast.show(message, { tone: "err" });
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 12,
            paddingBottom: insets.bottom + 32,
          },
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Button
            label="Back"
            variant="text"
            icon="chevron-back"
            onPress={() => router.back()}
          />

          <AppText variant="largeTitle">
            Branch Transfer
          </AppText>

          <AppText variant="caption">
            Transfer available vehicles between branches.
          </AppText>
        </View>

        {loading ? (
          <ActivityIndicator size="large" />
        ) : (
          <>
            {error ? (
              <GlassCard>
                <AppText
                  variant="caption"
                  style={{ color: "#c62828" }}
                >
                  {error}
                </AppText>
              </GlassCard>
            ) : null}

            <GlassCard>
              <Selection
                title="1. Source Branch"
                items={branches
                  .filter((item) => item.isActive)
                  .map((item) => ({
                    id: item.id,
                    label: item.name,
                  }))}
                selectedId={sourceBranchId}
                onSelect={(id) => {
                  setSourceBranchId(id);
                  setSourceListingId(null);
                  setDestinationBranchId(null);
                  setDestinationListingId(null);
                }}
              />

              {sourceBranchId !== null && (
                <Selection
                  title="2. Source Vehicle"
                  items={sourceListings.map((item) => ({
                    id: item.id,
                    label:
                      `${vehicleName(item)} · ` +
                      `${item.quantity} cars`,
                  }))}
                  selectedId={sourceListingId}
                  onSelect={(id) => {
                    setSourceListingId(id);
                    setDestinationListingId(null);
                  }}
                />
              )}
            </GlassCard>

            {source && (
              <GlassCard>
                <Selection
                  title="3. Destination Branch"
                  items={destinationBranches.map(
                    (item) => ({
                      id: item.id,
                      label: item.name,
                    })
                  )}
                  selectedId={destinationBranchId}
                  onSelect={(id) => {
                    setDestinationBranchId(id);
                    setDestinationListingId(null);
                  }}
                />

                {destinationBranchId !== null && (
                  <Selection
                    title="4. Matching Destination Vehicle"
                    items={destinationListings.map(
                      (item) => ({
                        id: item.id,
                        label:
                          `${vehicleName(item)} · ` +
                          `${item.quantity} cars`,
                      })
                    )}
                    selectedId={destinationListingId}
                    onSelect={setDestinationListingId}
                  />
                )}
              </GlassCard>
            )}

            <GlassCard>
              <AppText variant="headline">
                Transfer Details
              </AppText>

              <View style={styles.section}>
                <TextField
                  label="Vehicle Quantity"
                  value={quantity}
                  onChangeText={setQuantity}
                  keyboardType="number-pad"
                  placeholder="1"
                />

                <TextField
                  label="Transfer Reason"
                  value={reason}
                  onChangeText={setReason}
                  placeholder="Why are these vehicles being moved?"
                />
              </View>

              {source && destination &&
                Number.isSafeInteger(amount) && (
                  <View style={styles.preview}>
                    <AppText variant="bodyStrong">
                      Stock Preview
                    </AppText>

                    <AppText variant="body">
                      Source: {source.quantity}
                      {" → "}
                      {source.quantity - amount}
                    </AppText>

                    <AppText variant="body">
                      Destination: {destination.quantity}
                      {" → "}
                      {destination.quantity + amount}
                    </AppText>

                    <AppText variant="caption">
                      Final availability is checked by Backend.
                    </AppText>
                  </View>
                )}

              <Button
                label={
                  saving
                    ? "Transferring..."
                    : "Confirm Transfer"
                }
                variant="brand"
                disabled={!valid || saving}
                onPress={transfer}
              />
            </GlassCard>

            <GlassCard>
              <View style={styles.titleRow}>
                <AppText variant="headline">
                  Transfer History
                </AppText>
                <Button
                  label="Refresh"
                  size="sm"
                  variant="text"
                  onPress={load}
                />
              </View>

              {history.length === 0 ? (
                <AppText variant="caption">
                  No transfers recorded yet.
                </AppText>
              ) : (
                history.map((item) => (
                  <View
                    key={item.id}
                    style={styles.historyItem}
                  >
                    <AppText variant="bodyStrong">
                      {item.vehicleName}
                    </AppText>

                    <AppText variant="caption">
                      {item.sourceBranchName}
                      {" → "}
                      {item.destinationBranchName}
                    </AppText>

                    <AppText variant="caption">
                      Quantity: {item.quantity}
                    </AppText>

                    <AppText variant="caption">
                      {item.transferredAt
                        ? new Date(item.transferredAt)
                            .toLocaleDateString("en-MY")
                        : ""}
                    </AppText>
                  </View>
                ))
              )}
            </GlassCard>
          </>
        )}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 16,
    gap: 16,
  },
  header: {
    gap: 8,
    marginBottom: 8,
  },
  section: {
    gap: 12,
    marginVertical: 12,
  },
  option: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    marginTop: 8,
  },
  flex: {
    flex: 1,
  },
  preview: {
    padding: 14,
    borderRadius: 12,
    backgroundColor: "rgba(7,134,155,0.08)",
    gap: 8,
    marginVertical: 16,
  },
  titleRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  historyItem: {
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: "#cbd5dc",
    paddingVertical: 12,
    gap: 4,
  },
});
