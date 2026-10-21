import { useCallback, useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  ClientLiveCard,
  ClientNextStrip,
  ClientTripGroups,
} from "../../components/rides/ClientTripCards";
import { RatingDialog } from "../../components/rides/RatingDialog";
import {
  RideOutcomeDialog,
  type RideOutcome,
} from "../../components/rides/RideOutcomeDialog";
import { AppText } from "../../components/ui/AppText";
import { LoadingScreen } from "../../components/ui/LoadingScreen";
import { Logo } from "../../components/ui/Logo";
import { Screen } from "../../components/ui/Screen";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { RideRequest } from "../../interfaces/ride";
import {
  cancelRide,
  fetchRide,
  getPendingRatingRide,
  LIVE_STATUSES,
  subscribeClientOpenRides,
} from "../../services/rideService";
import {
  subscribeSavedPlaces,
  type SavedPlace,
} from "../../services/savedPlacesService";
import {
  ratingNudgedKey,
  rideOutcomeShownKey,
  sessionFlag,
} from "../../utils/sessionFlags";
import { radius, spacing } from "../../theme/tokens";

/**
 * The rider's home: book a ride, and everything live or upcoming: one green
 * card for a ride in progress, the next confirmed ride, then rides grouped
 * by day. Also where a finished trip asks for its rating and a lost request
 * explains itself.
 */
