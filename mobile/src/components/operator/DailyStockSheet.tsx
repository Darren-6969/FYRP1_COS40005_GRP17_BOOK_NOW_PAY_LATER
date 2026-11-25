
import { useCallback, useEffect, useState } from "react";
import { ScrollView, View } from "react-native";

import {
  AppText,
  BottomSheet,
  Button,
  TextField,
  useToast,
} from "@/components/ui";

import {
  getOperatorDailyAllocations,
  updateOperatorDailyStock,
  type OperatorDailyAllocation,
  type OperatorListing,
} from "@/services/operatorApi";

import { describeError } from "@/utils/errors";

function todayMY() {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Asia/Kuching",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((p) => p.type === type)?.value ?? "";

  return `${get("year")}-${get("month")}-${get("day")}`;
}

function validDate(value: string) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00Z`);

  return (
    !Number.isNaN(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}

export function DailyStockSheet({
  listing,
  onClose,
  initialFrom,
  initialTo,
}: {
  listing: OperatorListing | null;
  onClose: () => void;
  /** BNPLB-184: opened from a sold-out alert on its dates (YYYY-MM-DD). */
  initialFrom?: string;
  initialTo?: string;
}) {
  const toast = useToast();
  const [fromDate, setFromDate] = useState(todayMY);
  const [toDate, setToDate] = useState(todayMY);
  const [quantity, setQuantity] = useState("");
  const [allocations, setAllocations] = useState<
    OperatorDailyAllocation[]
  >([]);

  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const listingId = listing?.id ?? null;
  const defaultQuantity = listing?.quantity ?? 0;

  useEffect(() => {
    setFromDate(initialFrom || todayMY());
    setToDate(initialTo || initialFrom || todayMY());
    setQuantity(String(defaultQuantity));
    setAllocations([]);
    setError("");
  }, [listingId, defaultQuantity, initialFrom, initialTo]);

  const load = useCallback(async () => {
    if (
      !listingId ||
      !validDate(fromDate) ||
      !validDate(toDate) ||
      toDate < fromDate
    ) {
      setAllocations([]);
      return;
    }

    setLoading(true);

    try {
      const response = await getOperatorDailyAllocations(
        listingId,
        fromDate,
        toDate
      );

      setAllocations(response.allocations ?? []);
    } catch (err) {
      setError(describeError(err).message);
    } finally {
      setLoading(false);
    }
  }, [listingId, fromDate, toDate]);

  useEffect(() => {
    if (listingId) {
      load();
    }
  }, [listingId, load]);

  if (!listing) return null;

  const save = async (reset: boolean) => {
    setError("");

    if (
      !validDate(fromDate) ||
      !validDate(toDate) ||
      toDate < fromDate
    ) {
      setError("Enter a valid date range.");
      return;
    }

    const parsed = Number(quantity);

    if (
      !reset &&
      (
        quantity.trim() === "" ||
        !Number.isSafeInteger(parsed) ||
        parsed < 0 ||
        parsed > defaultQuantity
      )
    ) {
      setError(
        `Quantity must be between 0 and ${defaultQuantity}.`
      );
      return;
    }

    setSaving(true);

    try {
      await updateOperatorDailyStock(
        listing.id,
        {
          fromDate,
          toDate,
          quantity: reset ? null : parsed,
        }
      );

      toast.show(
        reset
          ? "Default stock restored."
          : "Daily stock updated.",
        { tone: "ok" }
      );

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
    <BottomSheet
      visible
      title="Daily Stock"
      subtitle={listing.name}
      onClose={onClose}
    >
      <ScrollView
        style={{ maxHeight: 470 }}
        keyboardShouldPersistTaps="handled"
      >
        <View style={{ gap: 16, paddingBottom: 20 }}>
          <AppText variant="bodyStrong">
            Default Fleet: {defaultQuantity} cars
          </AppText>

          <AppText variant="caption">
            Enter dates in YYYY-MM-DD format.
            Adjustments affect only the selected dates.
          </AppText>

          <TextField
            label="Start Date"
            value={fromDate}
            onChangeText={setFromDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />

          <TextField
            label="End Date"
            value={toDate}
            onChangeText={setToDate}
            placeholder="YYYY-MM-DD"
            autoCapitalize="none"
          />

          <TextField
            label="Daily Quantity"
            value={quantity}
            onChangeText={setQuantity}
            keyboardType="number-pad"
            placeholder="Enter number of cars"
          />

          {error ? (
            <AppText variant="caption" style={{ color: "#c62828" }}>
              {error}
            </AppText>
          ) : null}

          <Button
            label={saving ? "Saving..." : "Save Daily Stock"}
            variant="brand"
            disabled={saving}
            onPress={() => save(false)}
          />

          <Button
            label="Restore Default Quantity"
            variant="line"
            disabled={saving}
            onPress={() => save(true)}
          />

          <AppText variant="bodyStrong">
            Existing Allocations
          </AppText>

          {loading ? (
            <AppText variant="caption">
              Loading...
            </AppText>
          ) : allocations.length === 0 ? (
            <AppText variant="caption">
              No daily overrides for this date range.
            </AppText>
          ) : (
            allocations.map((item) => (
              <View
                key={item.date}
                style={{
                  paddingVertical: 10,
                  borderBottomWidth: 1,
                  borderBottomColor: "#DCE5E8",
                  gap: 4,
                }}
              >
                <AppText variant="bodyStrong">
                  {item.date}
                </AppText>
                <AppText variant="caption">
                  Capacity: {item.quantity ?? defaultQuantity}
                  {"  ·  "}
                  Servicing: {item.blockedQuantity ?? 0}
                </AppText>
              </View>
            ))
          )}

          <AppText variant="caption">
            Allocations are capacity settings,
            not live remaining inventory.
          </AppText>
        </View>
      </ScrollView>
    </BottomSheet>
  );
}
