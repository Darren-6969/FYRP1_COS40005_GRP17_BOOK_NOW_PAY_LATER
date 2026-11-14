import { Ionicons } from "@expo/vector-icons";
import { useRouter, type Href } from "expo-router";
import { StyleSheet, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText, Button, GlassCard } from "@/components/ui";
import { homeForRole } from "@/hooks/use-role-guard";
import { useTheme } from "@/hooks/use-theme";
import { getStoredUser, getToken } from "@/services/session";
import { logger } from "@/utils/logger";

/**
 * Shown for broken or old links instead of Expo's default page.
 * "Go home" sends a signed-in customer or operator to their own home,
 * and anyone else to Welcome.
 */
export default function NotFoundScreen() {
  const router = useRouter();
  const { tokens } = useTheme();

  const goHome = async () => {
    let target: Href = "/";
    try {
      const [token, user] = await Promise.all([getToken(), getStoredUser()]);
      target = (token ? homeForRole(user?.role) : null) ?? "/";
    } catch (err) {
      logger.warn("[not-found] could not read the saved session", err);
    }
    router.replace(target);
  };

  return (
    <SafeAreaView style={styles.safe}>
      <View style={styles.center}>
        <GlassCard padding={24} style={styles.card}>
          <View style={styles.content}>
            <View style={[styles.icon, { backgroundColor: tokens.infoBg }]}>
              <Ionicons name="compass-outline" size={30} color={tokens.infoFg} />
            </View>

            <AppText variant="title" align="center" accessibilityRole="header">
              Page not found
            </AppText>
            <AppText align="center">
              This link may be old or mistyped. Your bookings and payments are safe.
            </AppText>

            <Button label="Go home" icon="home-outline" onPress={goHome} style={styles.button} />
          </View>
        </GlassCard>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: {
    flex: 1,
  },
  center: {
    flex: 1,
    justifyContent: "center",
    paddingHorizontal: 20,
  },
  card: {
    alignSelf: "center",
    width: "100%",
    maxWidth: 420,
  },
  content: {
    alignItems: "center",
    gap: 12,
  },
  icon: {
    width: 64,
    height: 64,
    borderRadius: 32,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  button: {
    alignSelf: "stretch",
    marginTop: 8,
  },
});
