import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import * as Application from "expo-application";
import { Screen } from "./ui/Screen";
import { AppText } from "./ui/AppText";
import { Button } from "./ui/Button";
import { showAlert } from "./ui/alerts";
import { useAuth } from "../contexts/AuthContext";
import { type ThemePreference, useTheme } from "../contexts/ThemeContext";
import { radius, spacing } from "../theme/tokens";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/** Shared by the client and driver Account tabs until phase 1 fills them in. */
export function AccountScreen() {
  const { userProfile, currentUser, logout } = useAuth();
  const { colors, preference, setPreference } = useTheme();

  const confirmLogout = () =>
    showAlert("Sign out?", "You'll need a new text code to sign back in.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void logout() },
    ]);

  return (
    <Screen scroll>
      <View style={styles.header}>
        <AppText variant="eyebrow" color={userProfile?.role === "driver" ? "primary" : "secondary"}>
          {userProfile?.role === "driver" ? "DRIVER" : "CUSTOMER"}
        </AppText>
        <AppText variant="title">
          {userProfile ? `${userProfile.firstName} ${userProfile.lastName}` : "Account"}
        </AppText>
        <AppText variant="small" color="textMuted">
          {currentUser?.phoneNumber ?? ""}
        </AppText>
      </View>

      <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <AppText variant="eyebrow" color="textMuted">
          APPEARANCE
        </AppText>
        <View style={styles.segments}>
          {THEME_OPTIONS.map((o) => {
            const active = preference === o.value;
            return (
              <Pressable
                key={o.value}
                accessibilityRole="button"
                accessibilityState={{ selected: active }}
                onPress={() => setPreference(o.value)}
                style={[
                  styles.segment,
                  {
                    backgroundColor: active ? colors.primary : colors.surfaceRaised,
                    borderColor: active ? colors.primary : colors.border,
                  },
                ]}
              >
                <AppText variant="smallStrong" style={{ color: active ? colors.onPrimary : colors.text }}>
                  {o.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>

      <View style={styles.footer}>
        <Button title="Sign out" variant="secondary" onPress={confirmLogout} />
        <AppText variant="small" color="textMuted" align="center">
          OK Let&apos;s Go {Application.nativeApplicationVersion ?? ""} ({Application.nativeBuildVersion ?? "dev"})
        </AppText>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: spacing.xl, gap: spacing.xs },
  card: { padding: spacing.lg, borderRadius: radius.lg, borderWidth: 1, gap: spacing.md },
  segments: { flexDirection: "row", gap: spacing.sm },
  segment: {
    flex: 1,
    minHeight: 44,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  footer: { marginTop: "auto", paddingTop: spacing.xxl, gap: spacing.lg },
});
