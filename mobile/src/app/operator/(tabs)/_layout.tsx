
import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform } from "react-native";

export default function OperatorTabLayout() {
  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: "#07869B",
        tabBarInactiveTintColor: "#8A9AA3",
        tabBarHideOnKeyboard: true,

        tabBarStyle: {
          position: "absolute",
          left: 14,
          right: 14,
          bottom: Platform.OS === "ios" ? 18 : 12,
          height: 72,
          backgroundColor: "#FFFFFF",
          borderTopWidth: 0,
          borderRadius: 24,
          paddingTop: 9,
          paddingBottom: Platform.OS === "ios" ? 9 : 8,
          shadowColor: "#17313C",
          shadowOffset: {
            width: 0,
            height: 4,
          },
          shadowOpacity: 0.12,
          shadowRadius: 14,
          elevation: 12,
        },

        tabBarLabelStyle: {
          fontSize: 11,
          fontWeight: "800",
        },
      }}
    >
      <Tabs.Screen
        name="dashboard"
        options={{
          title: "Dashboard",
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "grid" : "grid-outline"}
              size={22}
              color={focused ? "#07869B" : "#8A9AA3"}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",
          tabBarIcon: ({ focused }) => (
            <Ionicons
              name={focused ? "calendar" : "calendar-outline"}
              size={22}
              color={focused ? "#07869B" : "#8A9AA3"}
            />
          ),
        }}
      />
      
<Tabs.Screen
  name="payments"
  options={{
    title: "Payments",
    tabBarIcon: ({ focused }) => (
      <Ionicons
        name={
          focused
            ? "wallet"
            : "wallet-outline"
        }
        size={22}
        color={
          focused
            ? "#07869B"
            : "#8A9AA3"
        }
      />
    ),
  }}
/>

    </Tabs>
  );
}
