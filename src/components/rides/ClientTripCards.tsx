import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import type { RideRequest } from "../../interfaces/ride";
import { firstLine, timeParts } from "../../utils/address";
import { groupRidesByDay, upcomingDayLabel } from "../../utils/rideDayGroups";
import { timeUntil } from "../../utils/timeUntil";
import { radius, spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

/*
 * The rider's home cards: one green live card for a ride in progress, a
 * "Next ride" strip, then rides grouped by day: blue for confirmed, gold for
 * requests still waiting on the driver. Pure and prop-driven.
 */

const price = (r: RideRequest): string =>
  `$${(r.totalClientCharge ?? r.estimatedPrice ?? 0).toFixed(2)}`;

const vehicleLine = (r: RideRequest): string =>
  [r.driverVehicleColor, r.driverVehicle].filter(Boolean).join(" ");

const LIVE_LABEL: Record<string, string> = {
  heading_to_pickup: "Driver on the way",
  arrived: "Driver has arrived",
  in_progress: "On your way",
};

// ─── Live ride ──────────────────────────────────────────────────────────────

export function ClientLiveCard({
  ride,
  onOpen,
}: {
  ride: RideRequest;
  onOpen: (id: string) => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(ride.id as string)}
      style={({ pressed }) => [
        styles.live,
        {
          backgroundColor: colors.surface,
          borderColor: colors.success,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={styles.liveTop}>
        <View style={[styles.pill, { backgroundColor: colors.success }]}>
          <View
            style={[styles.liveDot, { backgroundColor: colors.onSuccess }]}
          />
          <AppText variant="eyebrow" style={{ color: colors.onSuccess }}>
            {(LIVE_LABEL[ride.status] ?? "Live").toUpperCase()}
          </AppText>
        </View>
        <View style={styles.inline}>
          <AppText variant="smallStrong" color="success">
            Live map
          </AppText>
          <Ionicons name="chevron-forward" size={16} color={colors.success} />
        </View>
      </View>
      <AppText variant="heading">
        {ride.driverFirstName || "Your driver"}
        {vehicleLine(ride) ? (
          <AppText variant="body" color="textMuted">
            {"  ·  "}
            {vehicleLine(ride)}
          </AppText>
        ) : null}
      </AppText>
      <View style={styles.routeLines}>
        <View style={styles.inline}>
          <Ionicons name="location-sharp" size={15} color={colors.secondary} />
          <AppText variant="small" color="textSecondary" numberOfLines={1}>
            {firstLine(ride.pickup?.address)}
          </AppText>
        </View>
        <View style={styles.inline}>
          <Ionicons name="flag-sharp" size={15} color={colors.primary} />
          <AppText variant="small" color="textSecondary" numberOfLines={1}>
            {firstLine(ride.destination?.address)}
          </AppText>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Next ride strip ────────────────────────────────────────────────────────

export function ClientNextStrip({
  ride,
  now = new Date(),
  onOpen,
}: {
  ride: RideRequest;
  now?: Date;
  onOpen: (id: string) => void;
}) {
  const { colors } = useTheme();
  const [time, ampm] = timeParts(ride.scheduledTime);
  const until = timeUntil(ride.scheduledTime, now);
  const overdue = until === "overdue";
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(ride.id as string)}
      style={({ pressed }) => [
        styles.strip,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
        },
      ]}
    >
      <Ionicons name="navigate-circle" size={28} color={colors.secondary} />
      <View style={styles.stripText}>
        <AppText variant="eyebrow" color="textMuted">
          NEXT RIDE
        </AppText>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {time} {ampm} · {ride.driverFirstName || "your driver"}
        </AppText>
      </View>
      <AppText variant="smallStrong" color={overdue ? "danger" : "secondary"}>
        {until}
      </AppText>
    </Pressable>
  );
}

// ─── Rides grouped by day ───────────────────────────────────────────────────

export type ClientTripTheme = "upcoming" | "requests";

export function ClientTripRow({
  ride,
  theme,
  expired = false,
  dismissing = false,
  onOpen,
  onDismiss,
}: {
  ride: RideRequest;
  theme: ClientTripTheme;
  expired?: boolean;
  dismissing?: boolean;
  onOpen: (id: string) => void;
  onDismiss?: (id: string) => void;
}) {
  const { colors } = useTheme();
  const [time, ampm] = timeParts(ride.scheduledTime);
  const accent = expired
    ? colors.textMuted
    : theme === "requests"
      ? colors.accent
      : colors.secondary;
  return (
    <Pressable
      accessibilityRole="button"
      disabled={expired}
      onPress={() => onOpen(ride.id as string)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: expired ? 0.7 : pressed ? 0.9 : 1,
        },
      ]}
    >
      <View style={[styles.accent, { backgroundColor: accent }]} />
      <View style={styles.time}>
        <AppText variant="heading" numberOfLines={1}>
          {time}
        </AppText>
        <AppText variant="smallStrong" color="textMuted">
          {ampm}
        </AppText>
      </View>
      <View style={styles.rowText}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {expired ? "Request expired" : ride.driverFirstName || "Your driver"}
        </AppText>
        {theme === "requests" ? (
          <AppText variant="small" color={expired ? "textMuted" : "accent"}>
            {expired
              ? `${ride.driverFirstName || "The driver"} didn't accept in time`
              : "Waiting to accept"}
          </AppText>
        ) : null}
        <AppText variant="small" color="textMuted" numberOfLines={1}>
          {firstLine(ride.pickup?.address)} →{" "}
          {firstLine(ride.destination?.address)}
        </AppText>
      </View>
      <View style={styles.meta}>
        {expired && onDismiss ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => onDismiss(ride.id as string)}
            hitSlop={8}
            disabled={dismissing}
            style={[styles.dismiss, { borderColor: colors.border }]}
          >
            {dismissing ? (
              <ActivityIndicator color={colors.textMuted} />
            ) : (
              <AppText variant="smallStrong" color="text">
                Dismiss
              </AppText>
            )}
          </Pressable>
        ) : (
          <AppText variant="bodyStrong">{price(ride)}</AppText>
        )}
      </View>
    </Pressable>
  );
}

