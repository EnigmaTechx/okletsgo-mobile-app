import { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { AppText } from "../../components/ui/AppText";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { showAlert } from "../../components/ui/alerts";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import {
  confirmPhoneChange,
  startPhoneChange,
  updateProfileFields,
} from "../../services/profileService";
import { logAuthEvent } from "../../services/telemetryService";
import {
  describeSendCodeError,
  describeVerifyCodeError,
} from "../../utils/authErrors";
import { maskPhone } from "../../utils/support";
import { radius, spacing } from "../../theme/tokens";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Ten digits → "(519) 555-0123" while typing. */
const formatPhone = (digits: string): string => {
  const d = digits.replace(/\D/g, "").slice(0, 10);
  if (d.length > 6) return `(${d.slice(0, 3)}) ${d.slice(3, 6)}-${d.slice(6)}`;
  if (d.length > 3) return `(${d.slice(0, 3)}) ${d.slice(3)}`;
  if (d.length > 0) return `(${d}`;
  return "";
};

/** "+15195550123" → "5195550123". */
const tenDigits = (phone: string): string => {
  const raw = phone.replace(/\D/g, "");
  return raw.length > 10 ? raw.slice(-10) : raw;
};

/**
 * Edit name, email and mobile number. A new number is verified by SMS
 * before it is saved, as in the Ionic app; everything else saves at once.
 */
export default function EditProfile() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentUser, userProfile, refreshProfile } = useAuth();
  const isDriver = userProfile?.role === "driver";

  const [initial] = useState(() => ({
    firstName: userProfile?.firstName ?? "",
    lastName: userProfile?.lastName ?? "",
    email: userProfile?.email ?? "",
    phone: tenDigits(userProfile?.phone ?? currentUser?.phoneNumber ?? ""),
  }));
  const [firstName, setFirstName] = useState(initial.firstName);
  const [lastName, setLastName] = useState(initial.lastName);
  const [email, setEmail] = useState(initial.email);
  const [phone, setPhone] = useState(initial.phone);
  const [saving, setSaving] = useState(false);
  // Set once a code has been sent to the new number.
  const [verification, setVerification] = useState<{
    verificationId: string;
    code: string;
  } | null>(null);

  const emailError =
    email.length > 0 && !EMAIL_RE.test(email.trim())
      ? "Please enter a valid email address."
      : undefined;
  const phoneError =
    phone.length > 0 && phone.length < 10
      ? "Phone number must be 10 digits."
      : undefined;
  const phoneChanged = phone !== initial.phone;
  const hasChanges =
    firstName.trim() !== initial.firstName ||
    lastName.trim() !== initial.lastName ||
    email.trim() !== initial.email ||
    phoneChanged;
  const canSave =
    hasChanges &&
    !emailError &&
    !phoneError &&
    firstName.trim().length > 0 &&
    lastName.trim().length > 0 &&
    EMAIL_RE.test(email.trim()) &&
    phone.length === 10;

  const writeProfile = async () => {
    if (!currentUser) return;
    await updateProfileFields(currentUser.uid, {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone: `+1${phone}`,
    });
    await refreshProfile();
    showAlert("Profile updated", "Your changes have been saved.", [
      { text: "OK", onPress: () => router.back() },
    ]);
  };

  const save = async () => {
    if (!canSave || !currentUser) return;
    if (!phoneChanged) {
      setSaving(true);
      try {
        await writeProfile();
      } catch (err) {
        console.error("Error updating profile:", err);
        showAlert(
          "Could not save",
          "Please check your connection and try again.",
        );
      } finally {
        setSaving(false);
      }
      return;
    }
    showAlert(
      "Verify new number",
      `We will text a code to +1 ${formatPhone(phone)} to confirm the change.`,
      [
        { text: "Cancel", style: "cancel" },
        { text: "Send code", onPress: () => void sendCode() },
      ],
    );
  };

  const sendCode = async () => {
    setSaving(true);
    try {
      const start = await startPhoneChange(`+1${phone}`);
      setVerification({
        verificationId: start.verificationId,
        code: start.autoCode ?? "",
      });
      if (start.autoCode)
        await verifyAndSave(start.verificationId, start.autoCode);
    } catch (err) {
      const friendly = describeSendCodeError(err);
      void logAuthEvent("otp_send_failed", {
        code: friendly.code,
        phone: maskPhone(`+1${phone}`),
        reason: "phone_change",
      });
      showAlert(friendly.title, friendly.message);
    } finally {
      setSaving(false);
    }
  };

  const verifyAndSave = async (verificationId: string, code: string) => {
    if (!currentUser || code.length !== 6) return;
    setSaving(true);
    try {
      await confirmPhoneChange(currentUser, verificationId, code);
      await writeProfile();
      setVerification(null);
    } catch (err) {
      const friendly = describeVerifyCodeError(err);
      showAlert(friendly.title, friendly.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll>
      <View style={styles.hero}>
        <Avatar
          firstName={firstName}
          lastName={lastName}
          photoUrl={userProfile?.photoUrl}
          tint={isDriver ? colors.primary : colors.secondary}
          size={84}
        />
        <AppText variant="small" color="textMuted" align="center">
          Profile photos arrive in a later update.
        </AppText>
      </View>

      <View style={styles.form}>
        <TextField
          label="First name"
          value={firstName}
          onChangeText={setFirstName}
          autoCapitalize="words"
          textContentType="givenName"
          editable={!saving}
        />
        <TextField
          label="Last name"
          value={lastName}
          onChangeText={setLastName}
          autoCapitalize="words"
          textContentType="familyName"
          editable={!saving}
        />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          error={emailError}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
          editable={!saving}
        />
        <TextField
          label="Mobile number"
          prefix="+1"
          value={formatPhone(phone)}
          onChangeText={(t) => setPhone(t.replace(/\D/g, "").slice(0, 10))}
          error={phoneError}
          keyboardType="phone-pad"
          textContentType="telephoneNumber"
          editable={!saving && !verification}
        />
        {phoneChanged && !phoneError && !verification ? (
          <AppText variant="small" color="accent">
            Changing your number requires a text-message verification.
          </AppText>
        ) : null}
      </View>

      {verification ? (
        <View
          style={[
            styles.verify,
            { backgroundColor: colors.surface, borderColor: colors.secondary },
          ]}
        >
          <AppText variant="bodyStrong">Enter the 6-digit code</AppText>
          <AppText variant="small" color="textSecondary">
            Sent by text to +1 {formatPhone(phone)}.
          </AppText>
          <TextField
            value={verification.code}
            onChangeText={(t) =>
              setVerification({
                ...verification,
                code: t.replace(/\D/g, "").slice(0, 6),
              })
            }
            keyboardType="number-pad"
            textContentType="oneTimeCode"
            autoComplete="sms-otp"
            maxLength={6}
            placeholder="123456"
            editable={!saving}
          />
          <Button
            title="Verify and save"
            onPress={() =>
              void verifyAndSave(verification.verificationId, verification.code)
            }
            loading={saving}
            disabled={verification.code.length !== 6}
          />
          <Button
            title="Cancel number change"
            variant="ghost"
            onPress={() => {
              setVerification(null);
              setPhone(initial.phone);
            }}
          />
        </View>
      ) : (
        <Button
          title="Save changes"
          onPress={() => void save()}
          loading={saving}
          disabled={!canSave}
          style={styles.cta}
        />
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  hero: { alignItems: "center", gap: spacing.sm, paddingVertical: spacing.xl },
  form: { gap: spacing.lg },
  verify: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  cta: { marginTop: spacing.xxl },
});
