import React, { useState } from "react";
import { StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { AppText } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { TextField } from "../../components/ui/TextField";
import { showAlert } from "../../components/ui/alerts";
import { useAuth } from "../../contexts/AuthContext";
import { clearRegistrationActive, createProfile } from "../../services/authService";
import { logAuthEvent } from "../../services/telemetryService";
import { describeProfileSaveError } from "../../utils/authErrors";
import type { UserRole } from "../../interfaces/user";
import { spacing } from "../../theme/tokens";

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Registration step 2: name and email. A client's profile is created here;
 * a driver continues to vehicle details first (the profile is written there,
 * as in the Ionic app, so a driver never exists without a vehicle).
 */
export default function CompleteProfile() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const params = useLocalSearchParams<{ role?: UserRole; phone?: string }>();
  const role: UserRole = params.role === "driver" ? "driver" : "client";
  const phone = params.phone || currentUser?.phoneNumber || "";

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [saving, setSaving] = useState(false);

  const valid = firstName.trim().length > 0 && lastName.trim().length > 0 && EMAIL_RE.test(email.trim());

  const submit = async () => {
    if (!currentUser || !valid) return;
    const data = {
      firstName: firstName.trim(),
      lastName: lastName.trim(),
      email: email.trim().toLowerCase(),
      phone,
      role,
    };
    if (role === "driver") {
      router.push({ pathname: "/(auth)/driver-vehicle-info", params: data });
      return;
    }
    setSaving(true);
    void logAuthEvent("registration_started", { role });
    try {
      await createProfile(currentUser.uid, data);
      clearRegistrationActive();
      // The live profile listener now sees the document; the root layout
      // opens the client tabs as soon as it lands.
      router.replace("/(client)");
    } catch (err) {
      const friendly = describeProfileSaveError(err);
      showAlert(friendly.title, friendly.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll edges={["top", "bottom", "left", "right"]}>
      <AppText variant="eyebrow" color={role === "driver" ? "primary" : "secondary"} style={styles.eyebrow}>
        {role === "driver" ? "DRIVER · STEP 2 OF 3" : "CUSTOMER · STEP 2 OF 2"}
      </AppText>
      <AppText variant="display">Tell us about you</AppText>
      <AppText variant="body" color="textSecondary" style={styles.sub}>
        Your driver sees your first name only. We email receipts and important notices to this address.
      </AppText>

      <View style={styles.form}>
        <TextField label="First name" value={firstName} onChangeText={setFirstName} autoCapitalize="words" textContentType="givenName" />
        <TextField label="Last name" value={lastName} onChangeText={setLastName} autoCapitalize="words" textContentType="familyName" />
        <TextField
          label="Email"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          keyboardType="email-address"
          textContentType="emailAddress"
          autoComplete="email"
        />
        <TextField label="Mobile number" value={phone} editable={false} />
      </View>

      <Button
        title={role === "driver" ? "Next: vehicle details" : "Create my account"}
        onPress={submit}
        loading={saving}
        disabled={!valid}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginTop: spacing.xl, marginBottom: spacing.sm },
  sub: { marginTop: spacing.sm, marginBottom: spacing.xl },
  form: { gap: spacing.lg },
  cta: { marginTop: spacing.xxl },
});
