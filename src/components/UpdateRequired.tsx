import React from "react";
import { Linking, Platform, StyleSheet, View } from "react-native";
import { useTheme } from "../contexts/ThemeContext";
import { spacing } from "../theme/tokens";
import { AppText } from "./ui/AppText";
import { Button } from "./ui/Button";
import { Logo } from "./ui/Logo";

interface Props {
  storeUrl: string;
  message?: string;
  currentBuild: number | null;
}

/**
 * Full-screen stop shown in place of the whole app when this build is older
 * than the minimum in `config/app`. No tabs, no router — the only way forward
 * is the store. (See services/appUpdateService.ts.)
 */
export function UpdateRequired({ storeUrl, message, currentBuild }: Props) {
  const { colors } = useTheme();
  const storeName = Platform.OS === "ios" ? "App Store" : "Play Store";

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Logo width={200} />
      <AppText variant="title" align="center" style={styles.title}>
        Update required
      </AppText>
      <AppText variant="body" color="textSecondary" align="center" style={styles.body}>
        {message ||
          "This version of OK Let's Go is no longer supported. Please update to keep booking rides."}
      </AppText>
      {currentBuild !== null ? (
        <AppText variant="small" color="textMuted" align="center">
          You have build {currentBuild}
        </AppText>
      ) : null}
      <Button
        title={`Open the ${storeName}`}
        onPress={() => Linking.openURL(storeUrl).catch(() => undefined)}
        style={styles.button}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 28,
    gap: spacing.lg,
  },
  title: { marginTop: spacing.sm },
  body: { maxWidth: 320 },
  button: { marginTop: spacing.lg, alignSelf: "stretch" },
});
