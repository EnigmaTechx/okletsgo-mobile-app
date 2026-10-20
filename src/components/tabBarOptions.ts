import type { EdgeInsets } from "react-native-safe-area-context";
import type { Palette } from "../theme/tokens";
import { typography } from "../theme/tokens";

const TAB_BAR_CONTENT_HEIGHT = 60;
/**
 * Gap between the labels and the system area (gesture pill / nav buttons).
 * The inset alone only keeps the labels out from *under* the pill; they
 * still sat right on top of it, which read as cramped on the Pixel.
 */
const GAP_ABOVE_SYSTEM_AREA = 12;
/** Floor for phones that report no bottom inset at all. */
const MIN_BOTTOM_PADDING = 24;

/**
 * Shared Tabs options for the client and driver shells. The bottom padding
 * is the home-indicator / navigation-bar inset plus a visible gap, so the
 * labels never sit on the edge of the screen or on the gesture pill.
 */
export function tabScreenOptions(colors: Palette, insets: EdgeInsets) {
  const bottom = Math.max(
    insets.bottom + GAP_ABOVE_SYSTEM_AREA,
    MIN_BOTTOM_PADDING,
  );
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
