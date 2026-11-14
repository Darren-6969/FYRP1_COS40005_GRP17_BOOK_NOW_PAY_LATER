import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import { StyleSheet, Switch, View } from "react-native";

import { AccountScreen, SaveError } from "@/components/account/AccountScreen";
import { AppText, Button, GlassCard, useToast } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import { getMe, updateNotificationPreferences } from "@/services/authApi";
import { getStoredUser, saveStoredUser } from "@/services/session";
import { logger } from "@/utils/logger";

type Prefs = {
  notifyBookingUpdates: boolean;
  notifyPaymentReminders: boolean;
  notifyInvoices: boolean;
  notifyPromotions: boolean;
};

const ITEMS: { key: keyof Prefs; title: string; description: string }[] = [
  {
    key: "notifyBookingUpdates",
    title: "Booking updates",
    description: "When an operator accepts, declines or offers another car, and other changes to your bookings.",
  },
  {
    key: "notifyPaymentReminders",
    title: "Payment reminders",
    description: "Before a payment is due, and if one is missed.",
  },
  {
    key: "notifyInvoices",
    title: "Invoices and receipts",
    description: "When a payment is confirmed or an invoice is ready.",
  },
  {
    key: "notifyPromotions",
    title: "News and offers",
    description: "Occasional platform announcements.",
  },
];

function prefsOf(user: any): Prefs {
  return {
    notifyBookingUpdates: Boolean(user?.notifyBookingUpdates),
    notifyPaymentReminders: Boolean(user?.notifyPaymentReminders),
    notifyInvoices: Boolean(user?.notifyInvoices),
    notifyPromotions: Boolean(user?.notifyPromotions),
  };
}

/** Notification settings, pushed from Profile (rule 05b). */
export default function NotificationSettingsScreen() {
  const router = useRouter();
  const toast = useToast();
  const { tokens } = useTheme();
  const [prefs, setPrefs] = useState<Prefs | null>(null);
  const [saveError, setSaveError] = useState<unknown>(null);

  useEffect(() => {
    let active = true;
    (async () => {
      const stored = await getStoredUser();
      if (active && stored) setPrefs(prefsOf(stored));
      try {
        const response = await getMe();
        const user = response?.user || response;
        if (active && user) setPrefs(prefsOf(user));
      } catch (err) {
        logger.debug("Failed to refresh notification settings:", err);
        if (active && !stored) setPrefs(prefsOf(null));
      }
    })();
    return () => {
      active = false;
    };
  }, []);

  const save = async () => {
    if (!prefs) return;
    setSaveError(null);
    try {
      const response = await updateNotificationPreferences(prefs);
      const user = response?.user || response;
      if (user) await saveStoredUser(user);
      toast.show("Notification settings saved.", { tone: "ok" });
      router.back();
    } catch (err) {
      logger.debug("Failed to update notification preferences:", err);
      setSaveError(err);
    }
  };

  return (
    <AccountScreen
      title="Notifications"
      action={<Button label="Save" variant="brand" grow disabled={!prefs} onPress={save} />}
    >
      <AppText variant="caption">
        Choose which updates you want to receive.
      </AppText>
      <GlassCard padding={4}>
        {ITEMS.map((item, i) => (
          <View
            key={item.key}
            style={[styles.row, i > 0 && { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.line }]}
          >
            <View style={styles.flex}>
              <AppText variant="bodyStrong">{item.title}</AppText>
              <AppText variant="caption">{item.description}</AppText>
            </View>
            <Switch
              value={prefs?.[item.key] ?? false}
              disabled={!prefs}
              onValueChange={(on) => setPrefs((p) => (p ? { ...p, [item.key]: on } : p))}
              accessibilityLabel={item.title}
              trackColor={{ false: tokens.glassStrong, true: tokens.brand }}
              thumbColor="#FFFFFF"
              ios_backgroundColor={tokens.glassStrong}
            />
          </View>
        ))}
      </GlassCard>
      <SaveError error={saveError} />
    </AccountScreen>
  );
}

const styles = StyleSheet.create({
  flex: {
    flex: 1,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 64,
    paddingHorizontal: 12,
    paddingVertical: 12,
  },
});
