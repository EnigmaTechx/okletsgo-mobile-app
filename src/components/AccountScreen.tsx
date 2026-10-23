import { useEffect, useState } from "react";
import { Linking, Pressable, StyleSheet, Switch, View } from "react-native";
import { useRouter } from "expo-router";
import * as Application from "expo-application";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "./ui/Screen";
import { AppText } from "./ui/AppText";
import { Avatar } from "./ui/Avatar";
import { MenuRow } from "./ui/MenuRow";
import { showAlert } from "./ui/alerts";
import { StatsStrip } from "./StatsStrip";
import { useAuth } from "../contexts/AuthContext";
import { type ThemePreference, useTheme } from "../contexts/ThemeContext";
import { useBgLocationConsent } from "../hooks/useBgLocationConsent";
import { scheduleAccountDeletion } from "../services/profileService";
import { countCompletedRides } from "../services/rideService";
import { PRIVACY_POLICY_URL } from "../utils/support";
import { radius, spacing } from "../theme/tokens";

const THEME_OPTIONS: { value: ThemePreference; label: string }[] = [
  { value: "system", label: "System" },
  { value: "light", label: "Light" },
  { value: "dark", label: "Dark" },
];

/**
 * The Account tab for both roles: who you are, the numbers that matter, and
 * every setting the Ionic Settings and Profile pages offered.
 */
