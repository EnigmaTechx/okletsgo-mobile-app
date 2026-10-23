import { useState } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../theme/tokens";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

interface Props {
  visible: boolean;
  icon?: React.ComponentProps<typeof Ionicons>["name"];
  title: string;
  message: string;
  reasons: string[];
  cancelLabel: string;
  confirmLabel: string;
  /** Primary (orange) or danger (red) confirm button. */
  tone?: "primary" | "danger";
  dismissible?: boolean;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
}

/**
 * "Pick a reason, then confirm": the shape of every decline, cancel and
 * early-end sheet on the driver side (and the rider's cancel sheet).
 */
export function ReasonSheet({
  visible,
  icon = "close-circle-outline",
  title,
  message,
  reasons,
  cancelLabel,
  confirmLabel,
  tone = "danger",
  dismissible = true,
  onCancel,
  onConfirm,
}: Props) {
  const { colors } = useTheme();
  const [reason, setReason] = useState(reasons[0]);
  return (
    <Sheet visible={visible} onClose={onCancel} dismissible={dismissible}>
      <View style={styles.header}>
        <Ionicons name={icon} size={34} color={colors.primary} />
        <AppText variant="title">{title}</AppText>
      </View>
      <AppText variant="body" color="textSecondary">
        {message}
      </AppText>
      <View style={styles.options}>
        {reasons.map((opt) => {
          const selected = opt === reason;
          return (
            <Pressable
              key={opt}
              accessibilityRole="radio"
              accessibilityState={{ selected }}
              onPress={() => setReason(opt)}
              style={[
                styles.option,
                {
                  backgroundColor: selected
                    ? colors.surfaceRaised
                    : colors.surface,
                  borderColor: selected ? colors.primary : colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.radio,
                  {
                    borderColor: selected ? colors.primary : colors.textMuted,
                    backgroundColor: selected ? colors.primary : "transparent",
                  },
                ]}
              />
              <AppText variant="bodyStrong">{opt}</AppText>
            </Pressable>
          );
        })}
      </View>
      <View style={styles.actions}>
        <Button
          title={cancelLabel}
          variant="secondary"
          onPress={onCancel}
          style={styles.half}
        />
        <Button
          title={confirmLabel}
          variant={tone === "danger" ? "danger" : "primary"}
          onPress={() => onConfirm(reason)}
          style={styles.half}
        />
      </View>
    </Sheet>
  );
}

const styles = StyleSheet.create({
  header: { alignItems: "center", gap: spacing.sm },
  options: { gap: spacing.sm, marginTop: spacing.sm },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  radio: { width: 18, height: 18, borderRadius: 9, borderWidth: 2 },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.md },
  half: { flex: 1 },
});
