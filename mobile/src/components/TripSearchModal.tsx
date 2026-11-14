import { Ionicons } from "@expo/vector-icons";
import DateTimePicker, { type DateTimePickerEvent } from "@react-native-community/datetimepicker";
import { useEffect, useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";

import {
  AppText,
  BottomSheet,
  Button,
  Chip,
  FieldError,
  GlassCard,
} from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { formatMYT, mytToIso } from "@/utils/datetime";

export type TripSearch = {
  city: string;
  /** "2026-12-15", Malaysia wall-clock date */
  from: string;
  /** "10:00" */
  fromTime: string;
  to: string;
  toTime: string;
};

type Props = {
  visible: boolean;
  value: TripSearch;
  onClose: () => void;
  onApply: (value: TripSearch) => void;
};

const CITIES = ["Kuching", "Miri", "Sibu", "Bintulu"];

type PickerTarget = "fromDate" | "fromTime" | "toDate" | "toTime";

const PICKER_TITLE: Record<PickerTarget, string> = {
  fromDate: "Pick-up date",
  fromTime: "Pick-up time",
  toDate: "Return date",
  toTime: "Return time",
};

function pad2(n: number) {
  return String(n).padStart(2, "0");
}

/** The picker works in the phone's wall clock; these read what was chosen. */
function dateOf(d: Date) {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

function timeOf(d: Date) {
  return `${pad2(d.getHours())}:${pad2(d.getMinutes())}`;
}

function pickerValue(date: string, time: string) {
  const [y, m, d] = (date || dateOf(new Date())).split("-").map(Number);
  const [hh, mm] = (time || "10:00").split(":").map(Number);
  return new Date(y, m - 1, d, hh, mm);
}

function addDay(date: string) {
  const [y, m, d] = date.split("-").map(Number);
  return dateOf(new Date(y, m - 1, d + 1));
}

/** The trip picker on Home and the car list, as a bottom panel. */
export default function TripSearchModal({ visible, value, onClose, onApply }: Props) {
  const { scheme, tokens } = useTheme();
  const [draft, setDraft] = useState<TripSearch>(value);
  const [error, setError] = useState("");
  const [picker, setPicker] = useState<PickerTarget | null>(null);

  useEffect(() => {
    if (visible) {
      setDraft(value);
      setError("");
      setPicker(null);
    }
  }, [visible, value]);

  const apply = () => {
    // "Today" in Malaysia, whatever the phone's time zone (F7).
    const today = formatMYT(Date.now(), "iso");

    if (draft.from && draft.from < today) return setError("Pick-up date can't be in the past.");
    if (draft.from && !draft.to) return setError("Choose a return date.");
    if (!draft.from && draft.to) return setError("Choose a pick-up date.");
    if (draft.from && draft.to) {
      const start = `${draft.from}T${draft.fromTime || "10:00"}`;
      const end = `${draft.to}T${draft.toTime || "10:00"}`;
      if (end <= start) return setError("Return must be after pick-up.");
    }

    onApply(draft);
    onClose();
  };

  const onPicked = (event: DateTimePickerEvent, selected?: Date) => {
    const target = picker;
    // Android shows a dialog that closes itself; close our state too.
    if (Platform.OS === "android") setPicker(null);
    if (event.type === "dismissed" || !selected || !target) return;

    setError("");
    setDraft((current) => {
      if (target === "fromDate") {
        const from = dateOf(selected);
        const to = !current.to || current.to <= from ? addDay(from) : current.to;
        return { ...current, from, to };
      }
      if (target === "toDate") return { ...current, to: dateOf(selected) };
      if (target === "fromTime") return { ...current, fromTime: timeOf(selected) };
      return { ...current, toTime: timeOf(selected) };
    });
  };

  const isFrom = picker === "fromDate" || picker === "fromTime";
  const isDate = picker === "fromDate" || picker === "toDate";

  const row = (target: PickerTarget, icon: "calendar-outline" | "time-outline", text: string) => (
    <Pressable
      key={target}
      onPress={() => setPicker(target)}
      accessibilityRole="button"
      accessibilityLabel={`${PICKER_TITLE[target]}, ${text}`}
      style={({ pressed }) => [styles.rowPress, pressed && { opacity: 0.8 }]}
    >
      <Ionicons name={icon} size={19} color={tokens.leafInk} style={styles.rowIcon} />
      <AppText variant="caption" style={styles.rowLabel}>
        {PICKER_TITLE[target]}
      </AppText>
      <AppText variant="bodyStrong" style={styles.rowValue}>
        {text}
      </AppText>
    </Pressable>
  );

  const shown = (date: string, time: string, part: "date" | "time") => {
    if (!date) return part === "date" ? "Choose" : time || "10:00";
    return formatMYT(mytToIso(date, time || "10:00"), part === "date" ? "dayDate" : "time");
  };

  return (
    <BottomSheet
      visible={visible}
      title="Plan your trip"
      subtitle="Where and when you need the car"
      onClose={onClose}
      footer={<Button label="Show cars" variant="brand" onPress={apply} />}
    >
      <View style={styles.section}>
        <AppText variant="headline">Pick-up city</AppText>
        <View style={styles.chips}>
          {CITIES.map((city) => (
            <Chip
              key={city}
              label={city}
              selected={draft.city === city}
              onPress={() => setDraft((current) => ({ ...current, city }))}
            />
          ))}
        </View>
      </View>

      <View style={styles.section}>
        <AppText variant="headline">Pick-up</AppText>
        <GlassCard padding={4}>
          {row("fromDate", "calendar-outline", shown(draft.from, draft.fromTime, "date"))}
          {row("fromTime", "time-outline", shown(draft.from, draft.fromTime, "time"))}
        </GlassCard>
      </View>

      <View style={styles.section}>
        <AppText variant="headline">Return</AppText>
        <GlassCard padding={4}>
          {row("toDate", "calendar-outline", shown(draft.to, draft.toTime, "date"))}
          {row("toTime", "time-outline", shown(draft.to, draft.toTime, "time"))}
        </GlassCard>
      </View>

      <FieldError message={error} />

      <AppText variant="caption">
        Requesting is free. You only pay after the operator accepts.
      </AppText>

      {picker ? (
        <View style={Platform.OS === "ios" ? styles.inlinePicker : undefined}>
          {Platform.OS === "ios" ? (
            <View style={styles.inlineHeader}>
              <AppText variant="headline">{PICKER_TITLE[picker]}</AppText>
              <Button label="Done" variant="text" size="sm" onPress={() => setPicker(null)} />
            </View>
          ) : null}
          <DateTimePicker
            value={isFrom ? pickerValue(draft.from, draft.fromTime) : pickerValue(draft.to, draft.toTime)}
            mode={isDate ? "date" : "time"}
            display={Platform.OS === "ios" ? (isDate ? "inline" : "spinner") : "default"}
            themeVariant={scheme}
            minimumDate={
              picker === "fromDate"
                ? new Date()
                : picker === "toDate" && draft.from
                  ? pickerValue(draft.from, "00:00")
                  : undefined
            }
            onChange={onPicked}
          />
        </View>
      ) : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
  chips: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  rowPress: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    minHeight: 48,
    paddingHorizontal: 12,
  },
  rowIcon: {
    width: 20,
  },
  rowLabel: {
    flex: 1,
  },
  rowValue: {
    fontVariant: ["tabular-nums"],
  },
  inlinePicker: {
    gap: 4,
  },
  inlineHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
});
