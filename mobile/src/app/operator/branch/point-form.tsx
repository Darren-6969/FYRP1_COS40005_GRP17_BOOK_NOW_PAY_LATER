import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";

import { AccountScreen, SaveError } from "@/components/account/AccountScreen";
import { AppText, Button, Chip, ErrorState, GlassCard, SkeletonText, TextField, useToast } from "@/components/ui";
import {
  createOperatorBranchPoint,
  getOperatorBranches,
  updateOperatorBranchPoint,
  type OperatorPickupPoint,
  type OperatorPointPayload,
} from "@/services/operatorApi";
import { logger } from "@/utils/logger";
import { startAsync } from "@/utils/start-async";

type Usage = OperatorPickupPoint["usage"];

const USAGES: { value: Usage; label: string }[] = [
  { value: "BOTH", label: "Pick-up and drop-off" },
  { value: "PICKUP", label: "Pick-up only" },
  { value: "DROPOFF", label: "Drop-off only" },
];

type Form = { label: string; address: string; note: string; usage: Usage; pickupFee: string; dropoffFee: string };
type Errors = Partial<Record<keyof Form, string>>;

const EMPTY: Form = { label: "", address: "", note: "", usage: "BOTH", pickupFee: "0", dropoffFee: "0" };

/** RM 0 or more, whole ringgit or up to two decimals. */
const FEE = /^\d+(\.\d{1,2})?$/;

function feeText(value: number | string | null | undefined) {
  return value === null || value === undefined ? "0" : String(value);
}

/**
 * Add or edit a pick-up or drop-off point (plan 05b): a pushed form with
 * errors under each field. Each side has its own charge; RM 0 means free.
 */
export default function PointFormScreen() {
  const router = useRouter();
  const toast = useToast();
  const params = useLocalSearchParams<{ branchId?: string; pointId?: string }>();
  const branchNum = Number(params.branchId);
  const branchId = Number.isInteger(branchNum) && branchNum > 0 ? branchNum : null;
  const pointNum = Number(params.pointId);
  const pointId = params.pointId ? (Number.isInteger(pointNum) && pointNum > 0 ? pointNum : NaN) : null;
  const editing = pointId !== null;

  const [form, setForm] = useState<Form | null>(editing ? null : EMPTY);
  const [branchName, setBranchName] = useState<string | null>(null);
  const [loadError, setLoadError] = useState<unknown>(null);
  const [errors, setErrors] = useState<Errors>({});
  const [saveError, setSaveError] = useState<unknown>(null);

  const load = () => startAsync(async () => {
    try {
      if (!branchId || Number.isNaN(pointId)) throw new Error("This link isn't valid.");
      const response = await getOperatorBranches();
      const branch = (response?.branches ?? []).find((b) => b.id === branchId);
      if (!branch) throw new Error("This branch wasn't found.");
      setBranchName(branch.name);
      if (editing) {
        const p = (branch.pickupPoints ?? []).find((x) => x.id === pointId);
        if (!p) throw new Error("This point wasn't found.");
        setForm({
          label: p.label || "",
          address: p.address || "",
          note: p.note || "",
          usage: p.usage || "BOTH",
          pickupFee: feeText(p.fee),
          dropoffFee: feeText(p.dropoffFee),
        });
      }
    } catch (err) {
      logger.debug("Failed to load the point:", err);
      setLoadError(err);
    }
  });

  // Retry resets first; the first load needs no reset, so the effect's load
  // makes no synchronous state updates (react-hooks/set-state-in-effect).
  const retry = () => {
    setLoadError(null);
    return load();
  };

  useEffect(() => {
    load();
    // Load once for the branch and point in the link.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [params.branchId, params.pointId]);

  const title = editing ? "Edit point" : "Add a point";

  if (loadError) {
    return (
      <AccountScreen title={title}>
        <ErrorState error={loadError} onRetry={retry} />
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

  const pickup = form.usage !== "DROPOFF";
  const dropoff = form.usage !== "PICKUP";

  const save = async () => {
    const next: Errors = {};
    if (!form.label.trim()) next.label = "Name the place, for example Kuching Airport arrival hall.";
    if (pickup && !FEE.test(form.pickupFee.trim())) next.pickupFee = "Enter RM 0 or more, with up to two decimals.";
    if (dropoff && !FEE.test(form.dropoffFee.trim())) next.dropoffFee = "Enter RM 0 or more, with up to two decimals.";
    setErrors(next);
    setSaveError(null);
    if (Object.values(next).some(Boolean) || !branchId) return;

    const payload: OperatorPointPayload = {
      label: form.label.trim(),
      address: form.address.trim() || null,
      note: form.note.trim() || null,
      usage: form.usage,
      // The side a point doesn't serve has no charge.
      pickupFee: pickup ? Number(form.pickupFee.trim()) : 0,
      dropoffFee: dropoff ? Number(form.dropoffFee.trim()) : 0,
    };

    try {
      if (editing) await updateOperatorBranchPoint(branchId, pointId as number, payload);
      else await createOperatorBranchPoint(branchId, payload);
      toast.show(editing ? "Point saved." : "Point added.", { tone: "ok" });
      router.back();
    } catch (err) {
      logger.debug("Failed to save the point:", err);
      setSaveError(err);
    }
  };

  return (
    <AccountScreen title={title} action={<Button label={editing ? "Save changes" : "Add point"} variant="brand" grow onPress={save} />}>
      {branchName ? <AppText variant="caption">At {branchName}</AppText> : null}

      <GlassCard>
        <View style={styles.fields}>
          <TextField label="Name" value={form.label} onChangeText={set("label")} error={errors.label} placeholder="e.g. Airport arrival hall" maxLength={120} />
          <TextField label="Address (optional)" value={form.address} onChangeText={set("address")} placeholder="Where exactly" multiline maxLength={300} />
          <TextField
            label="Note for customers (optional)"
            value={form.note}
            onChangeText={set("note")}
            placeholder="e.g. Meet at door 3, call when you land"
            multiline
            maxLength={300}
          />
        </View>
      </GlassCard>

      <GlassCard>
        <View style={styles.fields}>
          <AppText variant="label" color="ink">
            Used for
          </AppText>
          <View style={styles.chips} accessibilityRole="radiogroup">
            {USAGES.map((u) => (
              <Chip
                key={u.value}
                label={u.label}
                selected={form.usage === u.value}
                onPress={() => {
                  setForm((f) => (f ? { ...f, usage: u.value } : f));
                  setErrors((e) => ({ ...e, pickupFee: undefined, dropoffFee: undefined }));
                }}
              />
            ))}
          </View>
          {pickup ? (
            <TextField
              label="Pick-up charge (RM)"
              value={form.pickupFee}
              onChangeText={set("pickupFee")}
              error={errors.pickupFee}
              keyboardType="decimal-pad"
              placeholder="0"
              hint="RM 0 means free."
            />
          ) : null}
          {dropoff ? (
            <TextField
              label="Drop-off charge (RM)"
              value={form.dropoffFee}
              onChangeText={set("dropoffFee")}
              error={errors.dropoffFee}
              keyboardType="decimal-pad"
              placeholder="0"
              hint="RM 0 means free."
            />
          ) : null}
        </View>
      </GlassCard>

      <SaveError error={saveError} />
    </AccountScreen>
  );
}

const styles = StyleSheet.create({
  fields: {
    gap: 14,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
});
