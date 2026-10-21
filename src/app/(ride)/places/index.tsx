import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "../../../components/ui/AppText";
import { Button } from "../../../components/ui/Button";
import { Screen } from "../../../components/ui/Screen";
import { showAlert } from "../../../components/ui/alerts";
import { useToast } from "../../../components/ui/Toast";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import {
  removeSavedPlace,
  restoreSavedPlace,
  subscribeSavedPlaces,
  type SavedPlace,
} from "../../../services/savedPlacesService";
import { radius, spacing } from "../../../theme/tokens";

/** The rider's saved addresses, with edit, delete and undo. */
export default function SavedPlaces() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const uid = currentUser?.uid;
  const [places, setPlaces] = useState<SavedPlace[] | null>(null);

  useEffect(() => {
    if (!uid) return;
    return subscribeSavedPlaces(uid, setPlaces);
  }, [uid]);

  const edit = (p: SavedPlace) =>
    router.push({ pathname: "/(ride)/places/edit", params: { id: p.id } });

  const remove = async (p: SavedPlace) => {
    if (!uid) return;
    try {
      await removeSavedPlace(uid, p.id);
      toast("Address deleted", {
        action: {
          text: "Undo",
          onPress: () => {
            restoreSavedPlace(uid, p).catch((e) =>
              console.error("Restore failed:", e),
            );
          },
        },
      });
    } catch (e) {
      console.error("Failed to delete saved place:", e);
      toast("Couldn't delete that address.", { type: "error" });
    }
  };

  const menu = (p: SavedPlace) =>
    showAlert(p.label, p.address, [
      { text: "Edit", onPress: () => edit(p) },
      {
        text: "Delete",
        style: "destructive",
        onPress: () =>
          showAlert("Delete address?", `${p.label} · ${p.address}`, [
            { text: "Cancel", style: "cancel" },
            {
              text: "Yes, delete",
              style: "destructive",
              onPress: () => void remove(p),
            },
          ]),
      },
      { text: "Cancel", style: "cancel" },
    ]);

  return (
    <Screen padded={false} edges={["left", "right"]}>
      <View style={styles.body}>
        {places === null ? (
          <ActivityIndicator color={colors.primary} style={styles.center} />
        ) : places.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons
              name="location-outline"
              size={48}
              color={colors.textMuted}
            />
            <AppText variant="heading" align="center">
              No saved addresses yet
            </AppText>
            <AppText variant="small" color="textMuted" align="center">
              Save the places you go to often for faster booking.
            </AppText>
          </View>
        ) : (
          places.map((p) => (
            <Pressable
              key={p.id}
              accessibilityRole="button"
              onPress={() => edit(p)}
              onLongPress={() => menu(p)}
              style={({ pressed }) => [
                styles.card,
                {
                  backgroundColor: pressed
                    ? colors.surfaceRaised
                    : colors.surface,
                  borderColor: colors.border,
                },
              ]}
            >
              <Ionicons name="location" size={22} color={colors.primary} />
              <View style={styles.flex}>
                <AppText variant="heading">{p.label}</AppText>
                <AppText variant="small" color="textSecondary">
                  {p.address}
                </AppText>
              </View>
              <Pressable
                accessibilityLabel={`Options for ${p.label}`}
                hitSlop={10}
                onPress={() => menu(p)}
              >
                <Ionicons
                  name="ellipsis-vertical"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            </Pressable>
          ))
        )}
      </View>
      <View style={styles.footer}>
        <Button
          title="Add address"
          onPress={() => router.push("/(ride)/places/edit")}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { flex: 1, padding: spacing.screen, gap: spacing.md },
  center: { marginTop: 40 },
  empty: {
    alignItems: "center",
    gap: spacing.sm,
    paddingTop: 56,
    paddingHorizontal: spacing.lg,
  },
  card: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
  },
  flex: { flex: 1, gap: 2 },
  footer: { padding: spacing.screen },
});
