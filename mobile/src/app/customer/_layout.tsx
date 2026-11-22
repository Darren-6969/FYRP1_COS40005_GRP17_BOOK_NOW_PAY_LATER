import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useRoleGuard } from "@/hooks/use-role-guard";
import { useTheme } from "@/hooks/use-theme";

export default function CustomerLayout() {
  // F4: only signed-in customers get past here, deep links included.
  const allowed = useRoleGuard("CUSTOMER");
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
      }}
    >
      <Stack.Screen name="(tabs)" />

      <Stack.Screen
        name="car-details"
        options={{
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="booking-request"
        options={{
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="review-booking"
        options={{
            animation: "slide_from_right",
        }}
        />

      <Stack.Screen
        name="booking/[id]"
        options={{
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="notifications"
        options={{
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="checkout"
        options={{
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="payment-success"
        options={{
            animation: "fade",
        }}
        />

      <Stack.Screen
        name="invoice/[id]"
        options={{
            animation:
            "slide_from_right",
        }}
        />

      <Stack.Screen
        name="upload-receipt"
        options={{
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="support-chat"
        options={{
            animation:
            "slide_from_right",
        }}
        />

      <Stack.Screen
        name="terms"
        options={{
            animation:
            "slide_from_right",
        }}
        />

      <Stack.Screen
        name="privacy"
        options={{
            animation:
            "slide_from_right",
        }}
        />

      <Stack.Screen
        name="cars"
        options={{
            animation:
            "slide_from_right",
        }}
        />

      <Stack.Screen
        name="licence"
        options={{
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="permit"
        options={{
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="account/edit-profile"
        options={{
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="account/change-password"
        options={{
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="account/notification-settings"
        options={{
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="account/delete-account"
        options={{
          animation: "slide_from_right",
        }}
      />

      <Stack.Screen
        name="saved-cars"
        options={{
            animation: "slide_from_right",
        }}
        />
    </Stack>
  );
}