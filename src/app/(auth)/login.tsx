import React, { useState } from "react";
import { Keyboard, Linking, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/ui/Screen";
import { AppText } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { Logo } from "../../components/ui/Logo";
import { showAlert } from "../../components/ui/alerts";
import { useTheme } from "../../contexts/ThemeContext";
import { sendOtp } from "../../services/authService";
import { logAuthEvent } from "../../services/telemetryService";
import { describeSendCodeError } from "../../utils/authErrors";
import { maskPhone, supportMailto } from "../../utils/support";
import { minTouch, radius, spacing } from "../../theme/tokens";

/** "(519)-555-0123" as the rider types, same as the Ionic app. */
const formatPhone = (digits: string): string => {
  if (digits.length > 6) return `(${digits.slice(0, 3)})-${digits.slice(3, 6)}-${digits.slice(6)}`;
  if (digits.length > 3) return `(${digits.slice(0, 3)})-${digits.slice(3)}`;
  if (digits.length > 0) return `(${digits}`;
  return "";
};

export default function Login() {
  const router = useRouter();
  const { colors } = useTheme();
  const [rawPhone, setRawPhone] = useState("");
  const [loading, setLoading] = useState(false);

  const mailto = (errorCode?: string) =>
    supportMailto({
      subject: "Trouble signing in to OK Let's Go",
      intro: "Hi, I can't sign in to the app.",
      phone: rawPhone ? `+1${rawPhone}` : undefined,
      errorCode,
    });

  const onChange = (text: string) => {
    const cleaned = text.replace(/\D/g, "").slice(0, 10);
    setRawPhone(cleaned);
    if (cleaned.length === 10) Keyboard.dismiss();
  };

  const handleSendOtp = async () => {
    if (rawPhone.length !== 10) {
      showAlert("Invalid number", "Please enter a valid 10-digit phone number.");
      return;
    }
    setLoading(true);
    const fullPhoneNumber = `+1${rawPhone}`;
    try {
      await sendOtp(fullPhoneNumber);
      // Pre-sign-in funnel event (the rules allow this one unauthenticated).
      void logAuthEvent("otp_sent", { phone: maskPhone(fullPhoneNumber) });
      router.push({ pathname: "/(auth)/otp", params: { phone: fullPhoneNumber } });
    } catch (err) {
      console.error("Login error:", err);
      // Plain words for the rider, raw code for Auth Diagnostics and the
      // support email. This step was invisible before: a lockout or Play
      // Integrity failure here happens before the user is signed in.
      const friendly = describeSendCodeError(err);
      void logAuthEvent("otp_send_failed", { code: friendly.code, phone: maskPhone(fullPhoneNumber) });
      showAlert(
        friendly.title,
        friendly.message,
        friendly.support
          ? [
              { text: "Email support", onPress: () => Linking.openURL(mailto(friendly.code)) },
              { text: "OK" },
            ]
          : undefined,
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <Screen scroll edges={["top", "bottom", "left", "right"]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(auth)/welcome"))}
          style={[styles.iconButton, { backgroundColor: colors.surface, borderColor: colors.border }]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Logo width={120} />
        <View style={{ width: minTouch }} />
      </View>

      <AppText variant="eyebrow" color="secondary" style={styles.eyebrow}>
        SIGN UP OR SIGN IN
      </AppText>
      <AppText variant="display">What&apos;s your mobile number?</AppText>
      <AppText variant="body" color="textSecondary" style={styles.sub}>
        We&apos;ll text you a 6-digit code. No password to remember.
      </AppText>

      <TextField
        label="Mobile number"
        prefix="+1"
        value={formatPhone(rawPhone)}
        onChangeText={onChange}
        keyboardType="phone-pad"
        textContentType="telephoneNumber"
        autoComplete="tel"
        autoFocus
        placeholder="(519)-555-0123"
        editable={!loading}
      />

      <View style={[styles.note, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Ionicons name="shield-checkmark-outline" size={18} color={colors.success} />
        <AppText variant="small" color="textSecondary" style={styles.noteText}>
          Verified natively on your phone. No browser pop-up, no reCAPTCHA puzzle.
        </AppText>
      </View>

      <Button
        title="Send code"
        onPress={handleSendOtp}
        loading={loading}
        disabled={rawPhone.length !== 10}
        style={styles.cta}
      />

      <AppText variant="small" color="textMuted" align="center" style={styles.terms}>
        By continuing you agree to the Terms of Use. Standard message rates may apply.
      </AppText>

      {/* Reachable before sign-in, so a locked-out user can still reach us. */}
      <Pressable
        accessibilityRole="link"
        onPress={() => Linking.openURL(mailto())}
        style={styles.support}
      >
        <AppText variant="small" color="textMuted" align="center">
          Having trouble signing in?{" "}
          <AppText variant="smallStrong" color="secondary">
            Contact support
          </AppText>
        </AppText>
      </Pressable>
    </Screen>
  );
}

const styles = StyleSheet.create({
  topBar: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: spacing.sm,
    marginBottom: spacing.xxl,
  },
  iconButton: {
    width: minTouch,
    height: minTouch,
    borderRadius: minTouch / 2,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  eyebrow: { marginBottom: spacing.sm },
  sub: { marginTop: spacing.sm, marginBottom: spacing.xxl },
  note: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
    marginTop: spacing.lg,
  },
  noteText: { flex: 1 },
  cta: { marginTop: spacing.xl },
  terms: { marginTop: spacing.lg },
  support: { marginTop: spacing.xl, minHeight: minTouch, justifyContent: "center" },
});
