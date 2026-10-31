import { StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { MenuRow } from "../../components/ui/MenuRow";
import { Screen } from "../../components/ui/Screen";
import { showAlert } from "../../components/ui/alerts";
import { useAuth } from "../../contexts/AuthContext";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../theme/tokens";

/**
 * Earnings & Payouts prototype (Ionic `pages/common/Earnings.tsx`), behind
 * the `driver_payouts` remote flag. Cash Out and Link Bank Account are
 * placeholders until a payout provider is wired up; the admin dashboard
 * says so on the flag.
 */
export default function DriverPayouts() {
  const { colors } = useTheme();
  const { userProfile } = useAuth();
  const { loaded, isVisible } = useFeatureFlags();
  if (loaded && !isVisible("driver_payouts")) return <Redirect href="/" />;

  const balance = userProfile?.earnings || 0;
  const soon = () =>
    showAlert(
      "Coming soon",
      "Payouts to your bank account are not available yet.",
    );

  return (
    <Screen scroll edges={["left", "right"]}>
      <View
        style={[
          styles.hero,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <AppText variant="eyebrow" color="textMuted">
          AVAILABLE BALANCE
        </AppText>
        <AppText variant="display">${balance.toFixed(2)}</AppText>
        <Button
          title="Cash Out Now"
          onPress={soon}
          disabled={balance <= 0}
          style={styles.cta}
        />
      </View>

      <AppText variant="heading" style={styles.section}>
        Linked Bank Account
      </AppText>
      <View
        style={[
          styles.group,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <MenuRow
          icon="cash-outline"
          label="Add Bank Account"
          detail="For direct deposits"
          value="Link"
          onPress={soon}
        />
      </View>

      <AppText variant="heading" style={styles.section}>
        Recent Payouts
      </AppText>
      <View style={styles.empty}>
        <Ionicons name="cash-outline" size={40} color={colors.textMuted} />
        <AppText variant="bodyStrong" color="textMuted">
          No recent payouts.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: {
    marginTop: spacing.lg,
    padding: spacing.xl,
    borderRadius: radius.xl,
    borderWidth: 1,
    alignItems: "center",
    gap: spacing.sm,
  },
  cta: { marginTop: spacing.md, alignSelf: "stretch" },
  section: { marginTop: spacing.xxl, marginBottom: spacing.md },
  group: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  empty: {
    alignItems: "center",
    gap: spacing.sm,
    paddingVertical: spacing.xxl,
  },
});
