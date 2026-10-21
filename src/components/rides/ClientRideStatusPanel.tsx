import { Ionicons } from "@expo/vector-icons";
import { useEffect, useState } from "react";
import { Image, Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import type { RideRequest } from "../../interfaces/ride";
import type { UserProfile } from "../../interfaces/user";
import { fetchUserProfile } from "../../services/rideService";
import { fetchEtaSeconds } from "../../services/routing";
import { radius, spacing } from "../../theme/tokens";
import { formatDayAndTime, formatTime } from "../../utils/address";
import { clientStatusLabel } from "../../utils/eta";
import { pointOf } from "../../utils/geo";
import { cad } from "../../utils/money";
import { formatDriverRating } from "../../utils/rating";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";
import { CancelRideSheet } from "./CancelRideSheet";
import { EditRideTimeSheet } from "./EditRideTimeSheet";
import { RouteTimeline } from "./RouteTimeline";

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

interface Props {
  ride: RideRequest;
  /** Collapsed shows only the status line and driver; expanded shows all. */
  expanded: boolean;
  onCancel: (reason: string) => void;
}

/**
 * The panel under the live map: status and ETA, the driver and their car,
 * the route, the total, and the cancel / end-trip action with its sheet.
 */
export function ClientRideStatusPanel({ ride, expanded, onCancel }: Props) {
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
  const statusTint =
    {
      pending: colors.accent,
      accepted: colors.secondary,
      heading_to_pickup: colors.primary,
      arrived: colors.primary,
      in_progress: colors.success,
    }[ride.status as string] ?? colors.textMuted;

  const pendingChange =
    ride.pendingTimeChange?.status === "pending"
      ? ride.pendingTimeChange
      : null;
  const canEditTime =
    (ride.status === "pending" || ride.status === "accepted") &&
    !pendingChange &&
    !!ride.scheduledTime;
  const when = new Date(ride.scheduledTime || ride.createdAt);
  const dateLabel = Number.isNaN(when.getTime())
    ? "ASAP"
    : when.toLocaleDateString("en-US", { month: "short", day: "numeric" });

  return (
    <View style={styles.root}>
      {/* Status + time */}
      <View style={styles.statusRow}>
        <View style={[styles.statusDot, { backgroundColor: statusTint }]} />
        <AppText variant="heading" style={styles.statusText}>
          {clientStatusLabel(ride, etaSeconds)}
        </AppText>
      </View>
      <View style={styles.timeRow}>
        <Ionicons name="calendar-outline" size={15} color={colors.textMuted} />
        <AppText variant="small" color="textSecondary">
          {dateLabel}
        </AppText>
        <Ionicons
          name="time-outline"
          size={15}
          color={colors.textMuted}
          style={styles.timeIcon}
        />
        <AppText variant="small" color="textSecondary">
          {formatTime(ride.scheduledTime || ride.createdAt)}
        </AppText>
        {canEditTime ? (
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Change pickup time"
            onPress={() => setEditOpen(true)}
            hitSlop={8}
            style={styles.editBtn}
          >
            <Ionicons name="create-outline" size={20} color={colors.primary} />
            <AppText variant="smallStrong" color="primary">
              Change
            </AppText>
          </Pressable>
        ) : null}
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

      {/* Driver */}
      <Pressable
        accessibilityRole="button"
        disabled={!photosVisible}
        onPress={() => setPreviewOpen(true)}
        style={[styles.driverRow, { borderColor: colors.border }]}
      >
        <View style={styles.driverText}>
          <AppText variant="title">
            {ride.driverFirstName || "Looking…"}
          </AppText>
          {ride.driverId ? (
            <AppText variant="small" color="textSecondary">
              {ride.driverVehicle || "Vehicle TBD"}
              {ride.driverVehicleColor ? ` (${ride.driverVehicleColor})` : ""}
              {plateVisible ? ` · ${ride.driverPlateNumber}` : ""}
            </AppText>
          ) : null}
          {ride.driverId ? (
            <View style={styles.rating}>
              <Ionicons name="star" size={14} color={STAR_GOLD} />
              <AppText variant="smallStrong" color="textSecondary">
                {formatDriverRating(driver?.rating)}
              </AppText>
            </View>
          ) : null}
          {!plateVisible && ride.status === "accepted" ? (
            <AppText variant="small" color="textMuted">
              Plate revealed when your driver heads out
            </AppText>
          ) : null}
        </View>
        <View style={styles.imagery}>
          {vehiclePhotoUrl ? (
            <Image source={{ uri: vehiclePhotoUrl }} style={styles.carPhoto} />
          ) : (
            <View
              style={[
                styles.carPhoto,
                styles.carFallback,
                { backgroundColor: colors.surfaceRaised },
              ]}
            >
              <Ionicons name="car-sport" size={34} color={colors.textMuted} />
            </View>
          )}
          <View
            style={[
              styles.avatarOverlay,
              {
                borderColor: colors.background,
                backgroundColor: colors.surface,
              },
            ]}
          >
            {photoUrl ? (
              <Image source={{ uri: photoUrl }} style={styles.avatarImg} />
            ) : (
              <Ionicons name="person" size={18} color={colors.textMuted} />
            )}
          </View>
        </View>
      </Pressable>

      {expanded ? (
        <>
          <RouteTimeline
            pickup={ride.pickup.address}
            dropoff={ride.destination.address}
          />

          <View style={[styles.payment, { borderColor: colors.border }]}>
            <AppText variant="eyebrow" color="textMuted">
              PAYMENT
            </AppText>
            <View style={styles.payRow}>
              <AppText variant="body" color="textSecondary">
                Total
              </AppText>
              <AppText variant="heading" color="primary">
                {cad(ride.totalClientCharge)}
              </AppText>
            </View>
          </View>

          <Button
            title={inProgress ? "End trip early" : "Cancel ride"}
            variant={inProgress ? "ghost" : "secondary"}
            onPress={() => setCancelOpen(true)}
          />
        </>
      ) : null}

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
          <View style={styles.previewImages}>
            <View
              style={[
                styles.previewAvatar,
                {
                  backgroundColor: colors.surface,
                  borderColor: colors.secondary,
                },
              ]}
            >
              {photoUrl ? (
                <Image
                  source={{ uri: photoUrl }}
                  style={styles.previewAvatarImg}
                />
              ) : (
                <Ionicons name="person" size={48} color={colors.textMuted} />
              )}
            </View>
            {vehiclePhotoUrl ? (
              <Image
                source={{ uri: vehiclePhotoUrl }}
                style={styles.previewCar}
              />
            ) : null}
          </View>
          <AppText variant="title">{ride.driverFirstName}</AppText>
          <View style={styles.rating}>
            <Ionicons name="star" size={16} color={STAR_GOLD} />
            <AppText variant="bodyStrong" color="textSecondary">
              {formatDriverRating(driver?.rating)}
            </AppText>
          </View>
          <AppText variant="body" color="textSecondary">
            {ride.driverVehicle}
            {ride.driverVehicleColor ? ` (${ride.driverVehicleColor})` : ""}
          </AppText>
          {ride.driverPlateNumber ? (
            <View style={[styles.plate, { borderColor: colors.text }]}>
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
  statusRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  statusDot: { width: 10, height: 10, borderRadius: 5 },
  statusText: { flex: 1 },
  timeRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  timeIcon: { marginLeft: spacing.sm },
  editBtn: {
    marginLeft: "auto",
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
  },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  noticeText: { flex: 1 },
  driverRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  driverText: { flex: 1, gap: 2 },
  rating: { flexDirection: "row", alignItems: "center", gap: 4 },
  imagery: { width: 96, height: 72 },
  carPhoto: { width: 96, height: 64, borderRadius: radius.md },
  carFallback: { alignItems: "center", justifyContent: "center" },
  avatarOverlay: {
    position: "absolute",
    right: -4,
    bottom: -4,
    width: 36,
    height: 36,
    borderRadius: 18,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarImg: { width: 36, height: 36 },
  payment: {
    gap: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  payRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  preview: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.md,
  },
  previewImages: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
  },
  previewAvatar: {
    width: 110,
    height: 110,
    borderRadius: 55,
    borderWidth: 3,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  previewAvatarImg: { width: 110, height: 110 },
  previewCar: { width: 150, height: 100, borderRadius: radius.lg },
  plate: {
    marginTop: spacing.sm,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.sm,
    borderRadius: radius.sm,
    borderWidth: 2,
  },
});
