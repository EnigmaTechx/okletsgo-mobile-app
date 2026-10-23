import { useEffect, useState } from "react";
import { StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/ui/Screen";
import { TextField } from "../../components/ui/TextField";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { VehicleInfo } from "../../interfaces/user";
import {
  submitVehicleChangeRequest,
  subscribePendingVehicleRequest,
  type VehicleChangeRequest,
} from "../../services/vehicleService";
import { formatPlate, isValidPlate, titleCase } from "../../utils/vehicle";
import { radius, spacing } from "../../theme/tokens";

/**
 * The driver's vehicle. Edits never write the profile directly: they go to
 * vehicleChangeRequests for admin approval, and the current details stay
 * active until then. Photos arrive with the shared photo work in phase 5.
 */
export default function DriverVehicle() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { currentUser, userProfile } = useAuth();
  const uid = currentUser?.uid;
  const current = userProfile?.vehicle;

  const [make, setMake] = useState(current?.make ?? "");
  const [model, setModel] = useState(current?.model ?? "");
  const [color, setColor] = useState(current?.color ?? "");
  const [plate, setPlate] = useState(current?.plateNumber ?? "");
  const [pending, setPending] = useState<
    VehicleChangeRequest | null | undefined
  >(undefined);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!uid) return;
    return subscribePendingVehicleRequest(uid, setPending);
  }, [uid]);

  const proposed: VehicleInfo = {
    make: titleCase(make),
    model: titleCase(model),
    color: titleCase(color),
    plateNumber: formatPlate(plate),
    licenseNumber: current?.licenseNumber ?? "",
    photoUrl: current?.photoUrl ?? "",
  };
  const changed =
    proposed.make !== (current?.make ?? "") ||
    proposed.model !== (current?.model ?? "") ||
    proposed.color !== (current?.color ?? "") ||
    proposed.plateNumber !== (current?.plateNumber ?? "");
  const valid =
    proposed.make.length > 1 &&
    proposed.model.length > 0 &&
    proposed.color.length > 1 &&
    isValidPlate(plate);
  const locked = pending !== null && pending !== undefined;

  const submit = async () => {
    if (!uid || !userProfile || !changed || !valid) return;
    setSaving(true);
    try {
      await submitVehicleChangeRequest(
        uid,
        `${userProfile.firstName} ${userProfile.lastName}`.trim(),
        {
          make: current?.make ?? "",
          model: current?.model ?? "",
          color: current?.color ?? "",
          plateNumber: current?.plateNumber ?? "",
          licenseNumber: current?.licenseNumber ?? "",
          photoUrl: current?.photoUrl ?? "",
        },
        proposed,
      );
      toast("Vehicle change submitted for admin approval.", {
        type: "success",
      });
      router.back();
    } catch (err) {
      console.error("Vehicle change failed:", err);
      toast("Couldn't submit the change. Please try again.", { type: "error" });
      setSaving(false);
    }
  };

  return (
    <Screen scroll edges={["left", "right"]}>
      <View style={styles.body}>
        {locked ? (
          <View
            style={[
              styles.notice,
              {
                backgroundColor: colors.surfaceRaised,
                borderColor: colors.primary,
              },
            ]}
          >
            <Ionicons
              name="hourglass-outline"
              size={20}
              color={colors.primary}
            />
            <AppText variant="small" style={styles.flex}>
              A vehicle change is pending admin approval. Your current details
              stay active until it is reviewed.
            </AppText>
          </View>
        ) : null}
        <TextField
          label="Make"
          value={make}
          onChangeText={setMake}
          autoCapitalize="words"
          editable={!locked && !saving}
        />
        <TextField
          label="Model"
          value={model}
          onChangeText={setModel}
          autoCapitalize="words"
          editable={!locked && !saving}
        />
        <TextField
          label="Colour"
          value={color}
          onChangeText={setColor}
          autoCapitalize="words"
          editable={!locked && !saving}
        />
        <TextField
          label="Plate"
          value={plate}
          onChangeText={(t) => setPlate(t.toUpperCase())}
          autoCapitalize="characters"
          autoCorrect={false}
          error={
            plate && !isValidPlate(plate)
              ? "Enter a valid Ontario plate, e.g. ABCD 123."
              : undefined
          }
          editable={!locked && !saving}
        />
        <AppText variant="small" color="textMuted">
          Licence number: {current?.licenseNumber || "on file"}. Contact support
          to change it.
        </AppText>
      </View>
      <Button
        title="Submit for approval"
        onPress={() => void submit()}
        loading={saving}
        disabled={locked || !changed || !valid}
        style={styles.cta}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: spacing.md, gap: spacing.lg },
  notice: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  flex: { flex: 1 },
  cta: { marginTop: spacing.xxl },
});
