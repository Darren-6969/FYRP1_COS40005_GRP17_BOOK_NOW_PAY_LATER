import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import type { ComponentProps } from "react";
import type { ColorValue } from "react-native";

import { FloatingTabBar } from "@/components/FloatingTabBar";

type IconName = ComponentProps<typeof Ionicons>["name"];

function tabIcon(active: IconName, inactive: IconName) {
  return ({ focused, color, size }: { focused: boolean; color: ColorValue; size: number }) => (
    <Ionicons name={focused ? active : inactive} size={size} color={color as string} />
  );
}

export default function OperatorTabLayout() {
  return (
    <Tabs
      tabBar={(props) => <FloatingTabBar {...props} />}
      screenOptions={{ headerShown: false }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{ title: "Dashboard", tabBarIcon: tabIcon("grid", "grid-outline") }}
      />
      <Tabs.Screen
        name="bookings"
        options={{ title: "Bookings", tabBarIcon: tabIcon("calendar", "calendar-outline") }}
      />
      <Tabs.Screen
        name="payments"
        options={{ title: "Payments", tabBarIcon: tabIcon("wallet", "wallet-outline") }}
      />
      <Tabs.Screen
        name="listings"
        options={{ title: "Listings", tabBarIcon: tabIcon("car-sport", "car-sport-outline") }}
      />
    </Tabs>
  );
}
