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
  Pill,
  SectionHead,
  Tiles,
  agoLabel,
  driverStatusPill,
  fmtKm,
  maskedPhone,
  money,
  useAdminLoad,
  vehicleLabel,
} from "../../../../components/admin/AdminUi";
import { RideMap } from "../../../../components/map/RideMap";
import { StatsStrip } from "../../../../components/StatsStrip";
import { AppText } from "../../../../components/ui/AppText";
import { Avatar } from "../../../../components/ui/Avatar";
import { SegmentedControl } from "../../../../components/ui/SegmentedControl";
import { useTheme } from "../../../../contexts/ThemeContext";
import type { RideRequest } from "../../../../interfaces/ride";
import type { UserProfile } from "../../../../interfaces/user";
import { fetchDriverDetail } from "../../../../services/adminStatsService";
import {
  buildDriverStats,
  buildWeeklyPay,
} from "../../../../services/driverStatsService";
import { bucketOpenRides } from "../../../../utils/adminRideBuckets";
import { formatKm, kmFromDriver, pointOf } from "../../../../utils/geo";
import {
  groupRidesByDay,
  upcomingDayLabel,
} from "../../../../utils/rideDayGroups";
import { timeUntil } from "../../../../utils/timeUntil";
import { radius, spacing } from "../../../../theme/tokens";

type Tab = "activity" | "pay" | "profile";

const drivingSince = (iso?: string): string => {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `Driving since ${d.toLocaleDateString(undefined, { month: "long", year: "numeric" })}`;
};

/** "just now", "3 min ago", "2 h ago" for the position stamp. */
const freshness = (iso?: string, now = new Date()): string => {
  if (!iso) return "";
  const t = new Date(iso).getTime();
  if (Number.isNaN(t)) return "";
  const min = Math.round((now.getTime() - t) / 60000);
  if (min < 1) return "just now";
  if (min < 60) return `${min} min ago`;
  const h = Math.floor(min / 60);
  if (h < 24) return `${h} h ago`;
  return h < 48 ? "yesterday" : `${Math.floor(h / 24)} days ago`;
};

const LIVE_LABEL: Record<string, string> = {
  heading_to_pickup: "Heading to pickup",
  arrived: "At the pickup",
  in_progress: "Trip in progress",
  en_route: "Trip in progress",
  confirmed: "Confirmed",
};

/**
 * "Now" card: where the driver is and what they are doing. Location is only
 * tracked during a trip, so the map shows the live ride's driverLocation
 * and nothing otherwise.
 */
function DriverNowCard({
  profile,
  live,
  next,
  now,
}: {
  profile: UserProfile;
  live: RideRequest | undefined;
  next: RideRequest | undefined;
  now: Date;
}) {
  const { colors } = useTheme();
  const pos = live?.driverLocation ?? null;
  const target = live ?? next;
  const toDropoff = !!live && live.status === "in_progress";
  const targetPoint = target
    ? pointOf(toDropoff ? target.destination : target.pickup)
    : null;
  const km = pos && targetPoint ? kmFromDriver(pos, targetPoint) : null;

  const status = live
    ? `${LIVE_LABEL[live.status] ?? "On a ride"} · ${live.clientFirstName || "rider"}`
    : profile.isOnline
      ? "Online · waiting for requests"
      : "Offline";
  const nextLine = target
    ? `${toDropoff ? "Drop-off" : "Pickup"}${km !== null ? ` · ${formatKm(km)} away` : ""}${
        !live && target.scheduledTime
          ? ` · ${timeUntil(target.scheduledTime, now)}`
          : ""
      }`
    : "";

  return (
    <Group>
      {pos ? (
        <View>
          <RideMap
            style={styles.map}
            driver={pos}
            pickup={toDropoff ? null : targetPoint}
            dropoff={toDropoff ? targetPoint : null}
            interactive={false}
            followFrame
          />
          <View style={[styles.stamp, { backgroundColor: colors.backdrop }]}>
            <AppText variant="small" style={{ color: "#FFFFFF" }}>
              {pos.updatedAt
                ? `Updated ${freshness(pos.updatedAt, now)}`
                : "Last known position"}
            </AppText>
          </View>
        </View>
      ) : null}
      <KvRow label="Now" value={status} />
      {nextLine ? (
        <KvRow label={live ? "Heading to" : "Next"} value={nextLine} />
      ) : null}
      {!pos ? (
        <KvRow
          label="Location"
          value={
            live ? "Waiting for the driver's location" : "Shown during a trip"
          }
          muted
        />
      ) : null}
    </Group>
  );
}

