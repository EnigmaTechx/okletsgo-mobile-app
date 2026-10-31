import { useEffect, useState } from "react";
import {
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from "@react-native-firebase/firestore";
import { httpsCallable } from "@react-native-firebase/functions";
import { db, functions } from "./firebase";
import type { RideRequest } from "../interfaces/ride";

/**
 * In-app ride chat. Messages are written only by the sendRideMessage
 * function, which masks phone numbers and emails; the app reads them live.
 * Same data as the Ionic app (rides/{id}/messages).
 */

export interface ChatMessage {
  id: string;
  senderId: string;
  senderRole: "rider" | "driver";
  senderFirstName: string;
  text: string;
  /** What was hidden in this message, if anything. */
  masked?: ("phone" | "email")[];
  /** Flagged for the owner, not hidden: talk of paying outside the app. */
  flagged?: "payment"[];
  quick?: boolean;
  createdAt: string;
}

export interface ChatFlag {
  id: string;
  original: string;
  senderFirstName: string;
  kinds: string[];
}

// Same rule as the function: open once the driver starts the trip (heading
// to pickup) until 15 minutes after it ends, then read-only. A ride cancelled
// before the trip started never opens it.
const ACTIVE = new Set<string>([
  "heading_to_pickup",
  "arrived",
  "en_route",
  "in_progress",
]);
export const CHAT_GRACE_MS = 15 * 60 * 1000;

export function chatIsOpen(
  ride: Pick<
    RideRequest,
    | "status"
    | "completedAt"
    | "tripCompletedAt"
    | "cancelledAt"
    | "headedToPickupAt"
  >,
  now = Date.now(),
): boolean {
  if (ACTIVE.has(ride.status)) return true;
  const started = !!ride.headedToPickupAt || ride.status === "completed";
  if (started && (ride.status === "completed" || ride.status === "cancelled")) {
    const end = ride.completedAt || ride.tripCompletedAt || ride.cancelledAt;
    const t = end ? new Date(end).getTime() : NaN;
    return Number.isFinite(t) && now - t < CHAT_GRACE_MS;
  }
  return false;
}

/** Chat can be opened at all (from the trip's start; afterwards read-only if anything was said). */
export const chatAvailable = (ride: RideRequest, now = Date.now()): boolean =>
  chatIsOpen(ride, now) || !!ride.chatLastAt;

export const unreadFor = (
  ride: RideRequest | null | undefined,
  uid?: string | null,
): number => (uid && ride?.chatUnread?.[uid]) || 0;

export async function sendRideMessage(
  rideId: string,
  text: string,
  quick = false,
): Promise<void> {
  const fn = httpsCallable(functions, "sendRideMessage");
  await fn({ rideId, text, quick });
}

/** Zero my unread count on the ride (allowed: I'm its rider or driver). */
export async function markChatRead(rideId: string, uid: string): Promise<void> {
  try {
    await updateDoc(doc(db, "rides", rideId), { [`chatUnread.${uid}`]: 0 });
  } catch (e) {
    console.warn("[chat] couldn't mark read", e);
  }
}

export function useRideMessages(rideId?: string): {
  messages: ChatMessage[];
  loading: boolean;
  error: boolean;
} {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  useEffect(() => {
    if (!rideId) return;
    return onSnapshot(
      query(
        collection(db, "rides", rideId, "messages"),
        orderBy("createdAt", "asc"),
        limit(300),
      ),
      (snap) => {
        setMessages(
          snap.docs.map((d) => ({
            id: d.id,
            ...(d.data() as Omit<ChatMessage, "id">),
          })),
        );
        setLoading(false);
      },
      () => {
        setError(true);
        setLoading(false);
      },
    );
  }, [rideId]);
  return { messages, loading, error };
}

/** Admin / owner only: originals of masked messages, keyed by message id. */
export function useChatFlags(
  rideId: string | undefined,
  enabled: boolean,
): Record<string, ChatFlag> {
  const [flags, setFlags] = useState<Record<string, ChatFlag>>({});
  useEffect(() => {
    if (!rideId || !enabled) return;
    return onSnapshot(
      collection(db, "rides", rideId, "messageFlags"),
      (snap) => {
        const out: Record<string, ChatFlag> = {};
        snap.docs.forEach((d) => {
          out[d.id] = { id: d.id, ...(d.data() as Omit<ChatFlag, "id">) };
        });
        setFlags(out);
      },
      () => setFlags({}),
    );
  }, [rideId, enabled]);
  return flags;
}

export const DRIVER_QUICK_REPLIES = [
  "I'm here",
  "Running 5 min late",
  "Where are you?",
  "Stuck in traffic",
];
export const RIDER_QUICK_REPLIES = [
  "Coming out now",
  "2 minutes please",
  "Where are you?",
  "I'm at the main door",
];
