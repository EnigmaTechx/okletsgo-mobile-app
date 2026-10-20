import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { Animated, Pressable, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../theme/tokens";
import { AppText } from "./AppText";

export type ToastType = "info" | "success" | "error";

interface ToastOptions {
  type?: ToastType;
  durationMs?: number;
  action?: { text: string; onPress: () => void };
}

interface ToastState extends Required<Pick<ToastOptions, "type">> {
  id: number;
  message: string;
  durationMs: number;
  action?: ToastOptions["action"];
}

type Show = (message: string, options?: ToastOptions) => void;

const ToastContext = createContext<Show>(() => undefined);

/** `const toast = useToast(); toast("Ride cancelled", { type: "success" })` */
export const useToast = (): Show => useContext(ToastContext);

/**
 * A single app-wide toast host (the Ionic app's AppToastHost), mounted in
 * the root layout so a message survives the navigation that follows it.
 */
export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toast, setToast] = useState<ToastState | null>(null);
  const counter = useRef(0);

  const show = useCallback<Show>((message, options) => {
    counter.current += 1;
    setToast({
      id: counter.current,
      message,
      type: options?.type ?? "info",
      durationMs: options?.durationMs ?? (options?.action ? 5000 : 2800),
      action: options?.action,
    });
  }, []);

  const value = useMemo(() => show, [show]);

  return (
    <ToastContext.Provider value={value}>
      {children}
      <ToastHost toast={toast} onDone={() => setToast(null)} />
    </ToastContext.Provider>
  );
}

function ToastHost({
  toast,
  onDone,
}: {
  toast: ToastState | null;
  onDone: () => void;
}) {
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!toast) return;
    opacity.setValue(0);
    Animated.timing(opacity, {
      toValue: 1,
      duration: 180,
      useNativeDriver: true,
    }).start();
    const t = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: 220,
        useNativeDriver: true,
      }).start(() => onDone());
    }, toast.durationMs);
    return () => clearTimeout(t);
  }, [toast, opacity, onDone]);

  if (!toast) return null;
  const accent = {
    info: colors.secondary,
    success: colors.success,
    error: colors.danger,
  }[toast.type];
  const icon = {
    info: "information-circle",
    success: "checkmark-circle",
    error: "alert-circle",
  }[toast.type] as React.ComponentProps<typeof Ionicons>["name"];

  return (
    <Animated.View
      pointerEvents="box-none"
      style={[styles.host, { bottom: insets.bottom + 84, opacity }]}
    >
      <View
        style={[
          styles.toast,
          { backgroundColor: colors.surface, borderColor: accent },
        ]}
      >
        <Ionicons name={icon} size={20} color={accent} />
        <AppText variant="small" style={styles.text}>
          {toast.message}
        </AppText>
        {toast.action ? (
          <Pressable
            accessibilityRole="button"
            onPress={() => {
              toast.action?.onPress();
              onDone();
            }}
            hitSlop={8}
          >
            <AppText variant="smallStrong" color="primary">
              {toast.action.text}
            </AppText>
          </Pressable>
        ) : null}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  host: {
    position: "absolute",
    left: spacing.screen,
    right: spacing.screen,
    alignItems: "center",
  },
  toast: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    maxWidth: 480,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderRadius: radius.md,
    borderWidth: 1,
    shadowColor: "#000",
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 6,
  },
  text: { flexShrink: 1 },
});
