import React from "react";
import { Redirect } from "expo-router";
import { useAuth } from "../contexts/AuthContext";
import { useOnboardingSeen } from "../hooks/useOnboardingSeen";
import { LoadingScreen } from "../components/ui/LoadingScreen";

/**
 * The app's entry route: sends each session to the right place.
 *   signed out, first launch   → onboarding slides
 *   signed out                 → welcome
 *   signed in, no profile yet  → registration (role choice)
 *   client / driver            → their tab shell
 */
export default function Index() {
  const { currentUser, userProfile } = useAuth();
  const { seen } = useOnboardingSeen();

  if (!currentUser) {
    if (seen === null) return <LoadingScreen />;
    return <Redirect href={seen ? "/(auth)/welcome" : "/(auth)/onboarding"} />;
  }
  if (!userProfile) return <Redirect href="/(auth)/role-select" />;
  if (userProfile.role === "driver") return <Redirect href="/(driver)" />;
  return <Redirect href="/(client)" />;
}
