import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import type { RideRequest } from "../../interfaces/ride";
import type { UserProfile } from "../../interfaces/user";
import { fetchUserProfile } from "../../services/rideService";
import { fetchEtaSeconds } from "../../services/routing";
import { formatDayAndTime, formatTime } from "../../utils/address";
import { clientHeadline, progressStep } from "../../utils/eta";
import {
  earlyCancellationFee,
  MID_TRIP_CANCELLATION_FEE,
} from "../../utils/fareCalculator";
import { FEATURES } from "../../config/features";
import { pointOf } from "../../utils/geo";
import { cad } from "../../utils/money";
import { formatDriverRating } from "../../utils/rating";
import { radius, spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { CancelRideSheet } from "./CancelRideSheet";
import { EditRideTimeSheet } from "./EditRideTimeSheet";
import { RouteTimeline } from "./RouteTimeline";
import { discountLabel } from "../../utils/promoLabels";

// SAFETY: mirrors the driver-side gate on the client's photo. The driver's
// photo is only revealed once they have accepted and started heading to
// pickup, never while the ride is merely pending or just accepted.
const DRIVER_PHOTO_VISIBLE = new Set<RideRequest["status"]>([
  "heading_to_pickup",
  "arrived",
  "confirmed",
  "en_route",
  "in_progress",
  "completed",
]);
const PLATE_VISIBLE = new Set<RideRequest["status"]>([
  "heading_to_pickup",
  "arrived",
  "in_progress",
  "completed",
]);
const STAR_GOLD = "#F5B301";
const STEPS = ["Accepted", "On the way", "Arrived", "On trip"];

interface Props {
  ride: RideRequest;
  onCancel: (reason: string) => void;
  /** Height of the headline + progress + driver block, for the collapsed panel. */
  onHeaderLayout?: (height: number) => void;
}

/**
 * The panel under the live map, laid out like the approved mockup: the
 * headline in the driver's name, the four-step progress bar, the driver
 * and their car, then (when open) the route, what you pay, and the
 * change-time / cancel actions.
 */
export function ClientRideStatusPanel({
  ride,
  onCancel,
  onHeaderLayout,
}: Props) {
  const { colors } = useTheme();
  const [driver, setDriver] = useState<UserProfile | null>(null);
  const [eta, setEta] = useState<{ key: string; seconds: number } | null>(null);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);

  // Rating is fine to show as soon as a driver is assigned; the photos stay
  // behind the reveal statuses.
  useEffect(() => {
    if (!ride.driverId) return;
    let active = true;
    fetchUserProfile(ride.driverId)
      .then((p) => active && setDriver(p))
      .catch((err) => console.warn("Driver profile unavailable:", err));
    return () => {
      active = false;
    };
  }, [ride.driverId]);

  // Road ETA whenever the driver has moved about 100 m.
  const drv = pointOf(ride.driverLocation);
  const live =
    ride.status === "heading_to_pickup" || ride.status === "in_progress";
  const target = pointOf(
    ride.status === "in_progress" ? ride.destination : ride.pickup,
  );
  const etaKey =
    live && drv && target
      ? `${drv.lat.toFixed(3)},${drv.lng.toFixed(3)}|${ride.status}`
      : null;
  useEffect(() => {
    if (!etaKey || !drv || !target) return;
    let active = true;
    fetchEtaSeconds(drv, target).then((s) => {
      if (active && s !== null) setEta({ key: etaKey, seconds: s });
    });
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [etaKey]);
  const etaSeconds = etaKey && eta?.key === etaKey ? eta.seconds : null;

  // Count down between position updates so the ETA feels continuous.
  useEffect(() => {
    if (etaSeconds === null || etaSeconds <= 0) return;
    const t = setInterval(
      () =>
        setEta((e) => (e ? { ...e, seconds: Math.max(0, e.seconds - 30) } : e)),
      30_000,
    );
    return () => clearInterval(t);
  }, [etaSeconds]);

  const photosVisible = DRIVER_PHOTO_VISIBLE.has(ride.status);
  const photoUrl = photosVisible ? driver?.photoUrl : undefined;
  const vehiclePhotoUrl = photosVisible ? driver?.vehicle?.photoUrl : undefined;
  const plateVisible =
    PLATE_VISIBLE.has(ride.status) && !!ride.driverPlateNumber;
  const inProgress = ride.status === "in_progress";
  const step = progressStep(ride.status);
  const pendingChange =
    ride.pendingTimeChange?.status === "pending"
      ? ride.pendingTimeChange
      : null;
  const canEditTime =
    (ride.status === "pending" || ride.status === "accepted") &&
    !pendingChange &&
    !!ride.scheduledTime;
  const vehicleLine = [ride.driverVehicleColor, ride.driverVehicle]
    .filter(Boolean)
    .join(" ");
  const total = ride.totalClientCharge ?? 0;
  const feeNote = inProgress
    ? ` · ${cad(MID_TRIP_CANCELLATION_FEE)} fee`
    : FEATURES.STRIPE_PAYMENTS && ride.status !== "pending"
      ? ` · ${cad(earlyCancellationFee(total))} fee`
      : "";

  return (
    <View style={styles.root}>
      <View
        style={styles.header}
        onLayout={(e) => onHeaderLayout?.(e.nativeEvent.layout.height)}
      >
        <AppText variant="title">{clientHeadline(ride, etaSeconds)}</AppText>

        {/* Progress */}
        <View style={styles.progress}>
          <View style={styles.bars}>
            {STEPS.map((label, i) => (
              <View
                key={label}
                style={[
                  styles.bar,
                  {
                    backgroundColor: i < step ? colors.success : colors.border,
                  },
                ]}
              />
            ))}
          </View>
          <View style={styles.bars}>
            {STEPS.map((label, i) => (
              <AppText
                key={label}
                variant="smallStrong"
                align="center"
                style={[
                  styles.stepLabel,
                  { color: i < step ? colors.success : colors.textMuted },
                ]}
                numberOfLines={1}
              >
                {label}
              </AppText>
            ))}
          </View>
        </View>

        {/* Driver */}
        <Pressable
          accessibilityRole="button"
          disabled={!photosVisible}
          onPress={() => setPreviewOpen(true)}
          style={styles.driverRow}
        >
          <Avatar
            firstName={ride.driverFirstName}
            lastName={ride.driverLastName}
            photoUrl={photoUrl}
            size={56}
            tint={ride.driverId ? colors.success : colors.border}
          />
          <View style={styles.driverText}>
            <View style={styles.nameRow}>
              <AppText variant="heading" numberOfLines={1}>
                {ride.driverFirstName || "Looking for a driver…"}
              </AppText>
              {ride.driverId ? (
                <View style={styles.rating}>
                  <Ionicons name="star" size={13} color={STAR_GOLD} />
                  <AppText variant="smallStrong" color="accent">
                    {formatDriverRating(driver?.rating)}
                  </AppText>
                </View>
              ) : null}
            </View>
            {ride.driverId ? (
              <AppText variant="small" color="textSecondary" numberOfLines={1}>
                {vehicleLine || "Vehicle TBD"}
                {plateVisible ? " · " : ""}
                {plateVisible ? (
                  <AppText variant="smallStrong" style={styles.plate}>
                    {ride.driverPlateNumber}
                  </AppText>
                ) : null}
              </AppText>
            ) : null}
            {ride.driverId && !plateVisible ? (
              <AppText variant="small" color="textMuted">
                Plate shown once your driver heads out
              </AppText>
            ) : null}
          </View>
          {vehiclePhotoUrl ? (
            <Image source={{ uri: vehiclePhotoUrl }} style={styles.carPhoto} />
          ) : null}
        </Pressable>
      </View>

      {pendingChange ? (
        <View
          style={[styles.notice, { backgroundColor: colors.surfaceRaised }]}
        >
          <Ionicons name="hourglass-outline" size={18} color={colors.primary} />
          <AppText variant="small" color="primary" style={styles.noticeText}>
            Waiting for your driver to approve the new pickup time (
            {formatDayAndTime(pendingChange.requestedTime)}).
          </AppText>
        </View>
      ) : null}

      {/* Route */}
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

      {/* Time and pay */}
      <View style={styles.payRow}>
        <View>
          <AppText variant="eyebrow" color="textMuted">
            PICKUP
          </AppText>
          <AppText variant="bodyStrong">
            {formatDayAndTime(ride.scheduledTime || ride.createdAt) ||
              formatTime(ride.createdAt)}
          </AppText>
        </View>
        <View style={styles.payAmount}>
          <AppText variant="eyebrow" color="textMuted">
            YOU PAY
          </AppText>
          <AppText variant="heading" color="success">
            {cad(total)}
          </AppText>
          {ride.couponCode || (ride.discountAmount ?? 0) > 0 ? (
            <AppText variant="small" color="accent">
              {discountLabel(ride)}
            </AppText>
          ) : null}
        </View>
      </View>

      {/* Actions */}
      <View style={styles.actions}>
        {canEditTime ? (
          <Button
            title="Change time"
            variant="secondary"
            onPress={() => setEditOpen(true)}
            style={styles.half}
          />
        ) : null}
        <Button
          title={inProgress ? `End trip${feeNote}` : `Cancel${feeNote}`}
          variant="danger"
          onPress={() => setCancelOpen(true)}
          style={styles.half}
        />
      </View>

      <CancelRideSheet
        visible={cancelOpen}
        ride={ride}
        onClose={() => setCancelOpen(false)}
        onConfirm={(reason) => {
          setCancelOpen(false);
          onCancel(reason);
        }}
      />
      {editOpen ? (
        <EditRideTimeSheet
          visible
          ride={ride}
          onClose={() => setEditOpen(false)}
        />
      ) : null}

      <Sheet visible={previewOpen} onClose={() => setPreviewOpen(false)}>
        <View style={styles.preview}>
          <Avatar
            firstName={ride.driverFirstName}
            lastName={ride.driverLastName}
            photoUrl={photoUrl}
            size={120}
            tint={colors.success}
          />
          {vehiclePhotoUrl ? (
            <Image
              source={{ uri: vehiclePhotoUrl }}
              style={styles.previewCar}
            />
          ) : null}
          <AppText variant="title">{ride.driverFirstName}</AppText>
          <View style={styles.rating}>
            <Ionicons name="star" size={16} color={STAR_GOLD} />
            <AppText variant="bodyStrong" color="textSecondary">
              {formatDriverRating(driver?.rating)}
            </AppText>
          </View>
          <AppText variant="body" color="textSecondary">
            {vehicleLine}
          </AppText>
          {ride.driverPlateNumber ? (
            <View style={[styles.plateBadge, { borderColor: colors.text }]}>
              <AppText variant="heading">{ride.driverPlateNumber}</AppText>
            </View>
          ) : null}
        </View>
      </Sheet>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  // The collapsed panel shows exactly this block; the route card below it
  // starts under the fold.
  header: { gap: spacing.md, paddingBottom: spacing.xs },
  progress: { gap: 6 },
  bars: { flexDirection: "row", gap: 6 },
  bar: { flex: 1, height: 6, borderRadius: 3 },
  stepLabel: { flex: 1, fontSize: 11, lineHeight: 14 },
  driverRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  driverText: { flex: 1, gap: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  rating: { flexDirection: "row", alignItems: "center", gap: 3 },
  plate: { letterSpacing: 1 },
  carPhoto: { width: 72, height: 48, borderRadius: radius.sm },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  noticeText: { flex: 1 },
  card: {
    marginTop: spacing.lg,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    marginTop: spacing.xs,
  },
  payAmount: { alignItems: "flex-end" },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xl },
  half: { flex: 1 },
  preview: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  previewCar: { width: 180, height: 110, borderRadius: radius.lg },
  plateBadge: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 2,
  },
});
