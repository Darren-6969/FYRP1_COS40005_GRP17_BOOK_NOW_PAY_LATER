
import { Stack, useRouter } from "expo-router";
import { useEffect, useState } from "react";

import {
  ActivityIndicator,
  View,
} from "react-native";

import { getMe } from "../../services/authApi";
import {
  clearSession,
  getToken,
} from "../../services/session";

export default function OperatorLayout() {
  const router = useRouter();
  const [authorized, setAuthorized] = useState(false);
  const [checking, setChecking] = useState(true);

  useEffect(() => {
    let active = true;

    const checkAccess = async () => {
      try {
        const token = await getToken();

        if (!token) {
          if (active) {
            router.replace("/login");
          }
          return;
        }

        const response = await getMe();
        const user = response?.user || response;

        if (user?.role !== "NORMAL_SELLER") {
          if (active) {
            router.replace("/login");
          }
          return;
        }

        if (active) {
          setAuthorized(true);
        }
      } catch (error) {
        console.log(
          "Operator authorization failed:",
          error
        );

        await clearSession();

        if (active) {
          router.replace("/login");
        }
      } finally {
        if (active) {
          setChecking(false);
        }
      }
    };

    checkAccess();

    return () => {
      active = false;
    };
  }, [router]);

  if (checking || !authorized) {
    return (
      <View
        style={{
          flex: 1,
          justifyContent: "center",
          alignItems: "center",
          backgroundColor: "#F7FAFB",
        }}
      >
        <ActivityIndicator
          size="large"
          color="#07869B"
        />
      </View>
    );
  }

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
    </Stack>
  );

    return (
    <Stack
      screenOptions={{
        headerShown: false,
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="(tabs)" />
      <Stack.Screen name="booking/[id]" />
      <Stack.Screen name="notifications" />
      <Stack.Screen name="listing/form" />
      <Stack.Screen name="listing/manage" />
      <Stack.Screen name="branches" />
      <Stack.Screen name="branch/points" />
      <Stack.Screen name="licence-checks" />
    </Stack>
  );
}

