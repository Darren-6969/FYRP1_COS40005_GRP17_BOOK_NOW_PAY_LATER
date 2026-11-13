import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useRoleGuard } from "@/hooks/use-role-guard";

export default function OperatorLayout() {
  // Same guard as the customer section. Unlike the old check, losing the
  // connection no longer clears the session and logs the operator out.
  const allowed = useRoleGuard("NORMAL_SELLER");

  if (!allowed) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F7FAFB",
        }}
      >
        <ActivityIndicator size="large" color="#07869B" />
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
