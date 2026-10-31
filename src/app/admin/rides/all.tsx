import { useCallback, useMemo, useRef, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useFocusEffect, useRouter } from "expo-router";
import type { QueryDocumentSnapshot } from "@react-native-firebase/firestore";
import {
  AdminLiveCard,
  AdminRideRow,
  AdminScreen,
  Caption,
  Chips,
  EmptyBox,
  ErrorBox,
  Group,
  Loading,
  SectionHead,
  countLabel,
} from "../../../components/admin/AdminUi";
import { Button } from "../../../components/ui/Button";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import type { RideRequest } from "../../../interfaces/ride";
import {
  fetchOpenRides,
  fetchRecentRides,
} from "../../../services/adminStatsService";
import {
  bucketOpenRides,
  driverOptions,
  matchesDriver,
  type DriverFilter,
} from "../../../utils/adminRideBuckets";
import {
  groupRidesByDay,
  upcomingDayLabel,
} from "../../../utils/rideDayGroups";
import { spacing } from "../../../theme/tokens";

type Segment = "today" | "upcoming" | "history";

/** "2 completed · 1 cancelled" */
const doneCaption = (done: RideRequest[]): string => {
  const completed = done.filter((r) => r.status === "completed").length;
  const other = done.length - completed;
  return [
    completed > 0 && `${completed} completed`,
    other > 0 && `${other} cancelled`,
  ]
    .filter(Boolean)
    .join(" · ");
};

/**
 * Every ride, as the owner wants to read it: what is happening now and
 * today, what is coming up, and the history, each filterable by driver.
 */
