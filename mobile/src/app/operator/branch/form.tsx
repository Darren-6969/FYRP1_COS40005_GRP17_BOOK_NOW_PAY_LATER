import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AccountScreen, SaveError } from "@/components/account/AccountScreen";
import { Button, ErrorState, GlassCard, SkeletonText, TextField, useToast } from "@/components/ui";
import {
  createOperatorBranch,
  getOperatorBranches,
  updateOperatorBranch,
  type OperatorBranchPayload,
} from "@/services/operatorApi";
import { logger } from "@/utils/logger";

type Form = { name: string; address: string; city: string; state: string; country: string; phone: string };
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = { name: "", address: "", city: "", state: "", country: "Malaysia", phone: "" };

/** Add or edit a branch (plan 05b): a pushed form with errors under each field. */
export default function BranchFormScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ id?: string }>();
  const parsed = Number(params.id);
  const branchId = params.id ? (Number.isInteger(parsed) && parsed > 0 ? parsed : NaN) : null;
  const editing = branchId !== null;

  const [form, setForm] = useState<Form | null>(editing ? null : EMPTY);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<unknown>(null);

  const load = async () => {
    if (!editing) return;
    setLoadError(null);
    try {
      if (Number.isNaN(branchId)) throw new Error("This branch link isn't valid.");
      // There is no single-branch endpoint; the list has every field.
      const response = await getOperatorBranches();
      const b = (response?.branches ?? []).find((x) => x.id === branchId);
      if (!b) throw new Error("This branch wasn't found. It may belong to another account.");
      setForm({
        name: b.name || "",
        address: b.address || "",
        city: b.city || "",
        state: b.state || "",
        country: b.country || "Malaysia",
        phone: b.phone || "",
      });
    } catch (err) {
      logger.debug("Failed to load the branch:", err);
      setLoadError(err);
    }
  };

  useEffect(() => {
    load();
    // Load once for the branch in the link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.id]);

  const title = editing ? "Edit branch" : "Add a branch";

  if (loadError) {
    return (
      <AccountScreen title={title}>
        <ErrorState error={loadError} onRetry={load} />
      </AccountScreen>
    );
  }

  if (!form) {
    return (
      <AccountScreen title={title}>
        <GlassCard>
          <SkeletonText lines={5} />
        </GlassCard>
      </AccountScreen>
    );
  }

  const set = (key: keyof Form) => (value: string) => {
    setForm((f) => (f ? { ...f, [key]: value } : f));
    if (errors[key]) setErrors((e) => ({ ...e, [key]: undefined }));
  };

  const save = async () => {
    const next: Errors = {};
    if (!form.name.trim()) next.name = "Give the branch a name, for example Kuching Airport.";
    if (!form.address.trim()) next.address = "Enter the branch's full address.";
    // Loose on purpose: landlines and mobiles in any common format.
    if (form.phone.trim() && form.phone.replace(/\D/g, "").length < 7) next.phone = "Enter a phone number, for example 082-123 456.";
    setErrors(next);
    setSaveError(null);
    if (Object.values(next).some(Boolean)) return;

    const payload: OperatorBranchPayload = {
      name: form.name.trim(),
      address: form.address.trim(),
      city: form.city.trim() || null,
      state: form.state.trim() || null,
      country: form.country.trim() || "Malaysia",
      phone: form.phone.trim() || null,
    };

    try {
      if (editing) await updateOperatorBranch(branchId as number, payload);
      else await createOperatorBranch(payload);
      toast.show(editing ? "Branch saved." : "Branch added. Add its pick-up and drop-off points next.", { tone: "ok" });
      router.back();
    } catch (err) {
      logger.debug("Failed to save the branch:", err);
      setSaveError(err);
    }
  };

  return (
    <AccountScreen title={title} action={<Button label={editing ? "Save changes" : "Add branch"} variant="brand" grow onPress={save} />}>
      <GlassCard>
        <View style={styles.fields}>
          <TextField label="Branch name" value={form.name} onChangeText={set("name")} error={errors.name} placeholder="e.g. Kuching Airport" maxLength={120} />
          <TextField
            label="Address"
            value={form.address}
            onChangeText={set("address")}
            error={errors.address}
            placeholder="Street, area and postcode"
            multiline
            maxLength={300}
          />
          <View style={styles.row}>
            <View style={styles.flex}>
              <TextField label="City (optional)" value={form.city} onChangeText={set("city")} placeholder="Kuching" autoCapitalize="words" />
            </View>
            <View style={styles.flex}>
              <TextField label="State (optional)" value={form.state} onChangeText={set("state")} placeholder="Sarawak" autoCapitalize="words" />
            </View>
          </View>
          <TextField label="Country" value={form.country} onChangeText={set("country")} placeholder="Malaysia" autoCapitalize="words" />
          <TextField
            label="Phone (optional)"
            value={form.phone}
            onChangeText={set("phone")}
            error={errors.phone}
            placeholder="082-123 456"
            keyboardType="phone-pad"
          />
        </View>
      </GlassCard>
      <SaveError error={saveError} />
    </AccountScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  fields: {
    gap: 14,
  },
  row: {
    flexDirection: "row",
    gap: 10,
  },
});
