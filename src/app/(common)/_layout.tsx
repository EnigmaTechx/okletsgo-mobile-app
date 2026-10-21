import { Stack } from "expo-router";
import { useTheme } from "../../contexts/ThemeContext";
import { fontFamily } from "../../theme/tokens";

/**
 * Screens shared by riders and drivers that open over the tab shells:
 * profile editing, Terms of Use and Help & Support. Native headers with a
 * back button; the root layout only lets a signed-in user with a profile in.
 */
export default function CommonLayout() {
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
      <Stack.Screen name="profile" options={{ title: "Edit profile" }} />
      <Stack.Screen name="terms" options={{ title: "Terms of Use" }} />
      <Stack.Screen name="support" options={{ title: "Help & Support" }} />
      <Stack.Screen name="history/[id]" options={{ title: "Trip details" }} />
    </Stack>
  );
}
