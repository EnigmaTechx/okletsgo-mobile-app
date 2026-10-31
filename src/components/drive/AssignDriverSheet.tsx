import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Ionicons } from "@expo/vector-icons";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import type { RideRequest } from "../../interfaces/ride";
import {
  listPublicDrivers,
  type PublicProfile,
} from "../../services/publicProfiles";
import { formatDriverRating } from "../../utils/rating";
import { fontFamily, radius, spacing, typography } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import { withAlpha } from "../ui/ConfirmSheet";
import { Sheet } from "../ui/Sheet";

/**
 * The dispatcher's "Assign this ride" sheet (Ionic AssignDriverSheet): pick
 * a driver (online first, then by rating), add an optional note, assign.
 * In "reassign" mode (an accepted ride) it lists everyone but the driver
 * who has it now, the dispatcher included, to take it back.
 * Only drivers who could legally take the ride are listed: approved, with a
 * vehicle, active, and in the same sandbox/live bucket as the ride. The
 * assignRide function re-checks all of this.
 */

const NOTE_MAX = 200;
const STAR_GOLD = "#F5B301";

const eligible = (
  d: PublicProfile,
  excludedId: string | undefined,
  testRide: boolean,
) =>
  d.uid !== excludedId &&
  d.isApproved !== false &&
  !!d.vehicle &&
  d.status !== "suspended" &&
  d.status !== "scheduled_for_deletion" &&
  (d.isTestAccount === true) === testRide;

interface Props {
  visible: boolean;
  ride: RideRequest;
  onClose: () => void;
  /** Resolves when assigned; throws with a message to show otherwise. */
  onAssign: (driverId: string, note: string) => Promise<void>;
  /** "reassign": the ride is accepted and moves from its current driver. */
  mode?: "assign" | "reassign";
}

export function AssignDriverSheet({
  visible,
  ride,
  onClose,
  onAssign,
  mode = "assign",
}: Props) {
  const [busy, setBusy] = useState(false);
  return (
    <Sheet visible={visible} onClose={onClose} dismissible={!busy}>
      {/* Mounted per opening, so the list and the note start fresh. */}
      {visible ? (
        <AssignBody
          ride={ride}
          mode={mode}
          onClose={onClose}
          onAssign={onAssign}
          onBusy={setBusy}
        />
      ) : null}
    </Sheet>
  );
}

