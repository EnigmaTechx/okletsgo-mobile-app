import type { ComponentProps, ReactNode } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { minTouch, spacing } from "../../theme/tokens";
import { AppText } from "./AppText";

type IconName = ComponentProps<typeof Ionicons>["name"];

interface Props {
  icon: IconName;
  label: string;
  /** Secondary line under the label. */
  detail?: string;
  /** Short text on the right (a version, a plate). */
  value?: string;
  /** Custom right-hand element (a Switch); replaces the chevron. */
  right?: ReactNode;
  onPress?: () => void;
  /** Opens elsewhere (browser); shows an external-link icon. */
  external?: boolean;
  danger?: boolean;
  disabled?: boolean;
}

/** One settings row: icon, label, optional value, chevron when it navigates. */
export function MenuRow({
  icon,
  label,
  detail,
  value,
  right,
  onPress,
  external,
  danger,
  disabled,
}: Props) {
  const { colors } = useTheme();
  const tint = danger ? colors.danger : colors.textMuted;
  const labelColor = danger ? colors.danger : colors.text;
  const chevron: IconName = external ? "open-outline" : "chevron-forward";

  return (
    <Pressable
      accessibilityRole={onPress ? "button" : undefined}
      disabled={!onPress || disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        { borderBottomColor: colors.border },
        pressed ? { backgroundColor: colors.surfaceRaised } : null,
        disabled ? styles.disabled : null,
      ]}
    >
      <Ionicons name={icon} size={22} color={tint} style={styles.icon} />
      <View style={styles.text}>
        <AppText variant="bodyStrong" style={{ color: labelColor }}>
          {label}
        </AppText>
        {detail ? (
          <AppText variant="small" color="textMuted">
            {detail}
          </AppText>
        ) : null}
      </View>
      {value ? (
        <AppText variant="small" color="textMuted" style={styles.value}>
          {value}
        </AppText>
      ) : null}
      {right ??
        (onPress ? (
          <Ionicons name={chevron} size={18} color={colors.textMuted} />
        ) : null)}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: minTouch + 12,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
    gap: spacing.md,
  },
  icon: { width: 24, textAlign: "center" },
  text: { flex: 1, gap: 2 },
  value: { maxWidth: "45%", textAlign: "right" },
  disabled: { opacity: 0.5 },
});
