import React from "react";
import { Stack } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";

export default function AuthLayout() {
  const { colors } = useTheme();
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.background },
        animation: "slide_from_right",
      }}
    >
      <Stack.Screen name="onboarding" options={{ animation: "fade" }} />
      <Stack.Screen name="welcome" options={{ animation: "fade" }} />
      <Stack.Screen name="login" />
      <Stack.Screen name="otp" options={{ gestureEnabled: false }} />
      <Stack.Screen name="role-select" options={{ gestureEnabled: false }} />
      <Stack.Screen name="complete-profile" />
      <Stack.Screen name="driver-vehicle-info" />
    </Stack>
  );
}
