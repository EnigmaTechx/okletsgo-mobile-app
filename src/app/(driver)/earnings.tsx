import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  RefreshControl,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/ui/Screen";
import { SegmentedControl } from "../../components/ui/SegmentedControl";
import { useAuth } from "../../contexts/AuthContext";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { RideRequest } from "../../interfaces/ride";
import type { SummaryPeriod } from "../../services/adminStatsService";
import {
  buildDriverStats,
  fetchDriverRides,
} from "../../services/driverStatsService";
import { radius, spacing } from "../../theme/tokens";

const PERIODS: { value: SummaryPeriod; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "6 months" },
];
const fmtKm = (km: number) =>
  km >= 10 ? Math.round(km).toLocaleString() : km.toFixed(1);
const money = (n: number) =>
  `$${n.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const whole = (n: number) => `$${Math.round(n).toLocaleString()}`;

/**
 * Earnings & stats, behind the driver_earnings remote flag exactly as in
 * the Ionic app: one fetch of every completed and cancelled ride, bucketed
 * on device for the chosen period, with the lifetime figures from the
 * same set.
 */
export default function DriverEarnings() {
  const { colors } = useTheme();
  const { currentUser, userProfile } = useAuth();
  const { isVisible } = useFeatureFlags();
  const uid = currentUser?.uid;
  const [period, setPeriod] = useState<SummaryPeriod>("month");
  const [rides, setRides] = useState<RideRequest[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const visible = isVisible("driver_earnings");

  const load = useCallback(async () => {
    if (!uid) return;
    try {
      const list = await fetchDriverRides(uid);
      setRides(list);
      setError(null);
    } catch (e) {
      console.error("[DriverEarnings] load failed", e);
      setError(
        "Couldn't load your earnings. Check your connection and try again.",
      );
    }
  }, [uid]);

  useEffect(() => {
    if (!visible || !uid) return;
    let active = true;
    fetchDriverRides(uid)
      .then((list) => {
        if (!active) return;
        setRides(list);
        setError(null);
      })
      .catch((e) => {
        console.error("[DriverEarnings] load failed", e);
        if (active)
          setError(
            "Couldn't load your earnings. Check your connection and try again.",
          );
      });
    return () => {
      active = false;
    };
  }, [visible, uid]);

  const data = useMemo(
    () => (rides ? buildDriverStats(period, rides) : null),
    [rides, period],
  );

  if (!visible) {
    return (
      <Screen>
        <View style={styles.center}>
          <Ionicons
            name="bar-chart-outline"
            size={48}
            color={colors.textMuted}
          />
          <AppText variant="heading" align="center">
            Earnings
          </AppText>
          <AppText variant="body" color="textMuted" align="center">
            Earnings and stats are not switched on for your account yet.
          </AppText>
        </View>
      </Screen>
    );
  }

  const max = data ? Math.max(1, ...data.bars.map((b) => b.value)) : 1;
  const rating = userProfile?.rating;
  const ratingCount = userProfile?.ratingCount ?? 0;
  const card = { backgroundColor: colors.surface, borderColor: colors.border };

  return (
    <Screen padded={false}>
      <ScrollView
        contentContainerStyle={styles.content}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            tintColor={colors.primary}
            onRefresh={() => {
              setRefreshing(true);
              void load().finally(() => setRefreshing(false));
            }}
          />
        }
      >
        <AppText variant="title" style={styles.title}>
          Earnings & stats
        </AppText>
        <SegmentedControl
          options={PERIODS}
          value={period}
          onChange={setPeriod}
        />

        {error ? (
          <View style={[styles.card, card]}>
            <AppText variant="body" color="danger">
              {error}
            </AppText>
            <Button
              title="Try again"
              variant="secondary"
              onPress={() => void load()}
            />
          </View>
        ) : !data ? (
          <ActivityIndicator color={colors.primary} style={styles.loader} />
        ) : (
          <>
            <View
              style={[styles.hero, { backgroundColor: colors.surfaceRaised }]}
            >
              <AppText variant="eyebrow" color="textMuted">
                EARNED {data.periodLabel.toUpperCase()}
              </AppText>
              <AppText variant="display" color="success">
                {money(data.earned)}
              </AppText>
              <AppText variant="small" color="textSecondary" align="center">
                {data.rides === 1
                  ? "1 completed ride"
                  : `${data.rides} completed rides`}{" "}
                · {fmtKm(data.km)} km driven
                {data.cancellationEarnings > 0
                  ? ` · includes ${money(data.cancellationEarnings)} in cancellation fees`
                  : ""}
              </AppText>
            </View>

            <View style={styles.tiles}>
              <Tile value={String(data.rides)} label="Rides" />
              <Tile value={fmtKm(data.km)} label="Km driven" />
              <Tile
                value={data.rides ? whole(data.perRide) : "—"}
                label="Per ride"
              />
            </View>

            <View style={[styles.card, card]}>
              <AppText variant="heading">{data.chartTitle}</AppText>
              <AppText variant="small" color="textMuted">
                {data.chartHint}
              </AppText>
              {data.earned === 0 ? (
                <AppText
                  variant="body"
                  color="textMuted"
                  align="center"
                  style={styles.emptyChart}
                >
                  Nothing earned in this period yet.
                </AppText>
              ) : (
                <View style={styles.bars}>
                  {data.bars.map((b) => {
                    const h =
                      b.value === 0 ? 4 : Math.round((b.value / max) * 96);
                    return (
                      <View key={b.label} style={styles.barCol}>
                        <AppText
                          variant="small"
                          color="textMuted"
                          numberOfLines={1}
                          style={styles.barValue}
                        >
                          {whole(b.value)}
                        </AppText>
                        <View
                          style={[
                            styles.bar,
                            {
                              height: h,
                              backgroundColor:
                                b.value === max
                                  ? colors.primary
                                  : colors.secondary,
                            },
                          ]}
                        />
                        <AppText
                          variant="small"
                          color="textMuted"
                          numberOfLines={1}
                        >
                          {b.label}
                        </AppText>
                      </View>
                    );
                  })}
                </View>
              )}
            </View>

            <View style={[styles.card, card]}>
              <Row
                label="Lifetime rides"
                value={data.lifetime.rides.toLocaleString()}
              />
              <Row
                label="Lifetime km"
                value={`${fmtKm(data.lifetime.km)} km`}
              />
              <Row
                label="Lifetime earned"
                value={money(data.lifetime.earned)}
              />
              <Row
                label="Rating"
                value={
                  typeof rating === "number" && ratingCount > 0
                    ? `${rating.toFixed(1)} ★ (${ratingCount})`
                    : "No ratings yet"
                }
              />
            </View>
          </>
        )}
      </ScrollView>
    </Screen>
  );
}

function Tile({ value, label }: { value: string; label: string }) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.tile,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <AppText variant="heading" numberOfLines={1}>
        {value}
      </AppText>
      <AppText variant="small" color="textMuted">
        {label}
      </AppText>
    </View>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <View style={styles.row}>
      <AppText variant="body" color="textSecondary">
        {label}
      </AppText>
      <AppText variant="bodyStrong">{value}</AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  content: {
    paddingHorizontal: spacing.screen,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  title: { paddingTop: spacing.lg },
  center: { alignItems: "center", gap: spacing.sm, paddingTop: 64 },
  loader: { marginTop: 48 },
  hero: {
    alignItems: "center",
    gap: 4,
    padding: spacing.xl,
    borderRadius: radius.lg,
  },
  tiles: { flexDirection: "row", gap: spacing.sm },
  tile: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 2,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  emptyChart: { paddingVertical: spacing.xl },
  bars: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: 6,
    marginTop: spacing.md,
    minHeight: 140,
  },
  barCol: { flex: 1, alignItems: "center", gap: 4 },
  barValue: { fontSize: 11 },
  bar: { width: "100%", borderRadius: 6 },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    paddingVertical: 6,
  },
});
