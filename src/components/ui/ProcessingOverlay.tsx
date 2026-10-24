import React, { useEffect, useState } from "react";
import { Animated, Easing, Modal, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../theme/tokens";
import { AppText } from "./AppText";

interface Props {
  visible: boolean;
  /** Label under the spinner, e.g. "Completing trip…". */
  message: string;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
}

/**
 * The branded busy overlay from the Ionic app: a ring sweeping around a
 * car on a dimmed backdrop, for short blocking actions (accepting,
 * completing, cancelling). Rendered in a modal so it sits above sheets.
 */
export function ProcessingOverlay({
  visible,
  message,
  icon = "car-sport",
}: Props) {
  const { colors } = useTheme();
  const [spin] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!visible) return;
    spin.setValue(0);
    const loop = Animated.loop(
      Animated.timing(spin, {
        toValue: 1,
        duration: 1100,
        easing: Easing.linear,
        useNativeDriver: true,
      }),
    );
    loop.start();
    return () => loop.stop();
  }, [visible, spin]);

  const rotate = spin.interpolate({
    inputRange: [0, 1],
    outputRange: ["0deg", "360deg"],
  });

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
    >
      <View style={[styles.root, { backgroundColor: colors.backdrop }]}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={styles.spinner}>
            <Animated.View
              style={[
                styles.ring,
                {
                  borderColor: colors.border,
                  borderTopColor: colors.primary,
                  transform: [{ rotate }],
                },
              ]}
            />
            <Ionicons name={icon} size={30} color={colors.primary} />
          </View>
          <AppText variant="bodyStrong" align="center">
            {message}
          </AppText>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  card: {
    minWidth: 220,
    maxWidth: 300,
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.xxl,
    borderRadius: radius.xl,
    borderWidth: 1,
  },
  spinner: {
    width: 84,
    height: 84,
    alignItems: "center",
    justifyContent: "center",
  },
  ring: {
    position: "absolute",
    width: 84,
    height: 84,
    borderRadius: 42,
    borderWidth: 5,
  },
});
