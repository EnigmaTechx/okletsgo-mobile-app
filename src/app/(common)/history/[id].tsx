import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useNavigation } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { RatingDialog } from "../../../components/rides/RatingDialog";
import { RouteTimeline } from "../../../components/rides/RouteTimeline";
import { AppText } from "../../../components/ui/AppText";
import { Avatar } from "../../../components/ui/Avatar";
import { Button } from "../../../components/ui/Button";
import { LoadingScreen } from "../../../components/ui/LoadingScreen";
import { Screen } from "../../../components/ui/Screen";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import type { RideRequest } from "../../../interfaces/ride";
import type { UserProfile } from "../../../interfaces/user";
import { fetchUserProfile, subscribeRide } from "../../../services/rideService";
import {
  durationLabel,
  formatShortDateTime,
  formatTime,
} from "../../../utils/address";
import { driverPayout } from "../../../utils/fareCalculator";
import { cad } from "../../../utils/money";
import { formatDriverRating } from "../../../utils/rating";
import { radius, spacing } from "../../../theme/tokens";
import { discountLabel } from "../../../utils/promoLabels";

const STAR_GOLD = "#F5B301";

/**
 * One past ride, for either role: status, route with times, the other
 * party, the payment breakdown, and why it was declined or cancelled.
 * Riders can rate a completed trip from here.
 */
