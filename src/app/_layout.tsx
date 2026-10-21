import React, { useEffect } from "react";
import { StatusBar } from "expo-status-bar";
import * as SplashScreen from "expo-splash-screen";
import { KeyboardProvider } from "react-native-keyboard-controller";
import {
  DarkTheme,
  DefaultTheme,
  Stack,
  ThemeProvider as NavigationThemeProvider,
} from "expo-router";
import {
  Manrope_500Medium,
  Manrope_600SemiBold,
  Manrope_700Bold,
  Manrope_800ExtraBold,
  useFonts,
} from "@expo-google-fonts/manrope";
import { AuthProvider, useAuth } from "../contexts/AuthContext";
import { FeatureFlagsProvider } from "../contexts/FeatureFlagsContext";
import { ThemeProvider, useTheme } from "../contexts/ThemeContext";
import { initPricingConfig } from "../services/pricingService";
import { useUpdateGate } from "../services/appUpdateService";
import { canAccessAdminSection } from "../config/appRoles";
import { UpdateRequired } from "../components/UpdateRequired";
import { LoadingScreen } from "../components/ui/LoadingScreen";
import { ToastProvider } from "../components/ui/Toast";

// Keep the native splash up until fonts, the stored theme and auth have
// resolved, so the first frame is already the right screen in the right colours.
SplashScreen.preventAutoHideAsync().catch(() => undefined);

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    Manrope_500Medium,
    Manrope_600SemiBold,
    Manrope_700Bold,
    Manrope_800ExtraBold,
  });

  // Admin-managed trip pricing (config/pricing), kept in sync for the life of
  // the app; falls back to defaults if unavailable.
  useEffect(() => initPricingConfig(), []);

  return (
    <KeyboardProvider>
      <ThemeProvider>
        <ToastProvider>
          <AuthProvider>
            <FeatureFlagsProvider>
              <RootNavigator fontsLoaded={fontsLoaded} />
            </FeatureFlagsProvider>
          </AuthProvider>
        </ToastProvider>
      </ThemeProvider>
    </KeyboardProvider>
  );
}

function RootNavigator({ fontsLoaded }: { fontsLoaded: boolean }) {
  const { scheme, colors, ready: themeReady } = useTheme();
  const { currentUser, userProfile, loading } = useAuth();
  const updateGate = useUpdateGate();

  const booted = fontsLoaded && themeReady && !loading;

  useEffect(() => {
    if (booted) SplashScreen.hideAsync().catch(() => undefined);
  }, [booted]);

  const navTheme = {
    ...(scheme === "dark" ? DarkTheme : DefaultTheme),
    colors: {
      ...(scheme === "dark" ? DarkTheme : DefaultTheme).colors,
      primary: colors.primary,
      background: colors.background,
      card: colors.surface,
      text: colors.text,
      border: colors.border,
      notification: colors.primary,
    },
  };

  // Unsupported build: full stop, store button only. Takes priority over the
  // auth loader so a rider on an ancient version sees this immediately.
  if (updateGate.updateRequired) {
    return (
      <NavigationThemeProvider value={navTheme}>
        <StatusBar style={scheme === "dark" ? "light" : "dark"} />
        <UpdateRequired
          storeUrl={updateGate.storeUrl}
          message={updateGate.message}
          currentBuild={updateGate.currentBuild}
        />
      </NavigationThemeProvider>
    );
  }

  if (!booted) {
    return (
      <NavigationThemeProvider value={navTheme}>
        <LoadingScreen />
      </NavigationThemeProvider>
    );
  }

  // Which route groups this session may enter. A signed-in user with no
  // profile belongs in registration (inside the auth group) and nowhere else.
  const signedOut = !currentUser;
  const registering = !!currentUser && !userProfile;
  const isClient = !!currentUser && userProfile?.role === "client";
  const isDriver = !!currentUser && userProfile?.role === "driver";
  const isAdmin =
    !!currentUser && !!userProfile && canAccessAdminSection(userProfile);

  return (
    <NavigationThemeProvider value={navTheme}>
      <StatusBar style={scheme === "dark" ? "light" : "dark"} />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.background },
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Protected guard={signedOut || registering}>
          <Stack.Screen name="(auth)" />
        </Stack.Protected>
        <Stack.Protected guard={isClient}>
          <Stack.Screen name="(client)" />
          <Stack.Screen name="(ride)" />
        </Stack.Protected>
        <Stack.Protected guard={isDriver}>
          <Stack.Screen name="(driver)" />
        </Stack.Protected>
        <Stack.Protected guard={isClient || isDriver}>
          <Stack.Screen name="(common)" />
        </Stack.Protected>
        <Stack.Protected guard={isAdmin}>
          <Stack.Screen name="admin" />
        </Stack.Protected>
      </Stack>
    </NavigationThemeProvider>
  );
}
