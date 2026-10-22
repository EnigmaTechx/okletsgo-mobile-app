import { useEffect, useState } from "react";
import { Pressable, ScrollView, StyleSheet, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  ActiveTripCard,
  DriverTripGroups,
  NextPickupStrip,
} from "../../components/drive/DriverTripCards";
import { AppText } from "../../components/ui/AppText";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { Logo } from "../../components/ui/Logo";
import { Screen } from "../../components/ui/Screen";
import { showAlert } from "../../components/ui/alerts";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";
import { useTheme } from "../../contexts/ThemeContext";
import { ensureForegroundLocation } from "../../hooks/useGeolocation";
import type { RideRequest } from "../../interfaces/ride";
import {
  setDriverOnline,
  subscribeDriverOpenRides,
} from "../../services/driverService";
import { LIVE_STATUSES } from "../../services/rideService";
import { formatDriverRating } from "../../utils/rating";
import { radius, spacing } from "../../theme/tokens";

const fmtKm = (km: number) =>
  km >= 10 ? String(Math.round(km)) : km.toFixed(1);

/**
 * The driver's home: online toggle, the numbers that matter, the trip in
 * progress, the next pickup, upcoming trips and new requests. Pending
 * drivers see the review notice instead.
 */
export default function DriverHome() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { userProfile, currentUser } = useAuth();
  const { isVisible } = useFeatureFlags();
  const uid = currentUser?.uid;
  const [rides, setRides] = useState<RideRequest[] | null>(null);
  const [toggling, setToggling] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribeDriverOpenRides(uid, setRides, () => setRides([]));
  }, [uid]);

  if (!userProfile || rides === null) return <LoadingScreen />;

  const online = !!userProfile.isOnline;
  const pendingApproval = userProfile.isApproved !== true;
  const active = rides.filter((r) => LIVE_STATUSES.includes(r.status));
  const upcoming = rides.filter((r) => r.status === "accepted");
  const requests = rides.filter((r) => r.status === "pending");
  const showEarnings = isVisible("driver_earnings");
  const openRide = (id: string) =>
    router.push({ pathname: "/(drive)/ride/[id]", params: { id } });

  const toggle = async (next: boolean) => {
    if (!uid || toggling) return;
    setToggling(true);
    try {
      if (next && !(await ensureForegroundLocation())) {
        showAlert(
          "Location needed",
          "Riders see how far you are from their pickup. Allow location access in Settings to go online.",
        );
        return;
      }
      await setDriverOnline(uid, next);
    } catch (err) {
      console.error("Online toggle failed:", err);
      toast("Couldn't update your status. Try again.", { type: "error" });
    } finally {
      setToggling(false);
    }
  };

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <AppText variant="eyebrow" color="primary">
              DRIVER
            </AppText>
            <AppText variant="title">Hi {userProfile.firstName}</AppText>
          </View>
          <Logo width={100} />
        </View>

        {pendingApproval ? (
          <View
            style={[
              styles.card,
              { backgroundColor: colors.surface, borderColor: colors.accent },
            ]}
          >
            <Ionicons
              name="shield-checkmark-outline"
              size={36}
              color={colors.accent}
            />
            <AppText variant="heading">Account under review</AppText>
            <AppText variant="body" color="textSecondary">
              Your application has been received. For the safety of our riders,
              our team is conducting a background check. You will be notified
              once your account is approved to hit the road.
            </AppText>
          </View>
        ) : (
          <>
            <Pressable
              accessibilityRole="switch"
              accessibilityState={{ checked: online, busy: toggling }}
              onPress={() => void toggle(!online)}
              style={[
                styles.card,
                styles.statusCard,
                {
                  backgroundColor: colors.surface,
                  borderColor: online ? colors.success : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.statusDot,
                  {
                    backgroundColor: online ? colors.success : colors.textMuted,
                  },
                ]}
              />
              <View style={styles.flex}>
                <AppText variant="heading" color={online ? "success" : "text"}>
                  {online ? "You're online" : "You're offline"}
                </AppText>
                <AppText variant="small" color="textSecondary">
                  {online ? "Receiving new requests" : "Tap to go online"}
                </AppText>
              </View>
              <Switch
                value={online}
                disabled={toggling}
                onValueChange={(v) => void toggle(v)}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor={colors.background}
              />
            </Pressable>
            <AppText variant="small" color="textMuted" style={styles.note}>
              Location is shared with the rider only while a trip is active,
              after you accept the disclosure.
            </AppText>

            <View style={styles.stats}>
              <Stat
                value={formatDriverRating(userProfile.rating)}
                label={`RATING${userProfile.ratingCount ? ` · ${userProfile.ratingCount}` : ""}`}
              />
              <Stat
                value={
                  String(userProfile.ratingCount ?? 0) === "0" &&
                  !userProfile.totalKmTravelled
                    ? "—"
                    : fmtKm(userProfile.totalKmTravelled ?? 0)
                }
                label="KM"
              />
              {showEarnings ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => router.navigate("/(driver)/earnings")}
                  style={[
                    styles.stat,
                    {
                      backgroundColor: colors.surface,
                      borderColor: colors.success,
                    },
                  ]}
                >
                  <AppText variant="heading" color="success" numberOfLines={1}>
                    ${(userProfile.earnings || 0).toFixed(2)}
                  </AppText>
                  <AppText variant="eyebrow" color="textMuted">
                    EARNED
                  </AppText>
                </Pressable>
              ) : null}
            </View>

            {active.map((r) => (
              <View key={r.id} style={styles.block}>
                <ActiveTripCard ride={r} onOpen={openRide} />
              </View>
            ))}
            {active.length === 0 && upcoming.length > 0 ? (
              <View style={styles.block}>
                <NextPickupStrip ride={upcoming[0]} onOpen={openRide} />
              </View>
            ) : null}
            <DriverTripGroups
              theme="upcoming"
              title="Upcoming trips"
              rides={upcoming}
              onOpen={openRide}
            />
            {online ? (
              <DriverTripGroups
                theme="requests"
                title="New requests"
                rides={requests}
                onOpen={openRide}
              />
            ) : null}

            {online &&
            requests.length === 0 &&
            upcoming.length === 0 &&
            active.length === 0 ? (
              <Empty text="You're online. New requests pop up here and as a push notification." />
            ) : null}
            {!online && upcoming.length === 0 && active.length === 0 ? (
              <Empty text="Go online to receive new requests." />
            ) : null}
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Stat({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.stat,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <AppText variant="heading" numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="eyebrow" color="textMuted" numberOfLines={1}>
        {label}
      </AppText>
    </View>
  );
}

function Empty({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View style={styles.empty}>
      <Ionicons name="car-sport-outline" size={44} color={colors.textMuted} />
      <AppText variant="body" color="textMuted" align="center">
        {text}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingHorizontal: spacing.screen, paddingBottom: spacing.xl },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.lg,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  statusCard: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 1.5,
  },
  statusDot: { width: 12, height: 12, borderRadius: 6 },
  flex: { flex: 1, gap: 2 },
  note: { marginTop: spacing.sm, paddingHorizontal: spacing.xs },
  stats: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  stat: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
  block: { marginTop: spacing.lg },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: 48 },
});
