import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import type { RideRequest } from "../../interfaces/ride";
import { submitRideRating } from "../../services/rideService";
import { cad } from "../../utils/money";
import { ratingNudgedKey, sessionFlag } from "../../utils/sessionFlags";
import { fontFamily, radius, spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Button } from "../ui/Button";
import { useToast } from "../ui/Toast";
import { RouteTimeline } from "./RouteTimeline";

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];

interface Props {
  ride: RideRequest;
  riderFirstName?: string;
  /** Called after Submit (with the stars) or Skip. */
  onDone: (submittedRating?: number) => void;
}

/**
 * "You've arrived": the trip summary and the rating prompt, shown in the
 * live panel the moment the driver completes the trip (the approved
 * mockup's trip-complete screen).
 */
export function TripCompletePanel({ ride, riderFirstName, onDone }: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const busy = useRef(false);

  const submit = () => {
    if (rating < 1 || busy.current) return;
    busy.current = true;
    sessionFlag.set(ratingNudgedKey(ride.id as string));
    submitRideRating(ride.id as string, rating, comment.trim()).catch(
      (err: unknown) => {
        const msg = err instanceof Error ? err.message : "";
        if (!/already rated|not found/i.test(msg))
          toast("Couldn't save your rating. Please try again.", {
            type: "error",
          });
      },
    );
    onDone(rating);
  };

  const km = ride.actualDistanceKm ?? ride.distance;
  const discount = Number(ride.discountAmount) || 0;
  const total = ride.totalClientCharge ?? 0;
  const card = { backgroundColor: colors.surface, borderColor: colors.border };

  return (
    <View style={styles.root}>
      <View style={styles.hero}>
        <View style={[styles.badge, { backgroundColor: colors.surfaceRaised }]}>
          <Ionicons name="checkmark" size={34} color={colors.success} />
        </View>
        <AppText variant="display">You&apos;ve arrived</AppText>
        <AppText variant="body" color="textSecondary">
          Thanks for riding with OK Let&apos;s Go
          {riderFirstName ? `, ${riderFirstName}` : ""}.
        </AppText>
      </View>

      <View style={[styles.card, card]}>
        <RouteTimeline
          pickup={ride.pickup.address}
          dropoff={ride.destination.address}
          compact
        />
        <View style={[styles.totalRow, { borderTopColor: colors.border }]}>
          <View>
            <AppText variant="eyebrow" color="textMuted">
              TRIP TOTAL{km ? ` · ${km} KM` : ""}
            </AppText>
            {discount > 0 ? (
              <AppText variant="smallStrong" color="accent">
                {ride.couponCode || "Discount"} applied
              </AppText>
            ) : null}
          </View>
          <View style={styles.amounts}>
            {discount > 0 ? (
              <AppText variant="small" color="textMuted" style={styles.strike}>
                {cad(total + discount)}
              </AppText>
            ) : null}
            <AppText variant="title" color="success">
              {cad(total)}
            </AppText>
          </View>
        </View>
      </View>

      <View style={[styles.card, card, styles.rate]}>
        <AppText variant="eyebrow" color="textMuted">
          RATE {(ride.driverFirstName || "YOUR DRIVER").toUpperCase()}
        </AppText>
        <View style={styles.stars}>
          {[1, 2, 3, 4, 5].map((n) => (
            <Pressable
              key={n}
              accessibilityRole="button"
              accessibilityLabel={`${n} star${n > 1 ? "s" : ""}`}
              onPress={() => setRating(n)}
              hitSlop={4}
            >
              <Ionicons
                name={n <= rating ? "star" : "star-outline"}
                size={40}
                color={n <= rating ? colors.success : colors.border}
              />
            </Pressable>
          ))}
        </View>
        <AppText variant="small" color="textMuted">
          {rating ? STAR_LABELS[rating] : "Tap a star · optional comment after"}
        </AppText>
        {rating ? (
          <TextInput
            value={comment}
            onChangeText={setComment}
            placeholder="Add a comment (optional)"
            placeholderTextColor={colors.textMuted}
            multiline
            maxLength={500}
            style={[
              styles.comment,
              {
                color: colors.text,
                backgroundColor: colors.background,
                borderColor: colors.border,
              },
            ]}
          />
        ) : null}
      </View>

      <Button title="Submit" onPress={submit} disabled={rating < 1} />
      <Button
        title="Skip for now"
        variant="ghost"
        onPress={() => {
          // Skipping here is an answer: Home must not ask again this session.
          sessionFlag.set(ratingNudgedKey(ride.id as string));
          onDone();
        }}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  root: { gap: spacing.md },
  hero: { alignItems: "center", gap: 4, paddingVertical: spacing.sm },
  badge: {
    width: 68,
    height: 68,
    borderRadius: 34,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.sm,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-end",
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  amounts: { alignItems: "flex-end" },
  strike: { textDecorationLine: "line-through" },
  rate: { alignItems: "center", gap: spacing.sm },
  stars: { flexDirection: "row", gap: spacing.sm },
  comment: {
    alignSelf: "stretch",
    minHeight: 64,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    textAlignVertical: "top",
  },
});
