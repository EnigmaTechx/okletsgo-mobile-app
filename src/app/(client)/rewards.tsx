import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import * as Clipboard from "expo-clipboard";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { KmBankCard, WelcomeHeroCard } from "../../components/promo/PromoCards";
import { AppText } from "../../components/ui/AppText";
import { Screen } from "../../components/ui/Screen";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import { usePromotions } from "../../contexts/PromotionsContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  discountLabel,
  subscribeAvailableCoupons,
  type Coupon,
} from "../../services/couponService";
import { radius, spacing } from "../../theme/tokens";

const validUntil = (c: Coupon): string | null => {
  const ms = c.validUntil?.toMillis?.();
  return ms
    ? new Date(ms).toLocaleDateString("en-US", {
        month: "short",
        day: "numeric",
        year: "numeric",
      })
    : null;
};

/**
 * Rewards tab: the welcome gift while it is unused, the km bank, then the
 * coupon codes a rider can type at checkout (the Ionic Coupons page).
 */
export default function ClientRewards() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const { welcome, welcomeAvailable, welcomeBookedRideId, bank } =
    usePromotions();
  const toast = useToast();
  const [coupons, setCoupons] = useState<Coupon[] | null>(null);

  useEffect(() => {
    if (!currentUser) return;
    return subscribeAvailableCoupons(currentUser.uid, setCoupons);
  }, [currentUser]);

  const copy = async (code: string) => {
    try {
      await Clipboard.setStringAsync(code);
    } catch (err) {
      console.warn("Copy failed:", err);
    }
    toast(`Copied ${code}`, { durationMs: 1400 });
  };

  return (
    <Screen scroll>
      <View style={styles.header}>
        <AppText variant="title">Rewards</AppText>
        <AppText variant="small" color="textMuted">
          Gifts, km credits and codes for your rides.
        </AppText>
      </View>

      {welcome && (welcomeAvailable || welcomeBookedRideId) ? (
        <View style={styles.promo}>
          <WelcomeHeroCard
            item={welcome}
            bookedRideId={welcomeBookedRideId}
            onBook={() => router.push("/(ride)/book/locations")}
            onOpenRide={(id) =>
              router.push({ pathname: "/(ride)/live/[id]", params: { id } })
            }
          />
        </View>
      ) : null}
      {bank ? (
        <View style={styles.promo}>
          <KmBankCard bank={bank} />
        </View>
      ) : null}

      <AppText variant="eyebrow" color="textMuted" style={styles.sectionTitle}>
        YOUR CODES
      </AppText>
      {coupons === null ? (
        <ActivityIndicator color={colors.primary} style={styles.center} />
      ) : coupons.length === 0 ? (
        <View style={styles.empty}>
          <Ionicons name="ticket-outline" size={56} color={colors.textMuted} />
          <AppText variant="heading" align="center">
            No coupons available
          </AppText>
          <AppText variant="small" color="textMuted" align="center">
            Check back later. New offers show up here automatically.
          </AppText>
        </View>
      ) : (
        <View style={styles.list}>
          {coupons.map((c) => {
            const until = validUntil(c);
            return (
              <View
                key={c.id}
                style={[
                  styles.card,
                  {
                    backgroundColor: colors.surface,
                    borderColor: colors.border,
                  },
                ]}
              >
                <View style={styles.cardTop}>
                  <View
                    style={[
                      styles.icon,
                      { backgroundColor: colors.surfaceRaised },
                    ]}
                  >
                    <Ionicons
                      name="ticket-outline"
                      size={20}
                      color={colors.primary}
                    />
                  </View>
                  <View style={styles.flex}>
                    <AppText variant="bodyStrong">
                      {c.description || discountLabel(c)}
                    </AppText>
                    <AppText variant="smallStrong" color="primary">
                      {discountLabel(c)}
                      {c.minFare ? ` · min fare $${c.minFare}` : ""}
                    </AppText>
                  </View>
                </View>
                {until ? (
                  <View style={styles.inline}>
                    <Ionicons
                      name="calendar-clear-outline"
                      size={14}
                      color={colors.textMuted}
                    />
                    <AppText variant="small" color="textMuted">
                      Valid until {until}
                    </AppText>
                  </View>
                ) : null}
                <View style={styles.codeRow}>
                  <View
                    style={[
                      styles.code,
                      {
                        borderColor: colors.primary,
                        backgroundColor: colors.background,
                      },
                    ]}
                  >
                    <AppText variant="heading" style={styles.codeText}>
                      {c.code}
                    </AppText>
                  </View>
                  <Pressable
                    accessibilityRole="button"
                    accessibilityLabel={`Copy ${c.code}`}
                    onPress={() => void copy(c.code)}
                    style={({ pressed }) => [
                      styles.copy,
                      {
                        backgroundColor: colors.primary,
                        opacity: pressed ? 0.85 : 1,
                      },
                    ]}
                  >
                    <Ionicons
                      name="copy-outline"
                      size={16}
                      color={colors.onPrimary}
                    />
                    <AppText
                      variant="smallStrong"
                      style={{ color: colors.onPrimary }}
                    >
                      Copy
                    </AppText>
                  </Pressable>
                </View>
              </View>
            );
          })}
        </View>
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  header: { paddingVertical: spacing.lg, gap: 4 },
  promo: { marginBottom: spacing.md },
  sectionTitle: { marginTop: spacing.xs, marginBottom: spacing.sm },
  center: { marginTop: 48 },
  empty: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: 64,
    paddingHorizontal: spacing.lg,
  },
  list: { gap: spacing.md },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  cardTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  icon: {
    width: 38,
    height: 38,
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
  },
  flex: { flex: 1 },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  codeRow: { flexDirection: "row", alignItems: "stretch", gap: spacing.sm },
  code: {
    flex: 1,
    borderWidth: 2,
    borderStyle: "dashed",
    borderRadius: radius.sm,
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 8,
  },
  codeText: { letterSpacing: 1.5 },
  copy: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 16,
    borderRadius: radius.sm,
  },
});
