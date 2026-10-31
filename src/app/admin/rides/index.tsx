import { useCallback, useState } from "react";
import { useFocusEffect } from "expo-router";
import {
  AdminScreen,
  BarChart,
  ErrorBox,
  Group,
  KvRow,
  Loading,
  Tiles,
  fmtKm,
} from "../../../components/admin/AdminUi";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import {
  fetchRidesSummary,
  type RidesSummary,
  type SummaryPeriod,
} from "../../../services/adminStatsService";

const PERIODS: { value: SummaryPeriod; label: string }[] = [
  { value: "week", label: "This week" },
  { value: "month", label: "This month" },
  { value: "all", label: "6 months" },
];

/** Completed rides, km and riders for a period, with the bar chart. Each
 *  period is fetched once per visit and served from memory after that. */
export default function AdminRides() {
  const [period, setPeriod] = useState<SummaryPeriod>("month");
  const [cache, setCache] = useState<
    Partial<Record<SummaryPeriod, RidesSummary>>
  >({});
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async (p: SummaryPeriod, pull = false) => {
    setError(null);
    if (pull) setRefreshing(true);
    else setLoading(true);
    try {
      const summary = await fetchRidesSummary(p);
      setCache((c) => ({ ...c, [p]: summary }));
    } catch (e) {
      console.error("[AdminRides] summary failed", e);
      setError(
        "Couldn't load the summary. Check your connection and try again.",
      );
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  // Fresh numbers on every visit; a period switch within a visit is served
  // from memory once fetched.
  useFocusEffect(
    useCallback(() => {
      setCache({});
      void load(period);
      // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [load]),
  );
  const changePeriod = (p: SummaryPeriod) => {
    setPeriod(p);
    if (!cache[p]) void load(p);
  };

  const data = cache[period] ?? null;

  return (
    <AdminScreen
      refreshing={refreshing}
      onRefresh={() => {
        setCache({});
        void load(period, true);
      }}
    >
      <SegmentedControl
        options={PERIODS}
        value={period}
        onChange={changePeriod}
      />
      {error ? (
        <ErrorBox message={error} onRetry={() => void load(period)} />
      ) : (loading && !data) || !data ? (
        <Loading />
      ) : (
        <>
          <Tiles
            items={[
              { label: "Rides", value: data.rides },
              { label: "Km", value: fmtKm(data.km) },
              { label: "Riders", value: data.riders },
            ]}
          />
          <BarChart
            title={data.chartTitle}
            hint={data.chartHint}
            bars={data.bars}
            emptyText="No completed rides in this period."
          />
          <Group>
            <KvRow label="Completed" value={String(data.completed)} />
            <KvRow label="Cancelled" value={String(data.cancelled)} />
            <KvRow
              label="Average distance"
              value={data.rides ? `${fmtKm(data.avgKm)} km` : "—"}
            />
            <KvRow label="Busiest day" value={data.busiestDay ?? "—"} />
          </Group>
        </>
      )}
    </AdminScreen>
  );
}
