import React from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { Screen } from "../../components/ui/Screen";
import { AppText } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { Logo } from "../../components/ui/Logo";
import { showAlert } from "../../components/ui/alerts";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { UserRole } from "../../interfaces/user";
import { radius, spacing } from "../../theme/tokens";

function RoleCard({
  eyebrow,
  title,
  body,
  icon,
  tint,
  onPress,
}: {
  eyebrow: string;
  title: string;
  body: string;
  icon: React.ComponentProps<typeof Ionicons>["name"];
  tint: string;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: tint, opacity: pressed ? 0.9 : 1 },
      ]}
    >
      <View style={[styles.iconWrap, { backgroundColor: colors.surfaceRaised }]}>
        <Ionicons name={icon} size={30} color={tint} />
      </View>
      <View style={styles.cardCopy}>
        <AppText variant="eyebrow" style={{ color: tint }}>
          {eyebrow}
        </AppText>
        <AppText variant="heading">{title}</AppText>
        <AppText variant="small" color="textSecondary">
          {body}
        </AppText>
      </View>
      <Ionicons name="chevron-forward" size={22} color={tint} />
    </Pressable>
  );
}

/**
 * Registration step 1: a verified phone number with no profile yet chooses a
 * role. Same rule as the Ionic app: one role per phone number, chosen once.
 */
export default function RoleSelect() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentUser, logout } = useAuth();
  const params = useLocalSearchParams<{ phone?: string }>();
  const phone = params.phone || currentUser?.phoneNumber || "";

  const choose = (role: UserRole) =>
    router.push({ pathname: "/(auth)/complete-profile", params: { role, phone } });

  const cancel = () =>
    showAlert("Cancel registration?", "You can sign in again with any number later.", [
      { text: "Keep going", style: "cancel" },
      {
        text: "Cancel registration",
        style: "destructive",
        onPress: () => {
          // The auth group stays mounted for a signed-out session, so leave
          // this screen explicitly once the sign-out has gone through.
          void logout()
            .catch((err) => console.warn("Cancel registration: sign-out failed", err))
            .finally(() => router.replace("/(auth)/welcome"));
        },
      },
    ]);

  return (
    <Screen scroll edges={["top", "bottom", "left", "right"]}>
      <View style={styles.logo}>
        <Logo width={168} />
      </View>
      <AppText variant="display" align="center">
        How are you riding with us today?
      </AppText>
      <AppText variant="body" color="textSecondary" align="center" style={styles.sub}>
        Choose one to continue. You can only hold one role per phone number.
      </AppText>

      <RoleCard
        eyebrow="CUSTOMER"
        title="Book a ride"
        body="Pick your driver, pay in app, follow the trip live."
        icon="person-outline"
        tint={colors.secondary}
        onPress={() => choose("client")}
      />
      <RoleCard
        eyebrow="DRIVER"
        title="Drive and earn"
        body="Approval required. Add your vehicle after sign-up."
        icon="car-sport-outline"
        tint={colors.primary}
        onPress={() => choose("driver")}
      />

      <View style={styles.footer}>
        <Button title="Cancel registration" variant="ghost" onPress={cancel} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  logo: { alignItems: "center", paddingVertical: spacing.xl },
  sub: { marginTop: spacing.sm, marginBottom: spacing.xxl },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.lg,
    padding: spacing.lg,
    borderRadius: radius.xl,
    borderWidth: 2,
    marginBottom: spacing.md,
  },
  iconWrap: { width: 64, height: 64, borderRadius: 32, alignItems: "center", justifyContent: "center" },
  cardCopy: { flex: 1, gap: 2 },
  footer: { marginTop: "auto", paddingTop: spacing.xl },
});