export default function ClientHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const { userProfile, currentUser } = useAuth();
  const uid = currentUser?.uid;

  const [rides, setRides] = useState<RideRequest[] | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [dismissing, setDismissing] = useState<Set<string>>(new Set());
  const [ratingRide, setRatingRide] = useState<RideRequest | null>(null);
  const [outcome, setOutcome] = useState<RideOutcome | null>(null);
  const focused = useRef(false);

  // A ride that left the open list: find out why and tell the rider once
  // (the live screen shares the same guard, so it never pops twice).
  const explainDeparted = async (ids: string[]) => {
    for (const rideId of ids) {
      const key = rideOutcomeShownKey(rideId);
      if (sessionFlag.has(key)) continue;
      try {
        const r = await fetchRide(rideId);
        if (!r) continue;
        if (r.status === "cancelled" && r.cancelledBy === "driver") {
          sessionFlag.set(key);
          setOutcome({
            variant: "cancelled",
            driverName: r.driverFirstName,
            reason: r.cancellationReason || undefined,
            rideId,
            canViewDetails: true,
          });
          return;
        }
        if (r.status === "cancelled" && r.cancelledBy === "system") {
          sessionFlag.set(key);
          setOutcome({ variant: "expired", rideId, canViewDetails: false });
          return;
        }
        if (r.status === "declined") {
          const declines = r.declinedBy || [];
          sessionFlag.set(key);
          setOutcome({
            variant: "declined",
            driverName: r.driverFirstName,
            reason: declines[declines.length - 1]?.reason || undefined,
            rideId,
            canViewDetails: true,
          });
          return;
        }
      } catch (err) {
        console.error("Failed to check departed ride:", err);
      }
    }
  };

  useEffect(() => {
    if (!uid) return;
    const unsubRides = subscribeClientOpenRides(
      uid,
      (list, departedIds) => {
        setRides(list);
        if (departedIds.length) void explainDeparted(departedIds);
      },
      () => setRides([]),
    );
    const unsubPlaces = subscribeSavedPlaces(uid, setSavedPlaces);
    return () => {
      unsubRides();
      unsubPlaces();
    };
  }, [uid]);

  // Lazy rating nudge whenever Home comes to the front: if the most recent
  // completed trip is still unrated, ask once per session.
  useFocusEffect(
    useCallback(() => {
      focused.current = true;
      if (uid) {
        getPendingRatingRide(uid).then((ride) => {
          if (!ride?.id || !focused.current) return;
          const key = ratingNudgedKey(ride.id);
          if (sessionFlag.has(key)) return;
          sessionFlag.set(key);
          setRatingRide(ride);
        });
      }
      return () => {
        focused.current = false;
      };
    }, [uid]),
  );

  const dismissExpired = async (rideId: string) => {
    setDismissing((s) => new Set(s).add(rideId));
    try {
      await cancelRide(rideId, "Ride request expired", "client");
    } catch {
      setDismissing((s) => {
        const next = new Set(s);
        next.delete(rideId);
        return next;
      });
    }
  };

  const openRide = (id: string) =>
    router.push({ pathname: "/(ride)/live/[id]", params: { id } });
  const startBooking = () => router.push("/(ride)/book/locations");
  // A saved place opens the wizard with that address already set as the
  // drop-off, so the rider only has to confirm the pickup.
  const bookTo = (p: SavedPlace) =>
    router.push({
      pathname: "/(ride)/book/locations",
      params: {
        destination: JSON.stringify({
          address: p.address,
          lat: p.lat,
          lng: p.lng,
        }),
      },
    });

  if (!userProfile || rides === null) return <LoadingScreen />;

  const active = rides.filter((r) => LIVE_STATUSES.includes(r.status));
  const confirmed = rides.filter((r) => r.status === "accepted");
  const pending = rides.filter((r) => r.status === "pending");
  const isExpired = (r: RideRequest) =>
    r.status === "pending" && new Date(r.scheduledTime) < new Date();

  return (
    <Screen padded={false}>
      <ScrollView contentContainerStyle={styles.content}>
        <View style={styles.header}>
          <View>
            <AppText variant="eyebrow" color="secondary">
              RIDER
            </AppText>
            <AppText variant="title">Ready, {userProfile.firstName}?</AppText>
          </View>
          <Logo width={100} />
        </View>

        {/* Book */}
        <View
          style={[
            styles.bookCard,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Pressable
            accessibilityRole="button"
            onPress={startBooking}
            style={({ pressed }) => [
              styles.whereTo,
              {
                backgroundColor: colors.background,
                borderColor: pressed ? colors.primary : colors.border,
              },
            ]}
          >
            <Ionicons name="search" size={20} color={colors.primary} />
            <AppText variant="heading" color="textSecondary">
              Where are we going?
            </AppText>
          </Pressable>
          {savedPlaces.length > 0 ? (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.chips}
            >
              {savedPlaces.slice(0, 6).map((p) => (
                <Pressable
                  key={p.id}
                  accessibilityRole="button"
                  accessibilityLabel={`Book a ride to ${p.label}`}
                  onPress={() => bookTo(p)}
                  style={({ pressed }) => [
                    styles.chip,
                    {
                      backgroundColor: pressed
                        ? colors.surfaceRaised
                        : colors.background,
                      borderColor: colors.border,
                    },
                  ]}
                >
                  <Ionicons
                    name="bookmark"
                    size={14}
                    color={colors.secondary}
                  />
                  <AppText variant="smallStrong">{p.label}</AppText>
                </Pressable>
              ))}
            </ScrollView>
          ) : null}
        </View>

        {rides.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="car-outline" size={44} color={colors.textMuted} />
            <AppText variant="body" color="textMuted" align="center">
              You have no active rides.
            </AppText>
          </View>
        ) : (
          <>
            {active.map((r) => (
              <View key={r.id} style={styles.block}>
                <ClientLiveCard ride={r} onOpen={openRide} />
              </View>
            ))}
            {active.length === 0 && confirmed.length > 0 ? (
              <View style={styles.block}>
                <ClientNextStrip ride={confirmed[0]} onOpen={openRide} />
              </View>
            ) : null}
            <ClientTripGroups
              theme="upcoming"
              title="Confirmed"
              rides={confirmed}
              onOpen={openRide}
            />
            <ClientTripGroups
              theme="requests"
              title="Waiting for driver"
              rides={pending}
              isExpired={isExpired}
              dismissingIds={dismissing}
              onOpen={openRide}
              onDismiss={(id) => void dismissExpired(id)}
            />
          </>
        )}
      </ScrollView>

      {ratingRide ? (
        <RatingDialog
          visible
          rideId={ratingRide.id as string}
          driverName={ratingRide.driverFirstName || "your driver"}
          onClose={() => setRatingRide(null)}
        />
      ) : null}
      <RideOutcomeDialog
        outcome={outcome}
        onBookAgain={() => {
          setOutcome(null);
          startBooking();
        }}
        onViewDetails={(rideId) => {
          setOutcome(null);
          router.push({
            pathname: "/(common)/history/[id]",
            params: { id: rideId },
          });
        }}
        onDismiss={() => setOutcome(null)}
      />
    </Screen>
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
  bookCard: {
    padding: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  whereTo: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 56,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  chips: { gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  empty: { alignItems: "center", gap: spacing.sm, paddingVertical: 48 },
  block: { marginTop: spacing.lg },
});
