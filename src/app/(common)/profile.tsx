import { useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/ui/Screen";
import { AppText } from "../../components/ui/AppText";
import { Avatar } from "../../components/ui/Avatar";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { showAlert } from "../../components/ui/alerts";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { usePhotoPicker } from "../../hooks/usePhotoPicker";
import {
  confirmPhoneChange,
  isRecentLoginError,
  reauthenticateWithPhone,
  sendPhoneVerification,
  updateProfileFields,
} from "../../services/profileService";
import { uploadProfilePhoto } from "../../services/storageService";
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
 * Which number a pending SMS code is for: the new one ("change") or, when
 * Firebase wants a fresh sign-in first, the current one ("reauth").
 */
type VerificationPurpose = "change" | "reauth";

interface PendingVerification {
  purpose: VerificationPurpose;
  verificationId: string;
  code: string;
}

/**
 * Edit name, email and mobile number. A new number is verified by SMS
 * before it is saved, as in the Ionic app; everything else saves at once.
 * If the sign-in is too old for Firebase to allow the change, the current
 * number is confirmed by SMS first, then the new-number code is sent again.
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
  const photoPicker = usePhotoPicker({ size: 512, front: true, square: true });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  // Set while an SMS code is outstanding (see VerificationPurpose).
  const [verification, setVerification] = useState<PendingVerification | null>(
    null,
  );

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

  /** Take or choose a photo, crop it square, upload it, refresh. */
  const changePhoto = async () => {
    if (!currentUser || uploadingPhoto || photoPicker.busy) return;
    const picked = await photoPicker.pick("Profile photo");
    if (!picked) return;
    setUploadingPhoto(true);
    try {
      await uploadProfilePhoto(currentUser.uid, picked.uri);
      await refreshProfile();
    } catch (err) {
      console.error("Error uploading profile photo:", err);
      showAlert(
        "Could not upload",
        "We couldn't upload your photo. Please check your connection and try again.",
      );
    } finally {
      setUploadingPhoto(false);
    }
  };

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
        { text: "Send code", onPress: () => void sendCode("change") },
      ],
    );
  };

  const cancelVerification = () => {
    setVerification(null);
    setPhone(initial.phone);
  };

  /** Text a code to the new number ("change") or the current one ("reauth"). */
  const sendCode = async (purpose: VerificationPurpose) => {
    const target = `+1${purpose === "change" ? phone : initial.phone}`;
    setSaving(true);
    try {
      const sent = await sendPhoneVerification(target);
      const pending: PendingVerification = {
        purpose,
        verificationId: sent.verificationId,
        code: sent.autoCode ?? "",
      };
      setVerification(pending);
      if (sent.autoCode) await verifyCode(pending);
    } catch (err) {
      const friendly = describeSendCodeError(err);
      void logAuthEvent("otp_send_failed", {
        code: friendly.code,
        phone: maskPhone(target),
        reason: `phone_change_${purpose}`,
      });
      showAlert(friendly.title, friendly.message);
    } finally {
      setSaving(false);
    }
  };

  /** Firebase wants a fresh sign-in: offer to confirm the current number. */
  const askToReauthenticate = () => {
    showAlert(
      "Please confirm it's you",
      `Because you signed in a while ago, we need to verify your current number first. We will text a code to +1 ${formatPhone(initial.phone)}, then send a new one to +1 ${formatPhone(phone)}.`,
      [
        { text: "Cancel", style: "cancel", onPress: cancelVerification },
        { text: "Send code", onPress: () => void sendCode("reauth") },
      ],
    );
  };

  const verifyCode = async (pending: PendingVerification) => {
    if (!currentUser || pending.code.length !== 6) return;
    setSaving(true);
    try {
      if (pending.purpose === "reauth") {
        await reauthenticateWithPhone(
          currentUser,
          pending.verificationId,
          pending.code,
        );
        setVerification(null);
        // Verified: now the new number, as if the user had just signed in.
        setSaving(false);
        await sendCode("change");
        return;
      }
      await confirmPhoneChange(
        currentUser,
        pending.verificationId,
        pending.code,
      );
      await writeProfile();
      setVerification(null);
    } catch (err) {
      if (pending.purpose === "change" && isRecentLoginError(err)) {
        setVerification(null);
        askToReauthenticate();
        return;
      }
      const friendly = describeVerifyCodeError(err);
      console.error(`Phone ${pending.purpose} verification failed:`, err);
      void logAuthEvent("phone_change_failed", {
        code: friendly.code,
        step: pending.purpose,
        phone: maskPhone(`+1${phone}`),
      });
      showAlert(
        friendly.title,
        friendly.unknown
          ? `${friendly.message}\n\nError code: ${friendly.code}`
          : friendly.message,
      );
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll edges={["left", "right"]}>
      <View style={styles.hero}>
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Change profile photo"
          onPress={() => void changePhoto()}
          disabled={uploadingPhoto || photoPicker.busy}
          style={styles.avatarWrap}
        >
          <Avatar
            firstName={firstName}
            lastName={lastName}
            photoUrl={userProfile?.photoUrl}
            tint={isDriver ? colors.primary : colors.secondary}
            size={96}
          />
          <View
            style={[
              styles.camera,
              {
                backgroundColor: colors.primary,
                borderColor: colors.background,
              },
            ]}
          >
            {uploadingPhoto || photoPicker.busy ? (
              <ActivityIndicator size="small" color={colors.onPrimary} />
            ) : (
              <Ionicons name="camera" size={16} color={colors.onPrimary} />
            )}
          </View>
        </Pressable>
        <AppText variant="small" color="textMuted" align="center">
          {uploadingPhoto
            ? "Uploading your photo…"
            : "Tap the photo to change it."}
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
          <AppText variant="bodyStrong">
            {verification.purpose === "reauth"
              ? "Confirm your current number"
              : "Enter the 6-digit code"}
          </AppText>
          <AppText variant="small" color="textSecondary">
            Sent by text to +1{" "}
            {formatPhone(
              verification.purpose === "reauth" ? initial.phone : phone,
            )}
            .
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
            title={
              verification.purpose === "reauth" ? "Confirm" : "Verify and save"
            }
            onPress={() => void verifyCode(verification)}
            loading={saving}
            disabled={verification.code.length !== 6}
          />
          <Button
            title="Cancel number change"
            variant="ghost"
            onPress={cancelVerification}
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
  hero: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: spacing.sm,
    paddingBottom: spacing.lg,
  },
  form: { gap: spacing.lg },
  avatarWrap: { position: "relative" },
  camera: {
    position: "absolute",
    right: -2,
    bottom: -2,
    width: 32,
    height: 32,
    borderRadius: 16,
    borderWidth: 2,
    alignItems: "center",
    justifyContent: "center",
  },
  verify: {
    marginTop: spacing.xl,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  cta: { marginTop: spacing.xxl },
});