export default function RideHistoryDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const navigation = useNavigation();
  const { colors } = useTheme();
  const { userProfile } = useAuth();
  const isDriver = userProfile?.role === "driver";

  const [ride, setRide] = useState<RideRequest | null | undefined>(undefined);
  const [other, setOther] = useState<UserProfile | null>(null);
  const [rateOpen, setRateOpen] = useState(false);
  const [optimisticRating, setOptimisticRating] = useState<number | null>(null);

  useEffect(() => {
    if (!id) return;
    return subscribeRide(id, setRide, () => setRide(null));
  }, [id]);

  useEffect(() => {
    if (ride)
      navigation.setOptions({
        title: formatShortDateTime(ride.scheduledTime || ride.createdAt),
      });
  }, [ride, navigation]);

  const otherUid = isDriver ? ride?.clientId : ride?.driverId;
  useEffect(() => {
    if (!otherUid) return;
    let active = true;
    fetchUserProfile(otherUid)
      .then((p) => active && setOther(p))
      .catch((err) => console.error("Error fetching profile:", err));
    return () => {
      active = false;
    };
  }, [otherUid]);

  if (ride === undefined) return <LoadingScreen />;
  if (ride === null) {
    return (
      <Screen edges={["left", "right"]}>
        <View style={styles.center}>
          <AppText variant="body" color="textMuted">
            Ride not found.
          </AppText>
        </View>
      </Screen>
    );
  }

  const cancelled = ride.status === "cancelled";
  const declined = ride.status === "declined";
  const completed = ride.status === "completed";
  // A cancelled ride only shows a pickup time if the rider was actually
  // picked up; the scheduled time would imply a pickup that never happened.
  const pickupTime = cancelled
    ? ride.tripStartedAt
      ? formatTime(ride.tripStartedAt)
      : null
    : formatTime(ride.tripStartedAt) || formatTime(ride.scheduledTime) || null;
  const dropoffTime =
    completed && ride.tripCompletedAt ? formatTime(ride.tripCompletedAt) : null;
  const duration = durationLabel(ride.tripStartedAt, ride.tripCompletedAt);

  const shownRating =
    typeof ride.driverRatingByClient === "number"
      ? ride.driverRatingByClient
      : optimisticRating;
  const statusTint = completed
    ? colors.success
    : cancelled
      ? colors.danger
      : declined
        ? colors.accent
        : colors.textMuted;
  const fee = ride.cancellationFee ?? 0;
  const displayTotal = cancelled
    ? isDriver
      ? driverPayout(fee)
      : fee
    : declined
      ? 0
      : isDriver
        ? driverPayout(ride.estimatedPrice)
        : ride.estimatedPrice;
  const lastDecline = (ride.declinedBy || [])[
    ride.declinedBy ? ride.declinedBy.length - 1 : 0
  ];
  const card = { backgroundColor: colors.surface, borderColor: colors.border };

  return (
    <Screen scroll edges={["left", "right"]}>
      <View style={styles.section}>
        <View style={styles.statusRow}>
          <View style={[styles.badge, { backgroundColor: statusTint }]}>
            <AppText variant="eyebrow" style={{ color: colors.background }}>
              {ride.status.toUpperCase()}
            </AppText>
          </View>
          <AppText variant="small" color="textMuted">
            {ride.distance != null ? `${ride.distance} km` : ""}
            {duration ? ` · ${duration}` : ""}
          </AppText>
        </View>

        {!isDriver && completed ? (
          typeof shownRating === "number" ? (
            <Stars label="You rated this trip" value={shownRating} />
          ) : (
            <Button
              title="Rate your driver"
              variant="secondary"
              onPress={() => setRateOpen(true)}
            />
          )
        ) : null}
        {isDriver &&
        completed &&
        typeof ride.driverRatingByClient === "number" ? (
          <View style={styles.gap}>
            <Stars
              label="Your rating for this trip"
              value={ride.driverRatingByClient}
            />
            {ride.clientReviewText ? (
              <AppText
                variant="small"
                color="textSecondary"
                style={styles.quote}
              >
                “{ride.clientReviewText}”
              </AppText>
            ) : null}
          </View>
        ) : null}
      </View>

      <View style={[styles.card, card]}>
        <RouteTimeline
          pickup={ride.pickup.address}
          dropoff={ride.destination.address}
          pickupAside={
            pickupTime ? <Aside label="Pickup" value={pickupTime} /> : undefined
          }
          dropoffAside={
            dropoffTime ? (
              <Aside label="Drop-off" value={dropoffTime} />
            ) : undefined
          }
        />
      </View>

      <View style={[styles.card, card]}>
        <AppText variant="eyebrow" color="textMuted">
          {isDriver ? "PASSENGER" : "DRIVER"}
        </AppText>
        <View style={styles.personRow}>
          <View style={styles.flex}>
            <AppText variant="heading">
              {isDriver
                ? ride.clientFirstName || "Passenger"
                : ride.driverFirstName || "Driver"}
            </AppText>
            {!isDriver && ride.driverVehicle ? (
              <AppText variant="small" color="textSecondary">
                {ride.driverVehicle}
              </AppText>
            ) : null}
            {!isDriver && other ? (
              <View style={styles.inline}>
                <Ionicons name="star" size={14} color={STAR_GOLD} />
                <AppText variant="small" color="textSecondary">
                  {formatDriverRating(other.rating)}
                </AppText>
              </View>
            ) : null}
          </View>
          {!isDriver && other?.vehicle?.photoUrl ? (
            <Image
              source={{ uri: other.vehicle.photoUrl }}
              style={styles.carPhoto}
            />
          ) : null}
          <Avatar
            firstName={isDriver ? ride.clientFirstName : ride.driverFirstName}
            photoUrl={other?.photoUrl}
            size={52}
            tint={isDriver ? colors.secondary : colors.primary}
          />
        </View>
      </View>

      <View style={[styles.card, card]}>
        <AppText variant="eyebrow" color="textMuted">
          {isDriver ? "BREAKDOWN" : "PAYMENT"}
        </AppText>
        {!isDriver && !cancelled && !declined && ride.platformFee != null ? (
          <>
            <Row label="Trip cost" value={cad(ride.estimatedPrice)} />
            <Row label="Service" value={cad(ride.platformFee)} />
            {ride.discountAmount ? (
              <Row
                label={
                  ride.promoId
                    ? discountLabel(ride)
                    : `Discount${ride.couponCode ? ` (${ride.couponCode})` : ""}`
                }
                value={`-${cad(ride.discountAmount)}`}
                tint={colors.success}
              />
            ) : null}
            <Total
              label="Total"
              value={cad(
                ride.totalClientCharge ??
                  ride.estimatedPrice + ride.platformFee,
              )}
            />
          </>
        ) : (
          <>
            {!cancelled && !declined ? (
              <Row
                label={
                  isDriver ? "Total distance (inc. commute)" : "Trip distance"
                }
                value={`${isDriver && ride.totalKmTravelled ? ride.totalKmTravelled : ride.distance} km`}
              />
            ) : null}
            <Total
              label={
                isDriver
                  ? "Est. earnings"
                  : declined
                    ? "No charge"
                    : "Total billed"
              }
              value={cad(displayTotal)}
            />
          </>
        )}
      </View>

      {declined ? (
        <View style={[styles.card, card]}>
          <AppText variant="eyebrow" color="accent">
            DECLINED BY DRIVER
          </AppText>
          <Row
            label="Reason"
            value={lastDecline?.reason || "No reason provided"}
          />
          <AppText variant="small" color="textMuted">
            No charge was applied. You can book again with another driver.
          </AppText>
        </View>
      ) : null}
      {cancelled ? (
        <View style={[styles.card, card]}>
          <AppText variant="eyebrow" color="danger">
            CANCELLED BY {(ride.cancelledBy || "system").toUpperCase()}
          </AppText>
          <Row
            label="Reason"
            value={ride.cancellationReason || "No reason provided"}
          />
          {fee > 0 ? (
            <Total
              label="Cancellation fee"
              value={cad(fee)}
              tint={colors.danger}
            />
          ) : (
            <AppText variant="small" color="textMuted">
              No fee was charged for this cancellation.
            </AppText>
          )}
        </View>
      ) : null}

      {ride.driverId && rateOpen ? (
        <RatingDialog
          visible
          rideId={ride.id as string}
          driverName={ride.driverFirstName || "your driver"}
          driverPhotoUrl={other?.photoUrl}
          onClose={(stars) => {
            setRateOpen(false);
            if (stars) setOptimisticRating(stars);
          }}
        />
      ) : null}
    </Screen>
  );
}

