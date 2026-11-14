import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { Image } from "expo-image";
import { useFocusEffect, useRouter, type Href } from "expo-router";
import { useCallback, useState, type ComponentProps, type ReactNode } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button, ConfirmSheet, GlassCard, SegmentedControl, StatusPill, type SegmentOption } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTabBarInset } from "@/hooks/use-tab-bar-inset";
import { useTheme } from "@/hooks/use-theme";
import type { ThemePreference } from "@/providers/theme-provider";
import { getMe } from "@/services/authApi";
import { getMyLicence, type LicenceDocument } from "@/services/customerApi";
import { clearSession, getStoredUser, saveStoredUser } from "@/services/session";
import { logger } from "@/utils/logger";

type IconName = ComponentProps<typeof Ionicons>["name"];

type UserProfile = {
  id?: number;
  userCode?: string;
  name?: string;
  email?: string;
  phone?: string;
  profileImageUrl?: string;
};

const APPEARANCE: readonly SegmentOption<ThemePreference>[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

function initialsOf(name: string) {
  return (
    name
      .split(" ")
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part.charAt(0).toUpperCase())
      .join("") || "CU"
  );
}

/**
 * Customer Profile (plan phase 3): grouped frosted sections. Edit profile,
 * change password and notification settings are pushed screens under
 * customer/account (rule 05b); the theme choice applies straight away.
 */
export default function ProfileScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const bottomInset = useTabBarInset();
  const { tokens, preference, setPreference } = useTheme();

  const [user, setUser] = useState<UserProfile | null>(null);
  // Undefined while loading or if it failed: the row then shows no pill.
  const [licence, setLicence] = useState<LicenceDocument | null | undefined>(undefined);
  const [signOutOpen, setSignOutOpen] = useState(false);

  const load = useCallback(async () => {
    // The stored copy first, so the header isn't blank while the server answers.
    const stored = await getStoredUser();
    if (stored) setUser(stored);

    try {
      const response = await getMe();
      const fresh = response?.user || response;
      if (fresh) {
        setUser(fresh);
        await saveStoredUser(fresh);
      }
    } catch (err) {
      logger.debug("Failed to refresh profile:", err);
    }

    try {
      const mine = await getMyLicence();
      setLicence(mine?.document ?? null);
    } catch (err) {
      logger.debug("Failed to load licence status:", err);
      setLicence(undefined);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      load();
    }, [load])
  );

  const go = (pathname: string) => router.push(pathname as Href);

  const signOut = async () => {
    await clearSession();
    setSignOutOpen(false);
    if (router.canDismiss()) router.dismissAll();
    router.replace("/login");
  };

  const name = user?.name || "Customer";
  const version = Constants.expoConfig?.version;

  return (
    <View style={styles.screen}>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingTop: insets.top + 8, paddingBottom: bottomInset }]}
        showsVerticalScrollIndicator={false}
      >
        <AppText variant="largeTitle" accessibilityRole="header">
          Profile
        </AppText>

        <GlassCard>
          <View style={styles.headerRow}>
            {user?.profileImageUrl ? (
              <Image
                source={{ uri: user.profileImageUrl }}
                style={styles.avatar}
                contentFit="cover"
                accessibilityLabel="Profile photo"
              />
            ) : (
              <View style={[styles.avatar, styles.avatarEmpty, { backgroundColor: tokens.infoBg }]}>
                <AppText variant="headline" style={{ color: tokens.infoFg }}>
                  {initialsOf(name)}
                </AppText>
              </View>
            )}
            <View style={styles.flex}>
              <AppText variant="headline" numberOfLines={1}>
                {name}
              </AppText>
              <AppText variant="caption" numberOfLines={1}>
                {user?.email || "No email on this account"}
              </AppText>
            </View>
            <Button label="Edit" variant="line" size="sm" onPress={() => go("/customer/account/edit-profile")} />
          </View>
        </GlassCard>

        <Group title="Account">
          <Row icon="person-outline" title="Personal details" onPress={() => go("/customer/account/edit-profile")} />
          <Row
            icon="card-outline"
            title="Driving licence"
            subtitle={licence === undefined ? "Needed for car bookings" : undefined}
            below={licence !== undefined ? <StatusPill kind="licence" status={licence?.status} style={styles.pill} /> : null}
            onPress={() => go("/customer/licence")}
          />
          <Row icon="lock-closed-outline" title="Change password" onPress={() => go("/customer/account/change-password")} />
          <Row
            icon="notifications-outline"
            title="Notification settings"
            subtitle="Choose which updates you get"
            onPress={() => go("/customer/account/notification-settings")}
          />
        </Group>

        <View style={styles.group}>
          <AppText variant="headline" accessibilityRole="header">
            Appearance
          </AppText>
          <GlassCard>
            <SegmentedControl
              options={APPEARANCE}
              value={preference}
              onChange={setPreference}
              accessibilityLabel="Appearance"
            />
            <AppText variant="caption" style={styles.mt8}>
              System follows your phone&apos;s light or dark setting.
            </AppText>
          </GlassCard>
        </View>

        <Group title="More">
          <Row icon="mail-unread-outline" title="Notifications" onPress={() => go("/customer/notifications")} />
          <Row icon="heart-outline" title="Saved cars" onPress={() => go("/customer/saved-cars")} />
          <Row icon="chatbubbles-outline" title="Help and support" onPress={() => go("/customer/support-chat")} />
          <Row icon="document-text-outline" title="Terms and conditions" onPress={() => go("/customer/terms")} />
          <Row icon="shield-checkmark-outline" title="Privacy policy" onPress={() => go("/customer/privacy")} />
        </Group>

        <Button label="Sign out" variant="line" icon="log-out-outline" onPress={() => setSignOutOpen(true)} />

        {version ? (
          <AppText variant="micro" align="center">
            BNPL Sarawak {version}
          </AppText>
        ) : null}
      </ScrollView>

      <ConfirmSheet
        visible={signOutOpen}
        title="Sign out?"
        message="You'll need your email and password to sign in again."
        confirmLabel="Sign out"
        confirmVariant="danger"
        onConfirm={signOut}
        onCancel={() => setSignOutOpen(false)}
      />
    </View>
  );
}

