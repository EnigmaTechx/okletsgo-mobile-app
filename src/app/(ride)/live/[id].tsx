import { useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  RideMap,
  type RideMapHandle,
  type RouteLine,
} from "../../../components/map/RideMap";
import { ClientRideStatusPanel } from "../../../components/rides/ClientRideStatusPanel";
import {
  RideOutcomeDialog,
  type RideOutcome,
} from "../../../components/rides/RideOutcomeDialog";
import { TripCompletePanel } from "../../../components/rides/TripCompletePanel";
import { AppText } from "../../../components/ui/AppText";
import { DraggablePanel } from "../../../components/ui/DraggablePanel";
import { IconButton } from "../../../components/ui/IconButton";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";
import { ProcessingOverlay } from "../../../components/ui/ProcessingOverlay";
import { useToast } from "../../../components/ui/Toast";
import { useAuth } from "../../../contexts/AuthContext";
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
import {
  rideOutcomeShownKey,
  sessionFlag,
  tripCompleteShownKey,
} from "../../../utils/sessionFlags";
import { radius, spacing } from "../../../theme/tokens";

/** Handle area (8 + 24 + 4) + content top padding (4) inside DraggablePanel. */
const PANEL_CHROME_HEIGHT = 40;

/**
 * The rider's live view of one ride: a full-screen map with the route and
 * the driver's car, and a draggable panel with status, driver, route and
 * actions. When the driver completes the trip the panel becomes the
 * "You've arrived" summary with the rating prompt, then moves on to the
 * trip's history page. A cancellation leaves on its own, as in Ionic.
 */
export default function LiveRide() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { userProfile } = useAuth();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const map = useRef<RideMapHandle>(null);

  const [ride, setRide] = useState<RideRequest | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [cancelling, setCancelling] = useState(false);
  const [outcome, setOutcome] = useState<RideOutcome | null>(null);
  const completionHandled = useRef(false);
  const [stableDriver, setStableDriver] = useState<LatLng | null>(null);
  // Measured from the panel's headline + progress + driver block, so the
  // collapsed sheet shows exactly that and nothing half-cut beneath it.
  const [headerHeight, setHeaderHeight] = useState(176);
  const collapsedHeight =
    PANEL_CHROME_HEIGHT + headerHeight + insets.bottom + spacing.xs;

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
        // Claim this ride so the app-wide watcher does not open the
        // separate "You've arrived" screen on top of this one.
        sessionFlag.set(tripCompleteShownKey(data.id as string));
        if (typeof data.driverRatingByClient === "number") {
          // Rated already (e.g. reopened later): nothing left to ask.
          goHistory(data.id as string);
          return;
        }
        toast("Trip completed! Thanks for riding.", { type: "success" });
        setExpanded(true);
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
  const completed = status === "completed";

  const legToPickup = useDrivingRoute(
    toPickup ? stableDriver : null,
    toPickup ? pickup : null,
  );
  const legTrip = useDrivingRoute(
    preTrip || toPickup || completed ? pickup : null,
    preTrip || toPickup || completed ? dropoff : null,
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
      </>
    );
  }

  const routes: RouteLine[] = [];
  if (legToPickup)
    routes.push({ coords: legToPickup.coords, color: colors.secondary });
  if (legTrip) routes.push({ coords: legTrip.coords, color: colors.primary });
  if (legToDest)
    routes.push({ coords: legToDest.coords, color: colors.primary });

  const expandedHeight = Math.round(windowHeight * (completed ? 0.78 : 0.64));

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <RideMap
        ref={map}
        style={StyleSheet.absoluteFill}
        pickup={inProgress ? null : pickup}
        dropoff={dropoff}
        driver={completed ? null : stableDriver}
        me={inProgress || completed ? null : me}
        routes={routes}
        frame={[pickup, dropoff, completed ? null : stableDriver].filter(
          (p): p is LatLng => !!p,
        )}
        bottomPadding={collapsedHeight}
      />

      {ride.couponCode && !completed ? (
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

      <DraggablePanel
        collapsedHeight={collapsedHeight}
        expandedHeight={expandedHeight}
        expanded={expanded}
        onExpandedChange={setExpanded}
        accessory={
          completed ? null : (
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
          )
        }
      >
        {completed ? (
          <TripCompletePanel
            ride={ride}
            riderFirstName={userProfile?.firstName}
            onDone={() => goHistory(ride.id as string)}
          />
        ) : (
          <ClientRideStatusPanel
            ride={ride}
            onCancel={(r) => void handleCancel(r)}
            onHeaderLayout={setHeaderHeight}
          />
        )}
      </DraggablePanel>

      <ProcessingOverlay visible={cancelling} message="Cancelling your ride…" />

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
});
