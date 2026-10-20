import { useState } from "react";
import { StyleSheet, View } from "react-native";
import type { RideRequest } from "../../interfaces/ride";
import { requestRideTimeChange } from "../../services/rideService";
import { spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { DateTimeField } from "../ui/DateTimeField";
import { Sheet } from "../ui/Sheet";
import { useToast } from "../ui/Toast";

interface Props {
  visible: boolean;
  ride: RideRequest;
  onClose: () => void;
}

/** Combine the day from one date with the clock time of another. */
const merge = (day: Date, time: Date): Date =>
  new Date(
    day.getFullYear(),
    day.getMonth(),
    day.getDate(),
    time.getHours(),
    time.getMinutes(),
  );

/**
 * Change the pickup time of an upcoming ride. Like booking it only forbids
 * the past; a material change on an accepted ride needs the driver's
 * approval, which the server decides.
 */
export function EditRideTimeSheet({ visible, ride, onClose }: Props) {
  const toast = useToast();
  const [value, setValue] = useState(() => new Date(ride.scheduledTime));
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const close = () => {
    setValue(new Date(ride.scheduledTime));
    setError(null);
    setSubmitting(false);
    onClose();
  };

  const submit = async () => {
    setError(null);
    if (Number.isNaN(value.getTime()))
      return setError("Please pick a valid time.");
    if (value.getTime() <= Date.now())
      return setError("Pick a time in the future.");
    if (
      Math.abs(value.getTime() - new Date(ride.scheduledTime).getTime()) <
      60_000
    )
      return setError("That's the same pickup time.");
    setSubmitting(true);
    try {
      const res = await requestRideTimeChange(
        ride.id as string,
        value.toISOString(),
      );
      toast(
        res.pendingApproval
          ? "Change requested. Waiting for your driver to approve."
          : "Pickup time updated.",
        { type: "success" },
      );
      close();
    } catch (err) {
      setError(
        (err instanceof Error && err.message) ||
          "Couldn't change the time. Please try again.",
      );
      setSubmitting(false);
    }
  };

  const now = new Date();
  return (
    <Sheet visible={visible} onClose={close} dismissible={!submitting}>
      <AppText variant="title">Change pickup time</AppText>
      <AppText variant="small" color="textSecondary">
        Pick a new date and time for this trip. If your driver has already
        accepted, the change needs their approval.
      </AppText>
      <DateTimeField
        mode="date"
        label="Pickup date"
        value={value}
        minimumDate={now}
        onChange={(d) => setValue(merge(d, value))}
        disabled={submitting}
      />
      <DateTimeField
        mode="time"
        label="Pickup time"
        value={value}
        onChange={(t) => setValue(merge(value, t))}
        disabled={submitting}
      />
      {error ? (
        <AppText variant="smallStrong" color="danger">
          {error}
        </AppText>
      ) : null}
      <View style={styles.actions}>
        <Button
          title="Cancel"
          variant="secondary"
          onPress={close}
          disabled={submitting}
          style={styles.half}
        />
        <Button
          title="Save time"
          onPress={() => void submit()}
          loading={submitting}
          style={styles.half}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.sm },
  half: { flex: 1 },
});
