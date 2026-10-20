import React from "react";
import { StyleSheet, View } from "react-native";
import { Screen } from "../../components/ui/Screen";
import { AppText } from "../../components/ui/AppText";
import { Logo } from "../../components/ui/Logo";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../theme/tokens";

/** Driver home. The online toggle, request sheet and active trip arrive in phase 3. */
export default function DriverHome() {
  const { userProfile } = useAuth();
  const { colors } = useTheme();
  const online = !!userProfile?.isOnline;

  return (
    <Screen scroll>
      <View style={styles.header}>
        <View>
          <AppText variant="eyebrow" color="primary">
            DRIVER
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
          {
            backgroundColor: colors.surface,
            borderColor: online ? colors.success : colors.border,
          },
        ]}
      >
        <AppText variant="heading" color={online ? "success" : "text"}>
          {online ? "You're online" : "You're offline"}
        </AppText>
        <AppText variant="small" color="textSecondary">
          Going online, ride requests and the active trip screen arrive in phase
          3. Until then, keep using the current OK Let&apos;s Go app to drive.
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
