import React, { useEffect, useState } from "react";
import {
  AccessibilityInfo,
  Animated,
  Modal,
  Pressable,
  StyleSheet,
  View,
} from "react-native";
import * as Clipboard from "expo-clipboard";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { useOverlayOpen } from "../ui/overlayState";
import type { PromotionItem } from "../../config/promotions";
import { personalise } from "../../config/promotions";

interface Props {
  item: PromotionItem | null;
  firstName?: string | null;
  /** The button: route to the item's destination. */
  onCta: (item: PromotionItem) => void;
  /** "Maybe later", the backdrop or the back button. */
  onDismiss: (item: PromotionItem) => void;
}

const ICONS: Record<PromotionItem["kind"], keyof typeof Ionicons.glyphMap> = {
  welcome: "gift",
  coupon: "ticket",
  info: "megaphone",
};

/**
 * The promotion pop-up: one card over a dim backdrop, fed by
 * config/promotions. The backdrop fades in over 250 ms while the card
 * springs up from 94 % scale over about 360 ms; with Reduce Motion on, both
 * only fade. Shown at most once per launch and never twice per account
 * (see PromoPopup).
 */
export function PromoSheet({ item, firstName, onCta, onDismiss }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const visible = !!item;
  useOverlayOpen(visible);
  const [backdrop] = useState(() => new Animated.Value(0));
  const [card] = useState(() => new Animated.Value(0));
  const [reduceMotion, setReduceMotion] = useState(false);

  useEffect(() => {
    let active = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((v) => active && setReduceMotion(v))
      .catch(() => undefined);
    const sub = AccessibilityInfo.addEventListener(
      "reduceMotionChanged",
      setReduceMotion,
    );
    return () => {
      active = false;
      sub.remove();
    };
  }, []);

  useEffect(() => {
    if (!visible) {
      backdrop.setValue(0);
      card.setValue(0);
      return;
    }
    Animated.parallel([
      Animated.timing(backdrop, {
        toValue: 1,
        duration: 250,
        useNativeDriver: true,
      }),
      reduceMotion
        ? Animated.timing(card, {
            toValue: 1,
            duration: 250,
            useNativeDriver: true,
          })
        : Animated.spring(card, {
            toValue: 1,
            useNativeDriver: true,
            speed: 14,
            bounciness: 6,
          }),
    ]).start();
  }, [visible, backdrop, card, reduceMotion]);

  if (!item) return null;

  const scale = reduceMotion
    ? 1
    : card.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] });

  const copy = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
    } catch (err) {
      console.warn("Copy failed:", err);
    }
    toast(`Copied ${code}`, { durationMs: 1400 });
  };

  return (
    <Modal
      visible
      transparent
      animationType="none"
      statusBarTranslucent
      onRequestClose={() => onDismiss(item)}
    >
      <View style={styles.root}>
        <Animated.View
          style={[
            styles.backdrop,
            { backgroundColor: colors.backdrop, opacity: backdrop },
          ]}
        >
          <Pressable
            style={styles.fill}
            onPress={() => onDismiss(item)}
            accessibilityLabel="Close"
          />
        </Animated.View>
        <Animated.View
          style={[
            styles.card,
            {
              backgroundColor: colors.background,
              borderColor: colors.border,
              opacity: card,
              transform: [{ scale }],
            },
          ]}
          accessibilityViewIsModal
        >
          <View style={[styles.iconWrap, { backgroundColor: colors.accent }]}>
            <Ionicons
              name={ICONS[item.kind]}
              size={34}
              color={colors.onAccent}
            />
          </View>
          {item.badge ? (
            <View
              style={[styles.badge, { backgroundColor: colors.surfaceRaised }]}
            >
              <AppText variant="eyebrow" color="primary">
                {item.badge.toUpperCase()}
              </AppText>
            </View>
          ) : null}
          <AppText variant="title" align="center">
            {personalise(item.title, firstName)}
          </AppText>
          {item.body ? (
            <AppText variant="body" color="textSecondary" align="center">
              {personalise(item.body, firstName)}
            </AppText>
          ) : null}

          {item.kind === "coupon" && item.couponCode ? (
            <Pressable
              accessibilityRole="button"
              accessibilityLabel={`Copy ${item.couponCode}`}
              onPress={() => void copy(item.couponCode as string)}
              style={[
                styles.code,
                {
                  borderColor: colors.primary,
                  backgroundColor: colors.surface,
                },
              ]}
            >
              <AppText variant="heading" style={styles.codeText}>
                {item.couponCode}
              </AppText>
              <Ionicons name="copy-outline" size={18} color={colors.primary} />
            </Pressable>
          ) : null}

          <View style={styles.actions}>
            {item.ctaLabel && item.ctaRoute ? (
              <Button title={item.ctaLabel} onPress={() => onCta(item)} />
            ) : null}
            <Button
              title={item.ctaLabel && item.ctaRoute ? "Maybe later" : "Got it"}
              variant="ghost"
              onPress={() => onDismiss(item)}
            />
          </View>
        </Animated.View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: spacing.xl,
  },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  fill: { flex: 1 },
  card: {
    width: "100%",
    maxWidth: 400,
    borderRadius: radius.xl,
    borderWidth: 1,
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    alignItems: "center",
    gap: spacing.md,
  },
  iconWrap: {
    width: 72,
    height: 72,
    borderRadius: 36,
    alignItems: "center",
    justifyContent: "center",
  },
  badge: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radius.pill,
  },
  code: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: radius.sm,
    paddingVertical: 10,
    paddingHorizontal: spacing.lg,
  },
  codeText: { letterSpacing: 1.5 },
  actions: { alignSelf: "stretch", gap: spacing.xs, marginTop: spacing.sm },
});
