import { useRef, useState } from "react";
import { Pressable, StyleSheet, TextInput, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useTheme } from "../../contexts/ThemeContext";
import { submitRideRating } from "../../services/rideService";
import { ratingNudgedKey, sessionFlag } from "../../utils/sessionFlags";
import { fontFamily, radius, spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { Avatar } from "../ui/Avatar";
import { Button } from "../ui/Button";
import { Dialog } from "../ui/Dialog";
import { useToast } from "../ui/Toast";

const STAR_LABELS = ["", "Poor", "Fair", "Good", "Great", "Excellent"];
const STAR_GOLD = "#F5B301";

interface Props {
  visible: boolean;
  rideId: string;
  driverName?: string;
  driverPhotoUrl?: string | null;
  /** Called immediately on submit (with the stars) or when skipped. */
  onClose: (submittedRating?: number) => void;
}

/**
 * "How was your trip?": one to five stars and an optional comment. Submits
 * in the background and closes at once; only a real failure is surfaced.
 */
export function RatingDialog({
  visible,
  rideId,
  driverName,
  driverPhotoUrl,
  onClose,
}: Props) {
  const { colors } = useTheme();
  const toast = useToast();
  const [rating, setRating] = useState(0);
  const [comment, setComment] = useState("");
  const busy = useRef(false);

  const reset = () => {
    setRating(0);
    setComment("");
    busy.current = false;
  };

  const submit = () => {
    if (rating < 1 || busy.current) return;
    busy.current = true;
    const stars = rating;
    // Home's lazy nudge checks this flag, so it never re-asks for a ride
    // whose write is still in flight.
    sessionFlag.set(ratingNudgedKey(rideId));
    submitRideRating(rideId, stars, comment.trim()).catch((err: unknown) => {
      const msg = err instanceof Error ? err.message : "";
      if (!/already rated|not found/i.test(msg)) {
        toast("Couldn't save your rating. Please try again.", {
          type: "error",
        });
      }
    });
    reset();
    onClose(stars);
  };

  return (
    <Dialog visible={visible}>
      <Avatar
        firstName={driverName}
        photoUrl={driverPhotoUrl ?? undefined}
        size={72}
      />
      <AppText variant="title" align="center" style={styles.title}>
        How was your trip?
      </AppText>
      <AppText variant="small" color="textMuted" align="center">
        Rate your trip with {driverName || "your driver"}
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
              size={38}
              color={n <= rating ? STAR_GOLD : colors.border}
            />
          </Pressable>
        ))}
      </View>
      <AppText variant="smallStrong" color="primary" style={styles.starLabel}>
        {STAR_LABELS[rating] || " "}
      </AppText>

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
            backgroundColor: colors.surface,
            borderColor: colors.border,
          },
        ]}
      />

      <Button
        title="Submit"
        onPress={submit}
        disabled={rating < 1}
        style={styles.submit}
      />
      <Button
        title="Not now"
        variant="ghost"
        onPress={() => {
          reset();
          onClose();
        }}
      />
    </Dialog>
  );
}

const styles = StyleSheet.create({
  title: { marginTop: spacing.sm },
  stars: { flexDirection: "row", gap: spacing.sm, marginTop: spacing.lg },
  starLabel: { minHeight: 18 },
  comment: {
    alignSelf: "stretch",
    minHeight: 72,
    borderRadius: radius.md,
    borderWidth: 1,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    fontFamily: fontFamily.medium,
    fontSize: 15,
    textAlignVertical: "top",
    marginTop: spacing.sm,
  },
  submit: { marginTop: spacing.md },
});
