import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import type { RideRequest } from "../../interfaces/ride";
import { fetchDriverSchedule } from "../../services/driverService";
import { reviewRideTimeChange } from "../../services/rideService";
import { formatDayAndTime } from "../../utils/address";
import { radius, spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";

/** How close another scheduled ride has to be before we warn of a clash. */
const CONFLICT_WINDOW_MS = 60 * 60 * 1000;

/**
 * Shown to the assigned driver when the rider asked for a material earlier
 * pickup time on an accepted ride. Approve or decline; the server applies
 * or reverts. A soft conflict check warns, never blocks.
 */
export function TimeChangeReviewCard({ ride }: { ride: RideRequest }) {
  const { colors } = useTheme();
  const toast = useToast();
  const change = ride.pendingTimeChange;
  const requestedAt = change?.requestedAt ?? null;
  const [busy, setBusy] = useState<{
    key: string | null;
    action: "approve" | "decline";
  } | null>(null);
  const [conflict, setConflict] = useState<{
    key: string | null;
    clash: boolean;
  } | null>(null);

  useEffect(() => {
    if (!change || !ride.driverId) return;
    let active = true;
    const requestedMs = new Date(change.requestedTime).getTime();
    fetchDriverSchedule(ride.driverId)
      .then((rides) => {
        if (!active) return;
        const clash = rides.some(
          (o) =>
            o.id !== ride.id &&
            !!o.scheduledTime &&
            Math.abs(new Date(o.scheduledTime).getTime() - requestedMs) <
              CONFLICT_WINDOW_MS,
        );
        setConflict({ key: requestedAt, clash });
      })
      .catch((err) => console.warn("Conflict check failed:", err));
    return () => {
      active = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [requestedAt, ride.driverId, ride.id]);

  if (!change || change.status !== "pending") return null;
  const submitting = busy?.key === requestedAt ? busy.action : null;
  const clash = conflict?.key === requestedAt && conflict.clash;

  const decide = async (approve: boolean) => {
    setBusy({ key: requestedAt, action: approve ? "approve" : "decline" });
    try {
      await reviewRideTimeChange(ride.id as string, approve);
      toast(
        approve
          ? "Pickup time updated."
          : "Change declined. Original time kept.",
        {
          type: "success",
        },
      );
      // The ride listener clears pendingTimeChange and this card goes away.
    } catch (err) {
      toast(
        (err instanceof Error && err.message) ||
          "Couldn't submit your decision. Please try again.",
        { type: "error" },
      );
      setBusy(null);
    }
  };

  const earlier =
    new Date(change.requestedTime).getTime() <
    new Date(change.previousTime).getTime();

  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surfaceRaised, borderColor: colors.primary },
      ]}
    >
      <View style={styles.inline}>
        <Ionicons name="hourglass-outline" size={20} color={colors.primary} />
        <AppText variant="bodyStrong">
          Rider wants {earlier ? "an earlier" : "a later"} pickup
        </AppText>
      </View>
      <View style={[styles.times, { backgroundColor: colors.surface }]}>
        <AppText variant="small" color="textMuted" style={styles.strike}>
          {formatDayAndTime(change.previousTime)}
        </AppText>
        <Ionicons name="arrow-forward" size={16} color={colors.textMuted} />
        <AppText variant="bodyStrong" color="primary">
          {formatDayAndTime(change.requestedTime)}
        </AppText>
      </View>
      {clash ? (
        <View style={styles.inline}>
          <Ionicons name="warning-outline" size={16} color={colors.accent} />
          <AppText variant="small" color="accent">
            Heads up: this is close to another of your scheduled rides.
          </AppText>
        </View>
      ) : null}
      <View style={styles.actions}>
        <Button
          title="Decline"
          variant="secondary"
          onPress={() => void decide(false)}
          loading={submitting === "decline"}
          disabled={!!submitting}
          style={styles.half}
        />
        <Button
          title="Approve"
          onPress={() => void decide(true)}
          loading={submitting === "approve"}
          disabled={!!submitting}
          style={styles.half}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  times: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  strike: { textDecorationLine: "line-through" },
  actions: { flexDirection: "row", gap: spacing.md },
  half: { flex: 1 },
});
