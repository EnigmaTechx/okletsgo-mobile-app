import { ref, putFile, getDownloadURL } from "@react-native-firebase/storage";
import { doc, setDoc } from "@react-native-firebase/firestore";
import { storage, db } from "./firebase";
import type { VehicleInfo } from "../interfaces/user";

// Profile and vehicle photos go to the same Storage paths the Ionic app uses
// (`users/{uid}/profile.jpg`, `users/{uid}/vehicle.jpg`), so the admin
// dashboard keeps showing them. Picking / cropping the photo (expo-image-picker
// + expo-image-manipulator) lands in phase 5; these helpers take a local file
// URI, which is what those libraries return.

type PhotoKind = "profile" | "vehicle";

async function uploadLocalFile(uid: string, kind: PhotoKind, fileUri: string): Promise<string> {
  const fileRef = ref(storage, `users/${uid}/${kind}.jpg`);
  await putFile(fileRef, fileUri, { contentType: "image/jpeg" });
  return getDownloadURL(fileRef);
}

// Upload-only — no Firestore write. Used during onboarding, before the
// user's profile document exists (writing photoUrl there would either create
// a partial doc or get wiped by the real profile write, which isn't a merge).
export const uploadProfilePhotoFile = (uid: string, fileUri: string) =>
  uploadLocalFile(uid, "profile", fileUri);
export const uploadVehiclePhotoFile = (uid: string, fileUri: string) =>
  uploadLocalFile(uid, "vehicle", fileUri);

export async function uploadProfilePhoto(uid: string, fileUri: string): Promise<string> {
  const url = await uploadProfilePhotoFile(uid, fileUri);
  await setDoc(doc(db, "users", uid), { photoUrl: url }, { merge: true });
  return url;
}

export async function uploadVehiclePhoto(
  uid: string,
  currentVehicle: VehicleInfo,
  fileUri: string,
): Promise<string> {
  const url = await uploadVehiclePhotoFile(uid, fileUri);
  await setDoc(
    doc(db, "users", uid),
    { vehicle: { ...currentVehicle, photoUrl: url } },
    { merge: true },
  );
  return url;
}
