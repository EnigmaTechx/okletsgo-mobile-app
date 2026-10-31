import React from "react";
import { Redirect, Stack } from "expo-router";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { canAccessAdminSection } from "../../config/appRoles";
import { fontFamily } from "../../theme/tokens";

/**
 * The in-app Admin section (product owner): read-only views of riders,
 * drivers, rides and weekly pay, on the same data the admin dashboard uses.
 * The root layout keeps this group out of the navigator for anyone without
 * an app role; this is the belt-and-braces check for a role revoked while
 * the section is open (the role comes from the live profile listener).
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
        headerTintColor: colors.primary,
        headerTitleStyle: {
          fontFamily: fontFamily.extrabold,
          fontSize: 18,
          color: colors.text,
        },
        headerShadowVisible: false,
        headerBackButtonDisplayMode: "minimal",
        contentStyle: { backgroundColor: colors.background },
      }}
    >
      <Stack.Screen name="index" options={{ title: "Admin" }} />
      <Stack.Screen name="clients/index" options={{ title: "Clients" }} />
      <Stack.Screen name="clients/[id]" options={{ title: "Client" }} />
      <Stack.Screen name="drivers/index" options={{ title: "Drivers" }} />
      <Stack.Screen name="drivers/[id]/index" options={{ title: "Driver" }} />
      <Stack.Screen
        name="drivers/[id]/rides"
        options={{ title: "Ride history" }}
      />
      <Stack.Screen
        name="drivers/[id]/weeks/[week]"
        options={{ title: "Weekly pay" }}
      />
      <Stack.Screen name="rides/index" options={{ title: "Rides summary" }} />
      <Stack.Screen name="rides/all" options={{ title: "All rides" }} />
      <Stack.Screen name="ride/[id]" options={{ title: "Ride" }} />
    </Stack>
  );
}
