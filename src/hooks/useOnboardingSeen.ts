import { useEffect, useState } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";

const KEY = "okletsgo.hasSeenOnboarding";

/** Whether the three welcome slides have been dismissed on this device. */
export function useOnboardingSeen(): { seen: boolean | null; markSeen: () => void } {
  const [seen, setSeen] = useState<boolean | null>(null);

  useEffect(() => {
    let cancelled = false;
    AsyncStorage.getItem(KEY)
      .then((v) => {
        if (!cancelled) setSeen(v === "true");
      })
      .catch(() => {
        if (!cancelled) setSeen(false);
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const markSeen = () => {
    setSeen(true);
    AsyncStorage.setItem(KEY, "true").catch(() => undefined);
  };

  return { seen, markSeen };
}
