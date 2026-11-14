import { Geist_300Light } from "@expo-google-fonts/geist/300Light";
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { Geist_700Bold } from "@expo-google-fonts/geist/700Bold";
import { GeistMono_400Regular } from "@expo-google-fonts/geist-mono/400Regular";
import { GeistMono_500Medium } from "@expo-google-fonts/geist-mono/500Medium";
import { useFonts } from "expo-font";
import {
  DarkTheme,
  DefaultTheme,
  ThemeProvider as NavThemeProvider,
  Stack,
} from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect, useMemo, type ComponentProps } from "react";
import { StyleSheet, View } from "react-native";

import { AmbientBackground } from "@/components/ui/AmbientBackground";
import { ToastProvider } from "@/components/ui/Toast";
import { useTheme } from "@/hooks/use-theme";
import { ThemeProvider } from "@/providers/theme-provider";
import { logger } from "@/utils/logger";

type NavTheme = ComponentProps<typeof NavThemeProvider>["value"];

// Keep the splash screen up until the fonts are ready, so no text renders
// in the fallback font first.
SplashScreen.preventAutoHideAsync().catch(() => {});

export default function RootLayout() {
  // Only the weights the type scale uses (constants/theme.ts FontFamily).
  const [fontsLoaded, fontError] = useFonts({
    Geist_300Light,
    Geist_400Regular,
    Geist_500Medium,
    Geist_600SemiBold,
    Geist_700Bold,
    GeistMono_400Regular,
    GeistMono_500Medium,
  });

  const ready = fontsLoaded || fontError !== null;

  useEffect(() => {
    if (fontError) logger.warn("[fonts] could not load Geist", fontError);
    // The fonts are bundled, so this is near-instant. If they fail, the app
    // still opens with the system font rather than staying on the splash.
    if (ready) SplashScreen.hideAsync().catch(() => {});
  }, [ready, fontError]);

  if (!ready) return null;

  return (
    <ThemeProvider>
      <ToastProvider>
        <AppShell />
      </ToastProvider>
    </ThemeProvider>
  );
}

/**
 * The ambient background is drawn once, behind every screen. Navigation
 * screens are transparent so it shows through; screens not yet redesigned
 * still paint their own solid background over it.
 */
function AppShell() {
  const { scheme, tokens } = useTheme();

  const navTheme = useMemo<NavTheme>(() => {
    const base = scheme === "dark" ? DarkTheme : DefaultTheme;
    return {
      ...base,
      colors: {
        ...base.colors,
        primary: tokens.brand,
        background: "transparent",
        card: tokens.background,
        text: tokens.ink,
        border: tokens.line,
        notification: tokens.cta,
      },
    };
  }, [scheme, tokens]);

  return (
    <View style={[styles.root, { backgroundColor: tokens.background }]}>
      <AmbientBackground />
      <NavThemeProvider value={navTheme}>
        {/* Default for screens that don't set their own. */}
        <StatusBar style={tokens.statusBar} />

        {/* Native push and pop transitions (the forced fade is gone). */}
        <Stack
          screenOptions={{
            headerShown: false,
            contentStyle: { backgroundColor: "transparent" },
          }}
        />
      </NavThemeProvider>
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
  },
});