function Stars({ label, value }: { label: string; value: number }) {
  const { colors } = useTheme();
  return (
    <View style={styles.inline}>
      <AppText variant="smallStrong" color="textSecondary">
        {label}
      </AppText>
      <View style={styles.starRow}>
        {[1, 2, 3, 4, 5].map((n) => (
          <Ionicons
            key={n}
            name="star"
            size={16}
            color={n <= value ? STAR_GOLD : colors.border}
          />
        ))}
      </View>
    </View>
  );
}

function Aside({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.aside}>
      <AppText variant="eyebrow" color="textMuted">
        {label.toUpperCase()}
      </AppText>
      <AppText variant="smallStrong">{value}</AppText>
    </View>
  );
}

function Row({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: string;
}) {
  return (
    <View style={styles.row}>
      <AppText
        variant="body"
        color="textSecondary"
        style={tint ? { color: tint } : undefined}
      >
        {label}
      </AppText>
      <AppText
        variant="bodyStrong"
        style={[styles.rowValue, tint ? { color: tint } : null]}
      >
        {value}
      </AppText>
    </View>
  );
}

function Total({
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
    <View style={[styles.row, styles.total, { borderTopColor: colors.border }]}>
      <AppText variant="heading">{label}</AppText>
      <AppText variant="title" style={{ color: tint ?? colors.primary }}>
        {value}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  center: { alignItems: "center", paddingTop: 64 },
  section: { paddingTop: spacing.md, gap: spacing.md },
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  badge: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: radius.sm },
  gap: { gap: spacing.xs },
  quote: { fontStyle: "italic" },
  card: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  personRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  flex: { flex: 1, gap: 2 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  starRow: { flexDirection: "row", gap: 2 },
  carPhoto: { width: 64, height: 48, borderRadius: radius.sm },
  aside: { alignItems: "flex-end" },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: spacing.md,
  },
  rowValue: { flexShrink: 1, textAlign: "right" },
  total: {
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
});