export function AccountScreen() {
  const router = useRouter();
  const { userProfile, currentUser, logout } = useAuth();
  const { colors, preference, setPreference } = useTheme();
  const bgLocation = useBgLocationConsent();
  const [rideCount, setRideCount] = useState<number | null>(null);

  const isDriver = userProfile?.role === "driver";
  const roleTint = isDriver ? colors.primary : colors.secondary;
  const uid = currentUser?.uid;

  useEffect(() => {
    if (!uid) return;
    let cancelled = false;
    countCompletedRides(uid, isDriver ? "driver" : "client").then((n) => {
      if (!cancelled) setRideCount(n);
    });
    return () => {
      cancelled = true;
    };
  }, [uid, isDriver]);

  const confirmLogout = () =>
    showAlert("Sign out?", "You will need a new text code to sign back in.", [
      { text: "Cancel", style: "cancel" },
      { text: "Sign out", style: "destructive", onPress: () => void logout() },
    ]);

  const confirmDelete = () =>
    showAlert(
      "Delete account?",
      "Your account will be deactivated immediately and permanently deleted in 30 days. You will lose access to all ride history and earnings.",
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Delete",
          style: "destructive",
          onPress: async () => {
            if (!uid) return;
            try {
              await scheduleAccountDeletion(uid);
              showAlert(
                "Account deactivated",
                "Your account is scheduled for permanent deletion in 30 days. Sign in again before then to restore it.",
                [{ text: "OK", onPress: () => void logout() }],
              );
            } catch (err) {
              console.error("Error scheduling deletion:", err);
              showAlert(
                "Could not deactivate",
                "Please try again or contact support.",
              );
            }
          },
        },
      ],
    );

  const openPrivacyPolicy = () =>
    Linking.openURL(PRIVACY_POLICY_URL).catch(() => undefined);

  const vehicle = userProfile?.vehicle;
  const vehicleLabel = vehicle
    ? [vehicle.color, vehicle.make, vehicle.model].filter(Boolean).join(" ")
    : undefined;
  const awaitingApproval =
    isDriver &&
    (userProfile?.status === "pending_approval" ||
      userProfile?.isApproved === false);

  return (
    <Screen scroll padded={false}>
      <View style={styles.header}>
        <Avatar
          firstName={userProfile?.firstName}
          lastName={userProfile?.lastName}
          photoUrl={userProfile?.photoUrl}
          tint={roleTint}
          size={76}
        />
        <View style={styles.identity}>
          <AppText variant="title">
            {userProfile
              ? `${userProfile.firstName} ${userProfile.lastName}`
              : "Account"}
          </AppText>
          <View style={styles.badgeRow}>
            <View style={[styles.badge, { backgroundColor: roleTint }]}>
              <AppText
                variant="eyebrow"
                style={{
                  color: isDriver ? colors.onPrimary : colors.background,
                }}
              >
                {isDriver ? "DRIVER" : "RIDER"}
              </AppText>
            </View>
            <AppText variant="small" color="textMuted">
              {currentUser?.phoneNumber ?? ""}
            </AppText>
          </View>
        </View>
      </View>

      <View style={styles.section}>
        <StatsStrip
          rideCount={rideCount}
          memberSince={userProfile?.createdAt}
          totalKm={isDriver ? undefined : (userProfile?.totalKmTravelled ?? 0)}
          rating={isDriver ? userProfile?.rating : undefined}
          ratingCount={isDriver ? userProfile?.ratingCount : 0}
        />
      </View>

      {awaitingApproval ? (
        <View
          style={[
            styles.notice,
            { backgroundColor: colors.surface, borderColor: colors.accent },
          ]}
        >
          <Ionicons name="time-outline" size={20} color={colors.accent} />
          <View style={styles.noticeText}>
            <AppText variant="smallStrong" color="accent">
              Awaiting approval
            </AppText>
            <AppText variant="small" color="textSecondary">
              We review every new driver before they can go online. You will get
              an email as soon as your account is approved.
            </AppText>
          </View>
        </View>
      ) : null}

      <SectionLabel text="Profile" />
      <View
        style={[
          styles.group,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <MenuRow
          icon="person-outline"
          label="Edit profile"
          detail="Name, email and mobile number"
          onPress={() => router.push("/(common)/profile")}
        />
        {isDriver ? (
          <MenuRow
            icon="car-outline"
            label="Vehicle"
            detail={vehicleLabel ?? "Not set"}
            value={vehicle?.plateNumber}
            onPress={() => router.push("/(drive)/vehicle")}
          />
        ) : (
          <MenuRow
            icon="bookmark-outline"
            label="Saved addresses"
            detail="Home, work and the places you go often"
            onPress={() => router.push("/(ride)/places")}
          />
        )}
      </View>

      <SectionLabel text="Preferences" />
      <View
        style={[
          styles.group,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <View style={[styles.themeRow, { borderBottomColor: colors.border }]}>
          <View style={styles.themeHeading}>
            <Ionicons
              name="moon-outline"
              size={22}
              color={colors.textMuted}
              style={styles.themeIcon}
            />
            <AppText variant="bodyStrong">Appearance</AppText>
          </View>
          <View style={styles.segments}>
            {THEME_OPTIONS.map((o) => {
              const active = preference === o.value;
              return (
                <Pressable
                  key={o.value}
                  accessibilityRole="button"
                  accessibilityState={{ selected: active }}
                  onPress={() => setPreference(o.value)}
                  style={[
                    styles.segment,
                    {
                      backgroundColor: active
                        ? colors.primary
                        : colors.surfaceRaised,
                      borderColor: active ? colors.primary : colors.border,
                    },
                  ]}
                >
                  <AppText
                    variant="smallStrong"
                    style={{ color: active ? colors.onPrimary : colors.text }}
                  >
                    {o.label}
                  </AppText>
                </Pressable>
              );
            })}
          </View>
        </View>
        {isDriver ? (
          <MenuRow
            icon="location-outline"
            label="Background location"
            detail="Let riders see your live location during a trip, even when the app is in the background."
            right={
              <Switch
                value={!!bgLocation.granted}
                onValueChange={bgLocation.setGranted}
                trackColor={{ false: colors.border, true: colors.success }}
                thumbColor={colors.background}
              />
            }
          />
        ) : null}
      </View>

      <SectionLabel text="About" />
      <View
        style={[
          styles.group,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <MenuRow
          icon="reader-outline"
          label="Terms of Use"
          onPress={() => router.push("/(common)/terms")}
        />
        <MenuRow
          icon="document-text-outline"
          label="Privacy Policy"
          onPress={openPrivacyPolicy}
          external
        />
        <MenuRow
          icon="chatbubbles-outline"
          label="Help & Support"
          onPress={() => router.push("/(common)/support")}
        />
        <MenuRow
          icon="information-circle-outline"
          label="App version"
          value={`${Application.nativeApplicationVersion ?? "dev"} (${Application.nativeBuildVersion ?? "0"})`}
        />
      </View>

      <SectionLabel text="Account" />
      <View
        style={[
          styles.group,
          { backgroundColor: colors.surface, borderColor: colors.border },
        ]}
      >
        <MenuRow
          icon="log-out-outline"
          label="Sign out"
          onPress={confirmLogout}
        />
        <MenuRow
          icon="trash-outline"
          label="Delete account"
          onPress={confirmDelete}
          danger
        />
      </View>
    </Screen>
  );
}

function SectionLabel({ text }: { text: string }) {
  return (
    <AppText variant="eyebrow" color="textMuted" style={styles.sectionLabel}>
      {text.toUpperCase()}
    </AppText>
  );
}

const styles = StyleSheet.create({
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.xl,
    paddingBottom: spacing.lg,
  },
  identity: { flex: 1, gap: spacing.xs },
  badgeRow: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  badge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radius.pill,
  },
  section: { paddingHorizontal: spacing.screen },
  notice: {
    flexDirection: "row",
    gap: spacing.md,
    marginHorizontal: spacing.screen,
    marginTop: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  noticeText: { flex: 1, gap: 2 },
  sectionLabel: {
    paddingHorizontal: spacing.screen + spacing.xs,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.sm,
  },
  group: {
    marginHorizontal: spacing.screen,
    borderRadius: radius.lg,
    borderWidth: 1,
    overflow: "hidden",
  },
  themeRow: {
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
    gap: spacing.md,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  themeHeading: { flexDirection: "row", alignItems: "center", gap: spacing.md },
  themeIcon: { width: 24, textAlign: "center" },
  segments: { flexDirection: "row", gap: spacing.sm },
  segment: {
    flex: 1,
    minHeight: 40,
    borderRadius: radius.sm,
    borderWidth: 1,
    alignItems: "center",
    justifyContent: "center",
  },
});
