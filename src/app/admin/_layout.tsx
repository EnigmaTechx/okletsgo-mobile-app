import React from "react";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { canAccessAdminSection } from "../../config/appRoles";

/**
 * The in-app Admin section (product owner). The root layout already keeps
 * this group out of the navigator for anyone without an app role; this is the
 * belt-and-braces check for a revoked role while the section is open.
 */
export default function AdminLayout() {
  const { userProfile } = useAuth();
  const { colors } = useTheme();
  if (!canAccessAdminSection(userProfile)) return <Redirect href="/" />;
  return (
    <Stack
      screenOptions={{
        headerShown: true,
        headerStyle: { backgroundColor: colors.background },
        headerTintColor: colors.text,
        headerShadowVisible: false,
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Admin" }} />
    </Stack>
  );
}
