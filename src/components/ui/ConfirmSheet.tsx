import React from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing, typography } from "../../theme/tokens";
import { AppText } from "./AppText";
import { Sheet } from "./Sheet";

/**
 * The app's one confirmation dialog, as in the Ionic app (ConfirmSheet): a
 * bottom sheet with an optional icon in a tinted circle, a title in the
 * tone colour, a short message, optional radio reasons and one or two pill
 * buttons. Used for cancelling a ride, ending a trip early, declining a
 * request, signing out, deleting the account, the arrival notice and the
 * background-location disclosure, so they all look the same.
 */

export type ConfirmTone = "primary" | "danger";
export type IconName = React.ComponentProps<typeof Ionicons>["name"];

interface Props {
  visible: boolean;
  /** Colours the icon, title, selected reason and (by default) the confirm button. */
  tone?: ConfirmTone;
  icon?: IconName;
  title: string;
  message?: React.ReactNode;
  /** Optional radio list of reasons. */
  options?: string[];
  selected?: string;
  onSelect?: (option: string) => void;
  /** Left / outline button. Omit for a single-button sheet. */
  cancelText?: string;
  onCancel?: () => void;
  /** Right / filled button. */
  confirmText: string;
  onConfirm: () => void;
  /** Overrides the confirm button colour (defaults to the tone). */
  confirmColor?: "primary" | "danger" | "secondary";
  confirmLoading?: boolean;
  /** Tapping outside (or back) closes the sheet. Default true. */
  dismissible?: boolean;
  /** Fired when the sheet is closed by the backdrop or the back button. */
  onDismiss?: () => void;
}

/** "#F14B1C" + alpha → "rgba(…)"; a tint for the icon disc and the picked reason. */
export const withAlpha = (hex: string, alpha: number): string => {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return hex;
  const n = parseInt(m[1], 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${alpha})`;
};

export function ConfirmSheet({
  visible,
  tone = "primary",
  icon,
  title,
  message,
  options,
  selected,
  onSelect,
  cancelText,
  onCancel,
  confirmText,
  onConfirm,
  confirmColor,
  confirmLoading = false,
  dismissible = true,
  onDismiss,
}: Props) {
  const { colors } = useTheme();
  const toneColor = tone === "danger" ? colors.danger : colors.primary;
  const confirmBg =
    confirmColor === "secondary"
      ? colors.secondary
      : confirmColor === "danger"
        ? colors.danger
        : confirmColor === "primary"
          ? colors.primary
          : toneColor;
  const onConfirmBg =
    confirmBg === colors.primary ? colors.onPrimary : colors.background;

  return (
    <Sheet
      visible={visible}
      dismissible={dismissible}
      onClose={() => (onDismiss ?? onCancel)?.()}
    >
      <View style={styles.body}>
        {icon ? (
          <View
            style={[
              styles.iconDisc,
              { backgroundColor: withAlpha(toneColor, 0.12) },
            ]}
          >
            <Ionicons name={icon} size={28} color={toneColor} />
          </View>
        ) : null}
        <AppText variant="title" align="center" style={{ color: toneColor }}>
          {title}
        </AppText>
        {message ? (
          typeof message === "string" ? (
            <AppText variant="body" color="textSecondary" align="center">
              {message}
            </AppText>
          ) : (
            <View style={styles.messageNode}>{message}</View>
          )
        ) : null}

        {options && options.length > 0 ? (
          <View style={styles.options} accessibilityRole="radiogroup">
            {options.map((opt) => {
              const on = opt === selected;
              return (
                <Pressable
                  key={opt}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: on }}
                  onPress={() => onSelect?.(opt)}
                  style={[
                    styles.option,
                    {
                      backgroundColor: on
                        ? withAlpha(toneColor, 0.07)
                        : "transparent",
                      borderColor: on ? toneColor : colors.border,
                    },
                  ]}
                >
                  <View
                    style={[
                      styles.radio,
                      {
                        borderColor: on ? toneColor : colors.textMuted,
                        backgroundColor: on ? toneColor : "transparent",
                      },
                      on
                        ? {
                            shadowColor: toneColor,
                            shadowOpacity: 0.3,
                            shadowRadius: 3,
                            shadowOffset: { width: 0, height: 0 },
                          }
                        : null,
                    ]}
                  />
                  <AppText variant="body" style={styles.optionText}>
                    {opt}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        ) : null}

        <View style={styles.actions}>
          {cancelText ? (
            <Pressable
              accessibilityRole="button"
              onPress={onCancel}
              disabled={confirmLoading}
              style={({ pressed }) => [
                styles.pill,
                {
                  borderColor: colors.border,
                  backgroundColor: pressed
                    ? colors.surfaceRaised
                    : "transparent",
                },
              ]}
            >
              <AppText
                style={[typography.button, { color: colors.textSecondary }]}
                numberOfLines={1}
              >
                {cancelText}
              </AppText>
            </Pressable>
          ) : null}
          <Pressable
            accessibilityRole="button"
            onPress={onConfirm}
            disabled={confirmLoading}
            style={({ pressed }) => [
              styles.pill,
              {
                backgroundColor: confirmBg,
                borderColor: confirmBg,
                opacity: pressed ? 0.85 : 1,
              },
            ]}
          >
            {confirmLoading ? (
              <ActivityIndicator color={onConfirmBg} />
            ) : (
              <AppText
                style={[typography.button, { color: onConfirmBg }]}
                numberOfLines={1}
              >
                {confirmText}
              </AppText>
            )}
          </Pressable>
        </View>
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: "center", gap: spacing.sm, paddingBottom: spacing.sm },
  iconDisc: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  messageNode: { alignSelf: "stretch" },
  options: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.md },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 13,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
  },
  optionText: { flex: 1 },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    alignSelf: "stretch",
    marginTop: spacing.lg,
  },
  pill: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
});
