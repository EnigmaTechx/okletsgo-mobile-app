import React, { useRef, useState } from "react";
import { StyleSheet, TextInput, View } from "react-native";
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
import {
  formatLicence,
  formatPlate,
  normalizePlate,
  titleCase,
  validateVehicleForm,
  type VehicleFormErrors,
} from "../../utils/vehicle";
import { spacing } from "../../theme/tokens";

type Field = "make" | "model" | "color" | "plateNumber" | "licenseNumber";

/**
 * Registration step 3 (drivers): vehicle details, then the profile is created
 * with `isOnline: false`. Inputs are shaped as the driver types (plates and
 * licence numbers upper-cased and grouped the way they appear on the card)
 * and validated against Ontario formats before the profile is written.
 * Vehicle and licence photos (camera + crop) follow in phase 5.
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

  const [values, setValues] = useState<Record<Field, string>>({
    make: "",
    model: "",
    color: "",
    plateNumber: "",
    licenseNumber: "",
  });
  // Errors show only for fields the driver has left, so the form never
  // shouts before they have had a chance to type.
  const [touched, setTouched] = useState<Partial<Record<Field, boolean>>>({});
  const [saving, setSaving] = useState(false);
  const modelRef = useRef<TextInput>(null);
  const colorRef = useRef<TextInput>(null);
  const plateRef = useRef<TextInput>(null);
  const licenceRef = useRef<TextInput>(null);

  const errors: VehicleFormErrors = validateVehicleForm(values);
  const valid = Object.keys(errors).length === 0;
  const shown = (f: Field) => (touched[f] ? errors[f] : undefined);

  const set = (field: Field, shape: (v: string) => string = (v) => v) => (v: string) =>
    setValues((cur) => ({ ...cur, [field]: shape(v) }));
  const touch = (field: Field) => () => setTouched((cur) => ({ ...cur, [field]: true }));

  const submit = async () => {
    setTouched({ make: true, model: true, color: true, plateNumber: true, licenseNumber: true });
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
          make: titleCase(values.make),
          model: titleCase(values.model),
          color: titleCase(values.color),
          plateNumber: formatPlate(normalizePlate(values.plateNumber)),
          licenseNumber: formatLicence(values.licenseNumber),
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
        Riders see the make, model, colour and plate so they can spot you at pickup. Your licence
        number is kept private and checked before approval.
      </AppText>

      <View style={styles.form}>
        <TextField
          label="Make"
          placeholder="Toyota"
          value={values.make}
          onChangeText={set("make")}
          onBlur={touch("make")}
          error={shown("make")}
          autoCapitalize="words"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => modelRef.current?.focus()}
        />
        <TextField
          ref={modelRef}
          label="Model"
          placeholder="Camry"
          value={values.model}
          onChangeText={set("model")}
          onBlur={touch("model")}
          error={shown("model")}
          autoCapitalize="words"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => colorRef.current?.focus()}
        />
        <TextField
          ref={colorRef}
          label="Colour"
          placeholder="Black"
          value={values.color}
          onChangeText={set("color")}
          onBlur={touch("color")}
          error={shown("color")}
          autoCapitalize="words"
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => plateRef.current?.focus()}
        />
        <TextField
          ref={plateRef}
          label="Plate number"
          placeholder="ABCD 123"
          value={values.plateNumber}
          onChangeText={set("plateNumber", formatPlate)}
          onBlur={touch("plateNumber")}
          error={shown("plateNumber")}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={9}
          returnKeyType="next"
          blurOnSubmit={false}
          onSubmitEditing={() => licenceRef.current?.focus()}
        />
        <TextField
          ref={licenceRef}
          label="Driver's licence number"
          placeholder="A1234-56789-01234"
          value={values.licenseNumber}
          onChangeText={set("licenseNumber", formatLicence)}
          onBlur={touch("licenseNumber")}
          error={shown("licenseNumber")}
          autoCapitalize="characters"
          autoCorrect={false}
          maxLength={17}
          returnKeyType="done"
          onSubmitEditing={() => void submit()}
        />
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