export function ClientTripGroups({
  theme,
  title,
  rides,
  now = new Date(),
  isExpired,
  dismissingIds,
  onOpen,
  onDismiss,
}: {
  theme: ClientTripTheme;
  title: string;
  rides: RideRequest[];
  now?: Date;
  isExpired?: (r: RideRequest) => boolean;
  dismissingIds?: Set<string>;
  onOpen: (id: string) => void;
  onDismiss?: (id: string) => void;
}) {
  const { colors } = useTheme();
  if (rides.length === 0) return null;
  const groups = groupRidesByDay(rides, now, "asc", upcomingDayLabel);
  const tint = theme === "requests" ? colors.accent : colors.secondary;
  return (
    <View style={styles.section}>
      <AppText variant="eyebrow" style={{ color: tint }}>
        {title.toUpperCase()}
      </AppText>
      {groups.map((g) => (
        <View key={g.key} style={styles.day}>
          <View style={styles.dayHead}>
            <AppText
              variant="smallStrong"
              color={g.label.startsWith("Today") ? "text" : "textSecondary"}
            >
              {g.label}
            </AppText>
            <AppText variant="small" color="textMuted">
              {g.rides.length === 1 ? "1 ride" : `${g.rides.length} rides`}
            </AppText>
          </View>
          <View style={styles.dayList}>
            {g.rides.map((r) => (
              <ClientTripRow
                key={r.id}
                ride={r}
                theme={theme}
                expired={isExpired?.(r) ?? false}
                dismissing={dismissingIds?.has(r.id as string) ?? false}
                onOpen={onOpen}
                onDismiss={onDismiss}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  live: {
    borderRadius: radius.lg,
    borderWidth: 1.5,
    padding: spacing.lg,
    gap: spacing.sm,
  },
  liveTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  liveDot: { width: 7, height: 7, borderRadius: 4 },
  routeLines: { gap: 4, marginTop: 2 },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  stripText: { flex: 1 },
  section: { gap: spacing.sm, marginTop: spacing.xl },
  day: { gap: spacing.sm },
  dayHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 2,
  },
  dayList: { gap: spacing.sm },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingRight: spacing.lg,
    paddingLeft: spacing.md,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  accent: { position: "absolute", left: 0, top: 0, bottom: 0, width: 4 },
  time: { width: 68, alignItems: "center" },
  dismiss: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  rowText: { flex: 1, gap: 1 },
  meta: { alignItems: "flex-end", gap: 1, minWidth: 56 },
});
