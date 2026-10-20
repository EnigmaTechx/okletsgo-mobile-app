import React from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { Logo } from "./Logo";

/**
 * Branded loader shown between the native splash and the first screen while
 * auth and the profile resolve, so there is never a blank frame or a bare
 * spinner. Matches the splash background.
 */
export function LoadingScreen() {
  const { colors } = useTheme();
  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <Logo width={220} />
      <ActivityIndicator
        size="large"
        color={colors.primary}
        style={styles.spinner}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  spinner: { marginTop: 28 },
});
