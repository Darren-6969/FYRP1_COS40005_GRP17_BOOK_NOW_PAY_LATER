import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useMemo, useState } from "react";
import { Platform, Pressable, StyleSheet, Switch, View } from "react-native";

import { AppText, BottomSheet, Button, FieldError, GlassCard, Money, useToast } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { returnOperatorBooking, type OperatorBooking } from "@/services/operatorApi";
import { formatMYT, mytParts, mytToIso } from "@/utils/datetime";
import { describeError } from "@/utils/errors";
import { logger } from "@/utils/logger";
import { formatRM } from "@/utils/money";
import { operatorBookingRef } from "@/utils/operator-booking";

type Props = {
  booking: OperatorBooking;
  onClose: () => void;
  onDone: () => Promise<void>;
};

const HOUR_MS = 60 * 60 * 1000;

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** A Malaysia wall-clock date and time: { date: "2026-11-16", time: "14:05" }. */
type WallClock = { date: string; time: string };

function wallClockOf(value: Date): WallClock {
  const p = mytParts(value)!;
  return { date: `${p.year}-${pad2(p.month + 1)}-${pad2(p.day)}`, time: `${pad2(p.hour)}:${pad2(p.minute)}` };
}

/**
 * The picker works in the phone's own time zone; it is only used to choose
 * calendar numbers, which are then read as Malaysia time (F14, F7).
 */
