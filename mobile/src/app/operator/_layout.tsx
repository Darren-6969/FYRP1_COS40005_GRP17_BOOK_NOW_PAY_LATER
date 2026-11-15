import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useRoleGuard } from "@/hooks/use-role-guard";
import { useTheme } from "@/hooks/use-theme";

export default function OperatorLayout() {
  // Same guard as the customer section. Unlike the old check, losing the
  // connection no longer clears the session and logs the operator out.
  const allowed = useRoleGuard("NORMAL_SELLER");
  const { tokens } = useTheme();

  if (!allowed) {
    // Transparent, so the ambient background shows in light and dark.
    return (
      <View style={{ flex: 1, justifyContent: "center", alignItems: "center" }}>
        <ActivityIndicator size="large" color={tokens.brand} />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    />
  );
}
