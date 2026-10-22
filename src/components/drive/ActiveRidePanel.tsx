import { useEffect, useState } from "react";
import { Image, Linking, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { RideRequest } from "../../interfaces/ride";
import type { UserProfile } from "../../interfaces/user";
import {
  subscribeOtherLiveRide,
  type CompleteTripMeta,
} from "../../services/driverService";
import { cancelRide, fetchUserProfile } from "../../services/rideService";
import { formatDayAndTime } from "../../utils/address";
import { driverPayout } from "../../utils/fareCalculator";
import {
  formatKm,
  haversineKm,
  kmFromDriver,
  pointOf,
  type LatLng,
} from "../../utils/geo";
import { cad } from "../../utils/money";
import { radius, spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { ReasonSheet } from "../ui/ReasonSheet";
import { Sheet } from "../ui/Sheet";
import { showAlert } from "../ui/alerts";
import { useToast } from "../ui/Toast";
import { RouteTimeline } from "../rides/RouteTimeline";
import { riderName } from "./DriverTripCards";
import { SwipeButton } from "./SwipeButton";
import { TimeChangeReviewCard } from "./TimeChangeReviewCard";

// SAFETY: the client's photo is only revealed once the driver has accepted
// and started heading to pickup, never while the ride is merely pending.
const CLIENT_PHOTO_VISIBLE = new Set<RideRequest["status"]>([
  "heading_to_pickup",
  "arrived",
  "confirmed",
  "en_route",
  "in_progress",
  "completed",
]);
const EARLY_END_REASONS = [
  "Client requested to be dropped off here",
  "Client exited the vehicle",
  "Road closed / inaccessible",
  "Other",
];
const CANCEL_REASONS_IN_PROGRESS = [
  "Client requested to end trip",
  "Vehicle issue / breakdown",
  "Safety concern",
  "Other",
];
const CANCEL_REASONS_PRE_TRIP = [
  "Client no-show",
  "Vehicle issue",
  "Traffic / Route closed",
  "Other",
];
/** Further than this from the drop-off, "Complete" asks first. */
const DROPOFF_PROXIMITY_KM = 0.3;
const WAIT_SECONDS = 300;
const GRACE_MS = 5 * 60 * 1000;
const UNLOCK_BEFORE_MIN = 45;

const STATUS_LABEL: Record<string, string> = {
  accepted: "Accepted",
  heading_to_pickup: "Heading to pickup",
  arrived: "Arrived at pickup",
  in_progress: "Trip in progress",
};

/** Header height for the collapsed sheet: status + rider row. */
export const ACTIVE_PANEL_HEADER = 150;

interface Props {
  ride: RideRequest;
  driverLocation: LatLng | null;
  locating: boolean;
  onHeadToPickup: () => Promise<void>;
  onArrived: () => Promise<void>;
  onStartTrip: () => Promise<void>;
  onComplete: (meta?: CompleteTripMeta) => Promise<void>;
  onCancelled: () => void;
}

const fmtCountdown = (secs: number) =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

/**
 * The driver's trip panel: rider, payout, route with distances, Call and
 * GPS, the slide-to-confirm for the next step with its timers (45-minute
 * start lock, 5-minute wait, pickup-time grace), the early-end guard and
 * the cancel sheet. Mirrors ActiveRideControls in the Ionic app.
 */
export function ActiveRidePanel({
  ride,
  driverLocation,
  locating,
  onHeadToPickup,
  onArrived,
  onStartTrip,
  onComplete,
  onCancelled,
}: Props) {
  const { colors } = useTheme();
  const { userProfile } = useAuth();
  const toast = useToast();
  // Sandbox drivers skip the start-trip unlock timer and the occupied gate.
  const isTestDriver = userProfile?.isTestAccount === true;

  const [client, setClient] = useState<UserProfile | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [earlyEndOpen, setEarlyEndOpen] = useState(false);
  const [earlyEndResolve, setEarlyEndResolve] = useState<
    ((r: { confirmed: boolean; reason?: string }) => void) | null
  >(null);
  const [cancelling, setCancelling] = useState(false);
  const [occupied, setOccupied] = useState(false);
  const [now, setNow] = useState(() => Date.now());

  const photosVisible = CLIENT_PHOTO_VISIBLE.has(ride.status);
  useEffect(() => {
    if (!photosVisible || !ride.clientId) return;
    let active = true;
    fetchUserProfile(ride.clientId)
      .then((p) => active && setClient(p))
      .catch((err) => console.warn("Client profile unavailable:", err));
    return () => {
      active = false;
    };
  }, [photosVisible, ride.clientId]);

  // One clock for every timer on the panel.
  useEffect(() => {
    if (ride.status !== "accepted" && ride.status !== "arrived") return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [ride.status]);

  useEffect(() => {
    if (ride.status !== "accepted" || !ride.driverId || !ride.id) return;
    return subscribeOtherLiveRide(ride.driverId, ride.id, setOccupied);
  }, [ride.status, ride.driverId, ride.id]);

  const scheduledMs = ride.scheduledTime
    ? new Date(ride.scheduledTime).getTime()
    : NaN;
  const minutesToUnlock =
    isTestDriver || Number.isNaN(scheduledMs)
      ? 0
      : Math.max(0, Math.ceil((scheduledMs - now) / 60000) - UNLOCK_BEFORE_MIN);
  const arrivedMs = ride.arrivedAtPickupAt
    ? new Date(ride.arrivedAtPickupAt).getTime()
    : now;
  const waitLeft = Math.max(
    0,
    WAIT_SECONDS - Math.floor((now - arrivedMs) / 1000),
  );
  const graceLeft = Number.isNaN(scheduledMs)
    ? 0
    : Math.max(0, Math.ceil((scheduledMs + GRACE_MS - now) / 1000));
  const canCancelNoShow = waitLeft === 0 && graceLeft === 0;
  const inProgress = ride.status === "in_progress";
  const payout = driverPayout(ride.estimatedPrice || 0);
  const tripKm = Number(ride.actualDistanceKm ?? ride.distance);
  const toPickup = inProgress
    ? null
    : kmFromDriver(driverLocation, ride.pickup);
  const toDropoff = inProgress
    ? kmFromDriver(driverLocation, ride.destination)
    : null;

  const openGps = () => {
    const target = inProgress ? ride.destination.address : ride.pickup.address;
    const url = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(target)}&travelmode=driving`;
    Linking.openURL(url).catch(() =>
      toast("Couldn't open navigation.", { type: "error" }),
    );
  };
  const call = () => {
    const digits = (ride.passengerPhone || "").replace(/\D/g, "");
    if (!digits)
      return toast("No phone number on this booking.", { type: "error" });
    Linking.openURL(`tel:+${digits}`).catch(() =>
      toast("Couldn't start a call.", { type: "error" }),
    );
  };

  const step = async (action: () => Promise<void>, failure: string) => {
    try {
      await action();
    } catch (err) {
      console.error(failure, err);
      toast(failure, { type: "error", durationMs: 4000 });
      throw err; // the swipe button springs back
    }
  };

  const handleArrived = () =>
    step(async () => {
      await onArrived();
      toast("Passenger notified of your arrival.");
      // Only worth explaining when the driver is early.
      if (
        !Number.isNaN(scheduledMs) &&
        scheduledMs - Date.now() >= 5 * 60 * 1000
      ) {
        showAlert(
          "You've arrived",
          `The rider has been notified. Please wait at the pickup location.\n\nScheduled pickup: ${formatDayAndTime(ride.scheduledTime)}. The no-show cancellation option unlocks 5 minutes after that time, or after a 5-minute wait, whichever is later.`,
        );
      }
    }, "Couldn't update the trip. Check your connection and try again.");

  const handleComplete = () =>
    step(async () => {
      const drv = pointOf(ride.driverLocation) ?? driverLocation;
      const dest = pointOf(ride.destination);
      if (drv && dest && haversineKm(drv, dest) > DROPOFF_PROXIMITY_KM) {
        const result = await new Promise<{
          confirmed: boolean;
          reason?: string;
        }>((resolve) => {
          setEarlyEndResolve(() => resolve);
          setEarlyEndOpen(true);
        });
        if (!result.confirmed) throw new Error("Not at drop-off yet.");
        const pickup = pointOf(ride.pickup);
        await onComplete({
          actualDistanceKm: pickup ? haversineKm(pickup, drv) : undefined,
          earlyEndReason: result.reason,
        });
        return;
      }
      await onComplete();
    }, "Couldn't complete the trip. Check your connection and try again.");

  const handleCancel = async (reason: string) => {
    if (!ride.id) return;
    setCancelling(true);
    try {
      await cancelRide(ride.id, reason, "driver");
      toast(inProgress ? "Trip cancelled" : "Job cancelled", {
        type: "success",
      });
      onCancelled();
    } catch (err) {
      toast(
        (err instanceof Error && err.message) || "Failed to cancel the ride.",
        { type: "error" },
      );
    } finally {
      setCancelling(false);
    }
  };

  const primaryAction = () => {
    switch (ride.status) {
      case "accepted":
        if (occupied && !isTestDriver) {
          return (
            <View
              style={[styles.notice, { backgroundColor: colors.surfaceRaised }]}
            >
              <Ionicons name="car-sport" size={22} color={colors.primary} />
              <View style={styles.flex}>
                <AppText variant="bodyStrong">Active trip in progress</AppText>
                <AppText variant="small" color="textSecondary">
                  Complete your current ride before starting this one.
                </AppText>
              </View>
            </View>
          );
        }
        return (
          <SwipeButton
            key="accepted"
            text={
              minutesToUnlock > 0
                ? `Too early (wait ${minutesToUnlock} min)`
                : "Head to pickup"
            }
            icon="arrow-forward"
            color={colors.secondary}
            disabled={minutesToUnlock > 0}
            onConfirm={() =>
              step(async () => {
                await onHeadToPickup();
                toast("Routing to pickup location…");
              }, "Couldn't update the trip. Check your connection and try again.")
            }
          />
        );
      case "heading_to_pickup":
        return (
          <SwipeButton
            key="heading"
            text="Arrived at pickup"
            icon="location-sharp"
            color={colors.primary}
            onConfirm={handleArrived}
          />
        );
      case "arrived":
        return (
          <View style={styles.stack}>
            <View
              style={[
                styles.waitBox,
                {
                  backgroundColor: canCancelNoShow
                    ? colors.dangerSoft
                    : colors.surfaceRaised,
                },
              ]}
            >
              <Ionicons
                name="time-outline"
                size={22}
                color={canCancelNoShow ? colors.danger : colors.primary}
              />
              <AppText
                variant="bodyStrong"
                color={canCancelNoShow ? "danger" : "text"}
              >
                {waitLeft > 0
                  ? `Wait for rider: ${fmtCountdown(waitLeft)}`
                  : canCancelNoShow
                    ? "Rider is late. You may cancel."
                    : "Waiting period elapsed."}
              </AppText>
              {waitLeft === 0 && graceLeft > 0 ? (
                <AppText variant="small" color="primary" align="center">
                  No-show cancellation unlocks 5 minutes after the scheduled
                  pickup ({fmtCountdown(graceLeft)}).
                </AppText>
              ) : null}
            </View>
            <SwipeButton
              key="arrived"
              text="Start trip"
              icon="play-circle"
              color={colors.secondary}
              onConfirm={() =>
                step(async () => {
                  await onStartTrip();
                  toast("Trip started. Drive safely!");
                }, "Couldn't update the trip. Check your connection and try again.")
              }
            />
            {canCancelNoShow ? (
              <Button
                title="Cancel · rider no-show"
                variant="danger"
                onPress={() => void handleCancel("Client no-show")}
                loading={cancelling}
              />
            ) : null}
          </View>
        );
      case "in_progress":
        return (
          <SwipeButton
            key="in_progress"
            text="Complete trip"
            icon="checkmark-circle"
            color={colors.success}
            onConfirm={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  return (
    <View style={styles.root}>
      <View style={styles.header}>
        <View style={styles.statusRow}>
          <View
            style={[
              styles.statusDot,
              {
                backgroundColor: inProgress ? colors.success : colors.secondary,
              },
            ]}
          />
          <AppText variant="eyebrow" color="textMuted">
            {(
              STATUS_LABEL[ride.status] ?? ride.status.replace(/_/g, " ")
            ).toUpperCase()}
          </AppText>
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Ride options"
            hitSlop={10}
            disabled={cancelling}
            onPress={() => setCancelOpen(true)}
            style={styles.more}
          >
            <Ionicons
              name="ellipsis-vertical"
              size={22}
              color={colors.textMuted}
            />
          </Pressable>
        </View>
        <View style={styles.riderRow}>
          <Pressable
            accessibilityRole="button"
            disabled={!client?.photoUrl}
            onPress={() => setPhotoOpen(true)}
            style={[
              styles.avatar,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.secondary,
              },
            ]}
          >
            {client?.photoUrl ? (
              <Image
                source={{ uri: client.photoUrl }}
                style={styles.avatarImg}
              />
            ) : (
              <Ionicons name="person" size={26} color={colors.textMuted} />
            )}
          </Pressable>
          <View style={styles.flex}>
            <AppText variant="title" numberOfLines={1}>
              {riderName(ride)}
            </AppText>
            <AppText variant="small" color="textMuted">
              {formatDayAndTime(ride.scheduledTime || ride.createdAt)}
            </AppText>
          </View>
          <View style={styles.payout}>
            <AppText variant="heading" color="success">
              {cad(payout)}
            </AppText>
            <AppText variant="eyebrow" color="textMuted">
              EST. EARN
            </AppText>
          </View>
        </View>
      </View>

      <TimeChangeReviewCard ride={ride} />

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <RouteTimeline
          pickup={ride.pickup.address}
          dropoff={ride.destination.address}
          compact
          pickupAside={
            toPickup !== null ? (
              <Tag text={`${formatKm(toPickup)} to pickup`} />
            ) : !inProgress && locating ? (
              <Tag text="··· to pickup" />
            ) : undefined
          }
          dropoffAside={
            <View style={styles.tags}>
              {Number.isFinite(tripKm) && tripKm > 0 ? (
                <Tag text={`${formatKm(tripKm)} trip`} muted />
              ) : null}
              {toDropoff !== null ? (
                <Tag text={`${formatKm(toDropoff)} to drop-off`} />
              ) : null}
            </View>
          }
        />
      </View>

      <View style={styles.tools}>
        <Button
          title="Call"
          variant="secondary"
          onPress={call}
          disabled={cancelling}
          style={styles.half}
        />
        <Button
          title="GPS"
          variant="secondary"
          onPress={openGps}
          disabled={cancelling}
          style={styles.half}
        />
      </View>

      <View style={styles.actionZone}>{primaryAction()}</View>

      <ReasonSheet
        visible={cancelOpen}
        title={inProgress ? "Cancel trip?" : "Cancel job?"}
        message={
          inProgress
            ? "The trip is already in progress. Please select a reason."
            : "Please select a reason for cancelling."
        }
        reasons={
          inProgress ? CANCEL_REASONS_IN_PROGRESS : CANCEL_REASONS_PRE_TRIP
        }
        cancelLabel={inProgress ? "Continue trip" : "Keep ride"}
        confirmLabel={inProgress ? "Cancel trip" : "Cancel job"}
        onCancel={() => setCancelOpen(false)}
        onConfirm={(reason) => {
          setCancelOpen(false);
          void handleCancel(reason);
        }}
      />

      <ReasonSheet
        visible={earlyEndOpen}
        icon="warning-outline"
        title="Not at drop-off yet"
        message="End the trip here? Select a reason."
        reasons={EARLY_END_REASONS}
        cancelLabel="Keep driving"
        confirmLabel="End here"
        dismissible={false}
        onCancel={() => {
          setEarlyEndOpen(false);
          earlyEndResolve?.({ confirmed: false });
          setEarlyEndResolve(null);
        }}
        onConfirm={(reason) => {
          setEarlyEndOpen(false);
          earlyEndResolve?.({ confirmed: true, reason });
          setEarlyEndResolve(null);
        }}
      />

      <Sheet visible={photoOpen} onClose={() => setPhotoOpen(false)}>
        <View style={styles.photoSheet}>
          {client?.photoUrl ? (
            <Image
              source={{ uri: client.photoUrl }}
              style={styles.photoLarge}
            />
          ) : null}
          <AppText variant="title">{riderName(ride)}</AppText>
        </View>
      </Sheet>
    </View>
  );
}

function Tag({ text, muted = false }: { text: string; muted?: boolean }) {
  return (
    <AppText
      variant="small"
      color={muted ? "textMuted" : "secondary"}
      numberOfLines={1}
    >
      {text}
    </AppText>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  header: { gap: spacing.sm, paddingBottom: spacing.xs },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  more: { marginLeft: "auto" },
  riderRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 52, height: 52 },
  flex: { flex: 1, gap: 2 },
  payout: { alignItems: "flex-end" },
  card: {
    marginTop: spacing.sm,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  tags: { alignItems: "flex-end", gap: 2 },
  tools: { flexDirection: "row", gap: spacing.md },
  half: { flex: 1 },
  actionZone: { marginTop: spacing.sm, gap: spacing.md },
  stack: { gap: spacing.md },
  waitBox: {
    alignItems: "center",
    gap: spacing.xs,
    padding: spacing.md,
    borderRadius: radius.lg,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
  },
  photoSheet: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  photoLarge: { width: 220, height: 220, borderRadius: 110 },
});
