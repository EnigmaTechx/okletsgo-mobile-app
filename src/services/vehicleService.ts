import {
  collection,
  query,
  where,
  addDoc,
  onSnapshot,
  serverTimestamp,
  limit,
  type Timestamp,
} from "@react-native-firebase/firestore";
import { db } from "./firebase";
import type { VehicleInfo } from "../interfaces/user";

// A driver's proposed vehicle edit, held for admin approval. The live
// users/{uid}.vehicle is only updated when an admin approves (server-side).
export interface VehicleChangeRequest {
  id: string;
  driverId: string;
  driverName?: string;
  current: VehicleInfo;
  proposed: VehicleInfo;
  status: "pending" | "approved" | "rejected";
  submittedAt?: Timestamp;
  reviewedAt?: Timestamp;
  reviewedBy?: string | null;
  rejectionReason?: string | null;
}

/** Submit a vehicle change for admin approval (creates a pending request). */
export async function submitVehicleChangeRequest(
  driverId: string,
  driverName: string,
  current: VehicleInfo,
  proposed: VehicleInfo,
): Promise<void> {
  await addDoc(collection(db, "vehicleChangeRequests"), {
    driverId,
    driverName,
    current,
    proposed,
    status: "pending",
    submittedAt: serverTimestamp(),
  });
}

/** Live subscription to this driver's currently-pending request (or null). */
export function subscribePendingVehicleRequest(
  driverId: string,
  cb: (req: VehicleChangeRequest | null) => void,
): () => void {
  const q = query(
    collection(db, "vehicleChangeRequests"),
    where("driverId", "==", driverId),
    where("status", "==", "pending"),
    limit(1),
  );
  return onSnapshot(
    q,
    (snap) => {
      if (snap.empty) return cb(null);
      const d = snap.docs[0];
      cb({ id: d.id, ...d.data() } as VehicleChangeRequest);
    },
    (e) => {
      console.warn("Pending vehicle request listener failed:", e);
      cb(null);
    },
  );
}