function AssignBody({
  ride,
  mode,
  onClose,
  onAssign,
  onBusy,
}: Omit<Props, "visible"> & { onBusy: (busy: boolean) => void }) {
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const reassign = mode === "reassign";
  const [drivers, setDrivers] = useState<PublicProfile[] | null>(null);
  const [selected, setSelected] = useState("");
  const [note, setNote] = useState("");
  const [busy, setBusyState] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const setBusy = (b: boolean) => {
    setBusyState(b);
    onBusy(b);
  };

  // Assign: everyone but the dispatcher. Reassign: everyone but who has it.
  const excludedId = reassign ? ride.driverId : ride.dispatcherId;
  const testRide = ride.isTest === true;

  useEffect(() => {
    let cancelled = false;
    listPublicDrivers()
      .then((all) => {
        if (cancelled) return;
        const list = all
          .filter((d) => eligible(d, excludedId, testRide))
          .sort(
            (a, b) =>
              Number(b.isOnline === true) - Number(a.isOnline === true) ||
              (b.rating ?? 0) - (a.rating ?? 0) ||
              (a.firstName ?? "").localeCompare(b.firstName ?? ""),
          );
        setDrivers(list);
        setSelected((cur) =>
          list.some((d) => d.uid === cur) ? cur : (list[0]?.uid ?? ""),
        );
      })
      .catch(
        () =>
          !cancelled &&
          setError("Couldn't load drivers. Check your connection."),
      );
    return () => {
      cancelled = true;
    };
  }, [excludedId, testRide]);

  const chosen = drivers?.find((d) => d.uid === selected);
  const me = currentUser?.uid;
  const when = ride.scheduledTime
    ? new Date(ride.scheduledTime).toLocaleString("en-US", {
        weekday: "short",
        hour: "numeric",
        minute: "2-digit",
        hour12: true,
      })
    : "ASAP";
  const km = Number(ride.distance);

  const submit = async () => {
    if (!chosen) return;
    setBusy(true);
    setError(null);
    try {
      await onAssign(chosen.uid, note.trim());
      setNote("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Couldn't assign the ride.");
    } finally {
      setBusy(false);
    }
  };

  const tone = colors.primary;
  return (
    <View style={styles.body}>
      <View
        style={[styles.iconDisc, { backgroundColor: withAlpha(tone, 0.12) }]}
      >
        <Ionicons name="person-add-outline" size={28} color={tone} />
      </View>
      <AppText variant="title" align="center" style={{ color: tone }}>
        {reassign ? "Reassign this ride" : "Assign this ride"}
      </AppText>
      <AppText variant="body" color="textSecondary" align="center">
        {[
          ride.clientFirstName,
          when,
          Number.isFinite(km) && km > 0 ? `${Math.round(km)} km` : "",
        ]
          .filter(Boolean)
          .join(" · ")}
      </AppText>
      {reassign ? (
        <AppText variant="small" color="textMuted" align="center">
          Now with{" "}
          {ride.driverId === me ? "you" : ride.driverFirstName || "a driver"}.
          The new driver has to accept it; until then the rider sees
          &ldquo;Confirming your driver&rdquo;.
        </AppText>
      ) : null}

      {drivers === null && !error ? (
        <ActivityIndicator color={tone} style={styles.loading} />
      ) : null}
      {drivers && drivers.length === 0 ? (
        <AppText
          variant="body"
          color="textMuted"
          align="center"
          style={styles.loading}
        >
          No other {ride.isTest ? "test " : ""}drivers can take this ride.
        </AppText>
      ) : null}
      {drivers && drivers.length > 0 ? (
        <View style={styles.options} accessibilityRole="radiogroup">
          {drivers.map((d) => {
            const on = d.uid === selected;
            return (
              <Pressable
                key={d.uid}
                accessibilityRole="radio"
                accessibilityState={{ selected: on }}
                onPress={() => setSelected(d.uid)}
                style={[
                  styles.option,
                  {
                    backgroundColor: on ? withAlpha(tone, 0.07) : "transparent",
                    borderColor: on ? tone : colors.border,
                  },
                ]}
              >
                <View
                  style={[
                    styles.radio,
                    {
                      borderColor: on ? tone : colors.textMuted,
                      backgroundColor: on ? tone : "transparent",
                    },
                  ]}
                />
                <View
                  style={[
                    styles.avatar,
                    { backgroundColor: withAlpha(colors.secondary, 0.18) },
                  ]}
                >
                  <AppText
                    variant="smallStrong"
                    style={{ color: colors.secondary }}
                  >
                    {(d.firstName?.[0] ?? "?").toUpperCase()}
                  </AppText>
                </View>
                <View style={styles.text}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {d.firstName}
                    {d.uid === me ? " (you)" : ""}
                  </AppText>
                  <View style={styles.meta}>
                    <AppText
                      variant="small"
                      style={{
                        color: d.isOnline ? colors.success : colors.textMuted,
                      }}
                    >
                      ● {d.isOnline ? "Online" : "Offline"}
                    </AppText>
                    <AppText variant="small" color="textSecondary">
                      {" · "}
                    </AppText>
                    <Ionicons name="star" size={12} color={STAR_GOLD} />
                    <AppText variant="small" color="textSecondary">
                      {" "}
                      {formatDriverRating(d.rating ?? undefined)}
                      {d.vehicle?.model ? ` · ${d.vehicle.model}` : ""}
                    </AppText>
                  </View>
                </View>
              </Pressable>
            );
          })}
        </View>
      ) : null}

      {drivers && drivers.length > 0 ? (
        <TextInput
          value={note}
          onChangeText={(t) => setNote(t.slice(0, NOTE_MAX))}
          placeholder="Note to driver (optional)…"
          placeholderTextColor={colors.textMuted}
          maxLength={NOTE_MAX}
          multiline
          style={[
            styles.note,
            {
              color: colors.text,
              backgroundColor: colors.surface,
              borderColor: colors.border,
            },
          ]}
        />
      ) : null}

      {error ? (
        <AppText variant="small" color="danger" align="center">
          {error}
        </AppText>
      ) : null}

      <View style={styles.actions}>
        <Pressable
          accessibilityRole="button"
          onPress={onClose}
          disabled={busy}
          style={({ pressed }) => [
            styles.pill,
            {
              borderColor: colors.border,
              backgroundColor: pressed ? colors.surfaceRaised : "transparent",
            },
          ]}
        >
          <AppText
            style={[typography.button, { color: colors.textSecondary }]}
            numberOfLines={1}
          >
            Cancel
          </AppText>
        </Pressable>
        <Pressable
          accessibilityRole="button"
          onPress={() => void submit()}
          disabled={!chosen || busy}
          style={({ pressed }) => [
            styles.pill,
            {
              backgroundColor: tone,
              borderColor: tone,
              opacity: !chosen ? 0.5 : pressed ? 0.85 : 1,
            },
          ]}
        >
          {busy ? (
            <ActivityIndicator color={colors.onPrimary} />
          ) : (
            <AppText
              style={[typography.button, { color: colors.onPrimary }]}
              numberOfLines={1}
            >
              {chosen
                ? `${reassign ? "Reassign" : "Assign"} to ${chosen.uid === me ? "me" : chosen.firstName}`
                : reassign
                  ? "Reassign"
                  : "Assign"}
            </AppText>
          )}
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  body: { alignItems: "center", gap: spacing.sm, paddingBottom: spacing.sm },
  iconDisc: {
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: spacing.xs,
  },
  loading: { marginVertical: spacing.lg },
  options: { alignSelf: "stretch", gap: spacing.sm, marginTop: spacing.md },
  option: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: 11,
    paddingHorizontal: spacing.md,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
  },
  radio: { width: 20, height: 20, borderRadius: 10, borderWidth: 2 },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  text: { flex: 1, gap: 1 },
  meta: { flexDirection: "row", alignItems: "center" },
  note: {
    alignSelf: "stretch",
    minHeight: 56,
    maxHeight: 100,
    marginTop: spacing.sm,
    borderRadius: radius.sm + 2,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    paddingVertical: 10,
    fontFamily: fontFamily.medium,
    fontSize: 15,
  },
  actions: {
    flexDirection: "row",
    gap: spacing.md,
    alignSelf: "stretch",
    marginTop: spacing.lg,
  },
  pill: {
    flex: 1,
    minHeight: 52,
    borderRadius: radius.pill,
    borderWidth: 1.5,
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 10,
  },
});
