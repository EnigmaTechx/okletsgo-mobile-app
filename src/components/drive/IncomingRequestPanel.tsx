import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { RideRequest } from "../../interfaces/ride";
import { formatTime } from "../../utils/address";
import { driverPayout } from "../../utils/fareCalculator";
import { formatKm, kmFromDriver, type LatLng } from "../../utils/geo";
import { spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Avatar } from "../ui/Avatar";
import { ConfirmSheet } from "../ui/ConfirmSheet";
import { RouteTimeline } from "../rides/RouteTimeline";
import {
  PersonRow,
  PriceCluster,
  SheetButton,
  SheetCard,
  SheetHead,
  SheetNote,
  Strong,
} from "../rides/SheetParts";
import { AssignDriverSheet } from "./AssignDriverSheet";
import { riderName } from "./DriverTripCards";

const DECLINE_REASONS = [
  "Schedule conflict",
  "Vehicle issue",
  "Too far from pickup",
  "Other",
];

interface Props {
  ride: RideRequest;
  /** Where the driver is now, for "x km to pickup". */
  driverLocation: LatLng | null;
  locating: boolean;
  accepting: boolean;
  onAccept: () => void;
  onDecline: (reason: string) => void;
  /** Dispatcher only: hand the ride to another driver (throws to show why not). */
  onAssign: (driverId: string, note: string) => Promise<void>;
  /** Height of the header block, for the collapsed sheet. */
  onHeaderLayout?: (height: number) => void;
}

/** "Oct 30" for the subline. */
const shortDate = (iso?: string): string => {
  const d = new Date(iso ?? "");
  return Number.isNaN(d.getTime())
    ? "ASAP"
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/** Seconds left to an ISO deadline, ticking once a second; 0 once passed. */
function useCountdown(deadline?: string): number {
  const target = deadline ? new Date(deadline).getTime() : NaN;
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!Number.isFinite(target)) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [target]);
  if (!Number.isFinite(target)) return 0;
  return Math.max(0, Math.round((target - now) / 1000));
}

const mmss = (secs: number) =>
  `${Math.floor(secs / 60)}:${String(secs % 60).padStart(2, "0")}`;

/**
 * A new request, laid out like the Ionic IncomingRequestCard: the pill
 * ("New request", or "Assigned by Andy" for a dispatched ride) with the
 * pickup date, time and distance under it, the rider and the payout, the
 * route, then Accept and Decline. The dispatcher also gets "Assign to
 * driver" and a countdown to his no-response fallback; an assigned driver
 * gets "Can't take it", which sends the ride back to the dispatcher.
 */
