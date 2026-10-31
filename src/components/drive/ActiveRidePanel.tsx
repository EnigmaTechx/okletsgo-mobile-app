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
import { formatTime } from "../../utils/address";
import { driverPayout } from "../../utils/fareCalculator";
import {
  formatKm,
  haversineKm,
  kmFromDriver,
  pointOf,
  type LatLng,
} from "../../utils/geo";
import { radius, spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { Sheet } from "../ui/Sheet";
import type { PillTone } from "../ui/SheetPill";
import { useToast } from "../ui/Toast";
import { RouteTimeline } from "../rides/RouteTimeline";
import {
  PersonRow,
  PriceCluster,
  SheetButton,
  SheetCard,
  SheetHead,
  Strong,
} from "../rides/SheetParts";
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

/** Pill tone and label per status, as the Ionic sheet header. */
const STATUS_THEME: Record<string, { tone: PillTone; label: string }> = {
  accepted: { tone: "blue", label: "Accepted" },
  heading_to_pickup: { tone: "blue", label: "Heading to pickup" },
  arrived: { tone: "gold", label: "Arrived at pickup" },
  in_progress: { tone: "green", label: "Trip in progress" },
  completed: { tone: "green", label: "Completed" },
};

interface Props {
  ride: RideRequest;
  driverLocation: LatLng | null;
  locating: boolean;
  onHeadToPickup: () => Promise<void>;
  onArrived: () => Promise<void>;
  onStartTrip: () => Promise<void>;
  onComplete: (meta?: CompleteTripMeta) => Promise<void>;
  onCancelled: () => void;
  /** Height of the header block, for the collapsed sheet. */
  onHeaderLayout?: (height: number) => void;
}

const fmtCountdown = (secs: number) =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

const shortDate = (iso?: string): string => {
  const d = new Date(iso ?? "");
  return Number.isNaN(d.getTime())
    ? "ASAP"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/**
 * The driver's trip sheet, laid out like the Ionic ActiveRideControls: the
 * status pill with the pickup time (or "Started 7:05 PM") and the live
 * distance under it, the rider and the payout, the route with its
 * distance tags, Call and GPS, the slide-to-confirm for the next step with
 * its timers (45-minute start lock, 5-minute wait, pickup-time grace), and
 * the cancel action under it. Every confirmation is a ConfirmSheet.
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
  onHeaderLayout,
}: Props) {
  const { colors } = useTheme();
  const { userProfile } = useAuth();
  const toast = useToast();
  // Sandbox drivers skip the start-trip unlock timer and the occupied gate.
  const isTestDriver = userProfile?.isTestAccount === true;

  const [client, setClient] = useState<UserProfile | null>(null);
  const [photoOpen, setPhotoOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState(CANCEL_REASONS_PRE_TRIP[0]);
  const [earlyEndOpen, setEarlyEndOpen] = useState(false);
  const [earlyEndReason, setEarlyEndReason] = useState(EARLY_END_REASONS[0]);
  const [earlyEndResolve, setEarlyEndResolve] = useState<
    ((r: { confirmed: boolean; reason?: string }) => void) | null
  >(null);
  const [earlyNoticeOpen, setEarlyNoticeOpen] = useState(false);
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
  const liveTag = inProgress
    ? toDropoff !== null
      ? `${formatKm(toDropoff)} to drop-off`
      : locating
        ? "··· to drop-off"
        : null
    : toPickup !== null
      ? `${formatKm(toPickup)} to pickup`
      : locating
        ? "··· to pickup"
        : null;
  const theme = STATUS_THEME[ride.status] ?? {
    tone: "grey" as PillTone,
    label: ride.status.replace(/_/g, " "),
  };
  const name = riderName(ride);
  const when = ride.scheduledTime || ride.createdAt;
  // No-show cancel unlocks 5 min after the scheduled pickup.
  const noShowUnlockAt = Number.isNaN(scheduledMs)
    ? ""
    : formatTime(new Date(scheduledMs + GRACE_MS).toISOString());

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
      // Only worth explaining when the driver is early (5+ min before pickup).
      if (!Number.isNaN(scheduledMs) && scheduledMs - Date.now() >= GRACE_MS)
        setEarlyNoticeOpen(true);
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
          setEarlyEndReason(EARLY_END_REASONS[0]);
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

  const openCancel = () => {
    setCancelReason(
      (inProgress ? CANCEL_REASONS_IN_PROGRESS : CANCEL_REASONS_PRE_TRIP)[0],
    );
    setCancelOpen(true);
  };

  const primaryAction = () => {
    switch (ride.status) {
      case "accepted":
        if (occupied && !isTestDriver) {
          return (
            <View
              style={[
                styles.occupied,
                {
                  backgroundColor: colors.dangerSoft,
                  borderColor: colors.danger,
                },
              ]}
            >
              <Ionicons name="car-sport" size={24} color={colors.danger} />
              <AppText variant="smallStrong" color="danger" align="center">
                Active Trip in Progress
              </AppText>
              <AppText variant="small" color="textSecondary" align="center">
                You must complete your current ride before starting this one.
              </AppText>
            </View>
          );
        }
        return (
          <SwipeButton
            key="accepted"
            text={
              minutesToUnlock > 0
                ? `Too early (Wait ${minutesToUnlock}m)`
                : "Head to Pickup"
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
            text="Arrived at Pickup"
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
              <View style={styles.waitRow}>
                <Ionicons
                  name="time-outline"
                  size={20}
                  color={canCancelNoShow ? colors.danger : colors.primary}
                />
                <AppText
                  variant="bodyStrong"
                  color={canCancelNoShow ? "danger" : "text"}
                >
                  {waitLeft > 0
                    ? `Wait for client: ${fmtCountdown(waitLeft)}`
                    : canCancelNoShow
                      ? "Client is late. You may cancel."
                      : "Wait time is up"}
                </AppText>
              </View>
              {waitLeft === 0 && graceLeft > 0 ? (
                <AppText variant="small" color="textSecondary" align="center">
                  No-show cancel unlocks in{" "}
                  <AppText variant="smallStrong" color="primary">
                    {fmtCountdown(graceLeft)}
                  </AppText>
                </AppText>
              ) : null}
            </View>
            <SwipeButton
              key="arrived"
              text="Start Trip"
              icon="play-circle"
              color="#3880FF"
              onConfirm={() =>
                step(async () => {
                  await onStartTrip();
                  toast("Trip started. Drive safely!");
                }, "Couldn't update the trip. Check your connection and try again.")
              }
            />
          </View>
        );
      case "in_progress":
        return (
          <SwipeButton
            key="in_progress"
            text="Complete Trip"
            icon="checkmark-circle"
            color={colors.success}
            onConfirm={handleComplete}
          />
        );
      default:
        return null;
    }
  };

  // Under the swipe: cancel before the trip, end early during it, or the
  // no-show cancel once the wait timer has run out.
  const secondaryAction =
    ride.status === "completed" ? null : ride.status === "arrived" &&
      canCancelNoShow ? (
      <SheetButton
        title="Cancel · client no-show"
        icon="warning-outline"
        kind="outline-danger"
        size="sm"
        onPress={() => void handleCancel("Client no-show")}
        loading={cancelling}
        style={styles.secondary}
      />
    ) : (
      <SheetButton
        title={inProgress ? "End trip early" : "Cancel ride"}
        icon={inProgress ? "stop-circle-outline" : "close-circle-outline"}
        kind="outline-danger"
        size="sm"
        onPress={openCancel}
        disabled={cancelling}
        style={styles.secondary}
      />
    );

  return (
    <View style={styles.root}>
      <SheetHead
        tone={theme.tone}
        pill={theme.label}
        onLayout={onHeaderLayout}
        subline={
          <>
            {inProgress ? (
              ride.tripStartedAt ? (
                <>
                  Started <Strong>{formatTime(ride.tripStartedAt)}</Strong>
                </>
              ) : (
                "On the way to drop-off"
              )
            ) : (
              <>
                {shortDate(when)}
                {" · "}
                <Strong>{formatTime(when)}</Strong>
              </>
            )}
            {liveTag ? ` · ${liveTag}` : ""}
          </>
        }
      />

      <View style={styles.body}>
        {/* Rider-requested earlier pickup awaiting this driver's decision */}
        <TimeChangeReviewCard ride={ride} />

        <PersonRow
          avatar={
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={
                client?.photoUrl ? "View rider photo" : undefined
              }
              disabled={!client?.photoUrl}
              onPress={() => setPhotoOpen(true)}
              style={[
                styles.avatar,
                { backgroundColor: `rgba(93, 183, 233, 0.18)` },
              ]}
            >
              {client?.photoUrl ? (
                <Image
                  source={{ uri: client.photoUrl }}
                  style={styles.avatarImg}
                />
              ) : (
                <AppText
                  variant="smallStrong"
                  style={{ color: colors.secondary }}
                >
                  {`${ride.clientFirstName?.charAt(0) ?? ""}${ride.clientLastName?.charAt(0) ?? ""}`.toUpperCase() ||
                    "?"}
                </AppText>
              )}
            </Pressable>
          }
          name={name}
          right={
            <PriceCluster
              amount={`$${payout.toFixed(2)}`}
              label="Est. Earn"
              size="md"
            />
          }
        />

        <SheetCard>
          <RouteTimeline
            size="md"
            pickup={ride.pickup.address}
            dropoff={ride.destination.address}
            pickupSuffix={
              !inProgress
                ? toPickup !== null
                  ? `${formatKm(toPickup)} to pickup`
                  : locating
                    ? "··· to pickup"
                    : null
                : null
            }
            dropoffSuffix={
              Number.isFinite(tripKm) && tripKm > 0
                ? `${formatKm(tripKm)} trip`
                : null
            }
          />
        </SheetCard>

        <View style={styles.tools}>
          <SheetButton
            title="Call"
            icon="call"
            kind="outline-primary"
            onPress={call}
            disabled={cancelling}
            style={styles.tool}
          />
          <SheetButton
            title="GPS"
            icon="navigate-circle-outline"
            kind="outline-secondary"
            onPress={openGps}
            disabled={cancelling}
            style={styles.tool}
          />
        </View>
      </View>

      <View style={[styles.foot, { borderTopColor: colors.border }]}>
        {primaryAction()}
        {secondaryAction}
      </View>

      {/* Arrival notice: only when the driver is early, so the pickup time is set. */}
      <ConfirmSheet
        visible={earlyNoticeOpen}
        tone="primary"
        icon="time-outline"
        title="You're early"
        message={
          <AppText variant="body" color="textSecondary" align="center">
            {name || "The rider"} has been notified. No-show cancel unlocks at{" "}
            <AppText variant="bodyStrong">{noShowUnlockAt}</AppText>, 5 min
            after pickup.
          </AppText>
        }
        confirmText="Got it"
        onConfirm={() => setEarlyNoticeOpen(false)}
        onDismiss={() => setEarlyNoticeOpen(false)}
      />

      {/* Cancel trip / cancel job */}
      <ConfirmSheet
        visible={cancelOpen}
        tone="danger"
        icon="close-circle-outline"
        title={inProgress ? "Cancel Trip?" : "Cancel Job?"}
        message={
          inProgress
            ? "The trip is in progress. Select a reason."
            : "Select a reason for cancelling."
        }
        options={
          inProgress ? CANCEL_REASONS_IN_PROGRESS : CANCEL_REASONS_PRE_TRIP
        }
        selected={cancelReason}
        onSelect={setCancelReason}
        cancelText={inProgress ? "Continue Trip" : "Keep Ride"}
        onCancel={() => setCancelOpen(false)}
        confirmText={inProgress ? "Cancel Trip" : "Cancel Job"}
        onConfirm={() => {
          setCancelOpen(false);
          void handleCancel(cancelReason);
        }}
      />

      {/* Early drop-off guard */}
      <ConfirmSheet
        visible={earlyEndOpen}
        tone="danger"
        icon="warning-outline"
        title="Not at Drop-off Yet"
        message="End the trip here? Select a reason."
        options={EARLY_END_REASONS}
        selected={earlyEndReason}
        onSelect={setEarlyEndReason}
        cancelText="Keep Driving"
        onCancel={() => {
          setEarlyEndOpen(false);
          earlyEndResolve?.({ confirmed: false });
          setEarlyEndResolve(null);
        }}
        confirmText="End Here"
        onConfirm={() => {
          setEarlyEndOpen(false);
          earlyEndResolve?.({ confirmed: true, reason: earlyEndReason });
          setEarlyEndResolve(null);
        }}
        dismissible={false}
      />

      <Sheet visible={photoOpen} onClose={() => setPhotoOpen(false)}>
        <View style={styles.photoSheet}>
          {client?.photoUrl ? (
            <Image
              source={{ uri: client.photoUrl }}
              style={styles.photoLarge}
            />
          ) : null}
          <AppText variant="title">{name}</AppText>
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  body: { gap: spacing.md },
  avatar: {
    width: 52,
    height: 52,
    borderRadius: 26,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 52, height: 52 },
  tools: { flexDirection: "row", gap: spacing.md },
  tool: { flex: 1 },
  foot: {
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  secondary: { alignSelf: "center", minWidth: 200, marginTop: spacing.xs },
  stack: { gap: spacing.md },
  waitBox: {
    alignItems: "stretch",
    gap: 6,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.md,
  },
  waitRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
  },
  occupied: {
    alignItems: "center",
    gap: 4,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  photoSheet: {
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
  },
  photoLarge: { width: 160, height: 160, borderRadius: 80 },
});
