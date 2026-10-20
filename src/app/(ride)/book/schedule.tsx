import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { useBooking } from "../../../components/booking/BookingContext";
import { RouteTimeline } from "../../../components/rides/RouteTimeline";
import { AppText } from "../../../components/ui/AppText";
import { Button } from "../../../components/ui/Button";
import { DateTimeField } from "../../../components/ui/DateTimeField";
import { Screen } from "../../../components/ui/Screen";
import { showAlert } from "../../../components/ui/alerts";
import { useTheme } from "../../../contexts/ThemeContext";
import { cad } from "../../../utils/money";
import { radius, spacing } from "../../../theme/tokens";

/** Top of the next hour: the default pickup time, as in the Ionic app. */
const nextHour = (): Date => {
  const d = new Date();
  d.setMinutes(0, 0, 0);
  d.setHours(d.getHours() + 1);
  return d;
};

const merge = (day: Date, time: Date): Date =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    time.getHours(),
    time.getMinutes(),
  );

/**
 * Step 2 of 4: when. Any future time is allowed; the request is deferred
 * to the driver, who accepts or declines it.
 */
export default function BookSchedule() {
  const router = useRouter();
  const { colors } = useTheme();
  const { draft, update } = useBooking();
  const [when, setWhen] = useState<Date>(() =>
    draft.scheduledForIso ? new Date(draft.scheduledForIso) : nextHour(),
  );

  useEffect(() => {
    if (!draft.pickup || !draft.destination)
      router.replace("/(ride)/book/locations");
  }, [draft.pickup, draft.destination, router]);

  if (!draft.pickup || !draft.destination) return null;

  const next = () => {
    if (Number.isNaN(when.getTime()))
      return showAlert("Invalid time", "Please enter a valid time.");
    if (when.getTime() < Date.now())
      return showAlert(
        "Time has passed",
        "You cannot schedule a ride in the past.",
      );
    update({ scheduledForIso: when.toISOString() });
    router.push("/(ride)/book/driver");
  };

  const summary = `${when.toLocaleDateString("en-US", { weekday: "long", month: "short", day: "numeric" })} at ${when.toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit", hour12: true })}`;

  return (
    <Screen scroll edges={["left", "right"]}>
      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <RouteTimeline
          pickup={draft.pickup.address}
          dropoff={draft.destination.address}
          compact
        />
        <View style={[styles.fareRow, { borderTopColor: colors.border }]}>
          <AppText variant="bodyStrong" color="textSecondary">
            Est. fare
          </AppText>
          <AppText variant="title" color="primary">
            {cad(draft.fare)}
          </AppText>
        </View>
      </View>

      <View style={styles.fields}>
        <DateTimeField
          mode="time"
          label="Pickup time"
          value={when}
          onChange={(t) => setWhen(merge(when, t))}
        />
        <DateTimeField
          mode="date"
          label="Pickup date"
          value={when}
          minimumDate={new Date()}
          onChange={(d) => setWhen(merge(d, when))}
        />
      </View>

      <View style={[styles.summary, { backgroundColor: colors.surfaceRaised }]}>
        <AppText variant="bodyStrong" color="primary" align="center">
          {summary}
        </AppText>
      </View>

      <Button title="Find a driver" onPress={next} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  fareRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  fields: { gap: spacing.md, marginTop: spacing.xl },
  summary: {
    marginTop: spacing.lg,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  cta: { marginTop: spacing.xxl },
});
