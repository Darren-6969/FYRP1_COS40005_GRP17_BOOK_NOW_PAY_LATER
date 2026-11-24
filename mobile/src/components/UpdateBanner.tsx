import { Ionicons } from "@expo/vector-icons";
import * as Updates from "expo-updates";
import { useEffect, useRef, useState } from "react";
import { AccessibilityInfo, Animated, AppState, Easing, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { AppText, Button, IconButton } from "@/components/ui";
import { Radius } from "@/constants/theme";
import { useTheme } from "@/hooks/use-theme";
import { logger } from "@/utils/logger";

/** How often to look for an update when the app comes back to the front. */
const CHECK_EVERY_MS = 30 * 60 * 1000;

/**
 * Tells the user a new version of the app has been downloaded (an EAS
 * Update, published with `eas update --channel <channel>`) and offers a
 * restart. Without this the update applies silently at the next cold start.
 *
 * expo-updates checks once at launch. This also checks when the app returns
 * to the foreground, at most every 30 minutes, so a phone that stays open
 * for days still hears about an update. Does nothing in development builds
 * or Expo Go, where updates are disabled.
 *
 * Mounted once in app/_layout.tsx.
 */
export function UpdateBanner() {
  const { isUpdatePending } = Updates.useUpdates();
  const [dismissed, setDismissed] = useState(false);
  const lastCheck = useRef(0);

  useEffect(() => {
    if (!Updates.isEnabled || __DEV__) return;
    const subscription = AppState.addEventListener("change", (state) => {
      if (state !== "active" || Date.now() - lastCheck.current < CHECK_EVERY_MS) return;
      lastCheck.current = Date.now();
      Updates.checkForUpdateAsync()
        .then((result) => (result.isAvailable ? Updates.fetchUpdateAsync() : null))
        .catch((err) => logger.debug("[updates] check failed:", err));
    });
    return () => subscription.remove();
  }, []);

  if (!Updates.isEnabled || !isUpdatePending || dismissed) return null;
  return <Banner onDismiss={() => setDismissed(true)} />;
}

function Banner({ onDismiss }: { onDismiss: () => void }) {
  const { tokens } = useTheme();
  const insets = useSafeAreaInsets();
  const progress = useState(() => new Animated.Value(0))[0];

  useEffect(() => {
    AccessibilityInfo.announceForAccessibility("An update is ready. Restart the app to use it.");
    Animated.timing(progress, { toValue: 1, duration: 240, easing: Easing.out(Easing.ease), useNativeDriver: true }).start();
  }, [progress]);

  const restart = async () => {
    try {
      await Updates.reloadAsync();
    } catch (err) {
      logger.debug("[updates] restart failed:", err);
    }
  };

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[
        styles.wrap,
        {
          top: insets.top + 8,
          opacity: progress,
          transform: [{ translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [-12, 0] }) }],
        },
      ]}
    >
      <View
        accessibilityRole="alert"
        style={[
          styles.card,
          {
            backgroundColor: tokens.background,
            borderColor: tokens.glassLine,
            boxShadow: `0px 14px 30px -18px ${tokens.shadow}`,
          },
        ]}
      >
        <View style={[styles.icon, { backgroundColor: tokens.glass }]}>
          <Ionicons name="arrow-up-circle-outline" size={22} color={tokens.brand} />
        </View>
        <View style={styles.text}>
          <AppText variant="bodyStrong">Update ready</AppText>
          <AppText variant="caption">Restart to use the latest version. Otherwise it applies next time you open the app.</AppText>
        </View>
        <Button label="Restart" size="sm" variant="brand" onPress={restart} />
        <IconButton icon="close" label="Not now" onPress={onDismiss} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  wrap: {
    position: "absolute",
    left: 12,
    right: 12,
    alignItems: "center",
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    width: "100%",
    maxWidth: 520,
    paddingVertical: 10,
    paddingLeft: 10,
    paddingRight: 4,
    borderRadius: Radius.card,
    borderWidth: StyleSheet.hairlineWidth,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  text: {
    flex: 1,
    gap: 2,
  },
});
