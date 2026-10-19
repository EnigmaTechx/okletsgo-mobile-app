/**
 * Design tokens for OK Let's Go.
 *
 * Two palettes, one set of names. The dark palette is the navy ground from
 * the approved mockups; the light palette keeps the same brand colours on a
 * white ground so the Ionic app's light/dark toggle survives the migration.
 * Components never hard-code a hex: they read `useTheme().colors`.
 */

export type ColorSchemeName = "light" | "dark";

export interface Palette {
  /** Screen background. */
  background: string;
  /** Cards, sheets, inputs. */
  surface: string;
  /** A step above surface (chips inside cards, map placeholders). */
  surfaceRaised: string;
  border: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  /** Brand orange: primary actions, active tab. */
  primary: string;
  onPrimary: string;
  /** Car blue: links, secondary accents, the rider role. */
  secondary: string;
  /** Status green: online, confirmed, success. */
  success: string;
  onSuccess: string;
  /** Promo yellow: welcome gift, pending badges. */
  accent: string;
  onAccent: string;
  danger: string;
  dangerSoft: string;
  /** Dim backdrop behind modals and sheets. */
  backdrop: string;
}

export const darkPalette: Palette = {
  background: "#0B1220",
  surface: "#131D2E",
  surfaceRaised: "#0F1A2C",
  border: "#26354D",
  text: "#F8FAFC",
  textSecondary: "#C7D2E3",
  textMuted: "#8FA3C0",
  primary: "#F14B1C",
  onPrimary: "#FFFFFF",
  secondary: "#5DB7E9",
  success: "#4ADE80",
  onSuccess: "#0B1220",
  accent: "#F9D720",
  onAccent: "#0B1220",
  danger: "#FCA5A5",
  dangerSoft: "rgba(220, 38, 38, 0.14)",
  backdrop: "rgba(5, 10, 18, 0.78)",
};

export const lightPalette: Palette = {
  background: "#FFFFFF",
  surface: "#F5F7FB",
  surfaceRaised: "#EAEFF6",
  border: "#D9E0EA",
  text: "#1E1E24",
  textSecondary: "#48484A",
  textMuted: "#6B7280",
  primary: "#F14B1C",
  onPrimary: "#FFFFFF",
  secondary: "#2B8BC8",
  success: "#16A34A",
  onSuccess: "#FFFFFF",
  accent: "#F2C200",
  onAccent: "#1E1E24",
  danger: "#B91C1C",
  dangerSoft: "rgba(220, 38, 38, 0.10)",
  backdrop: "rgba(15, 23, 42, 0.55)",
};

export const palettes: Record<ColorSchemeName, Palette> = {
  dark: darkPalette,
  light: lightPalette,
};

export const spacing = {
  xs: 4,
  sm: 8,
  md: 12,
  lg: 16,
  xl: 20,
  xxl: 28,
  screen: 16,
} as const;

export const radius = {
  sm: 10,
  md: 14,
  lg: 18,
  xl: 22,
  xxl: 26,
  pill: 999,
} as const;

/** Manrope weights loaded in the root layout (see `src/theme/fonts.ts`). */
export const fontFamily = {
  medium: "Manrope_500Medium",
  semibold: "Manrope_600SemiBold",
  bold: "Manrope_700Bold",
  extrabold: "Manrope_800ExtraBold",
} as const;

export const typography = {
  display: { fontFamily: fontFamily.extrabold, fontSize: 30, lineHeight: 34, letterSpacing: -0.3 },
  title: { fontFamily: fontFamily.extrabold, fontSize: 24, lineHeight: 28, letterSpacing: -0.2 },
  heading: { fontFamily: fontFamily.extrabold, fontSize: 19, lineHeight: 24 },
  body: { fontFamily: fontFamily.medium, fontSize: 15, lineHeight: 22 },
  bodyStrong: { fontFamily: fontFamily.bold, fontSize: 15, lineHeight: 22 },
  small: { fontFamily: fontFamily.medium, fontSize: 13, lineHeight: 18 },
  smallStrong: { fontFamily: fontFamily.bold, fontSize: 13, lineHeight: 18 },
  eyebrow: { fontFamily: fontFamily.extrabold, fontSize: 12, lineHeight: 16, letterSpacing: 1.4 },
  button: { fontFamily: fontFamily.extrabold, fontSize: 18, lineHeight: 22 },
  tab: { fontFamily: fontFamily.bold, fontSize: 11, lineHeight: 14 },
} as const;

/** Touch targets never go below this (Play and App Store guidance). */
export const minTouch = 44;
