import { useState } from "react";
import { Platform, Pressable, StyleSheet, View } from "react-native";
import DateTimePicker, {
  DateTimePickerAndroid,
  type DateTimePickerEvent,
} from "@react-native-community/datetimepicker";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../theme/tokens";
import { AppText } from "./AppText";
import { Button } from "./Button";
import { Sheet } from "./Sheet";

interface Props {
  mode: "date" | "time";
  label: string;
  value: Date;
  minimumDate?: Date;
  onChange: (next: Date) => void;
  disabled?: boolean;
}

const display = (mode: "date" | "time", d: Date): string =>
  mode === "date"
    ? d.toLocaleDateString("en-US", {
        weekday: "long",
        month: "short",
        day: "numeric",
      })
    : d.toLocaleTimeString("en-US", {
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      });

/**
 * A tappable row that opens the platform's own date or time picker: the
 * system dialog on Android, a spinner in a sheet on iOS.
 */
export function DateTimeField({
  mode,
  label,
  value,
  minimumDate,
  onChange,
  disabled,
}: Props) {
  const { colors } = useTheme();
  const [sheetOpen, setSheetOpen] = useState(false);
  const [draft, setDraft] = useState(value);

  const open = () => {
    if (Platform.OS === "android") {
      DateTimePickerAndroid.open({
        mode,
        value,
        minimumDate,
        is24Hour: false,
        onChange: (event: DateTimePickerEvent, date?: Date) => {
          if (event.type === "set" && date) onChange(date);
        },
      });
      return;
    }
    setDraft(value);
    setSheetOpen(true);
  };

  return (
    <>
      <Pressable
        accessibilityRole="button"
        accessibilityLabel={`${label}: ${display(mode, value)}`}
        disabled={disabled}
        onPress={open}
        style={({ pressed }) => [
          styles.row,
          {
            backgroundColor: colors.surface,
            borderColor: pressed ? colors.secondary : colors.border,
            opacity: disabled ? 0.6 : 1,
          },
        ]}
      >
        <Ionicons
          name={mode === "date" ? "calendar-outline" : "time-outline"}
          size={22}
          color={colors.primary}
        />
        <View style={styles.text}>
          <AppText variant="eyebrow" color="textMuted">
            {label.toUpperCase()}
          </AppText>
          <AppText variant="heading">{display(mode, value)}</AppText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>

      {Platform.OS === "ios" ? (
        <Sheet visible={sheetOpen} onClose={() => setSheetOpen(false)}>
          <AppText variant="heading" align="center">
            {label}
          </AppText>
          <DateTimePicker
            mode={mode}
            value={draft}
            minimumDate={minimumDate}
            display="spinner"
            themeVariant={undefined}
            textColor={colors.text}
            onChange={(_e, d) => d && setDraft(d)}
            style={styles.spinner}
          />
          <View style={styles.actions}>
            <Button
              title="Cancel"
              variant="secondary"
              onPress={() => setSheetOpen(false)}
              style={styles.half}
            />
            <Button
              title="Done"
              onPress={() => {
                setSheetOpen(false);
                onChange(draft);
              }}
              style={styles.half}
            />
          </View>
        </Sheet>
      ) : null}
    </>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 64,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  text: { flex: 1, gap: 2 },
  spinner: { alignSelf: "stretch" },
  actions: { flexDirection: "row", gap: spacing.md },
  half: { flex: 1 },
});
