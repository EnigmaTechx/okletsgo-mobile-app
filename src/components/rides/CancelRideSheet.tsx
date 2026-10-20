import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { FEATURES } from "../../config/features";
import type { RideRequest } from "../../interfaces/ride";
import {
  MID_TRIP_CANCELLATION_FEE,
  SERVICE_FEE,
  earlyCancellationFee,
} from "../../utils/fareCalculator";
import { cad } from "../../utils/money";
import { radius, spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { Sheet } from "../ui/Sheet";

const PRE_TRIP_REASONS = [
  "Driver is taking too long",
  "Changed my mind",
  "Booked by mistake",
  "Other",
];
const MID_TRIP_REASONS = [
  "Need to get out early",
  "Change of plans",
  "Safety concern",
  "Other",
];

interface Props {
  visible: boolean;
  ride: RideRequest;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/** "Cancel ride" / "End trip early": the warning, a reason, two buttons. */
export function CancelRideSheet({ visible, ride, onClose, onConfirm }: Props) {
  const { colors } = useTheme();
  const inProgress = ride.status === "in_progress";
  const reasons = inProgress ? MID_TRIP_REASONS : PRE_TRIP_REASONS;
  const [reason, setReason] = useState(reasons[0]);

  const total = ride.totalClientCharge || 0;
  const feeApplies = FEATURES.STRIPE_PAYMENTS && ride.status !== "pending";
  const message = inProgress
    ? `Your trip is already in progress. Ending it now will charge you for the distance covered so far, plus the ${cad(SERVICE_FEE)} service fee and a ${cad(MID_TRIP_CANCELLATION_FEE)} mid-trip cancellation fee.`
    : feeApplies
      ? `Are you sure you want to cancel? A 20% cancellation fee (${cad(earlyCancellationFee(total))}) will be charged because the driver has already been dispatched.`
      : ride.status === "pending"
        ? "Are you sure you want to cancel? You will not be charged."
        : "Are you sure you want to cancel? Please select a reason below.";

  return (
    <Sheet visible={visible} onClose={onClose}>
      <View style={styles.header}>
        <Ionicons
          name={inProgress ? "warning-outline" : "close-circle-outline"}
          size={34}
          color={colors.primary}
        />
        <AppText variant="title">
          {inProgress ? "End trip early?" : "Cancel ride"}
        </AppText>
      </View>
      <AppText variant="body" color="textSecondary">
        {message}
      </AppText>
      <View style={styles.options}>
        {reasons.map((opt) => {
          const selected = opt === reason;
          return (
            <Pressable
              key={opt}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setReason(opt)}
              style={[
                styles.option,
                {
                  backgroundColor: selected
                    ? colors.surfaceRaised
                    : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: selected ? colors.primary : colors.textMuted,
                    backgroundColor: selected ? colors.primary : "transparent",
                  },
                ]}
              />
              <AppText variant="bodyStrong">{opt}</AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.actions}>
        <Button
          title={inProgress ? "Continue trip" : "Keep ride"}
          variant="secondary"
          onPress={onClose}
          style={styles.half}
        />
        <Button
          title={inProgress ? "End trip" : "Cancel ride"}
          onPress={() => onConfirm(reason)}
          style={styles.half}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: spacing.sm },
  options: { gap: spacing.sm, marginTop: spacing.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  half: { flex: 1 },
});