function pickerValue({ date, time }: WallClock) {
  const [y, m, d] = date.split("-").map(Number);
  const [hh, mm] = time.split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

/** The hourly rate in integer sen: the booking's quoted rate, else the listing's. */
function hourlySenOf(booking: OperatorBooking): number | null {
  const snapshot = Number(booking.pricingSnapshot?.rateCard?.hourlySen || 0);
  if (Number.isInteger(snapshot) && snapshot > 0) return snapshot;
  const listing = Number(booking.listing?.hourlyRate || 0);
  return listing > 0 ? Math.round(listing * 100) : null;
}

/**
 * Record a vehicle return (plan 05b, F14): the native date and time
 * pickers in Malaysia time instead of typed text. A late return shows an
 * estimate of the charge, worked out the server's way (each started hour
 * at the hourly rate, in integer sen). The server works out the final
 * figure, and won't complete a late return until the operator confirms it
 * was paid at the counter.
 */
export default function ReturnModal({ booking, onClose, onDone }: Props) {
  const toast = useToast();
  const { tokens, scheme } = useTheme();
  const [wall, setWall] = useState<WallClock>(() => wallClockOf(new Date()));
  const [picking, setPicking] = useState<"date" | "time" | null>(null);
  const [collected, setCollected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [sendError, setSendError] = useState<unknown>(null);

  const estimate = useMemo(() => {
    const actual = new Date(mytToIso(wall.date, wall.time));
    const scheduled = booking.returnDate ? new Date(booking.returnDate) : null;
    const lateMs = scheduled ? Math.max(0, actual.getTime() - scheduled.getTime()) : 0;
    const hours = lateMs > 0 ? Math.ceil(lateMs / HOUR_MS) : 0;
    const hourlySen = hourlySenOf(booking);
    return {
      actual,
      hours,
      // Integers only: started hours times the hourly rate in sen.
      chargeSen: hours > 0 && hourlySen ? hours * hourlySen : null,
    };
  }, [wall, booking]);

  const late = estimate.hours > 0;

  const onPicked = (event: DateTimePickerEvent, selected?: Date) => {
    const target = picking;
    if (Platform.OS === "android") setPicking(null);
    if (event.type === "dismissed" || !selected || !target) return;
    setError(null);
    setSendError(null);
    setWall((current) =>
      target === "date"
        ? { ...current, date: `${selected.getFullYear()}-${pad2(selected.getMonth() + 1)}-${pad2(selected.getDate())}` }
        : { ...current, time: `${pad2(selected.getHours())}:${pad2(selected.getMinutes())}` }
    );
  };

  const submit = async () => {
    if (estimate.actual.getTime() > Date.now()) {
      setError("The return time can't be in the future.");
      return;
    }
    if (booking.pickedUpAt && estimate.actual.getTime() < new Date(booking.pickedUpAt).getTime()) {
      setError(`The return time can't be before the handover (${formatMYT(booking.pickedUpAt, "dayDateTime")}).`);
      return;
    }
    if (late && !collected) {
      setError("Collect the late return charge at the counter, then confirm it below.");
      return;
    }
    setError(null);
    setSendError(null);
    try {
      // Malaysia wall-clock time, which the server reads as Malaysia time.
      const response = await returnOperatorBooking(booking.id, {
        actualReturnedAt: `${wall.date}T${wall.time}`,
        counterPaymentReceived: late && collected,
      });
      const summary = response.returnSummary;
      toast.show(
        summary?.late
          ? `Return recorded. ${summary.lateReturnHours} late ${summary.lateReturnHours === 1 ? "hour" : "hours"}, ${formatRM(summary.lateReturnCharge)} paid at the counter.`
          : "Return recorded. No late charge.",
        { tone: "ok" }
      );
      await onDone();
      onClose();
    } catch (err) {
      logger.debug("Vehicle return failed:", err);
      setSendError(err);
    }
  };

  const sendInfo = sendError ? describeError(sendError) : null;
  const picked = pickerValue(wall);

  return (
    <BottomSheet
      visible
      title="Record the return"
      subtitle={operatorBookingRef(booking)}
      onClose={onClose}
      footer={<Button label="Complete return" variant="brand" onPress={submit} />}
    >
      <GlassCard>
        <AppText variant="caption">Due back</AppText>
        <AppText variant="bodyStrong">{formatMYT(booking.returnDate, "dayDateTime")}</AppText>
      </GlassCard>

      <AppText variant="label" color="ink" style={styles.mt16}>
        Returned at (Malaysia time)
      </AppText>
      <View style={styles.pickRow}>
        <PickButton icon="calendar-outline" label={formatMYT(estimate.actual, "dayDate")} onPress={() => setPicking("date")} />
        <PickButton icon="time-outline" label={formatMYT(estimate.actual, "time")} onPress={() => setPicking("time")} />
      </View>
      {picking ? (
        <View>
          <DateTimePicker
            value={picked}
            mode={picking}
            display={Platform.OS === "ios" ? (picking === "date" ? "inline" : "spinner") : "default"}
            themeVariant={scheme}
            maximumDate={picking === "date" ? new Date() : undefined}
            onChange={onPicked}
          />
          {Platform.OS === "ios" ? (
            <Button label="Done" variant="text" size="sm" style={styles.alignStart} onPress={() => setPicking(null)} />
          ) : null}
        </View>
      ) : null}

      <GlassCard style={styles.mt16}>
        {late ? (
          <>
            <AppText variant="bodyStrong">
              Late by {estimate.hours} started {estimate.hours === 1 ? "hour" : "hours"}
            </AppText>
            {estimate.chargeSen !== null ? (
              <View style={styles.amountRow}>
                <AppText variant="caption">Estimated late charge </AppText>
                <Money sen={estimate.chargeSen} variant="headline" />
              </View>
            ) : (
              <AppText variant="caption" style={styles.mt4}>
                The server works out the charge from the booking&apos;s hourly rate.
              </AppText>
            )}
            <AppText variant="caption" style={styles.mt4}>
              The final figure is the server&apos;s and shows after you complete the return.
            </AppText>
            <Pressable
              onPress={() => {
                setCollected((c) => !c);
                setError(null);
              }}
              // The row is a bigger tap area only; screen readers use the Switch
              // itself, so the setting isn't announced twice.
              accessible={false}
              style={[styles.switchRow, { borderTopColor: tokens.line }]}
            >
              <AppText variant="body" color="ink" style={styles.flex}>
                Paid at the counter
              </AppText>
              <Switch
                value={collected}
                onValueChange={(v) => {
                  setCollected(v);
                  setError(null);
                }}
                trackColor={{ false: tokens.glassStrong, true: tokens.brand }}
                thumbColor="#FFFFFF"
                accessibilityLabel="Paid at the counter"
              />
            </Pressable>
          </>
        ) : (
          <View style={styles.onTime}>
            <Ionicons name="checkmark-circle-outline" size={20} color={tokens.okFg} />
            <AppText variant="body" color="ink">
              On time. No late charge.
            </AppText>
          </View>
        )}
      </GlassCard>

      <FieldError message={error} />

      {sendInfo ? (
        <View style={[styles.note, { backgroundColor: tokens.errBg }]} accessibilityRole="alert">
          <Ionicons name="alert-circle-outline" size={18} color={tokens.errFg} />
          <View style={styles.flex}>
            <AppText variant="label" style={{ color: tokens.errFg }}>
              {sendInfo.title}
            </AppText>
            <AppText variant="caption" style={{ color: tokens.errFg }}>
              {sendInfo.message}
            </AppText>
          </View>
        </View>
      ) : null}

      <AppText variant="caption" style={styles.mt16}>
        Completing the return ends the booking.
      </AppText>
    </BottomSheet>
  );
}

function PickButton({ icon, label, onPress }: { icon: "calendar-outline" | "time-outline"; label: string; onPress: () => void }) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={`Change, ${label}`}
      style={({ pressed }) => [
        styles.pick,
        { backgroundColor: tokens.glass, borderColor: tokens.glassLine, opacity: pressed ? 0.7 : 1 },
      ]}
    >
      <Ionicons name={icon} size={18} color={tokens.ink} />
      <AppText variant="bodyStrong">{label}</AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  mt4: {
    marginTop: 4,
  },
  mt16: {
    marginTop: 16,
  },
  alignStart: {
    alignSelf: "flex-start",
  },
  pickRow: {
    flexDirection: "row",
    gap: 10,
    marginTop: 8,
  },
  pick: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    minHeight: 48,
    paddingHorizontal: 14,
    borderRadius: Radius.pill,
    borderWidth: StyleSheet.hairlineWidth,
  },
  amountRow: {
    flexDirection: "row",
    alignItems: "baseline",
    marginTop: 6,
  },
  switchRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  onTime: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  note: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: Radius.sm,
    marginTop: 12,
  },
});
