import React, { useCallback, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  RefreshControl,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  type ViewStyle,
} from "react-native";
import { useFocusEffect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import type { RideRequest } from "../../interfaces/ride";
import { rideCost, rideKm } from "../../services/adminStatsService";
import { rideEarned } from "../../services/driverStatsService";
import { formatTime } from "../../utils/address";
import { timeUntil } from "../../utils/timeUntil";
import { fontFamily, radius, spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { Screen } from "../ui/Screen";

/**
 * The building blocks of the owner's Admin section, ported from the Ionic
 * admin pages (AdminHome.css): tiles, pills, rows, the bar chart, and the
 * loader every page shares (fetch on focus, pull to refresh, retry).
 */

// ─── Formatting ─────────────────────────────────────────────────────────────

export const money = (n: number): string =>
  `$${n.toLocaleString(undefined, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

export const fmtKm = (km: number): string =>
  km >= 10 ? String(Math.round(km)) : km.toFixed(1);

export const shortPlace = (address?: string): string => {
  const first = (address ?? "").split(",")[0].trim();
  return first || "Unknown";
};

export const personName = (
  first?: string,
  last?: string,
  fallback = "—",
): string => [first, last].filter(Boolean).join(" ") || fallback;

export const vehicleLabel = (p: {
  vehicle?: { color?: string; make?: string; model?: string } | null;
}): string => {
  const v = p.vehicle;
  if (!v) return "No vehicle on file";
  return (
    [v.color, v.make, v.model].filter(Boolean).join(" ") || "Vehicle on file"
  );
};

export const riderName = (r: RideRequest): string =>
  personName(r.clientFirstName, r.clientLastName, "Rider");

/** "3 days ago" / "Today" for the last completed ride. */
export const agoLabel = (iso?: string): string => {
  if (!iso) return "No rides yet";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "—";
  const days = Math.floor((Date.now() - t) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
};

/** "••• ••• 0100": enough to recognise a rider, not a contact list. */
export const maskedPhone = (phone?: string): string => {
  const digits = (phone ?? "").replace(/\D/g, "");
  if (digits.length < 4) return "No phone on file";
  const tail = digits.slice(-4);
  const hidden = "•".repeat(Math.min(6, Math.max(3, digits.length - 4)));
  return `${hidden.replace(/(.{3})(?=.)/g, "$1 ")} ${tail}`;
};

export const whenLabel = (iso?: string): string => {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  return `${d.toLocaleDateString(undefined, {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: d.getFullYear() === new Date().getFullYear() ? undefined : "numeric",
  })} · ${formatTime(iso)}`;
};

export const countLabel = (n: number, noun: string): string =>
  n === 1 ? `1 ${noun}` : `${n} ${noun}s`;

// ─── Loader ─────────────────────────────────────────────────────────────────

/**
 * Fetch on every focus (first open and each return from a sub-page), pull
 * to refresh, retry. `load` must be stable (useCallback in the screen).
 */
export function useAdminLoad<T>(load: () => Promise<T>, errorText: string) {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const run = useCallback(
    async (pull = false) => {
      if (pull) setRefreshing(true);
      setError(null);
      try {
        setData(await load());
      } catch (e) {
        console.error(errorText, e);
        setError(errorText);
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [load, errorText],
  );

  useFocusEffect(
    useCallback(() => {
      void run();
    }, [run]),
  );

  return {
    data,
    loading,
    error,
    refreshing,
    reload: () => void run(),
    onRefresh: () => void run(true),
  };
}

// ─── Page shell ─────────────────────────────────────────────────────────────

export function AdminScreen({
  children,
  refreshing = false,
  onRefresh,
  gap = spacing.lg,
}: {
  children: React.ReactNode;
  refreshing?: boolean;
  onRefresh?: () => void;
  gap?: number;
}) {
  const { colors } = useTheme();
  return (
    <Screen padded={false} edges={["left", "right"]}>
      <ScrollView
        contentContainerStyle={[styles.page, { gap }]}
        refreshControl={
          onRefresh ? (
            <RefreshControl
              refreshing={refreshing}
              onRefresh={onRefresh}
              tintColor={colors.primary}
              colors={[colors.primary]}
            />
          ) : undefined
        }
      >
        {children}
      </ScrollView>
    </Screen>
  );
}

export function Loading() {
  const { colors } = useTheme();
  return (
    <View style={styles.loading}>
      <ActivityIndicator color={colors.primary} />
    </View>
  );
}

export function ErrorBox({
  message,
  onRetry,
}: {
  message: string;
  onRetry: () => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: colors.surface, borderColor: colors.danger },
      ]}
    >
      <AppText variant="body" color="danger">
        {message}
      </AppText>
      <Button
        title="Try again"
        variant="secondary"
        block={false}
        onPress={onRetry}
      />
    </View>
  );
}

export function EmptyBox({ text }: { text: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.box,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <AppText variant="body" color="textMuted" align="center">
        {text}
      </AppText>
    </View>
  );
}

/** A grouped list container: rows separated by hairlines. */
export function Group({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.group,
        { backgroundColor: colors.surface, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

export function SectionHead({
  title,
  caption,
  action,
}: {
  title: string;
  caption?: string;
  action?: { label: string; onPress: () => void };
}) {
  return (
    <View style={styles.sectionHead}>
      <AppText variant="heading">{title}</AppText>
      {action ? (
        <Pressable accessibilityRole="button" onPress={action.onPress}>
          <AppText variant="smallStrong" color="primary">
            {action.label}
          </AppText>
        </Pressable>
      ) : caption ? (
        <AppText variant="small" color="textMuted">
          {caption}
        </AppText>
      ) : null}
    </View>
  );
}

export function Caption({ text }: { text: string }) {
  return (
    <AppText variant="small" color="textMuted">
      {text}
    </AppText>
  );
}

// ─── Tiles ──────────────────────────────────────────────────────────────────

export function Tiles({
  items,
  loading = false,
}: {
  items: { label: string; value: string | number | undefined }[];
  loading?: boolean;
}) {
  const { colors } = useTheme();
  const three = items.length === 3;
  return (
    <View style={styles.tiles}>
      {items.map((t) => (
        <View
          key={t.label}
          style={[
            styles.tile,
            three ? styles.tileThird : styles.tileHalf,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          {loading && t.value === undefined ? (
            <ActivityIndicator color={colors.primary} />
          ) : (
            <AppText
              variant={three ? "heading" : "title"}
              numberOfLines={1}
              adjustsFontSizeToFit
            >
              {t.value ?? "—"}
            </AppText>
          )}
          <AppText variant="eyebrow" color="textMuted" numberOfLines={1}>
            {t.label.toUpperCase()}
          </AppText>
        </View>
      ))}
    </View>
  );
}

// ─── Pills ──────────────────────────────────────────────────────────────────

export type PillTone = "done" | "upcoming" | "live" | "off" | "muted";

const PILL_COLORS: Record<PillTone, { bg: string; fg: string }> = {
  done: { bg: "#E3F5EA", fg: "#1F7A3F" },
  upcoming: { bg: "#FFF1D6", fg: "#7A4B00" },
  live: { bg: "#E6F0FB", fg: "#0B5CAD" },
  off: { bg: "#FBE7E7", fg: "#8A2D2D" },
  muted: { bg: "", fg: "" },
};

export function Pill({
  tone,
  label,
  large = false,
}: {
  tone: PillTone;
  label: string;
  large?: boolean;
}) {
  const { colors } = useTheme();
  const c = PILL_COLORS[tone];
  const bg = tone === "muted" ? colors.surfaceRaised : c.bg;
  const fg = tone === "muted" ? colors.textSecondary : c.fg;
  return (
    <View
      style={[
        styles.pill,
        large ? styles.pillLarge : null,
        { backgroundColor: bg },
      ]}
    >
      <AppText
        variant={large ? "smallStrong" : "eyebrow"}
        style={{ color: fg }}
        numberOfLines={1}
      >
        {large ? label : label.toUpperCase()}
      </AppText>
    </View>
  );
}

export const rideStatusPill = (
  r: RideRequest,
): { label: string; tone: PillTone } => {
  switch (r.status) {
    case "completed":
      return { label: "Completed", tone: "done" };
    case "in_progress":
    case "arrived":
    case "heading_to_pickup":
    case "en_route":
    case "confirmed":
      return { label: "In progress", tone: "live" };
    case "cancelled":
      return { label: "Cancelled", tone: "off" };
    case "declined":
      return { label: "Declined", tone: "off" };
    case "pending":
      return { label: "Requested", tone: "upcoming" };
    case "accepted":
      return { label: "Accepted", tone: "live" };
    default:
      return { label: "Upcoming", tone: "upcoming" };
  }
};

export const driverStatusPill = (p: {
  isApproved?: boolean;
  isOnline?: boolean;
}): { label: string; tone: PillTone } =>
  p.isApproved === false
    ? { label: "Pending", tone: "upcoming" }
    : p.isOnline
      ? { label: "Online", tone: "done" }
      : { label: "Offline", tone: "muted" };

// ─── Rows ───────────────────────────────────────────────────────────────────

/** Label on the left, value on the right. */
export function KvRow({
  label,
  value,
  muted = false,
}: {
  label: string;
  value: React.ReactNode;
  muted?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, styles.kv, { borderBottomColor: colors.border }]}>
      <AppText variant="body" color="textSecondary" style={styles.kvLabel}>
        {label}
      </AppText>
      {typeof value === "string" || typeof value === "number" ? (
        <AppText
          variant={muted ? "body" : "bodyStrong"}
          color={muted ? "textMuted" : "text"}
          style={styles.kvValue}
          numberOfLines={2}
        >
          {value}
        </AppText>
      ) : (
        value
      )}
    </View>
  );
}

/** Icon or avatar, title, subtitle, optional right element, chevron when it navigates. */
export function LinkRow({
  icon,
  iconColor,
  left,
  title,
  sub,
  sub2,
  right,
  onPress,
  tall = false,
}: {
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  iconColor?: string;
  left?: React.ReactNode;
  title: React.ReactNode;
  sub?: React.ReactNode;
  sub2?: React.ReactNode;
  right?: React.ReactNode;
  onPress?: () => void;
  tall?: boolean;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      onPress={onPress}
      disabled={!onPress}
      style={({ pressed }) => [
        styles.row,
        tall ? styles.rowTall : null,
        {
          borderBottomColor: colors.border,
          backgroundColor: pressed ? colors.surfaceRaised : "transparent",
        },
      ]}
    >
      {left ??
        (icon ? (
          <Ionicons
            name={icon}
            size={22}
            color={iconColor ?? colors.textMuted}
            style={styles.rowIcon}
          />
        ) : null)}
      <View style={styles.rowText}>
        {typeof title === "string" ? (
          <AppText variant="bodyStrong" numberOfLines={2}>
            {title}
          </AppText>
        ) : (
          title
        )}
        {typeof sub === "string" ? (
          <AppText variant="small" color="textSecondary" numberOfLines={2}>
            {sub}
          </AppText>
        ) : (
          sub
        )}
        {typeof sub2 === "string" ? (
          <AppText variant="small" color="textMuted" numberOfLines={1}>
            {sub2}
          </AppText>
        ) : (
          sub2
        )}
      </View>
      {right}
      {onPress ? (
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      ) : null}
    </Pressable>
  );
}

/** One ride, as the owner sees it: who, where, when, and what it cost. */
export function AdminRideRow({
  ride: r,
  countdown = false,
  now = new Date(),
  hideDriver = false,
  hideRider = false,
  onPress,
}: {
  ride: RideRequest;
  /** Swap the status pill for "in 2 h 10 min" (Today › Up next). */
  countdown?: boolean;
  now?: Date;
  /** On a driver's own page the driver's name is noise. */
  hideDriver?: boolean;
  /** On a rider's own page the row leads with the driver instead. */
  hideRider?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const pill = rideStatusPill(r);
  const cost = rideCost(r);
  const driver = hideDriver ? "" : r.driverFirstName || "";
  const title = hideRider
    ? r.status === "pending"
      ? driver
        ? `Sent to ${driver}`
        : "No driver yet"
      : driver || "No driver"
    : r.clientFirstName || "Rider";
  const driverNote =
    driver && !hideRider
      ? r.status === "pending"
        ? ` · sent to ${driver}`
        : ` · ${driver}`
      : "";
  const until =
    countdown && r.scheduledTime ? timeUntil(r.scheduledTime, now) : "";
  const km =
    r.status === "completed" || r.status === "cancelled"
      ? rideKm(r)
      : Number(r.distance) || 0;
  return (
    <LinkRow
      onPress={onPress}
      title={
        <AppText variant="bodyStrong" numberOfLines={1}>
          {title}
          {driverNote ? (
            <AppText variant="body" color="textMuted">
              {driverNote}
            </AppText>
          ) : null}
        </AppText>
      }
      sub={`${shortPlace(r.pickup?.address)} → ${shortPlace(r.destination?.address)}`}
      sub2={`${formatTime(r.scheduledTime)} · ${fmtKm(km)} km`}
      right={
        <View style={styles.stat}>
          <AppText
            variant="bodyStrong"
            color={r.status === "cancelled" ? "textMuted" : "primary"}
          >
            {cost > 0 ? money(cost) : "—"}
          </AppText>
          {until ? (
            <AppText
              variant="small"
              style={{
                color: until === "overdue" ? colors.danger : colors.success,
              }}
            >
              {until}
            </AppText>
          ) : (
            <Pill tone={pill.tone} label={pill.label} />
          )}
        </View>
      }
    />
  );
}

const LIVE_LABEL: Record<string, string> = {
  heading_to_pickup: "Heading to pickup",
  arrived: "At pickup",
  in_progress: "In progress",
  en_route: "In progress",
  confirmed: "Confirmed",
};

/** A ride under way right now: green, like the live cards on both homes. */
export function AdminLiveCard({
  ride: r,
  onPress,
}: {
  ride: RideRequest;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  const started = r.tripStartedAt
    ? `started ${formatTime(r.tripStartedAt)}`
    : r.scheduledTime
      ? `pickup ${formatTime(r.scheduledTime)}`
      : "";
  const km = Number(r.distance) || 0;
  const cost = rideCost(r);
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
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
        <View style={styles.inline}>
          <View style={[styles.liveDot, { backgroundColor: colors.success }]} />
          <AppText variant="smallStrong" color="success">
            {LIVE_LABEL[r.status] ?? "Live"}
            {r.driverFirstName ? ` · ${r.driverFirstName}` : ""}
          </AppText>
        </View>
        <AppText variant="small" color="textMuted">
          {started}
        </AppText>
      </View>
      <AppText variant="heading">{r.clientFirstName || "Rider"}</AppText>
      <AppText variant="small" color="textSecondary">
        {shortPlace(r.pickup?.address)} → {shortPlace(r.destination?.address)}
        {km > 0 ? ` · ${fmtKm(km)} km` : ""}
        {cost > 0 ? ` · ${money(cost)}` : ""}
      </AppText>
    </Pressable>
  );
}

/** One ride as a pay line: who / where / when / km, and what's owed for it. */
export function PayRideRow({
  ride: r,
  onPress,
}: {
  ride: RideRequest;
  onPress: () => void;
}) {
  const cancelled = r.status === "cancelled";
  const earned = rideEarned(r);
  const when = cancelled
    ? (r.cancelledAt ?? r.scheduledTime)
    : (r.completedAt ?? r.scheduledTime);
  return (
    <LinkRow
      onPress={onPress}
      title={
        <AppText variant="bodyStrong" numberOfLines={1}>
          {riderName(r)}
          {cancelled ? (
            <AppText variant="body" color="textMuted">
              {" · Cancelled"}
            </AppText>
          ) : null}
        </AppText>
      }
      sub={`${shortPlace(r.pickup?.address)} → ${shortPlace(r.destination?.address)}`}
      sub2={`${formatTime(when)}${!cancelled ? ` · ${fmtKm(rideKm(r))} km` : ""}${cancelled && earned > 0 ? " · cancellation fee" : ""}`}
      right={
        <AppText
          variant="bodyStrong"
          color={earned === 0 ? "textMuted" : "primary"}
        >
          {money(earned)}
        </AppText>
      }
    />
  );
}

// ─── Chart ──────────────────────────────────────────────────────────────────

export function BarChart({
  title,
  hint,
  bars,
  format = (v) => String(v),
  emptyText,
}: {
  title: string;
  hint: string;
  bars: { label: string; value: number }[];
  format?: (v: number) => string;
  emptyText: string;
}) {
  const { colors } = useTheme();
  const max = Math.max(1, ...bars.map((b) => b.value));
  const empty = bars.every((b) => b.value === 0);
  return (
    <Group style={styles.chart}>
      <SectionHead title={title} caption={hint} />
      {empty ? (
        <AppText
          variant="body"
          color="textMuted"
          align="center"
          style={styles.chartEmpty}
        >
          {emptyText}
        </AppText>
      ) : (
        <>
          <View style={styles.bars}>
            {bars.map((b) => {
              const h = b.value === 0 ? 4 : Math.round((b.value / max) * 96);
              const top = b.value === max;
              return (
                <View key={b.label} style={styles.barCol}>
                  <AppText variant="small" numberOfLines={1}>
                    {format(b.value)}
                  </AppText>
                  <View
                    style={[
                      styles.bar,
                      {
                        height: h,
                        backgroundColor: top ? colors.primary : colors.primary,
                        opacity: top ? 1 : 0.3,
                      },
                    ]}
                  />
                </View>
              );
            })}
          </View>
          <View style={styles.barLabels}>
            {bars.map((b) => (
              <AppText
                key={b.label}
                variant="small"
                color="textMuted"
                align="center"
                style={styles.barLabel}
                numberOfLines={1}
              >
                {b.label}
              </AppText>
            ))}
          </View>
        </>
      )}
    </Group>
  );
}

// ─── Search + chips ─────────────────────────────────────────────────────────

export function Searchbar({
  value,
  onChangeText,
  placeholder,
}: {
  value: string;
  onChangeText: (t: string) => void;
  placeholder: string;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.search,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <Ionicons name="search" size={18} color={colors.textMuted} />
      <TextInput
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.textMuted}
        autoCorrect={false}
        autoCapitalize="none"
        clearButtonMode="while-editing"
        style={[styles.searchInput, { color: colors.text }]}
      />
      {value ? (
        <Pressable accessibilityLabel="Clear" onPress={() => onChangeText("")}>
          <Ionicons name="close-circle" size={18} color={colors.textMuted} />
        </Pressable>
      ) : null}
    </View>
  );
}

export function Chips<T extends string>({
  options,
  value,
  onChange,
}: {
  options: { value: T; label: string }[];
  value: T;
  onChange: (v: T) => void;
}) {
  const { colors } = useTheme();
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      contentContainerStyle={styles.chips}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="button"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[
              styles.chip,
              {
                backgroundColor: active ? colors.primary : colors.surface,
                borderColor: active ? colors.primary : colors.border,
              },
            ]}
          >
            <AppText
              variant="smallStrong"
              style={{ color: active ? colors.onPrimary : colors.text }}
            >
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </ScrollView>
  );
}

/** Name, "since" line and a pill, at the top of a person's page. */
export function PersonHead({
  avatar,
  name,
  sub,
  right,
}: {
  avatar: React.ReactNode;
  name: string;
  sub: string;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.personHead}>
      {avatar}
      <View style={styles.rowText}>
        <AppText variant="heading" numberOfLines={1}>
          {name}
        </AppText>
        <AppText variant="small" color="textSecondary" numberOfLines={1}>
          {sub}
        </AppText>
      </View>
      {right}
    </View>
  );
}

const styles = StyleSheet.create({
  page: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.xxl,
  },
  loading: { paddingTop: 60, alignItems: "center" },
  box: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
    alignItems: "center",
  },
  group: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  sectionHead: {
    flexDirection: "row",
    alignItems: "baseline",
    justifyContent: "space-between",
    gap: spacing.md,
    marginBottom: spacing.sm,
  },
  tiles: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  tile: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: 4,
  },
  tileHalf: { flexBasis: "48%", flexGrow: 1 },
  tileThird: { flexBasis: "30%", flexGrow: 1, paddingHorizontal: spacing.sm },
  pill: {
    paddingHorizontal: 9,
    paddingVertical: 4,
    borderRadius: radius.pill,
    alignSelf: "flex-start",
  },
  pillLarge: { paddingHorizontal: 14, paddingVertical: 6 },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  rowTall: { paddingVertical: spacing.lg },
  rowIcon: { width: 24, textAlign: "center" },
  rowText: { flex: 1, gap: 2 },
  kv: { justifyContent: "space-between" },
  kvLabel: { flexShrink: 1 },
  kvValue: { flexShrink: 1, textAlign: "right", maxWidth: "60%" },
  stat: { alignItems: "flex-end", gap: 4 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  live: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1.5,
    gap: 4,
  },
  liveTop: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  liveDot: { width: 8, height: 8, borderRadius: 4 },
  chart: { padding: spacing.lg, gap: spacing.sm },
  chartEmpty: { paddingVertical: spacing.xl },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 8,
    height: 124,
  },
  barCol: { flex: 1, alignItems: "center", gap: 4, justifyContent: "flex-end" },
  bar: { width: "100%", borderTopLeftRadius: 8, borderTopRightRadius: 8 },
  barLabels: { flexDirection: "row", gap: 8 },
  barLabel: { flex: 1 },
  search: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    minHeight: 46,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  searchInput: { flex: 1, fontFamily: fontFamily.semibold, fontSize: 16 },
  chips: { gap: spacing.sm, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  personHead: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
