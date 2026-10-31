import { StyleSheet, View } from "react-native";
import { Redirect } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "../../components/ui/AppText";
import { Screen } from "../../components/ui/Screen";
import { FEATURES } from "../../config/features";
import { useFeatureFlags } from "../../contexts/FeatureFlagsContext";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../theme/tokens";

/**
 * The Payment page (Ionic `pages/common/Payment.tsx`), behind the `payment`
 * remote flag. Until card payments go live (FEATURES.STRIPE_PAYMENTS, a
 * build-time switch) it is the "coming soon" notice; the Stripe card vault
 * (createSetupIntent + the native payment sheet) replaces it then.
 */
export default function Payment() {
  const { colors } = useTheme();
  const { loaded, isVisible } = useFeatureFlags();
  if (loaded && !isVisible("payment")) return <Redirect href="/" />;

  return (
    <Screen edges={["left", "right"]}>
      {FEATURES.STRIPE_PAYMENTS ? null : (
        <View style={styles.center}>
          <View
            style={[styles.icon, { backgroundColor: colors.surfaceRaised }]}
          >
            <Ionicons name="card-outline" size={36} color={colors.primary} />
          </View>
          <AppText variant="title" align="center">
            Card Payments Coming Soon
          </AppText>
          <AppText variant="body" color="textSecondary" align="center">
            During our soft launch, all trips are paid directly to your driver,
            cash or e-transfer. Card payments will be available in a future
            update.
          </AppText>
          <View
            style={[
              styles.note,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            <Ionicons name="time-outline" size={20} color={colors.primary} />
            <AppText variant="small" color="textSecondary" style={styles.flex}>
              We&apos;ll notify you as soon as in-app payments are live.
            </AppText>
          </View>
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  center: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.lg,
    paddingBottom: 80,
  },
  icon: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: "center",
    justifyContent: "center",
  },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    alignSelf: "stretch",
  },
  flex: { flex: 1 },
});
