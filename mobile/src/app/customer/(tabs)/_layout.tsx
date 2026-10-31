import { Ionicons } from "@expo/vector-icons";
import { Tabs } from "expo-router";
import { Platform, StyleSheet } from "react-native";

export default function CustomerTabLayout() {
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
          paddingBottom:
            Platform.OS === "ios" ? 9 : 8,

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
          fontSize: 10,
          fontWeight: "800",
          marginTop: 2,
        },

        tabBarItemStyle: {
          paddingVertical: 2,
        },
      }}
    >
      <Tabs.Screen
        name="home"
        options={{
          title: "Home",

          tabBarIcon: ({
            color,
            focused,
          }) => (
            <Ionicons
              name={
                focused
                  ? "home"
                  : "home-outline"
              }
              size={22}
              colour={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="bookings"
        options={{
          title: "Bookings",

          tabBarIcon: ({
            color,
            focused,
          }) => (
            <Ionicons
              name={
                focused
                  ? "calendar"
                  : "calendar-outline"
              }
              size={22}
              colour={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="payments"
        options={{
          title: "Payments",

          tabBarIcon: ({
            color,
            focused,
          }) => (
            <Ionicons
              name={
                focused
                  ? "wallet"
                  : "wallet-outline"
              }
              size={22}
              colour={color}
            />
          ),
        }}
      />

      <Tabs.Screen
        name="profile"
        options={{
          title: "Profile",

          tabBarIcon: ({
            color,
            focused,
          }) => (
            <Ionicons
              name={
                focused
                  ? "person"
                  : "person-outline"
              }
              size={22}
              colour={color}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({});