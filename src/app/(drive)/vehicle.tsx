import { useEffect, useState } from "react";
import { Image, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { Screen } from "../../components/ui/Screen";
import { TextField } from "../../components/ui/TextField";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { usePhotoPicker } from "../../hooks/usePhotoPicker";
import { uploadVehiclePhotoFile } from "../../services/storageService";
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
 * active until then. A new photo is uploaded straight away (upload only)
 * and travels with the request, as in the Ionic app.
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
  const [photoUrl, setPhotoUrl] = useState(current?.photoUrl ?? "");
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const photoPicker = usePhotoPicker({ size: 1000, square: false });

  useEffect(() => {
    if (!uid) return;
    return subscribePendingVehicleRequest(uid, setPending);
  }, [uid]);

  const changePhoto = async () => {
    if (!uid || uploadingPhoto || photoPicker.busy) return;
    const picked = await photoPicker.pick("Vehicle photo");
    if (!picked) return;
    setUploadingPhoto(true);
    try {
      setPhotoUrl(await uploadVehiclePhotoFile(uid, picked.uri));
    } catch (err) {
      console.error("Vehicle photo upload failed:", err);
      toast("Couldn't upload the photo. Please try again.", { type: "error" });
    } finally {
      setUploadingPhoto(false);
    }
  };

  const proposed: VehicleInfo = {
    make: titleCase(make),
    model: titleCase(model),
    color: titleCase(color),
    plateNumber: formatPlate(plate),
    licenseNumber: current?.licenseNumber ?? "",
    photoUrl: photoUrl || (current?.photoUrl ?? ""),
  };
  const changed =
    proposed.photoUrl !== (current?.photoUrl ?? "") ||
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
        <View style={styles.photoRow}>
          {photoUrl ? (
            <Image source={{ uri: photoUrl }} style={styles.photo} />
          ) : (
            <View
              style={[
                styles.photo,
                styles.photoEmpty,
                { backgroundColor: colors.surfaceRaised },
              ]}
            >
              <Ionicons name="car-sport" size={30} color={colors.textMuted} />
            </View>
          )}
          <View style={styles.flex}>
            <AppText variant="bodyStrong">Vehicle photo</AppText>
            <AppText variant="small" color="textMuted">
              Riders see it on the confirmation step.
            </AppText>
            <Button
              title={photoUrl ? "Change photo" : "Add photo"}
              variant="secondary"
              block={false}
              onPress={() => void changePhoto()}
              loading={uploadingPhoto || photoPicker.busy}
              disabled={locked || saving}
              style={styles.photoBtn}
            />
          </View>
        </View>
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
  photoRow: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  photo: { width: 88, height: 66, borderRadius: radius.md },
  photoEmpty: { alignItems: "center", justifyContent: "center" },
  photoBtn: { marginTop: spacing.sm, alignSelf: "flex-start" },
  cta: { marginTop: spacing.xxl },
});
