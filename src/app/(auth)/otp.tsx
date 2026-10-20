import { Ionicons } from "@expo/vector-icons";
import { deleteField, doc, updateDoc } from "@react-native-firebase/firestore";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
  Keyboard,
  Linking,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { AppText } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { Logo } from "../../components/ui/Logo";
import { Screen } from "../../components/ui/Screen";
import { showAlert } from "../../components/ui/alerts";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  checkUserProfile,
  clearOtpSession,
  clearRegistrationActive,
  getConfirmationResult,
  getOtpSession,
  rebuildConfirmationResult,
  sendOtp,
  setRegistrationActive,
  type PhoneConfirmation,
} from "../../services/authService";
import { db } from "../../services/firebase";
import { logAuthEvent } from "../../services/telemetryService";
import { fontFamily, minTouch, radius, spacing } from "../../theme/tokens";
import {
  describeSendCodeError,
  describeVerifyCodeError,
} from "../../utils/authErrors";
import { maskPhone, supportMailto } from "../../utils/support";

const CODE_LENGTH = 6;
const RESEND_SECONDS = 30;

export default function Otp() {
  const router = useRouter();
  const { colors } = useTheme();
  const { logout } = useAuth();
  const params = useLocalSearchParams<{ phone?: string }>();

  // Recover the verification session if the in-memory one was lost to the app
  // being killed while the rider read their SMS. Resolved once, on mount.
  const [stored] = useState(() => getOtpSession());
  const [confirmation, setConfirmation] = useState<PhoneConfirmation | null>(
    () => {
      const live = getConfirmationResult();
      if (live) return live;
      const session = getOtpSession();
      return session ? rebuildConfirmationResult(session.verificationId) : null;
    },
  );
  const phone = params.phone || stored?.phone || "";

  const [otp, setOtp] = useState("");
  const [loading, setLoading] = useState(false);
  const [countdown, setCountdown] = useState(RESEND_SECONDS);
  const verifyLock = useRef(false); // synchronous guard against double submits
  const inputRef = useRef<TextInput>(null);

  useEffect(() => {
    const t = setTimeout(() => inputRef.current?.focus(), 400);
    return () => clearTimeout(t);
  }, []);

  useEffect(() => {
    if (countdown <= 0) return;
    const t = setTimeout(() => setCountdown((c) => c - 1), 1000);
    return () => clearTimeout(t);
  }, [countdown]);

  // No session at all (deep link, expired resume): back to the phone screen.
  useEffect(() => {
    if (phone && confirmation) return;
    showAlert(
      "Session lost",
      "Your verification session was interrupted or expired. Please request a new code.",
    );
    const t = setTimeout(() => router.replace("/(auth)/login"), 1500);
    return () => clearTimeout(t);
  }, [phone, confirmation, router]);

  const mailto = (errorCode?: string) =>
    supportMailto({
      subject: "Trouble verifying my code — OK Let's Go",
      intro: "Hi, I can't get past the verification code screen.",
      phone,
      errorCode,
    });

  const restoreAccountPrompt = (uid: string, role: string) =>
    showAlert(
      "Account deactivated",
      "Your account is currently scheduled for deletion. Would you like to restore your account and cancel the deletion process?",
      [
        {
          text: "No, log me out",
          style: "cancel",
          onPress: () => {
            clearOtpSession();
            void logout().finally(() => router.replace("/(auth)/login"));
          },
        },
        {
          text: "Yes, restore account",
          onPress: async () => {
            try {
              await updateDoc(doc(db, "users", uid), {
                status: "active",
                deletionScheduledAt: deleteField(),
              });
              router.replace(role === "driver" ? "/(driver)" : "/(client)");
            } catch (err) {
              console.error("Error restoring account:", err);
              showAlert(
                "Restoration failed",
                "Failed to restore account. Please try again.",
              );
            }
          },
        },
      ],
    );

  const handleVerify = async (code = otp) => {
    if (verifyLock.current) return;
    if (code.length !== CODE_LENGTH || !confirmation) return;
    verifyLock.current = true;
    Keyboard.dismiss();
    setLoading(true);

    // Flag registration BEFORE confirm() so the profile listener, which fires
    // the moment Firebase Auth resolves, never treats the new user as a ghost.
    setRegistrationActive();

    try {
      const result = await confirmation.confirm(code);
      const user = result.user;
      clearOtpSession();
      void logAuthEvent("otp_confirm_success", { phone: maskPhone(phone) });
      const existing = await checkUserProfile(user.uid);

      if (existing) {
        clearRegistrationActive();
        if (existing.status === "scheduled_for_deletion") {
          setLoading(false);
          verifyLock.current = false;
          restoreAccountPrompt(user.uid, existing.role);
          return;
        }
        router.replace(existing.role === "driver" ? "/(driver)" : "/(client)");
      } else {
        router.replace({ pathname: "/(auth)/role-select", params: { phone } });
      }
    } catch (err) {
      clearRegistrationActive();
      verifyLock.current = false;
      setLoading(false);
      const friendly = describeVerifyCodeError(err);
      void logAuthEvent("otp_confirm_failed", {
        code: friendly.code,
        phone: maskPhone(phone),
      });
      if (friendly.resend) setOtp("");
      showAlert(friendly.title, friendly.message, [
        ...(friendly.resend
          ? [{ text: "Resend code", onPress: () => void handleResend(true) }]
          : []),
        ...(friendly.support
          ? [
              {
                text: "Email support",
                onPress: () => Linking.openURL(mailto(friendly.code)),
              },
            ]
          : []),
        { text: "OK" },
      ]);
    }
  };

  /** `force` lets the "Code expired" alert resend before the cooldown ends. */
  const handleResend = async (force = false) => {
    if (countdown > 0 && !force) return;
    verifyLock.current = false;
    setLoading(true);
    try {
      setConfirmation(await sendOtp(phone));
      setCountdown(RESEND_SECONDS);
      setOtp("");
      showAlert(
        "Code sent",
        "A new verification code has been sent to your phone.",
      );
    } catch (err) {
      console.error("Resend error:", err);
      const friendly = describeSendCodeError(err);
      void logAuthEvent("otp_send_failed", {
        code: friendly.code,
        phone: maskPhone(phone),
        resend: true,
      });
      showAlert(
        friendly.title,
        friendly.message,
        friendly.support
          ? [
              {
                text: "Email support",
                onPress: () => Linking.openURL(mailto(friendly.code)),
              },
              { text: "OK" },
            ]
          : undefined,
      );
    } finally {
      setLoading(false);
    }
  };

  const onChange = (text: string) => {
    const val = text.replace(/\D/g, "").slice(0, CODE_LENGTH);
    setOtp(val);
    if (val.length === CODE_LENGTH) void handleVerify(val);
  };

  return (
    <Screen scroll edges={["top", "bottom", "left", "right"]}>
      <View style={styles.topBar}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Back"
          disabled={loading}
          onPress={() =>
            router.canGoBack() ? router.back() : router.replace("/(auth)/login")
          }
          style={[
            styles.iconButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <Ionicons name="chevron-back" size={22} color={colors.text} />
        </Pressable>
        <Logo width={120} />
        <View style={{ width: minTouch }} />
      </View>

      <AppText variant="eyebrow" color="secondary" style={styles.eyebrow}>
        VERIFICATION CODE
      </AppText>
      <AppText variant="display">Enter the 6-digit code</AppText>
      <AppText variant="body" color="textSecondary" style={styles.sub}>
        Enter the code sent to{" "}
        <AppText variant="bodyStrong" color="text">
          {maskPhone(phone)}
        </AppText>
        .
      </AppText>

      <Pressable onPress={() => inputRef.current?.focus()} style={styles.boxes}>
        {Array.from({ length: CODE_LENGTH }).map((_, i) => (
          <View
            key={i}
            style={[
              styles.box,
              {
                backgroundColor: colors.surface,
                borderColor:
                  otp.length === i ? colors.secondary : colors.border,
              },
            ]}
          >
            <AppText variant="title">{otp[i] ?? ""}</AppText>
          </View>
        ))}
        {/* The real input is invisible so the OS can auto-fill the SMS code. */}
        <TextInput
          ref={inputRef}
          value={otp}
          onChangeText={onChange}
          keyboardType="number-pad"
          textContentType="oneTimeCode"
          autoComplete="sms-otp"
          maxLength={CODE_LENGTH}
          editable={!loading}
          style={styles.hiddenInput}
          caretHidden
        />
      </Pressable>

      <Button
        title="Verify"
        onPress={() => void handleVerify()}
        loading={loading}
        disabled={otp.length !== CODE_LENGTH}
        style={styles.cta}
      />

      <Pressable
        accessibilityRole="button"
        disabled={countdown > 0 || loading}
        onPress={() => void handleResend()}
        style={styles.resend}
      >
        <AppText
          variant="smallStrong"
          color={countdown > 0 ? "textMuted" : "primary"}
          align="center"
        >
          {countdown > 0 ? `Resend code in ${countdown}s` : "Resend code"}
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
  boxes: {
    flexDirection: "row",
    justifyContent: "space-between",
    gap: spacing.sm,
  },
  box: {
    flex: 1,
    height: 60,
    borderRadius: radius.md,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
  hiddenInput: {
    position: "absolute",
    opacity: 0.01,
    width: "100%",
    height: 60,
    fontFamily: fontFamily.bold,
  },
  cta: { marginTop: spacing.xxl },
  resend: {
    marginTop: spacing.xl,
    minHeight: minTouch,
    justifyContent: "center",
  },
});