export default function AdminAllRides() {
  const router = useRouter();
  const [segment, setSegment] = useState<Segment>("today");
  const [driver, setDriver] = useState<DriverFilter>("all");
  const [openRides, setOpenRides] = useState<RideRequest[] | null>(null);
  const [history, setHistory] = useState<RideRequest[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [more, setMore] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cursor = useRef<QueryDocumentSnapshot | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [now] = useState(() => new Date());

  const load = useCallback(async (pull = false) => {
    setError(null);
    if (pull) setRefreshing(true);
    try {
      const [open, page] = await Promise.all([
        fetchOpenRides(),
        fetchRecentRides(null),
      ]);
      setOpenRides(open);
      cursor.current = page.cursor;
      setHasMore(page.cursor !== null);
      setHistory(page.rides);
    } catch (e) {
      console.error("[AdminAllRides] load failed", e);
      setError("Couldn't load rides. Check your connection and try again.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const loadMore = async () => {
    if (!cursor.current || more) return;
    setMore(true);
    try {
      const page = await fetchRecentRides(cursor.current);
      cursor.current = page.cursor;
      setHasMore(page.cursor !== null);
      setHistory((prev) => [...(prev ?? []), ...page.rides]);
    } catch (e) {
      console.error("[AdminAllRides] load more failed", e);
      setHasMore(false);
    } finally {
      setMore(false);
    }
  };

  useFocusEffect(
    useCallback(() => {
      void load();
    }, [load]),
  );

  const drivers = useMemo(
    () => driverOptions([...(openRides ?? []), ...(history ?? [])]),
    [openRides, history],
  );
  const filtered = useMemo(
    () => (openRides ?? []).filter((r) => matchesDriver(r, driver)),
    [openRides, driver],
  );
  const buckets = useMemo(
    () => bucketOpenRides(filtered, now),
    [filtered, now],
  );
  const historyRows = useMemo(
    () =>
      (history ?? []).filter(
        (r) =>
          (r.status === "completed" ||
            r.status === "cancelled" ||
            r.status === "declined") &&
          matchesDriver(r, driver),
      ),
    [history, driver],
  );
  const historyGroups = groupRidesByDay(historyRows, now);
  const upcomingGroups = groupRidesByDay(
    buckets.upcoming,
    now,
    "asc",
    upcomingDayLabel,
  );
  const { live, upNext, waiting, done } = buckets.today;
  const initial = loading && !openRides && !history;
  const openRide = (rideId: string) =>
    router.push({
      pathname: "/admin/ride/[id]",
      params: { id: rideId },
    } as never);

  const withCount = (label: string, n: number) =>
    n > 0 ? `${label} (${n})` : label;

  const renderToday = () => {
    if (live.length + upNext.length + waiting.length + done.length === 0)
      return <EmptyBox text="Nothing scheduled for today." />;
    return (
      <>
        {live.map((r) => (
          <AdminLiveCard
            key={r.id}
            ride={r}
            onPress={() => openRide(r.id as string)}
          />
        ))}
        {upNext.length > 0 ? (
          <View>
            <SectionHead title="Up next" caption="accepted · by pickup time" />
            <Group>
              {upNext.map((r) => (
                <AdminRideRow
                  key={r.id}
                  ride={r}
                  countdown
                  now={now}
                  onPress={() => openRide(r.id as string)}
                />
              ))}
            </Group>
          </View>
        ) : null}
        {waiting.length > 0 ? (
          <View>
            <SectionHead title="Waiting for a driver" caption="today" />
            <Group>
              {waiting.map((r) => (
                <AdminRideRow
                  key={r.id}
                  ride={r}
                  onPress={() => openRide(r.id as string)}
                />
              ))}
            </Group>
          </View>
        ) : null}
        {done.length > 0 ? (
          <View>
            <SectionHead title="Done today" caption={doneCaption(done)} />
            <Group>
              {done.map((r) => (
                <AdminRideRow
                  key={r.id}
                  ride={r}
                  onPress={() => openRide(r.id as string)}
                />
              ))}
            </Group>
          </View>
        ) : null}
      </>
    );
  };

  const renderGroups = (groups: typeof historyGroups, emptyText: string) =>
    groups.length === 0 ? (
      <EmptyBox text={emptyText} />
    ) : (
      groups.map((g) => (
        <View key={g.key}>
          <SectionHead
            title={g.label}
            caption={countLabel(g.rides.length, "ride")}
          />
          <Group>
            {g.rides.map((r) => (
              <AdminRideRow
                key={r.id}
                ride={r}
                onPress={() => openRide(r.id as string)}
              />
            ))}
          </Group>
        </View>
      ))
    );

  return (
    <AdminScreen refreshing={refreshing} onRefresh={() => void load(true)}>
      <SegmentedControl
        options={[
          { value: "today", label: withCount("Today", buckets.counts.today) },
          {
            value: "upcoming",
            label: withCount("Upcoming", buckets.counts.upcoming),
          },
          { value: "history", label: "History" },
        ]}
        value={segment}
        onChange={setSegment}
      />
      <View style={styles.filter}>
        <Caption
          text={
            segment === "today"
              ? now.toLocaleDateString(undefined, {
                  weekday: "long",
                  month: "short",
                  day: "numeric",
                })
              : segment === "upcoming"
                ? "Tomorrow onwards · soonest first"
                : "Completed and cancelled · newest first"
          }
        />
        {drivers.length > 0 ? (
          <Chips
            options={[
              { value: "all" as DriverFilter, label: "All drivers" },
              ...drivers.map((d) => ({ value: d.id, label: d.label })),
            ]}
            value={driver}
            onChange={setDriver}
          />
        ) : null}
      </View>

      {error ? (
        <ErrorBox message={error} onRetry={() => void load()} />
      ) : initial ? (
        <Loading />
      ) : segment === "today" ? (
        renderToday()
      ) : segment === "upcoming" ? (
        renderGroups(upcomingGroups, "No rides booked beyond today.")
      ) : (
        <>
          {renderGroups(historyGroups, "No completed or cancelled rides yet.")}
          {hasMore ? (
            <Button
              title="Load more"
              variant="secondary"
              loading={more}
              onPress={() => void loadMore()}
            />
          ) : null}
        </>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  filter: { gap: spacing.sm },
});