export function IncomingRequestPanel({
  ride,
  driverLocation,
  locating,
  accepting,
  onAccept,
  onDecline,
  onAssign,
  onHeaderLayout,
}: Props) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const [declineOpen, setDeclineOpen] = useState(false);
  const [assignOpen, setAssignOpen] = useState(false);
  const [reason, setReason] = useState(DECLINE_REASONS[0]);
  const away = kmFromDriver(driverLocation, ride.pickup);
  const awayText =
    away !== null
      ? `${formatKm(away)} to pickup`
      : locating
        ? "··· to pickup"
        : null;
  const payout = driverPayout(ride.estimatedPrice || 0);
  const tripKm = Number(ride.actualDistanceKm ?? ride.distance);
  const when = ride.scheduledTime || ride.createdAt;
  const name = riderName(ride);

  // Dispatch: the dispatcher sees his own request; an assigned driver sees
  // who sent it. Anyone else is a plain request.
  const me = currentUser?.uid;
  const isDispatcher = !!ride.dispatcherId && ride.dispatcherId === me;
  const isAssigned = !!ride.assignedBy && !isDispatcher;
  const dispatcherName = ride.dispatcherFirstName || "the dispatcher";
  const forwardsOnDecline = !ride.dispatcherId && ride.autoForward !== false;
  const countdownOn =
    isDispatcher &&
    !!ride.dispatchDeadline &&
    ride.dispatchFallback !== "keep_waiting";
  const secondsLeft = useCountdown(
    countdownOn ? ride.dispatchDeadline : undefined,
  );

  return (
    <View style={styles.root}>
      <SheetHead
        tone={isAssigned ? "blue" : "gold"}
        pill={
          isAssigned
            ? `Assigned by ${ride.assignedByFirstName || dispatcherName}`
            : "New request"
        }
        onLayout={onHeaderLayout}
        subline={
          <>
            {shortDate(when)}
            {" · "}
            <Strong>{formatTime(when)}</Strong>
            {awayText ? ` · ${awayText}` : ""}
          </>
        }
      />

      <View style={styles.body}>
        {/* No photo before the driver accepts (safety gate): initials only. */}
        <PersonRow
          avatar={
            <Avatar
              firstName={ride.clientFirstName}
              lastName={ride.clientLastName}
              size={52}
              tint={colors.secondary}
            />
          }
          name={name}
          sub="Rider"
          right={
            <PriceCluster amount={`$${payout.toFixed(2)}`} label="Est. Earn" />
          }
        />

        <SheetCard>
          <RouteTimeline
            size="lg"
            pickup={ride.pickup.address}
            dropoff={ride.destination.address}
            pickupSuffix={awayText}
            dropoffSuffix={
              Number.isFinite(tripKm) && tripKm > 0
                ? `${formatKm(tripKm)} trip`
                : null
            }
          />
        </SheetCard>

        {isAssigned && ride.assignmentNote ? (
          <SheetNote icon="chatbubble-ellipses-outline">
            {ride.assignedByFirstName || dispatcherName}: &ldquo;
            {ride.assignmentNote}&rdquo;
          </SheetNote>
        ) : null}

        {countdownOn && secondsLeft > 0 ? (
          <AppText variant="smallStrong" color="textSecondary" align="center">
            {ride.dispatchFallback === "remind"
              ? `Reminder in ${mmss(secondsLeft)}`
              : `Auto-assigns in ${mmss(secondsLeft)} if you don't respond`}
          </AppText>
        ) : forwardsOnDecline ? (
          <AppText variant="smallStrong" color="textSecondary" align="center">
            If you decline, the request is offered to the next available driver.
          </AppText>
        ) : null}
      </View>

      <View style={[styles.foot, { borderTopColor: colors.border }]}>
        <SheetButton
          title="Accept Ride"
          icon="checkmark-circle"
          kind="success"
          size="lg"
          onPress={onAccept}
          loading={accepting}
        />
        {isDispatcher ? (
          <View style={styles.pair}>
            <SheetButton
              title="Assign to driver"
              icon="person-add-outline"
              kind="outline-secondary"
              onPress={() => setAssignOpen(true)}
              disabled={accepting}
              style={styles.grow}
            />
            <SheetButton
              title="Decline"
              icon="close-circle"
              kind="outline"
              size="md"
              onPress={() => {
                setReason(DECLINE_REASONS[0]);
                setDeclineOpen(true);
              }}
              disabled={accepting}
            />
          </View>
        ) : (
          <SheetButton
            title={isAssigned ? "Can't take it" : "Decline"}
            icon="close-circle"
            kind="outline"
            onPress={() => {
              setReason(DECLINE_REASONS[0]);
              setDeclineOpen(true);
            }}
            disabled={accepting}
          />
        )}
      </View>

      <ConfirmSheet
        visible={declineOpen}
        tone="danger"
        icon="close-circle-outline"
        title={isAssigned ? "Can't take this ride?" : "Decline Ride"}
        message={
          isAssigned
            ? `It goes back to ${dispatcherName} with your reason.`
            : isDispatcher
              ? "The ride ends and the rider is asked to book again. To pass it on, use Assign instead."
              : "Please select a reason. The client will be notified."
        }
        options={DECLINE_REASONS}
        selected={reason}
        onSelect={setReason}
        cancelText="Go Back"
        onCancel={() => setDeclineOpen(false)}
        confirmText={isAssigned ? "Send back" : "Decline Ride"}
        onConfirm={() => {
          setDeclineOpen(false);
          onDecline(reason);
        }}
      />

      {isDispatcher ? (
        <AssignDriverSheet
          visible={assignOpen}
          ride={ride}
          onClose={() => setAssignOpen(false)}
          onAssign={async (driverId, note) => {
            await onAssign(driverId, note);
            setAssignOpen(false);
          }}
        />
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  body: { gap: spacing.md },
  foot: {
    gap: spacing.md,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  pair: { flexDirection: "row", gap: spacing.md },
  grow: { flex: 1 },
});
