import { StyleSheet, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { radius } from "../../theme/tokens";
import { AppText } from "./AppText";

/**
 * Status pill at the top of the ride sheets (Ionic SheetPill): a tint of
 * one of the theme colours with an ink dark enough to read on it, and a
 * lighter ink in dark mode.
 */

export type PillTone = "gold" | "blue" | "green" | "orange" | "grey";

const TONES: Record<PillTone, { rgb: string; ink: string; inkDark: string }> = {
  gold: { rgb: "255, 196, 9", ink: "#7A4B00", inkDark: "#FFD466" },
  blue: { rgb: "93, 183, 233", ink: "#0B5CAD", inkDark: "#8FD0F5" },
  green: { rgb: "45, 211, 111", ink: "#1F7A3F", inkDark: "#6FE39A" },
  orange: { rgb: "241, 75, 28", ink: "#B3360F", inkDark: "#FF8F6B" },
  grey: { rgb: "115, 115, 128", ink: "#4A4A55", inkDark: "#C9C9D1" },
};

export function SheetPill({
  tone,
  size = "md",
  children,
}: {
  tone: PillTone;
  /** "lg" carries a sentence (the rider's status) and may wrap. */
  size?: "md" | "lg";
  children: string;
}) {
  const { scheme } = useTheme();
  const t = TONES[tone];
  const ink = scheme === "dark" ? t.inkDark : t.ink;
  const large = size === "lg";
  return (
    <View
      style={[
        styles.pill,
        large ? styles.pillLg : null,
        {
          backgroundColor: `rgba(${t.rgb}, ${scheme === "dark" ? 0.2 : 0.14})`,
        },
      ]}
    >
      <View style={[styles.dot, { backgroundColor: ink }]} />
      <AppText
        variant={large ? "smallStrong" : "eyebrow"}
        style={[{ color: ink }, large ? styles.textLg : null]}
        align="center"
      >
        {large ? children : children.toUpperCase()}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  pill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
    alignSelf: "center",
  },
  pillLg: { paddingHorizontal: 14, paddingVertical: 7, maxWidth: "100%" },
  dot: { width: 9, height: 9, borderRadius: 5 },
  textLg: { flexShrink: 1 },
});
