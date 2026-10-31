import { useCallback } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import {
  AdminScreen,
  EmptyBox,
  ErrorBox,
  Group,
  KvRow,
  LinkRow,
  Loading,
  Pill,
  SectionHead,
  fmtKm,
  money,
  personName,
  rideStatusPill,
  useAdminLoad,
  whenLabel,
} from "../../../components/admin/AdminUi";
import { AppText } from "../../../components/ui/AppText";
import { useTheme } from "../../../contexts/ThemeContext";
import {
  fetchRide,
  rideCost,
  rideKm,
} from "../../../services/adminStatsService";
import { rideEarned } from "../../../services/driverStatsService";
import { discountLabel } from "../../../utils/promoLabels";
import { spacing } from "../../../theme/tokens";

/**
 * Read-only view of one ride for the product owner: the rider's price AND
 * the driver's payout side by side (the user-facing ride pages show only
 * one, from the signed-in user's perspective).
 */
export default function AdminRideDetail() {
  const router = useRouter();
  const { colors } = useTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const load = useCallback(() => fetchRide(id ?? ""), [id]);
  const {
    data: r,
    loading,
    error,
    refreshing,
    reload,
    onRefresh,
  } = useAdminLoad(
    load,
    "Couldn't load this ride. Check your connection and try again.",
  );
  const notFound = !loading && r === null && !error;

  const pill = r ? rideStatusPill(r) : null;
  const done = r?.status === "completed";
  const cancelled = r?.status === "cancelled";
  const cost = r ? rideCost(r) : 0;
  const payout = r ? rideEarned(r) : 0;
  const bookedKm = Number(r?.distance) || 0;
  const actualKm = r?.actualDistanceKm;

  return (
    <AdminScreen refreshing={refreshing} onRefresh={onRefresh}>
      {error ? (
        <ErrorBox message={error} onRetry={reload} />
      ) : notFound ? (
        <EmptyBox text="This ride no longer exists." />
      ) : loading || !r || !pill ? (
        <Loading />
      ) : (
        <>
          <View style={styles.head}>
            <Pill tone={pill.tone} label={pill.label} large />
            <AppText variant="bodyStrong" style={styles.flex}>
              {whenLabel(r.scheduledTime)}
            </AppText>
            {r.isTest ? <Pill tone="muted" label="sandbox" /> : null}
          </View>

          <Group>
            <LinkRow
              icon="person-outline"
              title={personName(r.clientFirstName, r.clientLastName, "Rider")}
              sub={`Rider${r.passengerName ? ` · booked for ${r.passengerName}` : ""}`}
              onPress={() =>
                router.push({
                  pathname: "/admin/clients/[id]",
                  params: { id: r.clientId },
                } as never)
              }
            />
            {r.driverId ? (
              <LinkRow
                icon="car-sport-outline"
                title={personName(
                  r.driverFirstName,
                  r.driverLastName,
                  "Driver",
                )}
                sub={`Driver${r.driverVehicle ? ` · ${[r.driverVehicleColor, r.driverVehicle].filter(Boolean).join(" ")}` : ""}${r.driverPlateNumber ? ` · ${r.driverPlateNumber}` : ""}`}
                onPress={() =>
                  router.push({
                    pathname: "/admin/drivers/[id]",
                    params: { id: r.driverId },
                  } as never)
                }
              />
            ) : (
              <LinkRow icon="car-sport-outline" title="No driver yet" />
            )}
          </Group>

          <Group>
            <LinkRow
              icon="location-outline"
              iconColor={colors.secondary}
              title={r.pickup?.address || "—"}
              sub="Pickup"
            />
            <LinkRow
              icon="flag-outline"
              iconColor={colors.primary}
              title={r.destination?.address || "—"}
              sub="Drop-off"
            />
          </Group>

          <View>
            <SectionHead title="Trip" />
            <Group>
              <KvRow label="Booked distance" value={`${fmtKm(bookedKm)} km`} />
              {typeof actualKm === "number" ? (
                <KvRow
                  label={r.endedEarly ? "Driven (ended early)" : "Driven"}
                  value={`${fmtKm(actualKm)} km`}
                />
              ) : null}
              {done ? (
                <KvRow label="Km credited" value={`${fmtKm(rideKm(r))} km`} />
              ) : null}
              <KvRow
                label={
                  done
                    ? "Rider paid"
                    : cancelled
                      ? "Cancellation fee"
                      : "Rider price"
                }
                value={cost > 0 ? money(cost) : "—"}
              />
              {typeof r.discountAmount === "number" && r.discountAmount > 0 ? (
                <KvRow
                  label={
                    r.promoId
                      ? discountLabel(r)
                      : `Coupon${r.couponCode ? ` ${r.couponCode}` : ""}`
                  }
                  value={`− ${money(r.discountAmount)}`}
                  muted
                />
              ) : null}
              <KvRow
                label={
                  cancelled ? "Driver payout (fee share)" : "Driver payout"
                }
                value={payout > 0 ? money(payout) : "—"}
              />
              <KvRow
                label="Payment"
                value={
                  r.paymentStatus === "paid_direct"
                    ? "Direct to driver"
                    : (r.paymentStatus ?? "—").replace(/_/g, " ")
                }
                muted
              />
            </Group>
          </View>

          {cancelled || r.status === "declined" ? (
            <View>
              <SectionHead title={cancelled ? "Cancellation" : "Decline"} />
              <Group>
                {cancelled ? (
                  <KvRow
                    label="Cancelled by"
                    value={
                      r.cancelledBy === "system"
                        ? r.systemExpiryType === "driver_no_start"
                          ? "System (driver didn't start)"
                          : "System (no driver in time)"
                        : r.cancelledBy === "driver"
                          ? "Driver"
                          : r.cancelledBy === "client"
                            ? "Rider"
                            : "—"
                    }
                  />
                ) : null}
                {cancelled ? (
                  <KvRow label="When" value={whenLabel(r.cancelledAt)} muted />
                ) : null}
                {cancelled && r.cancellationReason ? (
                  <KvRow label="Reason" value={r.cancellationReason} muted />
                ) : null}
                {(r.declinedBy ?? []).map((d, i) => (
                  <KvRow
                    key={i}
                    label={`Declined${d.timestamp ? ` · ${whenLabel(d.timestamp)}` : ""}`}
                    value={d.reason || "No reason"}
                    muted
                  />
                ))}
              </Group>
            </View>
          ) : null}

          {(r.forwardHistory ?? []).length > 0 ? (
            <View>
              <SectionHead title="Hand-offs" />
              <Group>
                {r.forwardHistory!.map((f, i) => (
                  <LinkRow
                    key={i}
                    title={`${f.fromDriverFirstName} declined → offered to ${f.toDriverFirstName}`}
                    sub={`${whenLabel(f.at)}${f.reason ? ` · ${f.reason}` : ""}`}
                  />
                ))}
              </Group>
            </View>
          ) : null}

          {typeof r.driverRatingByClient === "number" ? (
            <Group>
              <LinkRow
                icon="star"
                iconColor={colors.accent}
                title={`${r.driverRatingByClient.toFixed(0)} ★ from the rider`}
                sub={r.clientReviewText ? `“${r.clientReviewText}”` : undefined}
              />
            </Group>
          ) : null}

          <View>
            <SectionHead title="Timeline" />
            <Group>
              <KvRow label="Booked" value={whenLabel(r.createdAt)} muted />
              <KvRow label="Pickup time" value={whenLabel(r.scheduledTime)} />
              {r.headedToPickupAt ? (
                <KvRow
                  label="Driver set off"
                  value={whenLabel(r.headedToPickupAt)}
                  muted
                />
              ) : null}
              {r.arrivedAtPickupAt ? (
                <KvRow
                  label="Arrived"
                  value={whenLabel(r.arrivedAtPickupAt)}
                  muted
                />
              ) : null}
              {r.tripStartedAt ? (
                <KvRow
                  label="Trip started"
                  value={whenLabel(r.tripStartedAt)}
                  muted
                />
              ) : null}
              {r.completedAt || r.tripCompletedAt ? (
                <KvRow
                  label="Completed"
                  value={whenLabel(r.completedAt ?? r.tripCompletedAt)}
                />
              ) : null}
            </Group>
          </View>
        </>
      )}
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  head: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    flexWrap: "wrap",
  },
  flex: { flex: 1 },
});
