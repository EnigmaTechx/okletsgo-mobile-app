import React, { useEffect, useState } from "react";
import {
  Animated,
  Modal,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../theme/tokens";
import { useOverlayOpen } from "./overlayState";

interface Props {
  visible: boolean;
  onClose: () => void;
  /** Tap on the dim backdrop closes the sheet (default true). */
  dismissible?: boolean;
  children: React.ReactNode;
  style?: ViewStyle;
}

/**
 * A bottom sheet for choices and short forms. The backdrop fades while
 * the card slides up (a sliding backdrop reads as a glitch), it keeps
 * clear of the home indicator, and scrolls when tall.
 */
export function Sheet({
  visible,
  onClose,
  dismissible = true,
  children,
  style,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [rise] = useState(() => new Animated.Value(0));
  useOverlayOpen(visible);

  useEffect(() => {
    if (!visible) {
      rise.setValue(0);
      return;
    }
    Animated.spring(rise, {
      toValue: 1,
      useNativeDriver: true,
      bounciness: 0,
      speed: 18,
    }).start();
  }, [visible, rise]);

  const translateY = rise.interpolate({
    inputRange: [0, 1],
    outputRange: [240, 0],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => dismissible && onClose()}
    >
      <View style={styles.root}>
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.backdrop }]}
          onPress={() => dismissible && onClose()}
          accessibilityLabel="Close"
        />
        <Animated.View
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              paddingBottom: insets.bottom + spacing.lg,
              transform: [{ translateY }],
            },
            style,
          ]}
        >
          <View style={[styles.handle, { backgroundColor: colors.border }]} />
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {children}
          </ScrollView>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, justifyContent: "flex-end" },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  sheet: {
    maxHeight: "88%",
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    paddingTop: spacing.sm,
  },
  handle: {
    alignSelf: "center",
    width: 40,
    height: 4,
    borderRadius: 2,
    marginBottom: spacing.md,
  },
  content: { paddingHorizontal: spacing.xl, gap: spacing.md },
});
