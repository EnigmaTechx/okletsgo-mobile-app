import { useEffect, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { useLocalSearchParams, useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { AppText } from "../../../components/ui/AppText";
import { Button } from "../../../components/ui/Button";
import { Screen } from "../../../components/ui/Screen";
import { TextField } from "../../../components/ui/TextField";
import { useToast } from "../../../components/ui/Toast";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import {
  usePlaceSearch,
  type PickedPlace,
} from "../../../hooks/usePlaceSearch";
import {
  addSavedPlace,
  getSavedPlace,
  updateSavedPlace,
} from "../../../services/savedPlacesService";
import { formatPredictionText } from "../../../utils/places";
import { radius, spacing } from "../../../theme/tokens";

/** Add or edit one saved address: search, pick, name it. */
export default function EditSavedPlace() {
  const router = useRouter();
  const navigation = useNavigation();
  const toast = useToast();
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const { id } = useLocalSearchParams<{ id?: string }>();
  const isEdit = !!id;

  const search = usePlaceSearch(3);
  const [picked, setPicked] = useState<PickedPlace | null>(null);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    navigation.setOptions({
      title: isEdit ? "Edit address" : "Add an address",
    });
  }, [navigation, isEdit]);

  useEffect(() => {
    if (!isEdit || !currentUser || !id) return;
    getSavedPlace(currentUser.uid, id).then((p) => {
      if (!p) return;
      setLabel(p.label);
      setPicked({ address: p.address, lat: p.lat, lng: p.lng });
      search.seed(p.address);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isEdit, currentUser, id]);

  const canSave = !!picked && label.trim().length > 0 && !saving;

  const save = async () => {
    if (!currentUser || !picked || !canSave) return;
    setSaving(true);
    try {
      const payload = {
        label: label.trim(),
        address: picked.address,
        lat: picked.lat,
        lng: picked.lng,
      };
      if (isEdit && id) await updateSavedPlace(currentUser.uid, id, payload);
      else await addSavedPlace(currentUser.uid, payload);
      router.back();
    } catch (e) {
      toast(
        e instanceof Error
          ? e.message
          : "Couldn't save this address. Try again.",
        { type: "error" },
      );
      setSaving(false);
    }
  };

  return (
    <Screen scroll edges={["left", "right"]}>
      <View style={styles.body}>
        <TextField
          label="Address"
          value={search.query}
          onChangeText={(t) => {
            search.setQuery(t);
            if (picked && t !== picked.address) setPicked(null);
          }}
          placeholder="Search for a location"
          autoCorrect={false}
          returnKeyType="search"
        />

        {search.predictions.length > 0 ? (
          <View
            style={[
              styles.predictions,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {search.predictions.map((p) => (
              <Pressable
                key={p.placeId}
                accessibilityRole="button"
                onPress={() => {
                  void search.pick(p).then((place) => {
                    if (place) setPicked(place);
                    else
                      toast("We couldn't locate that address.", {
                        type: "error",
                      });
                  });
                }}
                style={({ pressed }) => [
                  styles.prediction,
                  {
                    borderBottomColor: colors.border,
                    backgroundColor: pressed
                      ? colors.surfaceRaised
                      : "transparent",
                  },
                ]}
              >
                <Ionicons name="location" size={18} color={colors.textMuted} />
                <AppText variant="body" style={styles.flex}>
                  {formatPredictionText(p.description)}
                </AppText>
              </Pressable>
            ))}
          </View>
        ) : search.searching ? (
          <ActivityIndicator color={colors.primary} />
        ) : search.error ? (
          <AppText variant="small" color="danger">
            {search.error}
          </AppText>
        ) : null}

        {picked && search.predictions.length === 0 ? (
          <View
            style={[
              styles.picked,
              { backgroundColor: colors.surface, borderColor: colors.success },
            ]}
          >
            <Ionicons
              name="checkmark-circle"
              size={20}
              color={colors.success}
            />
            <AppText variant="small" style={styles.flex}>
              {picked.address}
            </AppText>
          </View>
        ) : null}

        <TextField
          label="Name"
          value={label}
          onChangeText={setLabel}
          placeholder="e.g. Home, Work, Mom's House"
          maxLength={40}
          autoCapitalize="words"
          returnKeyType="done"
          onSubmitEditing={() => void save()}
        />
      </View>

      <View style={styles.actions}>
        <Button
          title="Cancel"
          variant="secondary"
          onPress={() => router.back()}
          disabled={saving}
          style={styles.half}
        />
        <Button
          title="Save address"
          onPress={() => void save()}
          loading={saving}
          disabled={!canSave}
          style={styles.half}
        />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  body: { paddingTop: spacing.md, gap: spacing.lg },
  predictions: { borderRadius: radius.md, borderWidth: 1, overflow: "hidden" },
  prediction: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  flex: { flex: 1 },
  picked: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  actions: { flexDirection: "row", gap: spacing.md, marginTop: spacing.xxl },
  half: { flex: 1 },
});
