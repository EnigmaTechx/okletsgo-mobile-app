import { useCallback, useMemo, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AdminLiveCard,
  AdminRideRow,
  AdminScreen,
  Caption,
  EmptyBox,
  ErrorBox,
  Group,
  KvRow,
  LinkRow,
  Loading,
  PersonHead,
  SectionHead,
  agoLabel,
  maskedPhone,
  useAdminLoad,
} from "../../../components/admin/AdminUi";
import { StatsStrip } from "../../../components/StatsStrip";
import { AppText } from "../../../components/ui/AppText";
import { Avatar } from "../../../components/ui/Avatar";
import { SegmentedControl } from "../../../components/ui/SegmentedControl";
import { useTheme } from "../../../contexts/ThemeContext";
import { fetchClientDetail } from "../../../services/adminStatsService";
import { bucketOpenRides } from "../../../utils/adminRideBuckets";
import {
  groupRidesByDay,
  upcomingDayLabel,
} from "../../../utils/rideDayGroups";
import { spacing } from "../../../theme/tokens";

type Tab = "activity" | "profile";

const memberSince = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `Member since ${d.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
};

export default function AdminClientDetail() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("activity");
  const [now] = useState(() => new Date());
  const load = useCallback(() => fetchClientDetail(id ?? ""), [id]);
  const { data, loading, error, refreshing, reload, onRefresh } = useAdminLoad(
    load,
    "Couldn't load this rider. Check your connection and try again.",
  );
  const notFound = !loading && data === null && !error;

  const p = data?.profile;
  const buckets = useMemo(
    () => bucketOpenRides(data?.openRides ?? [], now),
    [data, now],
  );
  const upcoming = useMemo(
    () => [
      ...buckets.today.upNext,
      ...buckets.today.waiting,
      ...buckets.upcoming,
    ],
    [buckets],
  );
  const upcomingGroups = groupRidesByDay(
    upcoming,
    now,
    "asc",
    upcomingDayLabel,
  );
  const accepted = upcoming.filter((r) => r.status === "accepted").length;
  const waiting = upcoming.length - accepted;
  const lastRide = data?.recent[0];
  const openRide = (rideId: string) =>
    router.push({
      pathname: "/admin/ride/[id]",
      params: { id: rideId },
    } as never);

  const name = p
    ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Rider"
    : "";

  return (
    <AdminScreen refreshing={refreshing} onRefresh={onRefresh}>
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : notFound ? (
        <EmptyBox text="This rider's account no longer exists." />
      ) : loading || !data || !p ? (
        <Loading />
      ) : (
        <>
          <PersonHead
            avatar={
              <Avatar
                firstName={p.firstName}
                lastName={p.lastName}
                photoUrl={p.photoUrl}
                size={52}
                tint={colors.secondary}
              />
            }
            name={name}
            sub={memberSince(p.createdAt) || "Rider"}
          />
          <SegmentedControl
            options={[
              { value: "activity", label: "Activity" },
              { value: "profile", label: "Profile" },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === "activity" ? (
            <>
              {buckets.today.live.map((r) => (
                <AdminLiveCard
                  key={r.id}
                  ride={r}
                  onPress={() => openRide(r.id as string)}
                />
              ))}
              <View>
                <SectionHead
                  title="Upcoming"
                  caption={
                    upcoming.length === 0
                      ? undefined
                      : [
                          accepted > 0 && `${accepted} accepted`,
                          waiting > 0 && `${waiting} waiting`,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                  }
                />
                {upcomingGroups.length === 0 ? (
                  <EmptyBox text="No rides booked." />
                ) : (
                  <View style={styles.stack}>
                    {upcomingGroups.map((g) => (
                      <View key={g.key} style={styles.dayBlock}>
                        <Caption text={g.label} />
                        <Group>
                          {g.rides.map((r) => (
                            <AdminRideRow
                              key={r.id}
                              ride={r}
                              countdown={
                                r.status === "accepted" &&
                                g.label.startsWith("Today")
                              }
                              now={now}
                              hideRider
                              onPress={() => openRide(r.id as string)}
                            />
                          ))}
                        </Group>
                      </View>
                    ))}
                  </View>
                )}
              </View>
              <View>
                <SectionHead
                  title="Recent"
                  caption={
                    data.completedRides === 1
                      ? "1 completed"
                      : `${data.completedRides} completed`
                  }
                />
                {data.recent.length === 0 ? (
                  <EmptyBox text="No completed rides yet." />
                ) : (
                  <Group>
                    {data.recent.map((r) => (
                      <AdminRideRow
                        key={r.id}
                        ride={r}
                        hideRider
                        onPress={() => openRide(r.id as string)}
                      />
                    ))}
                  </Group>
                )}
              </View>
            </>
          ) : (
            <>
              <View style={styles.identity}>
                <Avatar
                  firstName={p.firstName}
                  lastName={p.lastName}
                  photoUrl={p.photoUrl}
                  size={96}
                  tint={colors.secondary}
                />
                <AppText variant="title" align="center">
                  {name}
                </AppText>
                <AppText variant="small" color="textSecondary">
                  {memberSince(p.createdAt) || " "}
                </AppText>
              </View>
              {/* Same strip the rider sees on their own Account tab. */}
              <StatsStrip
                rideCount={data.completedRides}
                totalKm={Number(p.totalKmTravelled) || 0}
                memberSince={p.createdAt}
              />
              <View>
                <SectionHead title="Contact" />
                <Group>
                  <LinkRow icon="call-outline" title={maskedPhone(p.phone)} />
                  <LinkRow
                    icon="mail-outline"
                    title={p.email || "No email on file"}
                  />
                </Group>
              </View>
              <View>
                <SectionHead title="Account" />
                <Group>
                  <KvRow
                    label="Last ride"
                    value={agoLabel(
                      lastRide?.completedAt ?? lastRide?.tripCompletedAt,
                    )}
                    muted
                  />
                </Group>
              </View>
            </>
          )}
        </>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  dayBlock: { gap: spacing.xs },
  identity: { alignItems: "center", gap: spacing.sm, paddingTop: spacing.sm },
});
