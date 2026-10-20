import type { ComponentProps } from "react";
import { Pressable, StyleSheet, type ViewStyle } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { minTouch } from "../../theme/tokens";

type IconName = ComponentProps<typeof Ionicons>["name"];

interface Props {
  icon: IconName;
  onPress: () => void;
  label: string;
  size?: number;
  /** Raised circle (floating over a map) vs. flat. */
  raised?: boolean;
  color?: string;
  style?: ViewStyle;
}

/** A round icon-only button, always at least the minimum touch size. */
export function IconButton({
  icon,
  onPress,
  label,
  size = 48,
  raised = false,
  color,
  style,
}: Props) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      onPress={onPress}
      hitSlop={6}
      style={({ pressed }) => [
        styles.base,
        {
          width: Math.max(size, minTouch),
          height: Math.max(size, minTouch),
          borderRadius: size,
          backgroundColor: raised ? colors.surface : "transparent",
          borderColor: raised ? colors.border : "transparent",
        },
        raised ? styles.raised : null,
        pressed ? styles.pressed : null,
        style,
      ]}
    >
      <Ionicons name={icon} size={22} color={color ?? colors.primary} />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    alignItems: "center",
    justifyContent: "center",
    borderWidth: 1,
  },
  raised: {
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
  pressed: { opacity: 0.8 },
});
