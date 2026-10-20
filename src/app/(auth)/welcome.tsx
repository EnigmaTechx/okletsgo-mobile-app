import React from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { AppText } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { Logo } from "../../components/ui/Logo";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing, radius } from "../../theme/tokens";

export default function Welcome() {
  const router = useRouter();
  const { colors } = useTheme();

  return (
    <Screen edges={["top", "bottom", "left", "right"]}>
      {/* Logo and copy sit together near the top; the spare height goes
          below them, above the buttons, instead of between logo and text. */}
      <View style={styles.hero}>
        <Logo width={236} />
      </View>
      <View style={styles.copy}>
        <AppText variant="eyebrow" color="success">
          WELCOME
        </AppText>
        <AppText variant="display">Your city. Your ride. Your way.</AppText>
        <AppText variant="body" color="textSecondary">
          Book in seconds, pick your driver, and follow the trip live from pickup to drop-off.
          Proudly serving Kitchener, Waterloo and Toronto.
        </AppText>
      </View>
      <View style={[styles.gift, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
        <AppText variant="smallStrong" color="accent">
          New customers ride free.
        </AppText>
        <AppText variant="small" color="textSecondary">
          Your first trip up to 10 km is on us once you finish signing up.
        </AppText>
      </View>
      <View style={styles.spacer} />
      <View style={styles.actions}>
        <Button title="Get started" onPress={() => router.push("/(auth)/login")} />
        <Button
          title="I already have an account"
          variant="secondary"
          onPress={() => router.push("/(auth)/login")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", paddingTop: spacing.xxl, paddingBottom: spacing.xl },
  copy: { gap: spacing.md, paddingHorizontal: spacing.sm },
  gift: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.xs,
  },
  spacer: { flex: 1 },
  actions: { gap: spacing.sm, paddingVertical: spacing.xl },
});
