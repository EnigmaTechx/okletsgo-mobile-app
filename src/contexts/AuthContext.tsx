import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import {
  onAuthStateChanged,
  signOut,
  type User,
} from "@react-native-firebase/auth";
import {
  deleteField,
  doc,
  getDoc,
  onSnapshot,
  updateDoc,
} from "@react-native-firebase/firestore";
import { auth, db } from "../services/firebase";
import type { UserProfile } from "../interfaces/user";
import {
  recordAppTelemetry,
  logAuthEvent,
  flushPendingAuthEvents,
} from "../services/telemetryService";
import {
  isRegistrationActive,
  clearRegistrationActive,
  clearOtpSession,
} from "../services/authService";
import { forgetPushToken } from "../services/pushService";

interface AuthContextType {
  currentUser: User | null;
  userProfile: UserProfile | null;
  /** True until the first auth state AND (when signed in) the first profile snapshot. */
  loading: boolean;
  refreshProfile: () => Promise<void>;
  logout: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  currentUser: null,
  userProfile: null,
  loading: true,
  refreshProfile: async () => {},
  logout: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({
  children,
}) => {
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [userProfile, setUserProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const telemetryWrittenFor = useRef<string | null>(null);

  // 1. Auth state (signed in vs out). Native Firebase persists the session in
  // the keychain / keystore, so a returning user is restored here on launch.
  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (user) => {
      // Any diagnostics event that couldn't be written last time (app closed
      // mid-write, token race, bad signal) gets another chance now.
      void flushPendingAuthEvents();
      setCurrentUser(user);
      if (!user) {
        setUserProfile(null);
        setLoading(false);
      }
    });
    return unsubscribe;
  }, []);

  // 2. Live profile listener, so debt / earnings / roles update instantly.
  useEffect(() => {
    if (!currentUser) return;
    const unsubscribeProfile = onSnapshot(
      doc(db, "users", currentUser.uid),
      (docSnap) => {
        if (docSnap.exists()) {
          setUserProfile(docSnap.data() as UserProfile);
        } else {
          // No Firestore profile for a signed-in user: a registration in
          // progress or one abandoned part-way. Keep them signed in and let the
          // root layout route them to registration — never sign out here (every
          // retry would cost another SMS and eventually trip Firebase's device
          // block, which locked a rider out in Oct 2026).
          if (!isRegistrationActive()) {
            void logAuthEvent("profile_missing_resume");
          }
          setUserProfile(null);
        }
        setLoading(false);
      },
      (error) => {
        console.error("Error listening to profile:", error);
        setLoading(false);
      },
    );
    return () => unsubscribeProfile();
  }, [currentUser]);

  // 3. Version / platform telemetry once per user, only after the profile is
  // confirmed to exist (never creates a partial user doc during registration).
  useEffect(() => {
    const uid = currentUser?.uid;
    if (uid && userProfile && telemetryWrittenFor.current !== uid) {
      telemetryWrittenFor.current = uid;
      void recordAppTelemetry(uid);
    }
  }, [currentUser, userProfile]);

  const refreshProfile = useCallback(async () => {
    if (!currentUser) return;
    const docSnap = await getDoc(doc(db, "users", currentUser.uid));
    if (docSnap.exists()) setUserProfile(docSnap.data() as UserProfile);
  }, [currentUser]);

  const logout = useCallback(async () => {
    clearRegistrationActive();
    clearOtpSession();
    // Detach this device's push token from the account being signed out, so
    // the next user on this device doesn't receive this account's
    // notifications (registerFcmToken re-dedupes on the next sign-in too).
    try {
      const uid = auth.currentUser?.uid;
      if (uid) {
        await updateDoc(doc(db, "users", uid), { fcmToken: deleteField() });
      }
      await forgetPushToken();
    } catch (err) {
      console.warn("Failed to clear push token on logout:", err);
    }
    // Modular call: the Auth instance from getAuth() carries no methods in
    // React Native Firebase 26, so `auth.signOut()` throws.
    await signOut(auth);
  }, []);

  const value = useMemo(
    () => ({ currentUser, userProfile, loading, refreshProfile, logout }),
    [currentUser, userProfile, loading, refreshProfile, logout],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};
