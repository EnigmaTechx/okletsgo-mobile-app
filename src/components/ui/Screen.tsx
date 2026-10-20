import React from "react";
import { StyleSheet, View, type ViewStyle } from "react-native";
import { KeyboardAwareScrollView } from "react-native-keyboard-controller";
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

/**
 * The page shell every screen uses: themed background, safe areas, keyboard.
 *
 * Scrolling screens use KeyboardAwareScrollView from
 * react-native-keyboard-controller rather than React Native's
 * KeyboardAvoidingView: with Android edge-to-edge the window no longer
 * resizes for the keyboard, so a plain ScrollView could not scroll to the
 * fields hidden under it. This one tracks the keyboard on both platforms,
 * keeps the focused field visible and stays scrollable while it is open.
 */
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
      {scroll ? (
        <KeyboardAwareScrollView
          bottomOffset={spacing.xxl}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          contentContainerStyle={[styles.scrollContent, inner]}
          style={styles.root}
        >
          {children}
        </KeyboardAwareScrollView>
      ) : (
        <View style={[styles.root, inner]}>{children}</View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  padded: { paddingHorizontal: spacing.screen },
  scrollContent: { flexGrow: 1, paddingBottom: spacing.xxl },
});
