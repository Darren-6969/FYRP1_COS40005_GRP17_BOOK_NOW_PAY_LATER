import { Image } from "expo-image";
import { Redirect, useFocusEffect, useRouter, type Href } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import { ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { OnboardingCarousel } from "@/components/OnboardingCarousel";
import { AppText, Button } from "@/components/ui";
import { homeForRole } from "@/hooks/use-role-guard";
import { useTheme } from "@/hooks/use-theme";
import { getStoredUser, getToken } from "@/services/session";
import { logger } from "@/utils/logger";

/**
 * The same colours as the expo-splash-screen settings in app.json, so the
 * hand-over from the splash screen is invisible in light and dark.
 */
const SPLASH_BACKGROUND = { light: "#EEF2EC", dark: "#0B1512" } as const;

type Launch = { state: "checking" } | { state: "welcome" } | { state: "home"; href: Href };

/**
 * Welcome (plan phase 5): the onboarding carousel, then Create an account
 * and Sign in, always visible, so nobody has to sit through the slides.
 * A saved login skips this screen (F18).
 */
export default function WelcomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { tokens, scheme } = useTheme();
  const [launch, setLaunch] = useState<Launch>({ state: "checking" });

  // White status bar icons over the photo, only while Welcome is on screen;
  // the theme's default comes back when another screen covers it.
  useFocusEffect(
    useCallback(() => {
      setStatusBarStyle("light");
      return () => setStatusBarStyle(tokens.statusBar);
    }, [tokens.statusBar])
  );

  // F18: a saved login goes straight to its home. This only reads the
  // device, so it is instant and works offline; the section's role guard
  // then confirms the session with the server (and refreshes it if needed).
  useEffect(() => {
    let active = true;
    (async () => {
      let next: Launch = { state: "welcome" };
      try {
        const [token, user] = await Promise.all([getToken(), getStoredUser()]);
        const home = token ? homeForRole(user?.role) : null;
        if (home) next = { state: "home", href: home };
      } catch (err) {
        logger.warn("[launch] could not read the saved session", err);
      }
      if (active) setLaunch(next);
    })();
    return () => {
      active = false;
    };
  }, []);

  if (launch.state === "checking") {
    return <View style={{ flex: 1, backgroundColor: SPLASH_BACKGROUND[scheme] }} />;
  }

  if (launch.state === "home") {
    return <Redirect href={launch.href} />;
  }

  const openLogin = (mode: "login" | "register") =>
    router.push({ pathname: "/login", params: { mode } } as unknown as Href);

  return (
    <View style={[styles.screen, { backgroundColor: tokens.background }]}>
      {/* Scrolls only on short phones, where the photo, text and buttons don't all fit. */}
      <ScrollView bounces={false} showsVerticalScrollIndicator={false} contentContainerStyle={{ paddingBottom: Math.max(insets.bottom, 16) + 8 }}>
        <OnboardingCarousel />
        <View style={styles.actions}>
          <Button label="Create an account" variant="cta" onPress={() => openLogin("register")} />
          <Button label="Sign in" variant="line" onPress={() => openLogin("login")} />
        </View>
      </ScrollView>

      <View style={[styles.brand, { top: insets.top + 10 }]} accessibilityRole="header" accessibilityLabel="BNPL, Book Now, Pay Later">
        <Image source={require("../../assets/images/logo-circle.png")} style={styles.logo} accessible={false} />
        <AppText variant="headline" style={styles.brandText}>
          BNPL
        </AppText>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
  },
  brand: {
    position: "absolute",
    left: 18,
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  logo: {
    width: 34,
    height: 34,
  },
  brandText: {
    color: "#FFFFFF",
  },
  actions: {
    paddingHorizontal: 18,
    paddingTop: 16,
    gap: 10,
  },
});
