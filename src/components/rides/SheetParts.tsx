import React from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { fontFamily, radius, spacing, typography } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { SheetPill, type PillTone } from "../ui/SheetPill";

/**
 * The shared shell of the ride sheets (Ionic SheetLayout.css): a centred
 * header with the status pill and one line under it, the person row with
 * the price cluster, bordered cards, the gold note, and the big buttons.
 */

type IconName = React.ComponentProps<typeof Ionicons>["name"];

/** Centred header: pill, then one line of detail (bold parts allowed). */
export function SheetHead({
  tone,
  pill,
  pillSize = "md",
  subline,
  children,
  onLayout,
}: {
  tone: PillTone;
  pill: string;
  pillSize?: "md" | "lg";
  /** Plain text, or nodes for a line with a bold part. */
  subline?: React.ReactNode;
  children?: React.ReactNode;
  onLayout?: (height: number) => void;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[styles.head, { borderBottomColor: colors.border }]}
      onLayout={(e) => onLayout?.(e.nativeEvent.layout.height)}
    >
      <SheetPill tone={tone} size={pillSize}>
        {pill}
      </SheetPill>
      {subline ? (
        typeof subline === "string" ? (
          <AppText variant="smallStrong" color="textSecondary" align="center">
            {subline}
          </AppText>
        ) : (
          <AppText variant="smallStrong" color="textSecondary" align="center">
            {subline}
          </AppText>
        )
      ) : null}
      {children}
    </View>
  );
}

/** A bold run inside a subline. */
export function Strong({ children }: { children: React.ReactNode }) {
  const { colors } = useTheme();
  return (
    <AppText
      variant="smallStrong"
      style={{ color: colors.text, fontFamily: fontFamily.extrabold }}
    >
      {children}
    </AppText>
  );
}

/** Avatar, name + one line, something at the right end. */
export function PersonRow({
  avatar,
  name,
  sub,
  right,
}: {
  avatar: React.ReactNode;
  name: string;
  sub?: React.ReactNode;
  right?: React.ReactNode;
}) {
  return (
    <View style={styles.person}>
      {avatar}
      <View style={styles.personText}>
        <AppText variant="bodyStrong" numberOfLines={1}>
          {name}
        </AppText>
        {sub ? (
          typeof sub === "string" ? (
            <AppText variant="small" color="textSecondary" numberOfLines={1}>
              {sub}
            </AppText>
          ) : (
            sub
          )
        ) : null}
      </View>
      {right}
    </View>
  );
}

/** "$12.40" over "EST. EARN", right-aligned. */
export function PriceCluster({
  amount,
  label,
  size = "lg",
  color,
}: {
  amount: string;
  label: string;
  size?: "lg" | "md";
  color?: string;
}) {
  const { colors } = useTheme();
  return (
    <View style={styles.price}>
      <AppText
        style={[
          styles.amount,
          { fontSize: size === "lg" ? 28 : 21, color: color ?? colors.primary },
        ]}
        numberOfLines={1}
      >
        {amount}
      </AppText>
      <AppText variant="eyebrow" color="textMuted">
        {label.toUpperCase()}
      </AppText>
    </View>
  );
}

/** Bordered content card (route, total). */
export function SheetCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.background, borderColor: colors.border },
        style,
      ]}
    >
      {children}
    </View>
  );
}

/** Gold note with an icon (hand-off, lock, assignment). */
export function SheetNote({
  icon,
  children,
}: {
  icon: IconName;
  children: React.ReactNode;
}) {
  const { scheme } = useTheme();
  const ink = scheme === "dark" ? "#FFD466" : "#7A4B00";
  return (
    <View
      style={[
        styles.note,
        {
          backgroundColor: `rgba(255, 196, 9, ${scheme === "dark" ? 0.2 : 0.14})`,
        },
      ]}
    >
      <Ionicons name={icon} size={20} color={ink} style={styles.noteIcon} />
      <AppText variant="smallStrong" style={[styles.noteText, { color: ink }]}>
        {children}
      </AppText>
    </View>
  );
}

/** Orange-tinted notice (the pending time-change line). */
export function SheetNotice({
  icon,
  children,
}: {
  icon: IconName;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.note, { backgroundColor: `rgba(241, 75, 28, 0.10)` }]}>
      <Ionicons
        name={icon}
        size={18}
        color={colors.primary}
        style={styles.noteIcon}
      />
      <AppText variant="smallStrong" color="primary" style={styles.noteText}>
        {children}
      </AppText>
    </View>
  );
}

/**
 * The big sheet buttons: a filled green Accept (64 tall), outline actions
 * (56 tall) and the slimmer outline secondary under a swipe (44 tall).
 */
export function SheetButton({
  title,
  icon,
  kind,
  onPress,
  loading = false,
  disabled = false,
  size = "md",
  style,
}: {
  title: string;
  icon?: IconName;
  kind:
    | "success"
    | "outline"
    | "outline-danger"
    | "outline-primary"
    | "outline-secondary";
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  size?: "lg" | "md" | "sm";
  style?: ViewStyle;
}) {
  const { colors } = useTheme();
  const filled = kind === "success";
  const ink =
    kind === "success"
      ? colors.onSuccess
      : kind === "outline-danger"
        ? colors.danger
        : kind === "outline-primary"
          ? colors.primary
          : kind === "outline-secondary"
            ? colors.secondary
            : colors.textSecondary;
  const border =
    kind === "success"
      ? colors.success
      : kind === "outline"
        ? colors.border
        : ink;
  const height = size === "lg" ? 64 : size === "md" ? 56 : 44;
  const fontSize = size === "lg" ? 20 : size === "md" ? 16 : 14;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: disabled || loading, busy: loading }}
      disabled={disabled || loading}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        {
          minHeight: height,
          backgroundColor: filled ? colors.success : "transparent",
          borderColor: border,
          opacity: disabled ? 0.45 : pressed ? 0.85 : 1,
        },
        style,
      ]}
    >
      {loading ? (
        <ActivityIndicator color={ink} />
      ) : (
        <>
          {icon ? (
            <Ionicons
              name={icon}
              size={size === "lg" ? 28 : size === "md" ? 22 : 18}
              color={ink}
            />
          ) : null}
          <AppText
            style={[
              typography.button,
              { color: ink, fontSize, fontFamily: fontFamily.extrabold },
            ]}
            numberOfLines={1}
          >
            {title}
          </AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  head: {
    alignItems: "center",
    gap: spacing.sm,
    paddingBottom: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  person: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.xs,
  },
  personText: { flex: 1, gap: 3 },
  price: { alignItems: "flex-end" },
  amount: { fontFamily: fontFamily.extrabold, lineHeight: 32 },
  card: {
    borderWidth: 1,
    borderRadius: radius.sm + 2,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  note: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: 10,
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: radius.sm + 2,
  },
  noteIcon: { marginTop: 1 },
  noteText: { flex: 1, lineHeight: 19 },
  button: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    borderRadius: radius.md,
    borderWidth: 1.5,
    paddingHorizontal: 16,
  },
});
