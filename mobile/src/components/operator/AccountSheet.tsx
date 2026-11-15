import { useRouter } from "expo-router";
import { useState } from "react";
import { StyleSheet, View } from "react-native";

import { AppText, BottomSheet, Button, ConfirmSheet, SegmentedControl, type SegmentOption } from "@/components/ui";
import { useTheme } from "@/hooks/use-theme";
import type { ThemePreference } from "@/providers/theme-provider";
import { clearSession } from "@/services/session";

const APPEARANCE: readonly SegmentOption<ThemePreference>[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/**
 * Operators have no Profile tab, so the appearance choice and sign out live
 * here, opened from the dashboard header (plan 05b, decision 4).
 */
export function AccountSheet({
  visible,
  onClose,
  name,
  email,
}: {
  visible: boolean;
  onClose: () => void;
  name?: string | null;
  email?: string | null;
}) {
  const router = useRouter();
  const { preference, setPreference } = useTheme();
  const [signOutOpen, setSignOutOpen] = useState(false);

  const signOut = async () => {
    await clearSession();
    setSignOutOpen(false);
    onClose();
    if (router.canDismiss()) router.dismissAll();
    router.replace("/login");
  };

  return (
    <>
      <BottomSheet visible={visible && !signOutOpen} title="Account" subtitle={[name, email].filter(Boolean).join(" · ") || undefined} onClose={onClose}>
        <View style={styles.block}>
          <AppText variant="label" color="ink">
            Appearance
          </AppText>
          <SegmentedControl options={APPEARANCE} value={preference} onChange={setPreference} accessibilityLabel="Appearance" />
          <AppText variant="caption">System follows your phone&apos;s light or dark setting.</AppText>
        </View>
        <Button label="Sign out" variant="line" icon="log-out-outline" style={styles.signOut} onPress={() => setSignOutOpen(true)} />
      </BottomSheet>

      <ConfirmSheet
        visible={signOutOpen}
        title="Sign out?"
        message="You'll need your email and password to sign in again."
        confirmLabel="Sign out"
        confirmVariant="danger"
        onConfirm={signOut}
        onCancel={() => setSignOutOpen(false)}
      />
    </>
  );
}

const styles = StyleSheet.create({
  block: {
    gap: 8,
  },
  signOut: {
    marginTop: 20,
  },
});
