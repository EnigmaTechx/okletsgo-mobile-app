import React from "react";
import { Image, type ImageStyle } from "react-native";

const logo = require("../../../assets/images/logo.png");

// The exact approved logo asset (2298 × 1200). Never redrawn or recoloured.
const ASPECT = 2298 / 1200;

export function Logo({
  width = 180,
  style,
}: {
  width?: number;
  style?: ImageStyle;
}) {
  return (
    <Image
      source={logo}
      accessibilityLabel="OK Let's Go"
      resizeMode="contain"
      style={[{ width, height: width / ASPECT }, style]}
    />
  );
}
