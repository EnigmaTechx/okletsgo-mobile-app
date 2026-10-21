import { StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";

export type RideOutcomeVariant = "declined" | "cancelled" | "expired";

export interface RideOutcome {
  variant: RideOutcomeVariant;
  driverName?: string;
  reason?: string;
  rideId: string;
  canViewDetails: boolean;
}

interface Props {
  outcome: RideOutcome | null;
  onBookAgain: () => void;
  onViewDetails: (rideId: string) => void;
  onDismiss: () => void;
}

/**
 * One branded notice for the three "your ride went away" outcomes:
 * declined, cancelled by the driver, or expired with no driver.
 */
export function RideOutcomeDialog({
  outcome,
  onBookAgain,
  onViewDetails,
  onDismiss,
}: Props) {
  const { colors } = useTheme();
  const variant = outcome?.variant ?? "declined";
  const who = outcome?.driverName || "Your driver";
  const meta = {
    declined: {
      icon: "close-circle" as const,
      accent: colors.danger,
      header: "Ride declined",
      body: `${who} declined your request.`,
    },
    cancelled: {
      icon: "alert-circle" as const,
      accent: colors.danger,
      header: "Ride cancelled",
      body: `${who} cancelled your ride.`,
    },
    expired: {
      icon: "time" as const,
      accent: colors.accent,
      header: "No driver available",
      body: "No driver accepted your request in time. Please try booking again.",
    },
  }[variant];
  const reason = outcome?.reason?.trim();
  const showReason = !!reason && !/^no reason provided\.?$/i.test(reason);

  return (
    <Dialog visible={!!outcome}>
      <View style={[styles.badge, { backgroundColor: colors.surfaceRaised }]}>
        <Ionicons name={meta.icon} size={38} color={meta.accent} />
      </View>
      <AppText variant="title" align="center">
        {meta.header}
      </AppText>
      <AppText variant="body" color="textSecondary" align="center">
        {meta.body}
      </AppText>
      {showReason ? (
        <View
          style={[
            styles.reason,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <AppText variant="eyebrow" color="textMuted">
            REASON
          </AppText>
          <AppText variant="bodyStrong">{reason}</AppText>
        </View>
      ) : null}
      <Button title="Book again" onPress={onBookAgain} style={styles.cta} />
      <Button
        title={outcome?.canViewDetails ? "View details" : "Dismiss"}
        variant="ghost"
        onPress={() =>
          outcome?.canViewDetails ? onViewDetails(outcome.rideId) : onDismiss()
        }
      />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  badge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  reason: {
    alignSelf: "stretch",
    borderRadius: radius.md,
    borderWidth: 1,
    padding: spacing.md,
    gap: 2,
    marginTop: spacing.sm,
  },
  cta: { marginTop: spacing.lg },
});
