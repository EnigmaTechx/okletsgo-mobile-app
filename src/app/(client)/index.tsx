import { StyleSheet, View } from "react-native";
import { AppText } from "../../components/ui/AppText";
import { Logo } from "../../components/ui/Logo";
import { Screen } from "../../components/ui/Screen";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../theme/tokens";

/** Client home. The map-first booking sheet and trip cards arrive in phase 2. */
export default function ClientHome() {
  const { userProfile } = useAuth();
  const { colors } = useTheme();

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View>
          <AppText variant="eyebrow" color="secondary">
            RIDER
          </AppText>
          <AppText variant="title">
            Hi {userProfile?.firstName ?? "there"}
          </AppText>
        </View>
        <Logo width={110} />
      </View>

      <View
        style={[
          styles.card,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <AppText variant="heading">Booking is on its way</AppText>
        <AppText variant="small" color="textSecondary">
          Phase 2 brings the map-first home, the four-step booking flow and live
          trip tracking to this build. Until then, keep using the current OK
          Let&apos;s Go app to book.
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.xl,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
});
