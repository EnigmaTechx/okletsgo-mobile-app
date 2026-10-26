import { Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../theme/tokens";
import type { KmBank, PromotionItem } from "../../config/promotions";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";

const fmtKm = (km: number) =>
  km >= 10 ? String(Math.round(km)) : km.toFixed(1);

const expiry = (item: PromotionItem): string | null => {
  if (!item.endsAt) return null;
  const d = new Date(item.endsAt);
  return Number.isNaN(d.getTime())
    ? null
    : d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
};

/**
 * Home's reminder once the welcome pop-up was dismissed: a yellow strip
 * that stays until the gift is used or expires.
 */
export function WelcomeStrip({
  item,
  onPress,
}: {
  item: PromotionItem;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.strip,
        { backgroundColor: colors.accent, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <Ionicons name="gift" size={22} color={colors.onAccent} />
      <View style={styles.flex}>
        <AppText variant="bodyStrong" style={{ color: colors.onAccent }}>
          Your first ride is on us
        </AppText>
        <AppText variant="small" style={{ color: colors.onAccent }}>
          {item.maxFreeKm ? `Up to ${fmtKm(item.maxFreeKm)} km free. ` : ""}
          Tap to book it.
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={20} color={colors.onAccent} />
    </Pressable>
  );
}

/** The Rewards tab's hero while the gift is unused. */
export function WelcomeHeroCard({
  item,
  bookedRideId,
  onBook,
  onOpenRide,
}: {
  item: PromotionItem;
  bookedRideId: string | null;
  onBook: () => void;
  onOpenRide: (id: string) => void;
}) {
  const { colors } = useTheme();
  const until = expiry(item);
  return (
    <View style={[styles.hero, { backgroundColor: colors.accent }]}>
      <View style={styles.heroTop}>
        <View style={[styles.heroIcon, { backgroundColor: colors.background }]}>
          <Ionicons name="gift" size={26} color={colors.primary} />
        </View>
        <View style={styles.flex}>
          <AppText variant="eyebrow" style={{ color: colors.onAccent }}>
            {(item.badge ?? "WELCOME GIFT").toUpperCase()}
          </AppText>
          <AppText variant="heading" style={{ color: colors.onAccent }}>
            First ride free
          </AppText>
        </View>
      </View>
      <AppText variant="body" style={{ color: colors.onAccent }}>
        {item.maxFreeKm
          ? `Your first trip of up to ${fmtKm(item.maxFreeKm)} km is on us; a longer one has its first ${fmtKm(item.maxFreeKm)} km covered. `
          : "Your first trip is on us. "}
        {bookedRideId
          ? "It's applied to your booked ride."
          : "It's applied automatically when you book."}
        {until && !bookedRideId ? ` Book by ${until}.` : ""}
      </AppText>
      {bookedRideId ? (
        <Button
          title="View your ride"
          variant="secondary"
          onPress={() => onOpenRide(bookedRideId)}
          style={{ ...styles.heroBtn, borderColor: colors.onAccent }}
        />
      ) : (
        <Button
          title="Book your free ride"
          onPress={onBook}
          style={styles.heroBtn}
        />
      )}
    </View>
  );
}

/** The km bank: credits to spend and progress to the next one. */
export function KmBankCard({ bank }: { bank: KmBank }) {
  const { colors } = useTheme();
  const pct = Math.min(1, bank.progressKm / bank.kmPerCredit);
  return (
    <View
      style={[
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
      ]}
    >
      <View style={styles.heroTop}>
        <View
          style={[styles.heroIcon, { backgroundColor: colors.surfaceRaised }]}
        >
          <Ionicons
            name="speedometer-outline"
            size={24}
            color={colors.secondary}
          />
        </View>
        <View style={styles.flex}>
          <AppText variant="eyebrow" color="textMuted">
            KM REWARDS
          </AppText>
          <AppText variant="heading">
            {bank.credits > 0
              ? `${fmtKm(bank.freeKm)} km free`
              : "No credit banked yet"}
          </AppText>
        </View>
        {bank.credits > 0 ? (
          <View style={[styles.pill, { backgroundColor: colors.success }]}>
            <AppText variant="smallStrong" style={{ color: colors.onSuccess }}>
              {bank.credits} {bank.credits === 1 ? "credit" : "credits"}
            </AppText>
          </View>
        ) : null}
      </View>
      <View style={[styles.track, { backgroundColor: colors.surfaceRaised }]}>
        <View
          style={[
            styles.fill,
            { backgroundColor: colors.secondary, width: `${pct * 100}%` },
          ]}
        />
      </View>
      <AppText variant="small" color="textSecondary">
        {fmtKm(bank.progressKm)} of {fmtKm(bank.kmPerCredit)} km to your next{" "}
        {fmtKm(bank.creditKm)} km credit.
        {bank.credits > 0
          ? ` Use a credit at checkout: your trip's first ${fmtKm(bank.creditKm)} km are free.`
          : ` Every ${fmtKm(bank.kmPerCredit)} km you ride banks ${fmtKm(bank.creditKm)} km of free riding.`}
      </AppText>
    </View>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  strip: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    borderRadius: radius.md,
  },
  hero: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    gap: spacing.md,
  },
  heroTop: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  heroIcon: {
    width: 48,
    height: 48,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
  heroBtn: { marginTop: spacing.xs },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  pill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radius.pill,
  },
  track: { height: 8, borderRadius: 4, overflow: "hidden" },
  fill: { height: 8, borderRadius: 4 },
});
