import React, {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import { doc, onSnapshot } from "@react-native-firebase/firestore";
import { db } from "../services/firebase";
import { useAuth } from "./AuthContext";
import {
  type FeatureFlagsDoc,
  type FeatureKey,
  isFeatureVisible,
} from "../config/features";

/**
 * Live view of the public `config/features` document (see
 * src/config/features.ts for the shape and the audience rules).
 *
 * One listener for the whole app, started at launch like the pricing
 * listener. A change made on the admin dashboard's App Features page reaches
 * every running app within seconds — no rebuild, no store release.
 *
 * `loaded` flips to true after the first snapshot OR the first error, so
 * route guards can tell "still loading" from "hidden". On error the flags
 * are null, which `isFeatureVisible` treats as hidden: the app fails closed.
 */

interface FeatureFlagsContextType {
  flags: FeatureFlagsDoc | null;
  loaded: boolean;
  /** Visibility for the CURRENT signed-in user (role + uid from AuthContext). */
  isVisible: (key: FeatureKey) => boolean;
}

const FeatureFlagsContext = createContext<FeatureFlagsContextType>({
  flags: null,
  loaded: false,
  isVisible: () => false,
});

export const useFeatureFlags = () => useContext(FeatureFlagsContext);

export const FeatureFlagsProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const { userProfile } = useAuth();
  const [flags, setFlags] = useState<FeatureFlagsDoc | null>(null);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const unsub = onSnapshot(
      doc(db, "config", "features"),
      (snap) => {
        setFlags(snap.exists() ? (snap.data() as FeatureFlagsDoc) : null);
        setLoaded(true);
      },
      (err) => {
        console.warn(
          "[featureFlags] config/features unavailable — all hidden",
          err,
        );
        setFlags(null);
        setLoaded(true);
      },
    );
    return unsub;
  }, []);

  const value = useMemo<FeatureFlagsContextType>(
    () => ({
      flags,
      loaded,
      isVisible: (key) => isFeatureVisible(flags, key, userProfile),
    }),
    [flags, loaded, userProfile],
  );

  return (
    <FeatureFlagsContext.Provider value={value}>
      {children}
    </FeatureFlagsContext.Provider>
  );
};
