import { useState } from "react";
import { Alert, Linking, Platform } from "react-native";
import * as ImagePicker from "expo-image-picker";
import { ImageManipulator, SaveFormat } from "expo-image-manipulator";

/**
 * Take or choose a photo, let the OS crop it square, and shrink it for
 * upload. Replaces the Ionic app's camera plugin + canvas crop modal with
 * the system picker's own crop step, which is what riders expect on each
 * platform anyway.
 */

export interface PickedPhoto {
  /** Local JPEG, square, at most `size` px on a side. */
  uri: string;
}

interface Options {
  /** Output size in px (longest side). Profile 512, vehicle 1000. */
  size?: number;
  /** Open the front camera first (profile photos). */
  front?: boolean;
  /** Crop to a square in the picker (profile photos). */
  square?: boolean;
}

const pickerOptions = (o: Options): ImagePicker.ImagePickerOptions => ({
  mediaTypes: ["images"],
  allowsEditing: true,
  aspect: o.square === false ? [4, 3] : [1, 1],
  quality: 0.9,
  cameraType: o.front
    ? ImagePicker.CameraType.front
    : ImagePicker.CameraType.back,
});

const explainDenied = (what: "camera" | "photos") =>
  Alert.alert(
    what === "camera" ? "Camera access needed" : "Photo access needed",
    `Allow ${what === "camera" ? "camera" : "photo library"} access in Settings to add a photo.`,
    [
      { text: "Not now", style: "cancel" },
      { text: "Open Settings", onPress: () => void Linking.openSettings() },
    ],
  );

async function shrink(uri: string, size: number): Promise<string> {
  const ctx = ImageManipulator.manipulate(uri);
  ctx.resize({ width: size });
  const rendered = await ctx.renderAsync();
  const saved = await rendered.saveAsync({
    compress: 0.85,
    format: SaveFormat.JPEG,
  });
  return saved.uri;
}

async function fromCamera(o: Options): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestCameraPermissionsAsync();
  if (!perm.granted) {
    if (!perm.canAskAgain || Platform.OS === "ios") explainDenied("camera");
    return null;
  }
  const res = await ImagePicker.launchCameraAsync(pickerOptions(o));
  if (res.canceled || !res.assets[0]) return null;
  return { uri: await shrink(res.assets[0].uri, o.size ?? 512) };
}

async function fromLibrary(o: Options): Promise<PickedPhoto | null> {
  const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
  if (!perm.granted) {
    if (!perm.canAskAgain || Platform.OS === "ios") explainDenied("photos");
    return null;
  }
  const res = await ImagePicker.launchImageLibraryAsync(pickerOptions(o));
  if (res.canceled || !res.assets[0]) return null;
  return { uri: await shrink(res.assets[0].uri, o.size ?? 512) };
}

/**
 * `pick()` asks "Take photo / Choose from library", runs the picker and
 * resolves with the prepared file, or null when the user backed out.
 * `busy` is true from the tap until the picker and resize are done.
 */
export function usePhotoPicker(options: Options = {}) {
  const [busy, setBusy] = useState(false);

  const pick = (title = "Photo"): Promise<PickedPhoto | null> =>
    new Promise((resolve) => {
      const run = async (fn: (o: Options) => Promise<PickedPhoto | null>) => {
        setBusy(true);
        try {
          resolve(await fn(options));
        } catch (err) {
          console.error("Photo picker failed:", err);
          Alert.alert(
            "Couldn't get the photo",
            "Please try again, or pick a different photo.",
          );
          resolve(null);
        } finally {
          setBusy(false);
        }
      };
      Alert.alert(title, undefined, [
        { text: "Take photo", onPress: () => void run(fromCamera) },
        { text: "Choose from library", onPress: () => void run(fromLibrary) },
        { text: "Cancel", style: "cancel", onPress: () => resolve(null) },
      ]);
    });

  return { pick, busy };
}
