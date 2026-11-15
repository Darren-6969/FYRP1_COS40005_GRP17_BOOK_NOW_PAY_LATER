import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText, BottomSheet, Button, TextField, useToast } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { quickEditOperatorListing, type OperatorListing } from "@/services/operatorApi";
import { describeError } from "@/utils/errors";
import { logger } from "@/utils/logger";

/** A ringgit amount as typed: whole ringgit, or up to two decimals. */
const MONEY = /^\d+(\.\d{1,2})?$/;

/**
 * Quick edit (plan 05b): the daily rate and the number of cars, with
 * inline errors. The amount is sent as typed; the server stores and prices
 * it. A smaller car count is refused by the server if bookings already hold
 * more cars than that, and its message is shown here.
 */
export function QuickEditSheet({
  listing,
  onClose,
  onSaved,
}: {
  listing: OperatorListing | null;
  onClose: () => void;
  onSaved: (listing: OperatorListing) => void;
}) {
  const toast = useToast();
  const { tokens } = useTheme();
  const [price, setPrice] = useState("");
  const [quantity, setQuantity] = useState("");
  const [errors, setErrors] = useState<{ price?: string; quantity?: string }>({});
  const [saveError, setSaveError] = useState<unknown>(null);

  useEffect(() => {
    if (!listing) return;
    setPrice(listing.price !== undefined && listing.price !== null ? String(listing.price) : "");
    setQuantity(String(listing.quantity ?? ""));
    setErrors({});
    setSaveError(null);
  }, [listing]);

  if (!listing) return null;

  const save = async () => {
    const next: typeof errors = {};
    const p = price.trim();
    const q = quantity.trim();
    if (!MONEY.test(p) || Number(p) <= 0) next.price = "Enter a daily rate above RM 0, with up to two decimals.";
    if (!/^\d+$/.test(q)) next.quantity = "Enter a whole number of cars, 0 or more.";
    setErrors(next);
    setSaveError(null);
    if (next.price || next.quantity) return;

    try {
      const response = await quickEditOperatorListing(listing.id, { price: Number(p), quantity: Number(q) });
      toast.show("Rate and car count saved.", { tone: "ok" });
      onSaved(response.listing);
      onClose();
    } catch (err) {
      logger.debug("Quick edit failed:", err);
      setSaveError(err);
    }
  };

  const info = saveError ? describeError(saveError) : null;

  return (
    <BottomSheet
      visible
      title="Quick edit"
      subtitle={listing.name}
      onClose={onClose}
      footer={<Button label="Save" variant="brand" onPress={save} />}
    >
      <View style={styles.fields}>
        <TextField
          label="Daily rate (RM)"
          value={price}
          onChangeText={(t) => {
            setPrice(t);
            if (errors.price) setErrors((e) => ({ ...e, price: undefined }));
          }}
          error={errors.price}
          keyboardType="decimal-pad"
          placeholder="120.00"
          hint="Hourly, weekly and monthly rates are on Edit details."
        />
        <TextField
          label="Number of cars"
          value={quantity}
          onChangeText={(t) => {
            setQuantity(t);
            if (errors.quantity) setErrors((e) => ({ ...e, quantity: undefined }));
          }}
          error={errors.quantity}
          keyboardType="number-pad"
          placeholder="1"
          hint="How many of this car you can rent out at the same time."
        />
      </View>
      {info ? (
        <View style={[styles.note, { backgroundColor: tokens.errBg }]} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color={tokens.errFg} />
          <View style={styles.flex}>
            <AppText variant="label" style={{ color: tokens.errFg }}>
              {info.title}
            </AppText>
            <AppText variant="caption" style={{ color: tokens.errFg }}>
              {info.message}
            </AppText>
          </View>
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  fields: {
    gap: 16,
  },
  note: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: Radius.sm,
    marginTop: 16,
  },
});
