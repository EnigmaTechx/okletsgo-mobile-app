import { Pressable, StyleSheet, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { radius } from "../../theme/tokens";
import { AppText } from "./AppText";

interface Props<T extends string> {
  options: { value: T; label: string }[];
  value: T;
  onChange: (value: T) => void;
}

/** Two to four mutually exclusive choices in a row (tabs for a list). */
export function SegmentedControl<T extends string>({
  options,
  value,
  onChange,
}: Props<T>) {
  const { colors } = useTheme();
  return (
    <View
      style={[
        styles.row,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      {options.map((o) => {
        const active = o.value === value;
        return (
          <Pressable
            key={o.value}
            accessibilityRole="tab"
            accessibilityState={{ selected: active }}
            onPress={() => onChange(o.value)}
            style={[
              styles.segment,
              active ? { backgroundColor: colors.primary } : null,
            ]}
          >
            <AppText
              variant="smallStrong"
              style={{
                color: active ? colors.onPrimary : colors.textSecondary,
              }}
            >
              {o.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    padding: 4,
    borderRadius: radius.md,
    borderWidth: 1,
    gap: 4,
  },
  segment: {
    flex: 1,
    minHeight: 36,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
});
