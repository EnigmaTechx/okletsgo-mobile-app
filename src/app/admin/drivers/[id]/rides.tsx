import { useCallback } from "react";
import { View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AdminScreen,
  Caption,
  EmptyBox,
  ErrorBox,
  Group,
  Loading,
  PayRideRow,
  SectionHead,
  countLabel,
  useAdminLoad,
} from "../../../../components/admin/AdminUi";
import { fetchDriverDetail } from "../../../../services/adminStatsService";
import { earnedTime } from "../../../../services/driverStatsService";
import { dayLabel, groupRidesByDay } from "../../../../utils/rideDayGroups";
import { spacing } from "../../../../theme/tokens";

/** Every completed and cancelled ride for one driver, grouped by the day
 *  it finished (or was cancelled), newest first. */
export default function AdminDriverRides() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(() => fetchDriverDetail(id ?? ""), [id]);
  const { data, loading, error, refreshing, reload, onRefresh } = useAdminLoad(
    load,
    "Couldn't load rides. Check your connection and try again.",
  );
  const notFound = !loading && data === null && !error;
  const groups = data
    ? groupRidesByDay(data.rides, new Date(), "desc", dayLabel, earnedTime)
    : [];
  const total = data?.rides.length ?? 0;
  const openRide = (rideId: string) =>
    router.push({
      pathname: "/admin/ride/[id]",
      params: { id: rideId },
    } as never);

  return (
    <AdminScreen refreshing={refreshing} onRefresh={onRefresh} gap={spacing.md}>
      <Caption
        text={`${data?.profile.firstName ? `${data.profile.firstName} · ` : ""}completed and cancelled · newest first · sandbox hidden`}
      />
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : notFound ? (
        <EmptyBox text="This driver's account no longer exists." />
      ) : loading || !data ? (
        <Loading />
      ) : total === 0 ? (
        <EmptyBox text="No rides yet." />
      ) : (
        groups.map((g) => (
          <View key={g.key}>
            <SectionHead
              title={g.label}
              caption={countLabel(g.rides.length, "ride")}
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
    </AdminScreen>
  );
}