export default function AdminDriverDetail() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [tab, setTab] = useState<Tab>("activity");
  const [now] = useState(() => new Date());
  const load = useCallback(() => fetchDriverDetail(id ?? ""), [id]);
  const { data, loading, error, refreshing, reload, onRefresh } = useAdminLoad(
    load,
    "Couldn't load this driver. Check your connection and try again.",
  );
  const notFound = !loading && data === null && !error;

  const p = data?.profile;
  // Same arithmetic as the driver's own Earnings page.
  const stats = useMemo(
    () => (data ? buildDriverStats("month", data.rides) : null),
    [data],
  );
  const weeks = useMemo(() => (data ? buildWeeklyPay(data.rides) : []), [data]);
  const buckets = useMemo(
    () => bucketOpenRides(data?.openRides ?? [], now),
    [data, now],
  );
  const completed = useMemo(
    () => (data ? data.rides.filter((r) => r.status === "completed") : []),
    [data],
  );
  const lastRide = completed[0];
  const recent = data ? data.rides.slice(0, 5) : [];
  const live = buckets.today.live[0];
  const next =
    buckets.today.upNext[0] ??
    buckets.upcoming.find((r) => r.status === "accepted");
  const todayRows = useMemo(
    () =>
      [
        ...buckets.today.upNext,
        ...buckets.today.waiting,
        ...buckets.today.done,
      ].sort(
        (a, b) =>
          new Date(a.scheduledTime || "").getTime() -
          new Date(b.scheduledTime || "").getTime(),
      ),
    [buckets],
  );
  const upcomingGroups = groupRidesByDay(
    buckets.upcoming,
    now,
    "asc",
    upcomingDayLabel,
  );
  const upAccepted = buckets.upcoming.filter(
    (r) => r.status === "accepted",
  ).length;
  const upWaiting = buckets.upcoming.filter(
    (r) => r.status === "pending",
  ).length;

  const openRide = (rideId: string) =>
    router.push({
      pathname: "/admin/ride/[id]",
      params: { id: rideId },
    } as never);
  const name = p
    ? `${p.firstName ?? ""} ${p.lastName ?? ""}`.trim() || "Driver"
    : "";
  const pill = p ? driverStatusPill(p) : null;
  if (pill && p?.isApproved === false) pill.label = "Pending approval";
  const v = p?.vehicle;

  return (
    <AdminScreen refreshing={refreshing} onRefresh={onRefresh}>
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : notFound ? (
        <EmptyBox text="This driver's account no longer exists." />
      ) : loading || !data || !p || !stats || !pill ? (
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
                tint={colors.primary}
              />
            }
            name={name}
            sub={vehicleLabel(p)}
            right={<Pill tone={pill.tone} label={pill.label} />}
          />
          <SegmentedControl
            options={[
              { value: "activity", label: "Activity" },
              { value: "pay", label: "Pay" },
              { value: "profile", label: "Profile" },
            ]}
            value={tab}
            onChange={setTab}
          />

          {tab === "activity" ? (
            <>
              <DriverNowCard profile={p} live={live} next={next} now={now} />
              {buckets.today.live.map((r) => (
                <AdminLiveCard
                  key={r.id}
                  ride={r}
                  onPress={() => openRide(r.id as string)}
                />
              ))}
              <View>
                <SectionHead
                  title={`Today · ${now.toLocaleDateString(undefined, { weekday: "short", month: "short", day: "numeric" })}`}
                  caption={
                    todayRows.length === 1
                      ? "1 ride"
                      : `${todayRows.length} rides`
                  }
                />
                {todayRows.length === 0 ? (
                  <EmptyBox text="No rides today." />
                ) : (
                  <Group>
                    {todayRows.map((r) => (
                      <AdminRideRow
                        key={r.id}
                        ride={r}
                        countdown={r.status === "accepted"}
                        now={now}
                        hideDriver
                        onPress={() => openRide(r.id as string)}
                      />
                    ))}
                  </Group>
                )}
              </View>
              <View>
                <SectionHead
                  title="Upcoming"
                  caption={
                    buckets.upcoming.length === 0
                      ? undefined
                      : [
                          upAccepted > 0 && `${upAccepted} accepted`,
                          upWaiting > 0 && `${upWaiting} waiting`,
                        ]
                          .filter(Boolean)
                          .join(" · ")
                  }
                />
                {upcomingGroups.length === 0 ? (
                  <EmptyBox text="Nothing booked beyond today." />
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
                              hideDriver
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
                  action={{
                    label: "See all",
                    onPress: () =>
                      router.push({
                        pathname: "/admin/drivers/[id]/rides",
                        params: { id: p.uid },
                      } as never),
                  }}
                />
                {recent.length === 0 ? (
                  <EmptyBox text="No completed rides yet." />
                ) : (
                  <Group>
                    {recent.map((r) => (
                      <AdminRideRow
                        key={r.id}
                        ride={r}
                        hideDriver
                        onPress={() => openRide(r.id as string)}
                      />
                    ))}
                  </Group>
                )}
              </View>
            </>
          ) : tab === "pay" ? (
            <>
              <View>
                <SectionHead title="This month" caption={stats.periodLabel} />
                <Tiles
                  items={[
                    {
                      label: "Earned",
                      value: `$${Math.round(stats.earned).toLocaleString()}`,
                    },
                    { label: "Rides", value: stats.rides },
                    { label: "Km", value: fmtKm(stats.km) },
                  ]}
                />
              </View>
              {/* Weekly pay: what to hand the driver at the end of each week. */}
              <View>
                <SectionHead title="Weekly pay" caption="Mon – Sun" />
                {weeks.length === 0 ? (
                  <EmptyBox text="No pay weeks yet." />
                ) : (
                  <Group>
                    {weeks.map((w) => (
                      <LinkRow
                        key={w.key}
                        title={
                          <AppText variant="bodyStrong" numberOfLines={1}>
                            {w.label}
                            {w.current ? (
                              <AppText variant="body" color="textMuted">
                                {" · in progress"}
                              </AppText>
                            ) : null}
                          </AppText>
                        }
                        sub={`${w.rides === 1 ? "1 ride" : `${w.rides} rides`}${w.km > 0 ? ` · ${fmtKm(w.km)} km` : ""}${w.cancellationEarnings > 0 ? ` · ${money(w.cancellationEarnings)} fees` : ""}`}
                        right={
                          <AppText
                            variant="bodyStrong"
                            color={w.earned === 0 ? "textMuted" : "primary"}
                          >
                            {money(w.earned)}
                          </AppText>
                        }
                        onPress={() =>
                          router.push({
                            pathname: "/admin/drivers/[id]/weeks/[week]",
                            params: { id: p.uid, week: w.key },
                          } as never)
                        }
                      />
                    ))}
                  </Group>
                )}
              </View>
              <Group>
                <KvRow
                  label="Lifetime earned"
                  value={money(stats.lifetime.earned)}
                />
                <KvRow
                  label="Lifetime rides"
                  value={String(stats.lifetime.rides)}
                  muted
                />
              </Group>
            </>
          ) : (
            <>
              <View style={styles.identity}>
                <Avatar
                  firstName={p.firstName}
                  lastName={p.lastName}
                  photoUrl={p.photoUrl}
                  size={96}
                  tint={colors.primary}
                />
                <AppText variant="title" align="center">
                  {name}
                </AppText>
                <AppText variant="small" color="textSecondary">
                  {drivingSince(p.createdAt) || " "}
                </AppText>
                <Pill tone={pill.tone} label={pill.label} large />
              </View>
              <StatsStrip
                rideCount={stats.lifetime.rides}
                totalKm={stats.lifetime.km}
                rating={p.rating}
                ratingCount={p.ratingCount}
                memberSince={p.createdAt}
              />
              <View>
                <SectionHead title="Vehicle" />
                <Group>
                  <LinkRow
                    icon="car-sport-outline"
                    title={vehicleLabel(p)}
                    sub={v?.plateNumber ? `Plate ${v.plateNumber}` : undefined}
                  />
                </Group>
              </View>
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
                  <KvRow
                    label="Location sharing"
                    value="During trips only"
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
  map: { height: 170 },
  stamp: {
    position: "absolute",
    left: spacing.sm,
    bottom: spacing.sm,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radius.sm,
  },
});
