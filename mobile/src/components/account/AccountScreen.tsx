import { Ionicons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import type { ReactNode } from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, FLOATING_BAR_CLEARANCE, FloatingActionBar, IconButton } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { describeError } from "@/utils/errors";

/**
 * Frame for the pushed account screens (edit profile, change password,
 * notification settings): back button and large title, a scrolling form
 * that clears the keyboard, and the save button in the floating bar.
 */
export function AccountScreen({
  title,
  children,
  action,
}: {
  title: string;
  children: ReactNode;
  /** Usually a <Button>; shown in the floating bar. */
  action?: ReactNode;
}) {
  const router = useRouter();
  const insets = useSafeAreaInsets();

  return (
    <KeyboardAvoidingView style={styles.screen} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView
        contentContainerStyle={[
          styles.content,
          {
            paddingTop: insets.top + 8,
            paddingBottom: (action ? FLOATING_BAR_CLEARANCE : 0) + insets.bottom + 16,
          },
        ]}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.topRow}>
          <IconButton icon="chevron-back" label="Back" onPress={() => router.back()} />
          <AppText variant="largeTitle" accessibilityRole="header" style={styles.flex} numberOfLines={1} adjustsFontSizeToFit>
            {title}
          </AppText>
        </View>
        {children}
      </ScrollView>
      {action ? <FloatingActionBar action={action} /> : null}
    </KeyboardAvoidingView>
  );
}

/** A failed save, shown inline above the form's end (rule 05b). */
export function SaveError({ error }: { error: unknown }) {
  const { tokens } = useTheme();
  if (!error) return null;
  const info = describeError(error);
  return (
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
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 16,
  },
  topRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  flex: {
    flex: 1,
  },
  note: {
    flexDirection: "row",
    gap: 10,
    alignItems: "flex-start",
    padding: 12,
    borderRadius: Radius.sm,
  },
});
