import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useBooking } from "../../../components/booking/BookingContext";
import { AppText } from "../../../components/ui/AppText";
import { Avatar } from "../../../components/ui/Avatar";
import { Screen } from "../../../components/ui/Screen";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import type { UserProfile } from "../../../interfaces/user";
import { listBookableDrivers } from "../../../services/rideService";
import { formatDriverRating } from "../../../utils/rating";
import { radius, spacing } from "../../../theme/tokens";

const STAR_GOLD = "#F5B301";

/**
 * Step 3 of 4: pick a driver who is online right now. Sandbox drivers only
 * show to sandbox riders. Who is "busy" is not pre-judged; the driver sees
 * the request and decides.
 */
export default function BookDriver() {
  const router = useRouter();
  const { colors } = useTheme();
  const { userProfile } = useAuth();
  const { draft, update } = useBooking();
  const [drivers, setDrivers] = useState<UserProfile[] | null>(null);

  useEffect(() => {
    if (!draft.scheduledForIso) {
      router.replace("/(ride)/book/locations");
      return;
    }
    let active = true;
    listBookableDrivers(userProfile?.isTestAccount === true)
      .then((list) => active && setDrivers(list))
      .catch((err) => {
        console.error("Error fetching drivers:", err);
        if (active) setDrivers([]);
      });
    return () => {
      active = false;
    };
  }, [draft.scheduledForIso, userProfile?.isTestAccount, router]);

  const select = (driver: UserProfile) => {
    update({ driver });
    router.push("/(ride)/book/confirm");
  };

  return (
    <Screen scroll edges={["left", "right"]}>
      {drivers === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : drivers.length === 0 ? (
        <View style={styles.center}>
          <Ionicons
            name="car-sport-outline"
            size={64}
            color={colors.textMuted}
          />
          <AppText variant="heading" align="center">
            No drivers available
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            No driver is online right now. Try again in a little while or adjust
            your schedule.
          </AppText>
        </View>
      ) : (
        <View style={styles.list}>
          {drivers.map((d) => (
            <Pressable
              key={d.uid}
              accessibilityRole="button"
              onPress={() => select(d)}
              style={({ pressed }) => [
                styles.row,
                {
                  backgroundColor: pressed
                    ? colors.surfaceRaised
                    : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Avatar
                firstName={d.firstName}
                lastName={d.lastName}
                size={52}
                tint={colors.primary}
              />
              <View style={styles.text}>
                <View style={styles.nameRow}>
                  <AppText variant="heading">{d.firstName}</AppText>
                  <Ionicons name="star" size={14} color={STAR_GOLD} />
                  <AppText variant="smallStrong" color="textSecondary">
                    {formatDriverRating(d.rating)}
                  </AppText>
                </View>
                <AppText variant="small" color="primary">
                  {d.vehicle?.make} {d.vehicle?.model}
                  {d.vehicle?.color ? ` (${d.vehicle.color})` : ""}
                </AppText>
              </View>
              <Ionicons
                name="chevron-forward"
                size={20}
                color={colors.textMuted}
              />
            </Pressable>
          ))}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    alignItems: "center",
    gap: spacing.md,
    paddingTop: 80,
    paddingHorizontal: spacing.lg,
  },
  list: { gap: spacing.md, paddingTop: spacing.md },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    paddingRight: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  text: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 6 },
});
