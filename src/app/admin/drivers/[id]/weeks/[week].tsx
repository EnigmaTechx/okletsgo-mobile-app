import { useCallback, useMemo } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AdminScreen,
  EmptyBox,
  ErrorBox,
  Group,
  Loading,
  PayRideRow,
  SectionHead,
  Tiles,
  fmtKm,
  money,
  useAdminLoad,
} from "../../../../../components/admin/AdminUi";
import { AppText } from "../../../../../components/ui/AppText";
import { useTheme } from "../../../../../contexts/ThemeContext";
import { fetchDriverDetail } from "../../../../../services/adminStatsService";
import {
  buildWeekPay,
  earnedTime,
  mondayFromKey,
  rideEarned,
} from "../../../../../services/driverStatsService";
import { dayLabel, groupRidesByDay } from "../../../../../utils/rideDayGroups";
import { radius, spacing } from "../../../../../theme/tokens";

/** One Monday–Sunday pay week for a driver: the amount to hand over and
 *  every ride behind it, grouped by the day the money was earned. */
export default function AdminDriverWeek() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id, week: key } = useLocalSearchParams<{
    id: string;
    week: string;
  }>();
  const load = useCallback(() => fetchDriverDetail(id ?? ""), [id]);
  const { data, loading, error, refreshing, reload, onRefresh } = useAdminLoad(
    load,
    "Couldn't load this week. Check your connection and try again.",
  );
  const monday = useMemo(() => (key ? mondayFromKey(key) : null), [key]);
  const week = useMemo(
    () => (data && monday ? buildWeekPay(monday, data.rides) : null),
    [data, monday],
  );
  const notFound = !loading && ((data === null && !error) || !monday);
  const groups = week
    ? groupRidesByDay(week.items, new Date(), "desc", dayLabel, earnedTime)
    : [];
  const driverName = data?.profile.firstName || "driver";
  const openRide = (rideId: string) =>
    router.push({
      pathname: "/admin/ride/[id]",
      params: { id: rideId },
    } as never);

  return (
    <AdminScreen refreshing={refreshing} onRefresh={onRefresh}>
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : notFound ? (
        <EmptyBox text="This week or driver can't be found." />
      ) : loading || !week ? (
        <Loading />
      ) : (
        <>
          <View style={[styles.hero, { backgroundColor: colors.primary }]}>
            <AppText variant="smallStrong" style={styles.onPrimary}>
              Pay to {driverName}
              {week.current ? " · week in progress" : ""}
            </AppText>
            <AppText variant="display" style={styles.onPrimary}>
              {money(week.earned)}
            </AppText>
            <AppText variant="small" style={styles.onPrimaryDim}>
              {week.label}
            </AppText>
          </View>
          <Tiles
            items={[
              { label: "Rides", value: week.rides },
              { label: "Km", value: fmtKm(week.km) },
              {
                label: "Cancel fees",
                value:
                  week.cancellationEarnings > 0
                    ? `$${Math.round(week.cancellationEarnings)}`
                    : "$0",
              },
            ]}
          />
          {week.items.length === 0 ? (
            <EmptyBox text="No rides this week." />
          ) : (
            groups.map((g) => (
              <View key={g.key}>
                <SectionHead
                  title={g.label}
                  caption={money(
                    g.rides.reduce((s, r) => s + rideEarned(r), 0),
                  )}
                />
                <Group>
                  {g.rides.map((r) => (
                    <PayRideRow
                      key={r.id}
                      ride={r}
                      onPress={() => openRide(r.id as string)}
                    />
                  ))}
                </Group>
              </View>
            ))
          )}
          <AppText variant="small" color="textMuted" align="center">
            Monday to Sunday. Each ride pays the driver&apos;s share at the time
            of the trip, so this total doesn&apos;t change if Pricing changes
            later.
          </AppText>
        </>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  hero: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: 4,
  },
  onPrimary: { color: "#FFFFFF" },
  onPrimaryDim: { color: "rgba(255,255,255,0.85)" },
});
