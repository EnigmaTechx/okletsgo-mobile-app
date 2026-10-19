import React from "react";
import type { ColorValue } from "react-native";
import { Ionicons } from "@expo/vector-icons";

type Name = React.ComponentProps<typeof Ionicons>["name"];

/** Outline icon at rest, filled when the tab is focused. */
export function TabBarIcon({
  name,
  focused,
  color,
}: {
  name: Name;
  focused: boolean;
  color: ColorValue;
}) {
  const resolved = focused ? (name.replace(/-outline$/, "") as Name) : name;
  return <Ionicons name={resolved} size={24} color={color} />;
}
