import React from "react";
import {
  ActivityIndicator,
  Pressable,
  type PressableProps,
  StyleSheet,
  type ViewStyle,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { minTouch, radius, typography } from "../../theme/tokens";
import { AppText } from "./AppText";

type Variant = "primary" | "secondary" | "ghost" | "success" | "danger";

interface Props extends Omit<PressableProps, "style" | "children"> {
  title: string;
  variant?: Variant;
  loading?: boolean;
  /** Full width (default) or hug content. */
  block?: boolean;
  style?: ViewStyle;
}

export function Button({
  title,
  variant = "primary",
  loading = false,
  block = true,
  disabled,
  style,
  ...rest
}: Props) {
  const { colors } = useTheme();
  const isDisabled = disabled || loading;

  const background = {
    primary: colors.primary,
    secondary: "transparent",
    ghost: "transparent",
    success: colors.success,
    danger: colors.dangerSoft,
  }[variant];
  const border = {
    primary: colors.primary,
    secondary: colors.border,
    ghost: "transparent",
    success: colors.success,
    danger: colors.danger,
  }[variant];
  const label = {
    primary: colors.onPrimary,
    secondary: colors.text,
    ghost: colors.textSecondary,
    success: colors.onSuccess,
    danger: colors.danger,
  }[variant];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: !!isDisabled, busy: loading }}
      disabled={isDisabled}
      {...rest}
      style={({ pressed }) => [
        styles.base,
        { backgroundColor: background, borderColor: border },
        variant === "ghost" ? styles.ghost : null,
        block ? styles.block : null,
        pressed ? styles.pressed : null,
        isDisabled ? styles.disabled : null,
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={label} />
      ) : (
        <AppText style={[variant === "ghost" ? typography.bodyStrong : typography.button, { color: label }]}>
          {title}
        </AppText>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  base: {
    minHeight: 52,
    borderRadius: radius.md + 2,
    borderWidth: 1,
    paddingHorizontal: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  ghost: { minHeight: minTouch },
  block: { alignSelf: "stretch" },
  pressed: { opacity: 0.85, transform: [{ scale: 0.985 }] },
  disabled: { opacity: 0.45 },
});
