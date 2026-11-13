import { Stack } from "expo-router";
import { ActivityIndicator, View } from "react-native";

import { useRoleGuard } from "@/hooks/use-role-guard";

export default function CustomerLayout() {
  // F4: only signed-in customers get past here, deep links included.
  const allowed = useRoleGuard("CUSTOMER");

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
        name="saved-cars"
        options={{
            animation: "slide_from_right",
        }}
        />
    </Stack>
  );
}