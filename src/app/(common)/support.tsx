import { useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { httpsCallable } from "@react-native-firebase/functions";
import { Screen } from "../../components/ui/Screen";
import { AppText } from "../../components/ui/AppText";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { showAlert } from "../../components/ui/alerts";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { functions } from "../../services/firebase";
import { SUPPORT_EMAIL } from "../../utils/support";
import { radius, spacing } from "../../theme/tokens";

// Must match VALID_CATEGORIES in the sendSupportEmail Cloud Function.
const CATEGORIES = [
  {
    value: "ride_issue",
    label: "Issue with a ride",
    icon: "alert-circle-outline",
  },
  { value: "billing", label: "Billing question", icon: "card-outline" },
  { value: "account", label: "Account help", icon: "person-outline" },
  { value: "feedback", label: "App feedback", icon: "sparkles-outline" },
  { value: "other", label: "Other", icon: "chatbubbles-outline" },
] as const;

const MIN_LENGTH = 10;
const MAX_LENGTH = 1000;

const friendlyError = (err: unknown): string => {
  if (err && typeof err === "object" && "code" in err) {
    const code = String((err as { code: string }).code);
    const serverMsg = (err as { message?: string }).message ?? "";
    if (code.endsWith("resource-exhausted")) return serverMsg;
    if (code.endsWith("unauthenticated"))
      return "You need to be signed in to contact support.";
    if (code.endsWith("invalid-argument"))
      return serverMsg || "Please check your message and try again.";
    if (code.endsWith("not-found"))
      return "Your account profile could not be found. Please try again.";
  }
  return `Something went wrong on our end. You can email us directly at ${SUPPORT_EMAIL}.`;
};

/** Send a message to support through the existing Cloud Function. */
export default function Support() {
  const router = useRouter();
  const { colors } = useTheme();
  const { userProfile } = useAuth();
  const [category, setCategory] = useState<
    (typeof CATEGORIES)[number]["value"] | ""
  >("");
  const [message, setMessage] = useState("");
  const [sending, setSending] = useState(false);

  const isValid = category !== "" && message.trim().length >= MIN_LENGTH;
  const mailto = `mailto:${SUPPORT_EMAIL}`;

  const send = async () => {
    if (!isValid) return;
    setSending(true);
    try {
      const fn = httpsCallable(functions, "sendSupportEmail");
      await fn({ category, message: message.trim() });
      setMessage("");
      setCategory("");
      showAlert(
        "Message sent",
        "We will get back to you within 24 hours. Check your email for our reply.",
        [{ text: "Got it", onPress: () => router.back() }],
      );
    } catch (err) {
      showAlert("Could not send message", friendlyError(err), [
        { text: "Email us directly", onPress: () => Linking.openURL(mailto) },
        { text: "OK", style: "cancel" },
      ]);
    } finally {
      setSending(false);
    }
  };

  return (
    <Screen scroll edges={["left", "right"]}>
      <AppText variant="eyebrow" color="textMuted" style={styles.label}>
        FROM
      </AppText>
      <View
        style={[
          styles.card,
          styles.sender,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Avatar
          firstName={userProfile?.firstName}
          lastName={userProfile?.lastName}
          size={44}
        />
        <View style={styles.senderText}>
          <AppText variant="bodyStrong">
            {userProfile
              ? `${userProfile.firstName} ${userProfile.lastName}`
              : ""}
          </AppText>
          <AppText variant="small" color="textMuted">
            {userProfile?.email ?? ""}
          </AppText>
        </View>
      </View>

      <AppText variant="eyebrow" color="textMuted" style={styles.label}>
        TOPIC
      </AppText>
      <View style={styles.chips}>
        {CATEGORIES.map((c) => {
          const active = category === c.value;
          return (
            <Pressable
              key={c.value}
              accessibilityRole="button"
              accessibilityState={{ selected: active }}
              onPress={() => setCategory(c.value)}
              style={[
                styles.chip,
                {
                  backgroundColor: active ? colors.primary : colors.surface,
                  borderColor: active ? colors.primary : colors.border,
                },
              ]}
            >
              <Ionicons
                name={c.icon}
                size={16}
                color={active ? colors.onPrimary : colors.textMuted}
              />
              <AppText
                variant="smallStrong"
                style={{ color: active ? colors.onPrimary : colors.text }}
              >
                {c.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <AppText variant="eyebrow" color="textMuted" style={styles.label}>
        MESSAGE
      </AppText>
      <TextField
        value={message}
        onChangeText={(t) => setMessage(t.slice(0, MAX_LENGTH))}
        placeholder="Describe your issue or feedback in detail..."
        multiline
        numberOfLines={6}
        textAlignVertical="top"
        style={styles.textarea}
        editable={!sending}
      />
      <AppText
        variant="small"
        color="textMuted"
        align="right"
        style={styles.counter}
      >
        {message.length} / {MAX_LENGTH}
        {message.trim().length > 0 && message.trim().length < MIN_LENGTH
          ? `  ·  at least ${MIN_LENGTH} characters`
          : ""}
      </AppText>

      <Button
        title="Send message"
        onPress={() => void send()}
        loading={sending}
        disabled={!isValid}
      />

      <AppText
        variant="small"
        color="textMuted"
        align="center"
        style={styles.or}
      >
        or reach us directly
      </AppText>
      <Pressable
        accessibilityRole="link"
        onPress={() => Linking.openURL(mailto).catch(() => undefined)}
        style={[
          styles.card,
          styles.emailRow,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <Ionicons name="mail-outline" size={20} color={colors.primary} />
        <View style={styles.senderText}>
          <AppText variant="small" color="textMuted">
            Email us at
          </AppText>
          <AppText variant="bodyStrong">{SUPPORT_EMAIL}</AppText>
        </View>
        <Ionicons name="chevron-forward" size={18} color={colors.textMuted} />
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  label: { paddingTop: spacing.xl, paddingBottom: spacing.sm },
  card: { borderWidth: 1, borderRadius: radius.lg, padding: spacing.lg },
  sender: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  senderText: { flex: 1, gap: 2 },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: spacing.sm },
  chip: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    minHeight: 40,
    paddingHorizontal: 14,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  textarea: { minHeight: 150, paddingTop: 14, fontSize: 15 },
  counter: { marginTop: spacing.xs, marginBottom: spacing.lg },
  or: { marginVertical: spacing.lg },
  emailRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
});
