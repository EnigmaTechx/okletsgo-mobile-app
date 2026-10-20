import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { radius, spacing } from "../theme/tokens";
import { AppText } from "./ui/AppText";

interface Props {
  /** Completed rides (taken for riders, completed for drivers); null while loading. */
  rideCount: number | null;
  /** ISO date the account was created, for "Member since". */
  memberSince?: string;
  /** Average star rating (drivers). Hidden until there is at least one rating. */
  rating?: number;
  ratingCount?: number;
  /** Lifetime km (riders). Hidden when undefined. */
  totalKm?: number;
}

const memberSinceYear = (iso?: string): string | null => {
  if (!iso) return null;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? null : String(d.getFullYear());
};

// Whole km once past 10 ("142"), one decimal below that ("8.4") so small
// early totals do not all read as "0".
const formatKm = (km: number): string =>
  km >= 10 ? String(Math.round(km)) : km.toFixed(1);

/** The three or four numbers at the top of the Account tab. */
export function StatsStrip({
  rideCount,
  memberSince,
  rating,
  ratingCount = 0,
  totalKm,
}: Props) {
  const { colors } = useTheme();
  const year = memberSinceYear(memberSince);
  const cells: { value: string | null; label: string; accent?: boolean }[] = [
    {
      value: rideCount === null ? null : String(rideCount),
      label: rideCount === 1 ? "Ride" : "Rides",
    },
  ];
  if (typeof totalKm === "number")
    cells.push({ value: formatKm(totalKm), label: "Km travelled" });
  if (ratingCount > 0 && typeof rating === "number")
    cells.push({
      value: `${rating.toFixed(1)}★`,
      label: "Rating",
      accent: true,
    });
  if (year) cells.push({ value: year, label: "Member since" });

  return (
    <View
      style={[
        styles.strip,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {cells.map((c, i) => (
        <View key={c.label} style={styles.cellWrap}>
          {i > 0 ? (
            <View
              style={[styles.divider, { backgroundColor: colors.border }]}
            />
          ) : null}
          <View style={styles.cell}>
            {c.value === null ? (
              <ActivityIndicator color={colors.primary} />
            ) : (
              <AppText
                variant="title"
                style={c.accent ? { color: colors.accent } : null}
              >
                {c.value}
              </AppText>
            )}
            <AppText variant="eyebrow" color="textMuted" style={styles.label}>
              {c.label.toUpperCase()}
            </AppText>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: "row",
    alignItems: "stretch",
    borderWidth: 1,
    borderRadius: radius.lg,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.xs,
  },
  cellWrap: { flex: 1, flexDirection: "row", alignItems: "stretch" },
  divider: { width: StyleSheet.hairlineWidth, marginVertical: 4 },
  cell: { flex: 1, alignItems: "center", justifyContent: "center", gap: 4 },
  label: { fontSize: 10, letterSpacing: 0.6 },
});
