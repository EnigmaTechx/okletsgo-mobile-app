import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { RouteTimeline } from "../../../components/rides/RouteTimeline";
import { AppText } from "../../../components/ui/AppText";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { Screen } from "../../../components/ui/Screen";
import { useTheme } from "../../../contexts/ThemeContext";
import { cad } from "../../../utils/money";
import { radius, spacing } from "../../../theme/tokens";

type Params = {
  rideId: string;
  driverFirstName?: string;
  driverPhotoUrl?: string;
  pickupAddress?: string;
  destinationAddress?: string;
  totalDue?: string;
  dateStr?: string;
  timeStr?: string;
};

/**
 * "You're all set!": shown once right after booking from the data handed
 * over by the confirmation step. Home sits directly behind it.
 */
export default function BookingSuccess() {
  const router = useRouter();
  const { colors } = useTheme();
  const p = useLocalSearchParams<Params>();

  if (!p.rideId) {
    router.replace("/(client)");
    return null;
  }

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <View style={[styles.check, { backgroundColor: colors.success }]}>
          <Ionicons name="checkmark" size={40} color={colors.onSuccess} />
        </View>
        <AppText variant="display" align="center">
          You&apos;re all set!
        </AppText>
        <AppText variant="body" color="textSecondary" align="center">
          Your ride is booked for
        </AppText>
        <AppText variant="heading" align="center">
          {p.dateStr} · {p.timeStr}
        </AppText>
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={styles.driverRow}>
          <Avatar
            firstName={p.driverFirstName}
            photoUrl={p.driverPhotoUrl || undefined}
            size={52}
            tint={colors.primary}
          />
          <View style={styles.flex}>
            <AppText variant="heading">{p.driverFirstName}</AppText>
            <AppText variant="small" color="textMuted">
              Your driver
            </AppText>
          </View>
          <AppText variant="title" color="primary">
            {cad(Number(p.totalDue))}
          </AppText>
        </View>
        <View style={[styles.route, { borderTopColor: colors.border }]}>
          <RouteTimeline
            pickup={p.pickupAddress}
            dropoff={p.destinationAddress}
            compact
          />
        </View>
      </View>

      <View style={styles.reminder}>
        <Ionicons
          name="notifications-outline"
          size={18}
          color={colors.textMuted}
        />
        <AppText variant="small" color="textMuted">
          We&apos;ll remind you 30 minutes before pickup.
        </AppText>
      </View>
      <AppText variant="small" color="textMuted" align="center">
        🍁 Thanks for riding local
      </AppText>

      <View style={styles.actions}>
        <Button
          title="View ride"
          onPress={() =>
            router.replace({
              pathname: "/(ride)/live/[id]",
              params: { id: p.rideId },
            })
          }
        />
        <Button
          title="Back to home"
          variant="ghost"
          onPress={() => router.navigate("/(client)")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.xxl * 2,
    paddingBottom: spacing.xl,
  },
  check: {
    width: 76,
    height: 76,
    borderRadius: 38,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.md,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  driverRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1 },
  route: { paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  reminder: {
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
    gap: 6,
    marginTop: spacing.xl,
  },
  actions: { marginTop: spacing.xxl, gap: spacing.sm },
});
