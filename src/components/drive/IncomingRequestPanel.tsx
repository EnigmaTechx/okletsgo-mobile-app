import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import type { RideRequest } from "../../interfaces/ride";
import { formatDayAndTime } from "../../utils/address";
import { driverPayout, getActivePricing } from "../../utils/fareCalculator";
import { formatKm, kmFromDriver, type LatLng } from "../../utils/geo";
import { cad } from "../../utils/money";
import { radius, spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { ReasonSheet } from "../ui/ReasonSheet";
import { RouteTimeline } from "../rides/RouteTimeline";
import { riderName } from "./DriverTripCards";

const DECLINE_REASONS = [
  "Schedule conflict",
  "Vehicle issue",
  "Too far from pickup",
  "Other",
];

interface Props {
  ride: RideRequest;
  /** Where the driver is now, for "x km away". */
  driverLocation: LatLng | null;
  locating: boolean;
  accepting: boolean;
  onAccept: () => void;
  onDecline: (reason: string) => void;
}

/** Header height for the collapsed sheet: title + rider row. */
export const REQUEST_PANEL_HEADER = 150;

/**
 * A new request, laid out like the approved mockup: who, from where (and
 * how far away), to where, when, the trip length and the driver's payout,
 * then Accept or Decline with a reason.
 */
export function IncomingRequestPanel({
  ride,
  driverLocation,
  locating,
  accepting,
  onAccept,
  onDecline,
}: Props) {
  const { colors } = useTheme();
  const [declineOpen, setDeclineOpen] = useState(false);
  const away = kmFromDriver(driverLocation, ride.pickup);
  const payout = driverPayout(ride.estimatedPrice || 0);
  const share = getActivePricing().driverSharePercent;
  const tripKm = Number(ride.actualDistanceKm ?? ride.distance);

  return (
    <View style={styles.root}>
      <AppText variant="eyebrow" color="accent">
        NEW RIDE REQUEST
      </AppText>
      <View style={styles.riderRow}>
        <Avatar
          firstName={ride.clientFirstName}
          lastName={ride.clientLastName}
          size={52}
          tint={colors.secondary}
        />
        <View style={styles.flex}>
          <AppText variant="title">{riderName(ride)} wants a ride</AppText>
          <AppText variant="small" color="textMuted">
            {away !== null
              ? `${formatKm(away)} from you`
              : locating
                ? "Locating you…"
                : "Distance unavailable"}
          </AppText>
        </View>
      </View>

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
        />
      </View>

      <View style={styles.facts}>
        <Fact
          label="PICKUP"
          value={
            formatDayAndTime(ride.scheduledTime || ride.createdAt) || "ASAP"
          }
        />
        <Fact
          label="TRIP"
          value={Number.isFinite(tripKm) && tripKm > 0 ? formatKm(tripKm) : "—"}
        />
        <Fact label="YOUR PAYOUT" value={cad(payout)} tint={colors.success} />
      </View>
      <AppText variant="small" color="textMuted">
        Payout is your {share}% share of the {cad(ride.estimatedPrice)} fare.
        {ride.couponCode
          ? " The rider is using a promo code; you are paid in full either way."
          : ""}
      </AppText>

      <View style={styles.actions}>
        <Button
          title="Accept ride"
          variant="success"
          onPress={onAccept}
          loading={accepting}
        />
        <Button
          title="Decline · give a reason"
          variant="secondary"
          onPress={() => setDeclineOpen(true)}
          disabled={accepting}
        />
      </View>

      <ReasonSheet
        visible={declineOpen}
        title="Decline ride"
        message="Please select a reason. The rider will be told."
        reasons={DECLINE_REASONS}
        cancelLabel="Go back"
        confirmLabel="Decline ride"
        onCancel={() => setDeclineOpen(false)}
        onConfirm={(reason) => {
          setDeclineOpen(false);
          onDecline(reason);
        }}
      />
    </View>
  );
}

function Fact({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.fact,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <AppText variant="eyebrow" color="textMuted">
        {label}
      </AppText>
      <AppText
        variant="bodyStrong"
        numberOfLines={1}
        style={tint ? { color: tint } : undefined}
      >
        {value}
      </AppText>
      <Ionicons name="ellipse" size={0} />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  riderRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  card: {
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  facts: { flexDirection: "row", gap: spacing.sm },
  fact: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
  actions: { gap: spacing.sm, marginTop: spacing.sm },
});