function Group({ title, children }: { title: string; children: ReactNode }) {
  const { tokens } = useTheme();
  const rows = (Array.isArray(children) ? children : [children]).filter(Boolean);
  return (
    <View style={styles.group}>
      <AppText variant="headline" accessibilityRole="header">
        {title}
      </AppText>
      <GlassCard padding={4}>
        {rows.map((row, i) => (
          <View key={i} style={i > 0 ? { borderTopWidth: StyleSheet.hairlineWidth, borderTopColor: tokens.line } : null}>
            {row}
          </View>
        ))}
      </GlassCard>
    </View>
  );
}

function Row({
  icon,
  title,
  subtitle,
  below,
  onPress,
}: {
  icon: IconName;
  title: string;
  subtitle?: string;
  /** Under the title, e.g. a status pill. */
  below?: ReactNode;
  onPress: () => void;
}) {
  const { tokens } = useTheme();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel={subtitle ? `${title}. ${subtitle}` : title}
      style={({ pressed }) => [styles.row, pressed && { opacity: 0.6 }]}
    >
      <View style={[styles.rowIcon, { backgroundColor: tokens.glassStrong, borderColor: tokens.glassLine }]}>
        <Ionicons name={icon} size={19} color={tokens.ink} />
      </View>
      <View style={styles.flex}>
        <AppText variant="bodyStrong">{title}</AppText>
        {subtitle ? <AppText variant="caption">{subtitle}</AppText> : null}
        {below}
      </View>
      <Ionicons name="chevron-forward" size={18} color={tokens.label} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  content: {
    paddingHorizontal: 18,
    gap: 18,
  },
  flex: {
    flex: 1,
  },
  mt8: {
    marginTop: 8,
  },
  headerRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  avatar: {
    width: 56,
    height: 56,
    borderRadius: 18,
  },
  avatarEmpty: {
    alignItems: "center",
    justifyContent: "center",
  },
  group: {
    gap: 10,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    minHeight: 56,
    paddingHorizontal: 10,
    paddingVertical: 8,
  },
  pill: {
    alignSelf: "flex-start",
    marginTop: 4,
  },
  rowIcon: {
    width: 36,
    height: 36,
    borderRadius: Radius.sm,
    borderWidth: StyleSheet.hairlineWidth,
    alignItems: "center",
    justifyContent: "center",
  },
});
