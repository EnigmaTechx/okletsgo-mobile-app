import React, { useEffect, useRef, useState } from "react";
import {
  Animated,
  PanResponder,
  ScrollView,
  StyleSheet,
  View,
  type ViewStyle,
} from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../theme/tokens";
import { anyOverlayOpen } from "./overlayState";

interface Props {
  /** Height when collapsed: what stays visible above the fold. */
  collapsedHeight: number;
  /** Height when fully open. */
  expandedHeight: number;
  expanded: boolean;
  onExpandedChange: (expanded: boolean) => void;
  /** Rendered over the panel's top edge (a floating button). */
  accessory?: React.ReactNode;
  children: React.ReactNode;
  style?: ViewStyle;
}

const clamp = (v: number, lo: number, hi: number) =>
  Math.min(hi, Math.max(lo, v));

interface GestureState {
  /** The panel's height right now (mirrors the Animated.Value). */
  current: number;
  /** Height when the drag began. */
  start: number;
  /** Content scroll offset, so an open panel only drags down from the top. */
  scrollY: number;
  expanded: boolean;
}

interface PanConfig {
  height: Animated.Value;
  collapsedHeight: number;
  expandedHeight: number;
  onExpandedChange: (expanded: boolean) => void;
}

/** Built outside the component: the callbacks only run on touches. */
function createPanResponder(
  gesture: React.RefObject<GestureState>,
  config: React.RefObject<PanConfig>,
) {
  const snap = (open: boolean) => {
    const { height, expandedHeight, collapsedHeight } = config.current;
    Animated.spring(height, {
      toValue: open ? expandedHeight : collapsedHeight,
      useNativeDriver: false,
      bounciness: 2,
    }).start();
  };
  return PanResponder.create({
    onMoveShouldSetPanResponderCapture: (_e, g) => {
      // A sheet or dialog on top owns the touch.
      if (anyOverlayOpen()) return false;
      const vertical = Math.abs(g.dy) > 6 && Math.abs(g.dy) > Math.abs(g.dx);
      if (!vertical) return false;
      // Open: only take a downward drag when the content is at the top,
      // so scrolling the details keeps working.
      const st = gesture.current;
      if (st.expanded) return g.dy > 0 && st.scrollY <= 0;
      return true;
    },
    onPanResponderGrant: () => {
      gesture.current.start = gesture.current.current;
      config.current.height.stopAnimation();
    },
    onPanResponderMove: (_e, g) => {
      const { height, collapsedHeight, expandedHeight } = config.current;
      height.setValue(
        clamp(gesture.current.start - g.dy, collapsedHeight, expandedHeight),
      );
    },
    onPanResponderRelease: (_e, g) => {
      const { collapsedHeight, expandedHeight, onExpandedChange } =
        config.current;
      const h = clamp(
        gesture.current.start - g.dy,
        collapsedHeight,
        expandedHeight,
      );
      const mid = (collapsedHeight + expandedHeight) / 2;
      const open = g.vy < -0.3 ? true : g.vy > 0.3 ? false : h > mid;
      if (open !== gesture.current.expanded) onExpandedChange(open);
      else snap(open);
    },
    onPanResponderTerminationRequest: () => false,
  });
}

/**
 * The sheet under a full-screen map: drag it up or down anywhere on it
 * (when open, dragging down works once its content is scrolled to the
 * top), or tap the handle to toggle. Snaps to collapsed or expanded.
 */
export function DraggablePanel({
  collapsedHeight,
  expandedHeight,
  expanded,
  onExpandedChange,
  accessory,
  children,
  style,
}: Props) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [height] = useState(
    () => new Animated.Value(expanded ? expandedHeight : collapsedHeight),
  );
  // Mutable gesture bookkeeping, read only inside the responder callbacks.
  const gesture = useRef<GestureState>({
    current: expanded ? expandedHeight : collapsedHeight,
    start: 0,
    scrollY: 0,
    expanded,
  });

  useEffect(() => {
    const id = height.addListener(({ value }) => {
      gesture.current.current = value;
    });
    return () => height.removeListener(id);
  }, [height]);

  useEffect(() => {
    gesture.current.expanded = expanded;
    Animated.spring(height, {
      toValue: expanded ? expandedHeight : collapsedHeight,
      useNativeDriver: false,
      bounciness: 2,
    }).start();
  }, [expanded, expandedHeight, collapsedHeight, height]);

  // Heights and the callback can change between renders; the responder
  // reads them through this ref so it is created once.
  const config = useRef<PanConfig>({
    height,
    collapsedHeight,
    expandedHeight,
    onExpandedChange,
  });
  useEffect(() => {
    config.current = {
      height,
      collapsedHeight,
      expandedHeight,
      onExpandedChange,
    };
  }, [height, collapsedHeight, expandedHeight, onExpandedChange]);
  // The responder's callbacks only ever run on touches, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => createPanResponder(gesture, config));

  return (
    <Animated.View
      {...pan.panHandlers}
      style={[
        styles.panel,
        { backgroundColor: colors.background, height },
        style,
      ]}
    >
      {accessory ? <View style={styles.accessory}>{accessory}</View> : null}
      <View
        style={styles.handleArea}
        onTouchEnd={() => onExpandedChange(!expanded)}
        accessible
        accessibilityRole="button"
        accessibilityLabel={expanded ? "Collapse details" : "Expand details"}
      >
        <View style={[styles.handle, { backgroundColor: colors.border }]} />
      </View>
      <ScrollView
        bounces={false}
        scrollEnabled={expanded}
        showsVerticalScrollIndicator={false}
        scrollEventThrottle={16}
        onScroll={(e) => {
          gesture.current.scrollY = e.nativeEvent.contentOffset.y;
        }}
        contentContainerStyle={[
          styles.content,
          { paddingBottom: insets.bottom + spacing.lg },
        ]}
      >
        {children}
      </ScrollView>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  panel: {
    position: "absolute",
    left: 0,
    right: 0,
    bottom: 0,
    borderTopLeftRadius: radius.xxl,
    borderTopRightRadius: radius.xxl,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: -4 },
    elevation: 12,
    overflow: "visible",
  },
  accessory: { position: "absolute", right: spacing.screen, top: -64 },
  handleArea: {
    alignItems: "center",
    paddingTop: spacing.sm,
    paddingBottom: spacing.xs,
    minHeight: 24,
  },
  handle: { width: 40, height: 4, borderRadius: 2 },
  content: { paddingHorizontal: spacing.xl, paddingTop: spacing.xs },
});
