import React from "react";
import { StyleSheet, View } from "react-native";
import { Screen } from "./ui/Screen";
import { AppText } from "./ui/AppText";

/**
 * A labelled stand-in for a screen that lands in a later phase. Every route in
 * the Ionic app has a home in the new shell from day one; these fill in as the
 * parity tracker moves.
 */
export function PlaceholderScreen({
  title,
  phase,
  children,
}: {
  title: string;
  phase: number;
  children?: React.ReactNode;
}) {
  return (
    <Screen scroll>
      <View style={styles.header}>
        <AppText variant="title">{title}</AppText>
        <AppText variant="small" color="textMuted">
          Lands in phase {phase} of the migration.
        </AppText>
      </View>
      {children}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: 20, gap: 4 },
});
