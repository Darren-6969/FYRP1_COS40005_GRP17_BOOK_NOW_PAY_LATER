import { Redirect, useFocusEffect, useRouter, type Href } from "expo-router";
import { setStatusBarStyle } from "expo-status-bar";
import { useCallback, useEffect, useState } from "react";
import {
  ImageBackground,
  Pressable,
  SafeAreaView,
  StyleSheet,
  Text,
  View,
} from "react-native";

import { homeForRole } from "@/hooks/use-role-guard";
import { useTheme } from "@/hooks/use-theme";
import { getStoredUser, getToken } from "@/services/session";
import { logger } from "@/utils/logger";

// Same colour as the expo-splash-screen background in app.json, so the
// hand-over from the splash screen is invisible.
const SPLASH_BACKGROUND = "#208AEF";

type Launch =
  | { state: "checking" }
  | { state: "welcome" }
  | { state: "home"; href: Href };

export default function WelcomeScreen() {
  const router = useRouter();
  const { tokens } = useTheme();
  const [launch, setLaunch] = useState<Launch>({ state: "checking" });

  // White status bar icons over the dark photo, only while Welcome is on
  // screen; the theme's default comes back when another screen covers it.
  // (A <StatusBar> element here would stay in force while Welcome sits
  // underneath in the stack.) Welcome is restyled in phase 5.
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
        const [token, user] = await Promise.all([
          getToken(),
          getStoredUser(),
        ]);
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
    return (
      <View style={{ flex: 1, backgroundColor: SPLASH_BACKGROUND }} />
    );
  }

  if (launch.state === "home") {
    return <Redirect href={launch.href} />;
  }

  return (
    <ImageBackground
      source={{
        uri: "https://images.unsplash.com/photo-1503376780353-7e6692767b70?auto=format&fit=crop&w=1200&q=90",
      }}
      style={styles.background}
      resizeMode="cover"
    >
      <View style={styles.overlay} />

      <SafeAreaView style={styles.container}>
        {/* Logo */}
        <View style={styles.logoArea}>
          <View style={styles.logoIcon}>
            <Text style={styles.carIcon}>🚘</Text>
          </View>

          <Text style={styles.logoMain}>BNPL</Text>
          <Text style={styles.logoSub}>Car Rental</Text>
        </View>

        {/* Main Content */}
        <View style={styles.content}>
          <Text style={styles.title}>
            Book Now.{"\n"}
            <Text style={styles.highlight}>Pay Later.</Text>
          </Text>

          <Text style={styles.subtitle}>
            Flexible car rentals with simple and convenient BNPL payments.
          </Text>
        </View>

        {/* Bottom */}
        <View style={styles.bottomSection}>
          <View style={styles.dots}>
            <View style={[styles.dot, styles.activeDot]} />
            <View style={styles.dot} />
            <View style={styles.dot} />
          </View>

          <Pressable
            style={({ pressed }) => [
              styles.button,
              pressed && styles.buttonPressed,
            ]}
            onPress={() => router.push("/login")}
          >
            <Text style={styles.buttonText}>Get Started</Text>
            <Text style={styles.arrow}>→</Text>
          </Pressable>

          <Text style={styles.footerText}>
            Book smarter. Pay with flexibility.
          </Text>
        </View>
      </SafeAreaView>
    </ImageBackground>
  );
}

const styles = StyleSheet.create({
  background: {
    flex: 1,
    width: "100%",
    height: "100%",
  },

  overlay: {
  position: "absolute",
  top: 0,
  right: 0,
  bottom: 0,
  left: 0,
  backgroundColor: "rgba(2, 20, 34, 0.60)",
},

  container: {
    flex: 1,
    paddingHorizontal: 28,
    paddingVertical: 30,
    justifyContent: "space-between",
  },

  logoArea: {
    alignItems: "center",
    marginTop: 35,
  },

  logoIcon: {
    width: 62,
    height: 62,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.16)",
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.30)",
  },

  carIcon: {
    fontSize: 31,
  },

  logoMain: {
    fontSize: 38,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: 2,
  },

  logoSub: {
    fontSize: 22,
    fontWeight: "700",
    color: "#56D9E8",
    marginTop: -4,
  },

  content: {
    maxWidth: 460,
    alignSelf: "center",
    width: "100%",
  },

  title: {
    fontSize: 42,
    lineHeight: 48,
    fontWeight: "900",
    color: "#FFFFFF",
    marginBottom: 18,
  },

  highlight: {
    color: "#54DDE9",
  },

  subtitle: {
    color: "#E8F2F5",
    fontSize: 17,
    lineHeight: 27,
    maxWidth: 380,
  },

  bottomSection: {
    width: "100%",
    maxWidth: 460,
    alignSelf: "center",
    paddingBottom: 10,
  },

  dots: {
    flexDirection: "row",
    justifyContent: "center",
    gap: 7,
    marginBottom: 22,
  },

  dot: {
    width: 7,
    height: 7,
    borderRadius: 20,
    backgroundColor: "rgba(255,255,255,0.4)",
  },

  activeDot: {
    width: 24,
    backgroundColor: "#FFFFFF",
  },

  button: {
    minHeight: 58,
    borderRadius: 18,
    backgroundColor: "#07869B",
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    shadowColor: "#000",
    shadowOffset: {
      width: 0,
      height: 7,
    },
    shadowOpacity: 0.25,
    shadowRadius: 12,
    elevation: 8,
  },

  buttonPressed: {
    opacity: 0.85,
    transform: [{ scale: 0.99 }],
  },

  buttonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "800",
  },

  arrow: {
    color: "#FFFFFF",
    fontSize: 25,
    marginLeft: 10,
    marginTop: -2,
  },

  footerText: {
    color: "rgba(255,255,255,0.72)",
    textAlign: "center",
    fontSize: 12,
    marginTop: 14,
  },
});