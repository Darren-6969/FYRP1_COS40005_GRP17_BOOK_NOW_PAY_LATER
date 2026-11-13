import { Geist_300Light } from "@expo-google-fonts/geist/300Light";
import { Geist_400Regular } from "@expo-google-fonts/geist/400Regular";
import { Geist_500Medium } from "@expo-google-fonts/geist/500Medium";
import { Geist_600SemiBold } from "@expo-google-fonts/geist/600SemiBold";
import { Geist_700Bold } from "@expo-google-fonts/geist/700Bold";
import { GeistMono_400Regular } from "@expo-google-fonts/geist-mono/400Regular";
import { GeistMono_500Medium } from "@expo-google-fonts/geist-mono/500Medium";
import { useFonts } from "expo-font";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";

import { ToastProvider } from "@/components/ui/Toast";
import { ThemeProvider } from "@/providers/theme-provider";
import { logger } from "@/utils/logger";

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
        {/* Status bar, ambient background and transitions arrive in phase 1. */}
        <StatusBar style="light" />

        <Stack
          screenOptions={{
            headerShown: false,
            animation: "fade",
          }}
        />
      </ToastProvider>
    </ThemeProvider>
  );
}
