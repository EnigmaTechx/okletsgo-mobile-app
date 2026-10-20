import React from "react";
import { Text, type TextProps, type TextStyle } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { typography, type Palette } from "../../theme/tokens";

type Variant = keyof typeof typography;
type ColorToken = keyof Palette;

interface Props extends TextProps {
  variant?: Variant;
  /** A palette token name; defaults to `text`. */
  color?: ColorToken;
  align?: TextStyle["textAlign"];
}

export function AppText({
  variant = "body",
  color = "text",
  align,
  style,
  ...rest
}: Props) {
  const { colors } = useTheme();
  return (
    <Text
      {...rest}
      style={[
        typography[variant],
        { color: colors[color] },
        align ? { textAlign: align } : null,
        style,
      ]}
    />
  );
}
