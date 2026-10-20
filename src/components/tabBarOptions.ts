import type { EdgeInsets } from "react-native-safe-area-context";
import type { Palette } from "../theme/tokens";
import { typography } from "../theme/tokens";

const TAB_BAR_CONTENT_HEIGHT = 60;
/** Breathing room under the labels even on phones that report no bottom inset. */
const MIN_BOTTOM_PADDING = 12;

/**
 * Shared Tabs options for the client and driver shells. The bottom padding
 * respects the home-indicator / navigation-bar inset so the labels never sit
 * on the edge of the screen.
 */
export function tabScreenOptions(colors: Palette, insets: EdgeInsets) {
  const bottom = Math.max(insets.bottom, MIN_BOTTOM_PADDING);
  return {
    headerShown: false,
    tabBarActiveTintColor: colors.primary,
    tabBarInactiveTintColor: colors.textMuted,
    tabBarStyle: {
      backgroundColor: colors.background,
      borderTopColor: colors.border,
      height: TAB_BAR_CONTENT_HEIGHT + bottom,
      paddingTop: 8,
      paddingBottom: bottom,
    },
    tabBarLabelStyle: typography.tab,
    tabBarItemStyle: { paddingVertical: 2 },
    sceneStyle: { backgroundColor: colors.background },
  } as const;
}
