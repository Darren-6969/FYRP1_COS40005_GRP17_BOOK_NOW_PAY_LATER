import { Stack } from "expo-router";

export default function CustomerLayout() {
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
        name="upload-receipt"
        options={{
          animation: "slide_from_right",
        }}
      />
    </Stack>
  );
}