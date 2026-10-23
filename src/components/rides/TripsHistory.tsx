import { useCallback, useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  RefreshControl,
  StyleSheet,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import type { QueryDocumentSnapshot } from "@react-native-firebase/firestore";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { RideRequest } from "../../interfaces/ride";
import {
  fetchRideHistoryPage,
  type HistoryTab,
} from "../../services/rideService";
import { firstLine, formatTime } from "../../utils/address";
import { driverPayout } from "../../utils/fareCalculator";
import { cad } from "../../utils/money";
import { groupRidesByDay, type DayGroup } from "../../utils/rideDayGroups";
import { radius, spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Screen } from "../ui/Screen";
import { SegmentedControl } from "../ui/SegmentedControl";

const TABS: { value: HistoryTab; label: string }[] = [
  { value: "all", label: "All" },
  { value: "completed", label: "Completed" },
  { value: "cancelled", label: "Cancelled" },
];

/**
 * Past trips, newest first, grouped by day, loading more as you scroll.
 * Riders see what they paid; drivers see their payout.
 */
export function TripsHistory({ role }: { role: "client" | "driver" }) {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;

  const [tab, setTab] = useState<HistoryTab>("all");
  // Pages loaded so far, tagged with the tab they belong to; a tab switch
  // shows the loader until its first page lands.
  const [loaded, setLoaded] = useState<{
    tab: HistoryTab;
    rides: RideRequest[];
    hasMore: boolean;
  } | null>(null);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const cursor = useRef<QueryDocumentSnapshot | null>(null);
  const busy = useRef(false);

  const load = useCallback(
    async (reset: boolean) => {
      if (!uid || busy.current) return;
      busy.current = true;
      if (reset) cursor.current = null;
      try {
        const page = await fetchRideHistoryPage(uid, role, tab, cursor.current);
        cursor.current = page.cursor;
        setLoaded((prev) => ({
          tab,
          rides:
            reset || !prev || prev.tab !== tab
              ? page.rides
              : [...prev.rides, ...page.rides],
          hasMore: page.hasMore,
        }));
      } catch (err) {
        console.error("Error fetching ride history:", err);
        setLoaded((prev) =>
          prev?.tab === tab ? prev : { tab, rides: [], hasMore: false },
        );
      } finally {
        busy.current = false;
      }
    },
    [uid, role, tab],
  );

  useEffect(() => {
    void load(true);
  }, [load]);

  const rides = loaded?.tab === tab ? loaded.rides : null;
  const hasMore = loaded?.tab === tab ? loaded.hasMore : false;

  const groups = groupRidesByDay(rides ?? []);

  const renderGroup = ({ item: g }: { item: DayGroup }) => (
    <View style={styles.group}>
      <View style={styles.groupHead}>
        <AppText variant="eyebrow" color="textMuted">
          {g.label.toUpperCase()}
        </AppText>
        {g.rides.length > 1 ? (
          <AppText variant="small" color="textMuted">
            {g.rides.length} rides
          </AppText>
        ) : null}
      </View>
      {g.rides.map((ride) => {
        const completed = ride.status === "completed";
        return (
          <Pressable
            key={ride.id}
            accessibilityRole="button"
            onPress={() =>
              router.push({
                pathname: "/(common)/history/[id]",
                params: { id: ride.id as string },
              })
            }
            style={({ pressed }) => [
              styles.row,
              {
                backgroundColor: pressed
                  ? colors.surfaceRaised
                  : colors.surface,
                borderColor: colors.border,
              },
            ]}
          >
            <View style={styles.rowText}>
              <View style={styles.rowTop}>
                <AppText variant="bodyStrong">
                  {formatTime(ride.scheduledTime || ride.createdAt)}
                </AppText>
                <View
                  style={[
                    styles.badge,
                    {
                      backgroundColor: completed
                        ? colors.success
                        : colors.surfaceRaised,
                    },
                  ]}
                >
                  <AppText
                    variant="eyebrow"
                    style={{
                      color: completed ? colors.onSuccess : colors.textMuted,
                    }}
                  >
                    {ride.status.toUpperCase()}
                  </AppText>
                </View>
              </View>
              <View style={styles.inline}>
                <Ionicons
                  name="navigate-outline"
                  size={14}
                  color={colors.textMuted}
                />
                <AppText
                  variant="small"
                  color="textSecondary"
                  numberOfLines={1}
                >
                  {firstLine(ride.destination?.address)}
                </AppText>
              </View>
              <AppText variant="bodyStrong" color="primary">
                {cad(
                  role === "driver"
                    ? driverPayout(
                        completed
                          ? ride.estimatedPrice
                          : (ride.cancellationFee ?? 0),
                      )
                    : completed
                      ? ride.estimatedPrice
                      : (ride.cancellationFee ?? 0),
                )}
              </AppText>
            </View>
            <Ionicons
              name="chevron-forward"
              size={18}
              color={colors.textMuted}
            />
          </Pressable>
        );
      })}
    </View>
  );

  return (
    <Screen padded={false}>
      <View style={styles.header}>
        <AppText variant="title">Trips</AppText>
        <SegmentedControl options={TABS} value={tab} onChange={setTab} />
      </View>
      {rides === null ? (
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} size="large" />
        </View>
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => g.key}
          renderItem={renderGroup}
          contentContainerStyle={styles.list}
          onEndReachedThreshold={0.4}
          onEndReached={() => {
            if (!hasMore || loadingMore) return;
            setLoadingMore(true);
            void load(false).finally(() => setLoadingMore(false));
          }}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              tintColor={colors.primary}
              onRefresh={() => {
                setRefreshing(true);
                void load(true).finally(() => setRefreshing(false));
              }}
            />
          }
          ListEmptyComponent={
            <View style={styles.center}>
              <Ionicons
                name="calendar-outline"
                size={48}
                color={colors.textMuted}
              />
              <AppText variant="body" color="textMuted" align="center">
                {tab === "completed"
                  ? "No completed rides yet."
                  : tab === "cancelled"
                    ? "No cancelled rides."
                    : "No past rides found."}
              </AppText>
            </View>
          }
          ListFooterComponent={
            loadingMore ? (
              <ActivityIndicator color={colors.primary} style={styles.more} />
            ) : null
          }
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    gap: spacing.md,
  },
  list: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.lg,
    paddingBottom: spacing.xl,
  },
  center: { alignItems: "center", gap: spacing.md, paddingTop: 64 },
  group: { marginBottom: spacing.md, gap: spacing.sm },
  groupHead: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "baseline",
    paddingHorizontal: 4,
  },
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  rowText: { flex: 1, gap: 4 },
  rowTop: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radius.pill,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  more: { paddingVertical: spacing.lg },
});
