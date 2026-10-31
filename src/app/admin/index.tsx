import { useCallback } from "react";
import { Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import {
  AdminScreen,
  ErrorBox,
  Tiles,
  fmtKm,
  useAdminLoad,
} from "../../components/admin/AdminUi";
import { AppText } from "../../components/ui/AppText";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { isProductOwner } from "../../config/appRoles";
import { fetchAdminOverview } from "../../services/adminStatsService";
import { radius, spacing } from "../../theme/tokens";

const greeting = (): string => {
  const h = new Date().getHours();
  if (h < 12) return "Good morning";
  if (h < 17) return "Good afternoon";
  return "Good evening";
};

type Icon = React.ComponentProps<typeof Ionicons>["name"];

/** All rides first: it is where the owner checks what is happening today. */
const LINKS: { href: string; icon: Icon; title: string; sub: string }[] = [
  {
    href: "/admin/rides/all",
    icon: "calendar-outline",
    title: "All rides",
    sub: "Today, upcoming and history, by driver",
  },
  {
    href: "/admin/clients",
    icon: "people-outline",
    title: "Clients",
    sub: "Everyone registered, with rides and km",
  },
  {
    href: "/admin/drivers",
    icon: "car-sport-outline",
    title: "Drivers",
    sub: "Who's online, earnings, rides and km",
  },
  {
    href: "/admin/rides",
    icon: "stats-chart-outline",
    title: "Rides summary",
    sub: "This week, this month, six months",
  },
];

/** Owner only: who riders book through, and the fallback. */
const DISPATCH_LINK: (typeof LINKS)[number] = {
  href: "/admin/dispatch",
  icon: "git-network-outline",
  title: "Dispatch",
  sub: "Who riders book through, and the fallback",
};

export default function AdminHome() {
  const router = useRouter();
  const { colors } = useTheme();
  const { userProfile } = useAuth();
  const load = useCallback(() => fetchAdminOverview(), []);
  const { data, loading, error, refreshing, reload, onRefresh } = useAdminLoad(
    load,
    "Couldn't load the overview. Check your connection and try again.",
  );

  return (
    <AdminScreen refreshing={refreshing} onRefresh={onRefresh}>
      <View style={styles.greeting}>
        <View style={styles.flex}>
          <AppText variant="title">
            {greeting()}
            {userProfile?.firstName ? `, ${userProfile.firstName}` : ""}
          </AppText>
          <AppText variant="body" color="textSecondary">
            Here&apos;s how the app is doing.
          </AppText>
        </View>
        <View style={[styles.chip, { backgroundColor: colors.surfaceRaised }]}>
          <AppText variant="eyebrow" color="primary">
            OWNER
          </AppText>
        </View>
      </View>

      <Tiles
        loading={loading}
        items={[
          { label: "Riders", value: data?.riders },
          { label: "Rides this week", value: data?.ridesThisWeek },
          { label: "Rides this month", value: data?.ridesThisMonth },
          {
            label: "Km this month",
            value: data ? fmtKm(data.kmThisMonth) : undefined,
          },
        ]}
      />

      {error ? <ErrorBox message={error} onRetry={reload} /> : null}

      <View style={styles.links}>
        {(isProductOwner(userProfile) ? [...LINKS, DISPATCH_LINK] : LINKS).map(
          (l) => (
            <Pressable
              key={l.href}
              accessibilityRole="button"
              onPress={() => router.push(l.href as never)}
              style={({ pressed }) => [
                styles.link,
                {
                  backgroundColor: pressed
                    ? colors.surfaceRaised
                    : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <View
                style={[
                  styles.linkIcon,
                  { backgroundColor: colors.surfaceRaised },
                ]}
              >
                <Ionicons name={l.icon} size={22} color={colors.primary} />
              </View>
              <View style={styles.flex}>
                <AppText variant="bodyStrong">{l.title}</AppText>
                <AppText variant="small" color="textSecondary">
                  {l.sub}
                </AppText>
              </View>
              <Ionicons
                name="chevron-forward"
                size={18}
                color={colors.textMuted}
              />
            </Pressable>
          ),
        )}
      </View>
    </AdminScreen>
  );
}

const styles = StyleSheet.create({
  greeting: {
    flexDirection: "row",
    alignItems: "flex-start",
    gap: spacing.md,
    paddingVertical: spacing.sm,
  },
  flex: { flex: 1, gap: 2 },
  chip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radius.pill,
  },
  links: { gap: spacing.sm },
  link: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  linkIcon: {
    width: 44,
    height: 44,
    borderRadius: radius.md,
    alignItems: "center",
    justifyContent: "center",
  },
});
