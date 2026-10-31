import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import type { RideRequest } from "../../interfaces/ride";
import { firstLine, timeParts } from "../../utils/address";
import { driverPayout } from "../../utils/fareCalculator";
import { formatKm } from "../../utils/geo";
import { dispatchChip } from "../../utils/driverHome";
import { groupRidesByDay, upcomingDayLabel } from "../../utils/rideDayGroups";
import { timeUntil } from "../../utils/timeUntil";
import { radius, spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

/*
 * The driver dashboard's rides area: one green card for the trip in
 * progress, a "Next pickup" strip, then trips grouped by day: blue for
 * accepted, gold for new requests. Pure and prop-driven.
 */

/** "Priya R.", or the passenger's name when booked for someone else. */
export const riderName = (r: RideRequest): string => {
  if (r.passengerName) return r.passengerName;
  const last = (r.clientLastName ?? "").trim();
  return last
    ? `${r.clientFirstName} ${last[0]}.`
    : r.clientFirstName || "Rider";
};

const ACTIVE_LABEL: Record<string, string> = {
  heading_to_pickup: "Heading to pickup",
  arrived: "Arrived at pickup",
  in_progress: "Trip in progress",
};

export function ActiveTripCard({
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
            {(ACTIVE_LABEL[ride.status] ?? "Active").toUpperCase()}
          </AppText>
        </View>
        <View style={styles.inline}>
          <AppText variant="smallStrong" color="success">
            Tap to resume
          </AppText>
          <Ionicons name="chevron-forward" size={16} color={colors.success} />
        </View>
      </View>
      <AppText variant="heading">{riderName(ride)}</AppText>
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

export function NextPickupStrip({
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
      <View style={styles.flex}>
        <AppText variant="eyebrow" color="textMuted">
          NEXT PICKUP
        </AppText>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {time} {ampm} · {riderName(ride)}
        </AppText>
      </View>
      <AppText
        variant="smallStrong"
        color={until === "overdue" ? "danger" : "secondary"}
      >
        {until}
      </AppText>
    </Pressable>
  );
}

export type DriverTripTheme = "upcoming" | "requests";

/** "Request", "Today · request" or "Assigned by Andy" under the name. */
const requestTag = (ride: RideRequest, uid?: string): string => {
  if (ride.assignedBy && ride.dispatcherId !== uid)
    return `Assigned by ${ride.assignedByFirstName || "the dispatcher"}`;
  return "New request";
};

export function DriverTripRow({
  ride,
  theme,
  chip,
  uid,
  onOpen,
}: {
  ride: RideRequest;
  /** Colour of the left accent; rides mixed in a group pick by status. */
  theme?: DriverTripTheme;
  /** A small line at the right ("Pickup in 20 min", "Auto-assigns in 7 min"). */
  chip?: string | null;
  uid?: string;
  onOpen: (id: string) => void;
}) {
  const { colors } = useTheme();
  const [time, ampm] = timeParts(ride.scheduledTime);
  const km = Number(ride.actualDistanceKm ?? ride.distance);
  const isRequest = ride.status === "pending";
  const kind: DriverTripTheme = theme ?? (isRequest ? "requests" : "upcoming");
  const accent = kind === "requests" ? colors.accent : colors.secondary;
  return (
    <Pressable
      accessibilityRole="button"
      onPress={() => onOpen(ride.id as string)}
      style={({ pressed }) => [
        styles.row,
        {
          backgroundColor: colors.surface,
          borderColor: colors.border,
          opacity: pressed ? 0.9 : 1,
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
      <View style={styles.flex}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {riderName(ride)}
        </AppText>
        {isRequest ? (
          <AppText variant="small" color="accent">
            {requestTag(ride, uid)}
          </AppText>
        ) : null}
        <AppText variant="small" color="textMuted" numberOfLines={1}>
          {firstLine(ride.pickup?.address)} →{" "}
          {firstLine(ride.destination?.address)}
        </AppText>
      </View>
      <View style={styles.meta}>
        <AppText variant="bodyStrong">
          ${driverPayout(ride.estimatedPrice || 0).toFixed(2)}
        </AppText>
        {Number.isFinite(km) && km > 0 ? (
          <AppText variant="small" color="textMuted">
            {formatKm(km)}
          </AppText>
        ) : null}
        {chip ? (
          <AppText variant="small" color="accent" numberOfLines={1}>
            {chip}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

/** "1 ride", "3 rides · 1 request". */
const dayCount = (rides: RideRequest[]): string => {
  const req = rides.filter((r) => r.status === "pending").length;
  const base = rides.length === 1 ? "1 ride" : `${rides.length} rides`;
  return req
    ? `${base} · ${req === 1 ? "1 request" : `${req} requests`}`
    : base;
};

export function DriverTripGroups({
  theme,
  title,
  rides,
  now = new Date(),
  uid,
  chipFor,
  onOpen,
}: {
  theme: DriverTripTheme;
  title: string;
  rides: RideRequest[];
  now?: Date;
  uid?: string;
  chipFor?: (ride: RideRequest) => string | null;
  onOpen: (id: string) => void;
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
              {dayCount(g.rides)}
            </AppText>
          </View>
          <View style={styles.day}>
            {g.rides.map((r) => (
              <DriverTripRow
                key={r.id}
                ride={r}
                uid={uid}
                chip={chipFor?.(r)}
                onOpen={onOpen}
              />
            ))}
          </View>
        </View>
      ))}
    </View>
  );
}

/**
 * Requests for today and tomorrow, pinned above everything else so an
 * imminent request can't hide under accepted rides. Shown offline too: the
 * rider booked this driver by name.
 */
export function NeedsResponse({
  rides,
  todayCount,
  online,
  uid,
  now = new Date(),
  onOpen,
}: {
  rides: RideRequest[];
  todayCount: number;
  online: boolean;
  uid?: string;
  now?: Date;
  onOpen: (id: string) => void;
}) {
  const { colors } = useTheme();
  if (rides.length === 0) return null;
  const n = rides.length;
  return (
    <View style={styles.section}>
      <View
        style={[
          styles.alert,
          { backgroundColor: colors.surface, borderColor: colors.accent },
        ]}
      >
        <Ionicons name="alert-circle" size={22} color={colors.accent} />
        <View style={styles.flex}>
          <AppText variant="bodyStrong">
            {n === 1 ? "1 request needs" : `${n} requests need`} a response
            {todayCount ? ` · ${todayCount} today` : ""}
          </AppText>
          {!online ? (
            <AppText variant="small" color="textSecondary">
              You&apos;re offline, but these were booked with you. You can still
              respond.
            </AppText>
          ) : null}
        </View>
      </View>
      {rides.map((r) => (
        <DriverTripRow
          key={r.id}
          ride={r}
          uid={uid}
          chip={dispatchChip(r, uid, now.getTime()) ?? pickupChip(r, now)}
          onOpen={onOpen}
        />
      ))}
    </View>
  );
}

/** "Pickup in 20 min" for a request within the hour, else null. */
const pickupChip = (r: RideRequest, now: Date): string | null => {
  const until = timeUntil(r.scheduledTime, now);
  if (!until || until === "overdue")
    return until === "overdue" ? "Pickup time passed" : null;
  if (until === "now") return "Pickup now";
  return until.startsWith("in ") && until.endsWith(" min")
    ? `Pickup ${until}`
    : null;
};

const styles = StyleSheet.create({
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  flex: { flex: 1, gap: 1 },
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
  section: { gap: spacing.sm, marginTop: spacing.xl },
  alert: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
  },
  day: { gap: spacing.sm },
  dayHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 2,
  },
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
  meta: { alignItems: "flex-end", gap: 1, minWidth: 56 },
});
