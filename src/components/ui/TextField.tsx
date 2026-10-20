import React, { forwardRef, useState } from "react";
import { StyleSheet, TextInput, type TextInputProps, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { fontFamily, radius, spacing } from "../../theme/tokens";
import { AppText } from "./AppText";

interface Props extends TextInputProps {
  label?: string;
  /** Short text rendered inside the field on the left (e.g. "+1"). */
  prefix?: string;
  error?: string | null;
}

export const TextField = forwardRef<TextInput, Props>(function TextField(
  { label, prefix, error, style, onFocus, onBlur, ...rest },
  ref,
) {
  const { colors } = useTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = error
    ? colors.danger
    : focused
      ? colors.secondary
      : colors.border;

  return (
    <View style={styles.wrap}>
      {label ? (
        <AppText variant="eyebrow" color="textMuted" style={styles.label}>
          {label.toUpperCase()}
        </AppText>
      ) : null}
      <View
        style={[styles.field, { backgroundColor: colors.surface, borderColor }]}
      >
        {prefix ? (
          <AppText variant="heading" color="text" style={styles.prefix}>
            {prefix}
          </AppText>
        ) : null}
        <TextInput
          ref={ref}
          placeholderTextColor={colors.textMuted}
          {...rest}
          onFocus={(e) => {
            setFocused(true);
            onFocus?.(e);
          }}
          onBlur={(e) => {
            setFocused(false);
            onBlur?.(e);
          }}
          style={[styles.input, { color: colors.text }, style]}
        />
      </View>
      {error ? (
        <AppText variant="small" color="danger" style={styles.error}>
          {error}
        </AppText>
      ) : null}
    </View>
  );
});

const styles = StyleSheet.create({
  wrap: { alignSelf: "stretch" },
  label: { marginBottom: spacing.sm },
  field: {
    flexDirection: "row",
    alignItems: "center",
    minHeight: 56,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
  },
  prefix: { marginRight: spacing.sm },
  input: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: 19,
    paddingVertical: 12,
    letterSpacing: 0.4,
  },
  error: { marginTop: spacing.sm },
});
