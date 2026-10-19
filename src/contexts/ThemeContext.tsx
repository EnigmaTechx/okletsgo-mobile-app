import React, { createContext, useContext, useEffect, useMemo, useState } from "react";
import { useColorScheme } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { type ColorSchemeName, type Palette, palettes } from "../theme/tokens";

/**
 * Light / dark / follow-system, the same three choices the Ionic Settings
 * page offers. The preference is a per-device convenience, so AsyncStorage is
 * the right home (it never needs to sync across devices).
 */

export type ThemePreference = "system" | "light" | "dark";

const THEME_KEY = "okletsgo.theme";

interface ThemeContextType {
  /** The palette actually in use after resolving "system". */
  scheme: ColorSchemeName;
  colors: Palette;
  preference: ThemePreference;
  /** True once the stored preference has been read (avoids a light flash). */
  ready: boolean;
  setPreference: (p: ThemePreference) => void;
}

const ThemeContext = createContext<ThemeContextType>({
  scheme: "dark",
  colors: palettes.dark,
  preference: "system",
  ready: false,
  setPreference: () => {},
});

export const useTheme = () => useContext(ThemeContext);

const isPreference = (v: unknown): v is ThemePreference =>
  v === "system" || v === "light" || v === "dark";

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const systemScheme = useColorScheme();
  const [preference, setPreferenceState] = useState<ThemePreference>("system");
  const [ready, setReady] = useState(false);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(THEME_KEY)
      .then((v) => {
        if (!cancelled && isPreference(v)) setPreferenceState(v);
      })
      .catch(() => undefined)
      .finally(() => {
        if (!cancelled) setReady(true);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const setPreference = (p: ThemePreference) => {
    setPreferenceState(p);
    AsyncStorage.setItem(THEME_KEY, p).catch(() => undefined);
  };

  const scheme: ColorSchemeName =
    preference === "system" ? (systemScheme === "light" ? "light" : "dark") : preference;

  const value = useMemo<ThemeContextType>(
    () => ({ scheme, colors: palettes[scheme], preference, ready, setPreference }),
    [scheme, preference, ready],
  );

  return <ThemeContext.Provider value={value}>{children}</ThemeContext.Provider>;
};
