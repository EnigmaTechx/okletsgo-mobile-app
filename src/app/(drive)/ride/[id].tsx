import { useEffect, useRef, useState } from "react";
import { StyleSheet, useWindowDimensions, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import {
  ActiveRidePanel,
  ACTIVE_PANEL_HEADER,
} from "../../../components/drive/ActiveRidePanel";
import {
  IncomingRequestPanel,
  REQUEST_PANEL_HEADER,
} from "../../../components/drive/IncomingRequestPanel";
import {
  RideMap,
  type RideMapHandle,
  type RouteLine,
} from "../../../components/map/RideMap";
import { AppText } from "../../../components/ui/AppText";
import { Button } from "../../../components/ui/Button";
import { DraggablePanel } from "../../../components/ui/DraggablePanel";
import { IconButton } from "../../../components/ui/IconButton";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";
import { showAlert } from "../../../components/ui/alerts";
import { useToast } from "../../../components/ui/Toast";
import { useTheme } from "../../../contexts/ThemeContext";
import { useBgLocationConsent } from "../../../hooks/useBgLocationConsent";
import { useDrivingRoute } from "../../../hooks/useDrivingRoute";
import { useGeolocation } from "../../../hooks/useGeolocation";
import type { RideRequest } from "../../../interfaces/ride";
import {
  startTripTracking,
  stopTripTracking,
} from "../../../services/backgroundLocation";
import {
  completeTrip,
  headToPickup,
  markArrived,
  startTrip,
  writeDriverLocation,
  type CompleteTripMeta,
} from "../../../services/driverService";
import {
  LIVE_STATUSES,
  respondToRide,
  subscribeRide,
} from "../../../services/rideService";
import { formatDayAndTime } from "../../../utils/address";
import { haversineKm, pointOf, type LatLng } from "../../../utils/geo";
import { spacing } from "../../../theme/tokens";

const PANEL_CHROME_HEIGHT = 40;

/**
 * One ride from the driver's side: a new request to accept or decline, or
 * the active trip with its map, live location sharing and step-by-step
 * controls. Leaves on its own when the ride is cancelled or completed.
 */
export default function DriverRide() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const map = useRef<RideMapHandle>(null);
  const bgConsent = useBgLocationConsent();

  const [ride, setRide] = useState<RideRequest | null>(null);
  const [expanded, setExpanded] = useState(true);
  const [accepting, setAccepting] = useState(false);
  const [busy, setBusy] = useState<string | null>(null);
  const [disclosureDismissed, setDisclosureDismissed] = useState(false);
  const [stableMe, setStableMe] = useState<LatLng | null>(null);
  const [openedAt] = useState(() => Date.now());
  const lastWrite = useRef<{ point: LatLng; at: number } | null>(null);

  const tracking = !!ride && LIVE_STATUSES.includes(ride.status);
  // One fix while deciding on a request, a watch during the trip.
  const { location: me, error: geoError, locating } = useGeolocation(tracking);

  const goHome = () => router.navigate("/(driver)");
  const goHistory = (rideId: string) =>
    router.replace({
      pathname: "/(common)/history/[id]",
      params: { id: rideId },
    });

  useEffect(() => {
    if (!id) return;
    return subscribeRide(id, (data) => {
      if (!data || data.status === "cancelled" || data.status === "declined") {
        goHome();
        return;
      }
      if (data.status === "completed") {
        goHistory(data.id as string);
        return;
      }
      setRide(data);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [id]);

  useEffect(() => {
    if (geoError)
      toast(`GPS error: ${geoError}`, { type: "error", durationMs: 5000 });
  }, [geoError, toast]);

  // Marker only moves after ~100 m so the route line does not twitch.
  if (me && (!stableMe || haversineKm(stableMe, me) > 0.1)) setStableMe(me);

  // Foreground live-location write, throttled like the Ionic page. Keeps
  // the rider updated whenever the app is open, whatever the background
  // consent says.
  useEffect(() => {
    if (!tracking || !ride?.id || !me) return;
    const now = Date.now();
    const prev = lastWrite.current;
    if (prev && haversineKm(prev.point, me) < 0.025 && now - prev.at < 15_000)
      return;
    lastWrite.current = { point: me, at: now };
    writeDriverLocation(ride.id, me).catch((e) =>
      console.error("Foreground location update failed:", e),
    );
  }, [tracking, ride?.id, me]);

  // Prominent disclosure BEFORE the OS background-permission prompt (Google
  // Play policy), then the background task for the rest of the trip.
  const needsDisclosure =
    tracking && bgConsent.granted === false && !disclosureDismissed;
  useEffect(() => {
    if (!needsDisclosure) return;
    showAlert(
      "Share your live location",
      "During a trip, OK Let's Go collects your location in the background, even when the app is closed or not in use, so your rider can follow you to pickup and drop-off. Tracking stops when the trip ends.",
      [
        {
          text: "Not now",
          style: "cancel",
          onPress: () => setDisclosureDismissed(true),
        },
        { text: "Allow", onPress: () => bgConsent.setGranted(true) },
      ],
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needsDisclosure]);

  useEffect(() => {
    if (!tracking || !ride?.id || !bgConsent.granted) {
      void stopTripTracking();
      return;
    }
    startTripTracking(ride.id).then((ok) => {
      if (!ok)
        console.warn("Background location not granted; foreground only.");
    });
    return () => {
      void stopTripTracking();
    };
  }, [tracking, ride?.id, bgConsent.granted]);

  const accept = async () => {
    if (!ride?.id) return;
    setAccepting(true);
    try {
      await respondToRide(ride.id, "accept");
    } catch (err) {
      showAlert(
        "Couldn't accept",
        (err instanceof Error && err.message) ||
          "An unexpected error occurred while accepting the ride.",
      );
    } finally {
      setAccepting(false);
    }
  };

  const decline = async (reason: string) => {
    if (!ride?.id) return;
    setBusy("Declining request…");
    try {
      const result = await respondToRide(ride.id, "decline", reason);
      goHome();
      toast(
        result && result.forwarded
          ? `Request passed to ${result.driverFirstName || "another driver"}`
          : "Request declined",
        { type: "success" },
      );
    } catch (err) {
      showAlert(
        "Couldn't decline",
        (err instanceof Error && err.message) ||
          "Couldn't decline the request. Please try again.",
      );
    } finally {
      setBusy(null);
    }
  };

  const complete = async (meta?: CompleteTripMeta) => {
    if (!ride) return;
    setBusy("Completing trip…");
    try {
      await completeTrip(ride, meta);
      // The listener sees "completed" and moves to the trip's history.
    } finally {
      setBusy(null);
    }
  };

  const pickup = pointOf(ride?.pickup);
  const dropoff = pointOf(ride?.destination);
  const preTrip = ride?.status === "pending" || ride?.status === "accepted";
  const toPickup =
    ride?.status === "heading_to_pickup" || ride?.status === "arrived";
  const inProgress = ride?.status === "in_progress";
  const legToPickup = useDrivingRoute(
    toPickup ? stableMe : null,
    toPickup ? pickup : null,
  );
  const legTrip = useDrivingRoute(
    preTrip || toPickup ? pickup : null,
    preTrip || toPickup ? dropoff : null,
  );
  const legToDest = useDrivingRoute(
    inProgress ? stableMe : null,
    inProgress ? dropoff : null,
  );
  if (!ride) return <LoadingScreen />;

  const routes: RouteLine[] = [];
  if (legToPickup)
    routes.push({ coords: legToPickup.coords, color: colors.secondary });
  if (legTrip) routes.push({ coords: legTrip.coords, color: colors.primary });
  if (legToDest)
    routes.push({ coords: legToDest.coords, color: colors.primary });

  // A request older than 30 minutes past its pickup time is only dismissable.
  const expiredRequest =
    ride.status === "pending" &&
    new Date(ride.scheduledTime).getTime() < openedAt - 30 * 60 * 1000;
  const headerHeight =
    ride.status === "pending" ? REQUEST_PANEL_HEADER : ACTIVE_PANEL_HEADER;
  const collapsedHeight =
    PANEL_CHROME_HEIGHT + headerHeight + insets.bottom + spacing.xs;

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <RideMap
        ref={map}
        style={StyleSheet.absoluteFill}
        pickup={inProgress ? null : pickup}
        dropoff={dropoff}
        driver={stableMe}
        routes={routes}
        frame={[pickup, dropoff, stableMe].filter((p): p is LatLng => !!p)}
        bottomPadding={collapsedHeight}
      />
      <View style={[styles.topLeft, { top: insets.top + 12 }]}>
        <IconButton
          icon="arrow-back"
          label="Back to dashboard"
          raised
          onPress={goHome}
        />
      </View>

      <DraggablePanel
        collapsedHeight={collapsedHeight}
        expandedHeight={Math.round(windowHeight * 0.7)}
        expanded={expanded}
        onExpandedChange={setExpanded}
        accessory={
          <IconButton
            icon="locate"
            label="Recenter map"
            raised
            onPress={() =>
              map.current?.focus(
                me ?? pickup ?? { lat: 43.4643, lng: -80.5204 },
                0.01,
              )
            }
          />
        }
      >
        {ride.status === "pending" ? (
          expiredRequest ? (
            <View style={styles.expired}>
              <AppText variant="title" align="center">
                Request expired
              </AppText>
              <AppText variant="body" color="textSecondary" align="center">
                This ride was scheduled for{" "}
                {formatDayAndTime(ride.scheduledTime)} and was not accepted in
                time.
              </AppText>
              <Button
                title="Dismiss"
                variant="secondary"
                onPress={() => void decline("Request expired")}
              />
            </View>
          ) : (
            <IncomingRequestPanel
              ride={ride}
              driverLocation={me}
              locating={locating}
              accepting={accepting}
              onAccept={() => void accept()}
              onDecline={(r) => void decline(r)}
            />
          )
        ) : (
          <ActiveRidePanel
            ride={ride}
            driverLocation={me}
            locating={locating}
            onHeadToPickup={() => headToPickup(ride.id as string, me)}
            onArrived={() => markArrived(ride.id as string)}
            onStartTrip={() => startTrip(ride.id as string)}
            onComplete={complete}
            onCancelled={goHome}
          />
        )}
      </DraggablePanel>

      {busy ? (
        <View style={[styles.busy, { backgroundColor: colors.backdrop }]}>
          <AppText variant="bodyStrong" style={{ color: "#FFFFFF" }}>
            {busy}
          </AppText>
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  topLeft: { position: "absolute", left: spacing.screen },
  expired: {
    gap: spacing.md,
    paddingVertical: spacing.lg,
    alignItems: "stretch",
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
