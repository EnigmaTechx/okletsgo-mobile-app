import { Stack } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { fontFamily } from "../../theme/tokens";

/** Driver-only screens over the tabs: the ride page and vehicle changes. */
export default function DriveLayout() {
  const { colors } = useTheme();
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
      <Stack.Screen name="ride/[id]" options={{ headerShown: false }} />
      <Stack.Screen name="vehicle" options={{ title: "Vehicle" }} />
    </Stack>
  );
}
