import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Animated,
  PanResponder,
  StyleSheet,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { radius } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

const THUMB = 56;
const PAD = 4;

interface Props {
  text: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  color: string;
  onConfirm: () => Promise<void>;
  disabled?: boolean;
}

interface Drag {
  width: number;
  x: Animated.Value;
  busy: boolean;
  fired: boolean;
  disabled: boolean;
}

/** Built outside the component: these only run on touches. */
function createResponder(drag: React.RefObject<Drag>, fire: () => void) {
  const maxPos = () => Math.max(0, drag.current.width - THUMB - PAD * 2);
  return PanResponder.create({
    onStartShouldSetPanResponder: () =>
      !drag.current.disabled && !drag.current.busy,
    onMoveShouldSetPanResponder: (_e, g) =>
      !drag.current.disabled && !drag.current.busy && Math.abs(g.dx) > 4,
    onPanResponderGrant: () => {
      drag.current.fired = false;
    },
    onPanResponderMove: (_e, g) => {
      if (drag.current.fired) return;
      const pos = Math.min(maxPos(), Math.max(0, g.dx));
      drag.current.x.setValue(pos);
      if (pos >= maxPos() * 0.95 && maxPos() > 0) {
        drag.current.fired = true;
        drag.current.x.setValue(maxPos());
        fire();
      }
    },
    onPanResponderRelease: () => {
      if (!drag.current.fired)
        Animated.spring(drag.current.x, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
    },
    onPanResponderTerminate: () => {
      if (!drag.current.fired)
        Animated.spring(drag.current.x, {
          toValue: 0,
          useNativeDriver: true,
        }).start();
    },
    onPanResponderTerminationRequest: () => false,
  });
}

/**
 * Slide the thumb to the end to confirm. Fires once per gesture, shows a
 * spinner while the confirmation runs, and springs back if it fails.
 */
export function SwipeButton({
  text,
  icon,
  color,
  onConfirm,
  disabled = false,
}: Props) {
  const { colors } = useTheme();
  const [busy, setBusy] = useState(false);
  const [x] = useState(() => new Animated.Value(0));
  const drag = useRef<Drag>({
    width: 0,
    x,
    busy: false,
    fired: false,
    disabled,
  });
  useEffect(() => {
    drag.current.disabled = disabled;
  }, [disabled]);

  const fire = async () => {
    drag.current.busy = true;
    setBusy(true);
    try {
      await onConfirm();
    } catch (err) {
      console.warn("Swipe action failed:", err);
      Animated.spring(x, { toValue: 0, useNativeDriver: true }).start();
    } finally {
      drag.current.busy = false;
      drag.current.fired = false;
      setBusy(false);
    }
  };
  // Callbacks only touch the ref on gestures, never during render.
  // eslint-disable-next-line react-hooks/refs
  const [pan] = useState(() => createResponder(drag, () => void fire()));

  return (
    <View
      onLayout={(e) => {
        drag.current.width = e.nativeEvent.layout.width;
      }}
      style={[
        styles.track,
        { backgroundColor: colors.surfaceRaised, opacity: disabled ? 0.6 : 1 },
      ]}
    >
      <AppText variant="bodyStrong" color="textMuted" style={styles.label}>
        {busy ? "" : text}
      </AppText>
      {busy ? <ActivityIndicator color={color} style={styles.spinner} /> : null}
      <Animated.View
        {...pan.panHandlers}
        style={[
          styles.thumb,
          {
            backgroundColor: disabled ? colors.textMuted : color,
            transform: [{ translateX: x }],
          },
        ]}
      >
        <Ionicons name={icon} size={28} color="#FFFFFF" />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: THUMB + PAD * 2,
    borderRadius: radius.pill,
    justifyContent: "center",
    overflow: "hidden",
  },
  label: { textAlign: "center", paddingLeft: THUMB / 2 },
  spinner: { position: "absolute", alignSelf: "center" },
  thumb: {
    position: "absolute",
    left: PAD,
    top: PAD,
    width: THUMB,
    height: THUMB,
    borderRadius: THUMB / 2,
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 2 },
    elevation: 4,
  },
});
