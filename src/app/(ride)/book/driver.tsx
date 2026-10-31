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
import { dispatcherFor, fetchDispatchConfig } from "../../../services/dispatch";
import {
  getPublicProfile,
  isBookableDriver,
  listPublicDrivers,
  type PublicProfile,
} from "../../../services/publicProfiles";
import { formatDriverRating } from "../../../utils/rating";
import { radius, spacing } from "../../../theme/tokens";

const STAR_GOLD = "#F5B301";

interface Listing {
  drivers: PublicProfile[];
  /** Dispatch is on: the one driver listed is the dispatcher. */
  viaDispatch: boolean;
}

/**
 * Who a rider may book right now. Dispatch on: only the dispatcher (Andy),
 * who confirms every ride and may assign it on; other drivers are hidden.
 * Otherwise every online driver. Sandbox riders only see sandbox drivers.
 * Who is "busy" is not pre-judged; the driver sees the request and decides.
 */
async function loadListing(isTest: boolean): Promise<Listing> {
  const cfg = await fetchDispatchConfig();
  const dispatcherId = dispatcherFor(cfg, isTest);
  if (dispatcherId) {
    const dispatcher = await getPublicProfile(dispatcherId);
    if (dispatcher && dispatcher.vehicle) {
      const listed =
        cfg.showWhenOffline !== false || dispatcher.isOnline === true;
      return {
        drivers: listed ? [{ ...dispatcher, uid: dispatcherId }] : [],
        viaDispatch: true,
      };
    }
    // Dispatcher missing or incomplete: fall back to the normal list.
  }
  const online = await listPublicDrivers({ onlineOnly: true });
  return {
    drivers: online.filter(
      (d) => isBookableDriver(d) && (d.isTestAccount === true) === isTest,
    ),
    viaDispatch: false,
  };
}

/** Step 3 of 4: pick a driver. */
export default function BookDriver() {
  const router = useRouter();
  const { colors } = useTheme();
  const { userProfile } = useAuth();
  const { draft, update } = useBooking();
  const [listing, setListing] = useState<Listing | null>(null);

  useEffect(() => {
    if (!draft.scheduledForIso) {
      router.replace("/(ride)/book/locations");
      return;
    }
    let active = true;
    loadListing(userProfile?.isTestAccount === true)
      .then((l) => active && setListing(l))
      .catch((err) => {
        console.error("Error fetching drivers:", err);
        if (active) setListing({ drivers: [], viaDispatch: false });
      });
    return () => {
      active = false;
    };
  }, [draft.scheduledForIso, userProfile?.isTestAccount, router]);

  const drivers = listing?.drivers ?? null;
  const viaDispatch = listing?.viaDispatch === true;

  const select = (driver: PublicProfile) => {
    update({ driver, viaDispatch });
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
          {viaDispatch ? (
            <View
              style={[
                styles.dispatchNote,
                {
                  backgroundColor: colors.surfaceRaised,
                  borderColor: colors.border,
                },
              ]}
            >
              <AppText variant="smallStrong" color="textSecondary">
                {drivers[0].firstName} confirms every ride and may assign it to
                another vetted OK Let&apos;s Go driver. You&apos;ll see their
                name and car before pickup.
              </AppText>
            </View>
          ) : null}
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
                photoUrl={d.photoUrl ?? undefined}
                size={52}
                tint={colors.primary}
              />
              <View style={styles.text}>
                <View style={styles.nameRow}>
                  <AppText variant="heading">{d.firstName}</AppText>
                  <Ionicons name="star" size={14} color={STAR_GOLD} />
                  <AppText variant="smallStrong" color="textSecondary">
                    {formatDriverRating(d.rating ?? undefined)}
                  </AppText>
                  {viaDispatch && d.isOnline !== true ? (
                    <AppText variant="small" color="textMuted">
                      · Offline, books ahead
                    </AppText>
                  ) : null}
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
  dispatchNote: {
    paddingVertical: 11,
    paddingHorizontal: 14,
    borderRadius: radius.md,
    borderWidth: 1,
  },
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
