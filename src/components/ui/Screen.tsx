import React from "react";
import { KeyboardAvoidingView, Platform, ScrollView, StyleSheet, View, type ViewStyle } from "react-native";
import { SafeAreaView, type Edge } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing } from "../../theme/tokens";

interface Props {
  children: React.ReactNode;
  /** Scroll the content (forms); otherwise a plain flex column. */
  scroll?: boolean;
  /** Add the standard 16 px side gutter. */
  padded?: boolean;
  edges?: Edge[];
  style?: ViewStyle;
  contentStyle?: ViewStyle;
}

/** The page shell every screen uses: themed background, safe areas, keyboard. */
export function Screen({
  children,
  scroll = false,
  padded = true,
  edges = ["top", "left", "right"],
  style,
  contentStyle,
}: Props) {
  const { colors } = useTheme();
  const inner = [padded ? styles.padded : null, contentStyle];

  return (
    <SafeAreaView edges={edges} style={[styles.root, { backgroundColor: colors.background }, style]}>
      <KeyboardAvoidingView
        style={styles.root}
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        {scroll ? (
          <ScrollView
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={[styles.scrollContent, inner]}
          >
            {children}
          </ScrollView>
        ) : (
          <View style={[styles.root, inner]}>{children}</View>
        )}
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { paddingHorizontal: spacing.screen },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xxl },
});
