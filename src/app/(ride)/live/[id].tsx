import { useEffect, useRef, useState } from "react";
import { Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import {
  RideMap,
  type RideMapHandle,
  type RouteLine,
} from "../../../components/map/RideMap";
import { ClientRideStatusPanel } from "../../../components/rides/ClientRideStatusPanel";
import { RatingDialog } from "../../../components/rides/RatingDialog";
import {
  RideOutcomeDialog,
  type RideOutcome,
} from "../../../components/rides/RideOutcomeDialog";
import { AppText } from "../../../components/ui/AppText";
import { IconButton } from "../../../components/ui/IconButton";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";
import { useToast } from "../../../components/ui/Toast";
import { useTheme } from "../../../contexts/ThemeContext";
import { useDrivingRoute } from "../../../hooks/useDrivingRoute";
import { useGeolocation } from "../../../hooks/useGeolocation";
import type { RideRequest } from "../../../interfaces/ride";
import {
  cancelRide,
  LIVE_STATUSES,
  subscribeRide,
} from "../../../services/rideService";
import { haversineKm, pointOf, type LatLng } from "../../../utils/geo";
import { cad } from "../../../utils/money";
import { rideOutcomeShownKey, sessionFlag } from "../../../utils/sessionFlags";
import { radius, spacing } from "../../../theme/tokens";

const PANEL_COLLAPSED = 190;

/**
 * The rider's live view of one ride: a full-screen map with the route and
 * the driver's car, and a panel with status, driver, route and actions.
 * Leaves on its own when the ride ends: history for a driver cancellation
 * or a completed trip (after the rating prompt), home otherwise.
 */
export default function LiveRide() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const map = useRef<RideMapHandle>(null);

  const [ride, setRide] = useState<RideRequest | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [ratingRide, setRatingRide] = useState<RideRequest | null>(null);
  const [outcome, setOutcome] = useState<RideOutcome | null>(null);
  const completionHandled = useRef(false);
  const [stableDriver, setStableDriver] = useState<LatLng | null>(null);

  const { location: me } = useGeolocation(true);

  const goHome = () => router.navigate("/(client)");
  const goHistory = (rideId: string) =>
    router.replace({
      pathname: "/(common)/history/[id]",
      params: { id: rideId },
    });

  useEffect(() => {
    if (!id) return;
    return subscribeRide(id, (data) => {
      if (!data) {
        goHome();
        return;
      }
      if (data.status === "cancelled") {
        if (data.cancelledBy === "driver") {
          toast(
            `${data.driverFirstName || "Your driver"} cancelled this ride.`,
            { type: "error" },
          );
          goHistory(data.id as string);
        } else if (
          data.cancelledBy === "system" &&
          data.systemExpiryType === "driver_no_start"
        ) {
          toast(
            "Your driver didn't start the trip in time, so it was cancelled. You have not been charged.",
            { durationMs: 4000 },
          );
          goHome();
        } else {
          goHome();
        }
        return;
      }
      if (data.status === "declined") {
        // Shared guard with Home so the outcome pops exactly once per ride.
        const key = rideOutcomeShownKey(data.id as string);
        if (sessionFlag.has(key)) {
          goHome();
          return;
        }
        sessionFlag.set(key);
        const declines = data.declinedBy || [];
        setOutcome({
          variant: "declined",
          driverName: data.driverFirstName,
          reason: declines[declines.length - 1]?.reason,
          rideId: data.id as string,
          canViewDetails: true,
        });
        return;
      }
      if (data.status === "completed") {
        if (completionHandled.current) return;
        completionHandled.current = true;
        toast("Trip completed! Thanks for riding.", { type: "success" });
        if (typeof data.driverRatingByClient === "number")
          goHistory(data.id as string);
        else setRatingRide(data);
        return;
      }
      setRide(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  // Only move the driver's marker once they have travelled about 100 m, so
  // GPS jitter does not make the car and the route line twitch.
  const privacyUnlocked = !!ride && LIVE_STATUSES.includes(ride.status);
  const liveDriver = privacyUnlocked ? pointOf(ride?.driverLocation) : null;
  if (
    liveDriver &&
    (!stableDriver || haversineKm(stableDriver, liveDriver) > 0.1)
  ) {
    setStableDriver(liveDriver);
  }

  const pickup = pointOf(ride?.pickup);
  const dropoff = pointOf(ride?.destination);
  const status = ride?.status;
  const preTrip = status === "pending" || status === "accepted";
  const toPickup = status === "heading_to_pickup" || status === "arrived";
  const inProgress = status === "in_progress";

  const legToPickup = useDrivingRoute(
    toPickup ? stableDriver : null,
    toPickup ? pickup : null,
  );
  const legTrip = useDrivingRoute(
    preTrip || toPickup ? pickup : null,
    preTrip || toPickup ? dropoff : null,
  );
  const legToDest = useDrivingRoute(
    inProgress ? stableDriver : null,
    inProgress ? dropoff : null,
  );

  // Follow the car during the trip.
  useEffect(() => {
    if (inProgress && stableDriver) map.current?.focus(stableDriver, 0.012);
  }, [inProgress, stableDriver]);

  const handleCancel = async (reason: string) => {
    if (!ride?.id) return;
    setCancelling(true);
    try {
      await cancelRide(ride.id, reason, "client");
      goHome();
      toast("Ride cancelled", { type: "success" });
    } catch (err) {
      console.error(err);
      toast("Failed to cancel ride. Please try again.", { type: "error" });
    } finally {
      setCancelling(false);
    }
  };

  const outcomeDialog = (
    <RideOutcomeDialog
      outcome={outcome}
      onBookAgain={() => {
        setOutcome(null);
        router.replace("/(ride)/book/locations");
      }}
      onViewDetails={(rideId) => {
        setOutcome(null);
        goHistory(rideId);
      }}
      onDismiss={() => {
        setOutcome(null);
        goHome();
      }}
    />
  );

  if (!ride) {
    return (
      <>
        <LoadingScreen />
        {outcomeDialog}
        {ratingRide ? (
          <RatingDialog
            visible
            rideId={ratingRide.id as string}
            driverName={ratingRide.driverFirstName || "your driver"}
            onClose={() => {
              const rid = ratingRide.id as string;
              setRatingRide(null);
              goHistory(rid);
            }}
          />
        ) : null}
      </>
    );
  }

  const routes: RouteLine[] = [];
  if (legToPickup)
    routes.push({ coords: legToPickup.coords, color: colors.secondary });
  if (legTrip) routes.push({ coords: legTrip.coords, color: colors.primary });
  if (legToDest)
    routes.push({ coords: legToDest.coords, color: colors.primary });

  const panelMax = expanded ? "62%" : PANEL_COLLAPSED;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <RideMap
        ref={map}
        style={StyleSheet.absoluteFill}
        pickup={inProgress ? null : pickup}
        dropoff={dropoff}
        driver={stableDriver}
        me={inProgress ? null : me}
        routes={routes}
        frame={[pickup, dropoff, stableDriver].filter((p): p is LatLng => !!p)}
        bottomPadding={PANEL_COLLAPSED}
      />

      {ride.couponCode ? (
        <View
          style={[
            styles.couponChip,
            { top: insets.top + 12, backgroundColor: colors.success },
          ]}
        >
          <AppText variant="smallStrong" style={{ color: colors.onSuccess }}>
            Discount applied
            {ride.discountAmount ? ` · −${cad(ride.discountAmount)}` : ""}
          </AppText>
        </View>
      ) : null}

      <View style={[styles.topLeft, { top: insets.top + 12 }]}>
        <IconButton
          icon="arrow-back"
          label="Back to home"
          raised
          onPress={goHome}
        />
      </View>

      <View
        style={[
          styles.panel,
          {
            backgroundColor: colors.background,
            maxHeight: panelMax,
            paddingBottom: insets.bottom + spacing.md,
          },
        ]}
      >
        <View style={styles.floatRow}>
          <IconButton
            icon="locate"
            label="Recenter map"
            raised
            onPress={() =>
              map.current?.focus(
                me ?? pickup ?? dropoff ?? { lat: 43.4643, lng: -80.5204 },
                0.01,
              )
            }
          />
        </View>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel={expanded ? "Collapse details" : "Expand details"}
          onPress={() => setExpanded((e) => !e)}
          style={styles.handleArea}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <Ionicons
            name={expanded ? "chevron-down" : "chevron-up"}
            size={16}
            color={colors.textMuted}
          />
        </Pressable>
        <ScrollView
          bounces={false}
          contentContainerStyle={styles.panelContent}
          scrollEnabled={expanded}
        >
          <ClientRideStatusPanel
            ride={ride}
            expanded={expanded}
            onCancel={(r) => void handleCancel(r)}
          />
        </ScrollView>
      </View>

      {cancelling ? (
        <View style={[styles.busy, { backgroundColor: colors.backdrop }]}>
          <AppText variant="bodyStrong" style={{ color: "#FFFFFF" }}>
            Cancelling your ride…
          </AppText>
        </View>
      ) : null}

      {outcomeDialog}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topLeft: { position: "absolute", left: spacing.screen },
  couponChip: {
    position: "absolute",
    alignSelf: "center",
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderRadius: radius.pill,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
  },
  floatRow: {
    position: "absolute",
    right: spacing.screen,
    top: -64,
  },
  handleArea: { alignItems: "center", paddingTop: spacing.sm, gap: 2 },
  handle: { width: 40, height: 4, borderRadius: 2 },
  panelContent: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.sm,
    paddingBottom: spacing.md,
  },
  busy: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    alignItems: "center",
    justifyContent: "center",
  },
});
