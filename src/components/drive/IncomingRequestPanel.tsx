import { useState } from "react";
import { StyleSheet, View } from "react-native";
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
  Strong,
} from "../rides/SheetParts";
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

/**
 * A new request, laid out like the Ionic IncomingRequestCard: the "New
 * request" pill with the pickup date, time and distance under it, the
 * rider and the payout, the route with "· x km to pickup" and "· y km trip"
 * beside the addresses, then Accept Ride and Decline.
 */
export function IncomingRequestPanel({
  ride,
  driverLocation,
  locating,
  accepting,
  onAccept,
  onDecline,
  onHeaderLayout,
}: Props) {
  const { colors } = useTheme();
  const [declineOpen, setDeclineOpen] = useState(false);
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
  const forwardsOnDecline = ride.autoForward !== false;
  const name = riderName(ride);

  return (
    <View style={styles.root}>
      <SheetHead
        tone="gold"
        pill="New request"
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

        {forwardsOnDecline ? (
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
        <SheetButton
          title="Decline"
          icon="close-circle"
          kind="outline"
          onPress={() => {
            setReason(DECLINE_REASONS[0]);
            setDeclineOpen(true);
          }}
          disabled={accepting}
        />
      </View>

      <ConfirmSheet
        visible={declineOpen}
        tone="danger"
        icon="close-circle-outline"
        title="Decline Ride"
        message="Please select a reason. The client will be notified."
        options={DECLINE_REASONS}
        selected={reason}
        onSelect={setReason}
        cancelText="Go Back"
        onCancel={() => setDeclineOpen(false)}
        confirmText="Decline Ride"
        onConfirm={() => {
          setDeclineOpen(false);
          onDecline(reason);
        }}
      />
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
});
