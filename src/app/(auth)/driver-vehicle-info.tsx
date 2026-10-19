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
import type { VehicleInfo } from "../../interfaces/user";
import { spacing } from "../../theme/tokens";

/**
 * Registration step 3 (drivers): vehicle details, then the profile is created
 * with `isOnline: false`. Vehicle and licence photos (camera + crop) follow in
 * phase 5; until then the driver adds them from Account after approval.
 */
export default function DriverVehicleInfo() {
  const router = useRouter();
  const { currentUser } = useAuth();
  const params = useLocalSearchParams<{
    firstName?: string;
    lastName?: string;
    email?: string;
    phone?: string;
  }>();

  const [vehicle, setVehicle] = useState<VehicleInfo>({
    make: "",
    model: "",
    color: "",
    plateNumber: "",
    licenseNumber: "",
  });
  const [saving, setSaving] = useState(false);

  const set = (k: keyof VehicleInfo) => (v: string) => setVehicle((cur) => ({ ...cur, [k]: v }));
  const valid = (["make", "model", "color", "plateNumber", "licenseNumber"] as const).every(
    (k) => vehicle[k].trim().length > 0,
  );

  const submit = async () => {
    if (!currentUser || !valid) return;
    setSaving(true);
    void logAuthEvent("registration_started", { role: "driver" });
    try {
      await createProfile(currentUser.uid, {
        firstName: params.firstName || "",
        lastName: params.lastName || "",
        email: params.email || "",
        phone: params.phone || currentUser.phoneNumber || "",
        role: "driver",
        vehicle: {
          make: vehicle.make.trim(),
          model: vehicle.model.trim(),
          color: vehicle.color.trim(),
          plateNumber: vehicle.plateNumber.trim().toUpperCase(),
          licenseNumber: vehicle.licenseNumber.trim().toUpperCase(),
        },
      });
      clearRegistrationActive();
      router.replace("/(driver)");
    } catch (err) {
      const friendly = describeProfileSaveError(err);
      showAlert(friendly.title, friendly.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Screen scroll edges={["top", "bottom", "left", "right"]}>
      <AppText variant="eyebrow" color="primary" style={styles.eyebrow}>
        DRIVER · STEP 3 OF 3
      </AppText>
      <AppText variant="display">Your vehicle</AppText>
      <AppText variant="body" color="textSecondary" style={styles.sub}>
        Riders see the make, model, colour and plate so they can spot you at pickup.
      </AppText>

      <View style={styles.form}>
        <TextField label="Make" value={vehicle.make} onChangeText={set("make")} autoCapitalize="words" />
        <TextField label="Model" value={vehicle.model} onChangeText={set("model")} autoCapitalize="words" />
        <TextField label="Colour" value={vehicle.color} onChangeText={set("color")} autoCapitalize="words" />
        <TextField label="Plate number" value={vehicle.plateNumber} onChangeText={set("plateNumber")} autoCapitalize="characters" />
        <TextField label="Driver's licence number" value={vehicle.licenseNumber} onChangeText={set("licenseNumber")} autoCapitalize="characters" />
      </View>

      <Button title="Finish sign-up" onPress={submit} loading={saving} disabled={!valid} style={styles.cta} />
    </Screen>
  );
}

const styles = StyleSheet.create({
  eyebrow: { marginTop: spacing.xl, marginBottom: spacing.sm },
  sub: { marginTop: spacing.sm, marginBottom: spacing.xl },
  form: { gap: spacing.lg },
  cta: { marginTop: spacing.xxl },
});
