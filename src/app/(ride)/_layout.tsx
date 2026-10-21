import { Stack } from "expo-router";
import { BookingProvider } from "../../components/booking/BookingContext";
import { useTheme } from "../../contexts/ThemeContext";
import { fontFamily } from "../../theme/tokens";

/**
 * Rider-only flows that open over the tabs: the booking wizard, the live
 * ride map, saved addresses. The root layout admits only signed-in clients.
 */
export default function RideLayout() {
  const { colors } = useTheme();
  return (
    <BookingProvider>
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
        <Stack.Screen
          name="book/locations"
          options={{ title: "Trip details" }}
        />
        <Stack.Screen
          name="book/schedule"
          options={{ title: "Schedule ride" }}
        />
        <Stack.Screen
          name="book/driver"
          options={{ title: "Select a driver" }}
        />
        <Stack.Screen name="book/confirm" options={{ title: "Confirm trip" }} />
        <Stack.Screen
          name="book/success"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen name="live/[id]" options={{ headerShown: false }} />
        <Stack.Screen
          name="complete/[id]"
          options={{ headerShown: false, gestureEnabled: false }}
        />
        <Stack.Screen
          name="places/index"
          options={{ title: "Saved addresses" }}
        />
        <Stack.Screen
          name="places/edit"
          options={{ title: "Add an address" }}
        />
      </Stack>
    </BookingProvider>
  );
}
