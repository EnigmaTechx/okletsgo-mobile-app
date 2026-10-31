import { useEffect, useState } from "react";
import { Pressable, StyleSheet, Switch, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import {
  AdminScreen,
  Caption,
  EmptyBox,
  Group,
  Loading,
  SectionHead,
} from "../../components/admin/AdminUi";
import { AppText } from "../../components/ui/AppText";
import { ConfirmSheet } from "../../components/ui/ConfirmSheet";
import { useToast } from "../../components/ui/Toast";
import { useAuth } from "../../contexts/AuthContext";
import { useTheme } from "../../contexts/ThemeContext";
import { isProductOwner } from "../../config/appRoles";
import {
  callableMessage,
  updateDispatchSettings,
  useDispatchConfig,
  type DispatchConfig,
  type DispatchPatch,
  type FallbackAction,
} from "../../services/dispatch";
import {
  isBookableDriver,
  listPublicDrivers,
  type PublicProfile,
} from "../../services/publicProfiles";
import { spacing } from "../../theme/tokens";

/*
 * Dispatch settings (owner only), as the Ionic AdminDispatch page. Riders
 * book through one dispatcher (Andy), who accepts, assigns or declines each
 * request. Every change saves at once through the updateDispatchSettings
 * function and applies to new bookings right away (config/dispatch is read
 * when a rider picks a driver).
 */

const MINUTES = [5, 10, 15, 30, 60];
const ACTIONS: { value: FallbackAction; label: string; sub: string }[] = [
  {
    value: "assign_next",
    label: "Next driver",
    sub: "Assign to the highest-rated online driver",
  },
  { value: "remind", label: "Remind me", sub: "Send one more notification" },
  {
    value: "keep_waiting",
    label: "Keep waiting",
    sub: "Nothing happens until you act",
  },
];
const NONE = "None";

type Picker = "dispatcher" | "testDispatcher" | "minutes" | "action";

export default function AdminDispatch() {
  const toast = useToast();
  const { colors } = useTheme();
  const { currentUser, userProfile } = useAuth();
  const canEdit = isProductOwner(userProfile);
  const { config, error } = useDispatchConfig();
  const [drivers, setDrivers] = useState<PublicProfile[] | null>(null);
  const [saving, setSaving] = useState(false);
  // Optimistic copy so toggles move at once; replaced by the live doc.
  const [draft, setDraft] = useState<DispatchConfig | null>(null);
  const [picker, setPicker] = useState<Picker | null>(null);
  const [pick, setPick] = useState("");
  const cfg: DispatchConfig = { ...(config ?? {}), ...(draft ?? {}) };

  useEffect(() => {
    let active = true;
    listPublicDrivers()
      .then(
        (all) =>
          active &&
          setDrivers(
            all
              .filter(isBookableDriver)
              .sort((a, b) =>
                (a.firstName ?? "").localeCompare(b.firstName ?? ""),
              ),
          ),
      )
      .catch(() => active && setDrivers([]));
    return () => {
      active = false;
    };
  }, []);

  const me = currentUser?.uid;
  const liveDrivers = (drivers ?? []).filter((d) => d.isTestAccount !== true);
  const testDrivers = (drivers ?? []).filter((d) => d.isTestAccount === true);
  const nameOf = (id?: string | null) =>
    drivers?.find((d) => d.uid === id)?.firstName;
  const dispatcherName = nameOf(cfg.dispatcherId) || "the dispatcher";
  const label = (d: PublicProfile) =>
    `${d.firstName}${d.uid === me ? " (me)" : ""}`;

  const save = async (patch: DispatchPatch) => {
    setDraft((d) => ({ ...(d ?? {}), ...(patch as DispatchConfig) }));
    setSaving(true);
    try {
      await updateDispatchSettings(patch);
      toast("Saved", { type: "success", durationMs: 1400 });
    } catch (e) {
      toast(callableMessage(e, "Couldn't save. Try again."), {
        type: "error",
        durationMs: 3500,
      });
    } finally {
      setDraft(null); // fall back to whatever the live doc says
      setSaving(false);
    }
  };

  const toggleEnabled = (on: boolean) => {
    if (!on) return void save({ enabled: false });
    // Turning on needs a dispatcher: default to me if I'm a live driver.
    const meIsDriver = liveDrivers.some((d) => d.uid === me);
    const dispatcherId =
      cfg.dispatcherId || (meIsDriver ? me : liveDrivers[0]?.uid);
    if (!dispatcherId) {
      toast("Add a driver before turning dispatch on.", {
        type: "error",
        durationMs: 3500,
      });
      return;
    }
    void save({ enabled: true, dispatcherId });
  };

  // The pickers are ConfirmSheets with radio options (labels), mapped back
  // to ids / values on confirm.
  const pickerOptions: string[] =
    picker === "dispatcher"
      ? liveDrivers.map(label)
      : picker === "testDispatcher"
        ? [NONE, ...testDrivers.map(label)]
        : picker === "minutes"
          ? MINUTES.map((m) => `${m} min`)
          : ACTIONS.map((a) => a.label);
  const openPicker = (which: Picker, current: string) => {
    setPick(current);
    setPicker(which);
  };
  const confirmPicker = () => {
    const which = picker;
    setPicker(null);
    if (!which) return;
    if (which === "dispatcher") {
      const d = liveDrivers.find((x) => label(x) === pick);
      if (d) void save({ dispatcherId: d.uid });
    } else if (which === "testDispatcher") {
      const d = testDrivers.find((x) => label(x) === pick);
      void save({ testDispatcherId: d ? d.uid : null });
    } else if (which === "minutes") {
      void save({ fallbackMinutes: Number(pick.replace(/\D/g, "")) });
    } else {
      const a = ACTIONS.find((x) => x.label === pick);
      if (a) void save({ fallbackAction: a.value });
    }
  };

  const fallbackAction = cfg.fallbackAction ?? "assign_next";
  const fallbackMinutes = cfg.fallbackMinutes ?? 10;
  const loading = config === null || drivers === null;
  const disabled = !canEdit || saving;

  return (
    <AdminScreen>
      {error ? (
        <EmptyBox text="Couldn't load dispatch settings. Check your connection and come back." />
      ) : loading ? (
        <Loading />
      ) : (
        <>
          {!canEdit ? (
            <EmptyBox text="Only the owner can change these settings." />
          ) : null}

          <View>
            <SectionHead title="Bookings" />
            <Group>
              <SettingRow
                title="Riders book through a dispatcher"
                sub="Other drivers are hidden from riders and only get rides the dispatcher assigns"
              >
                <Switch
                  value={cfg.enabled === true}
                  disabled={disabled}
                  onValueChange={toggleEnabled}
                  trackColor={{ false: colors.border, true: colors.success }}
                  thumbColor={colors.background}
                />
              </SettingRow>
              <SelectRow
                title="Dispatcher"
                sub="Who riders book through"
                value={nameOf(cfg.dispatcherId) || "Choose"}
                disabled={disabled || liveDrivers.length === 0}
                onPress={() =>
                  openPicker(
                    "dispatcher",
                    liveDrivers.find((d) => d.uid === cfg.dispatcherId)
                      ? label(
                          liveDrivers.find((d) => d.uid === cfg.dispatcherId)!,
                        )
                      : liveDrivers[0]
                        ? label(liveDrivers[0])
                        : "",
                  )
                }
              />
              <SettingRow
                title={`Show ${dispatcherName} when offline`}
                sub="So riders can always book ahead"
              >
                <Switch
                  value={cfg.showWhenOffline !== false}
                  disabled={disabled}
                  onValueChange={(v) => void save({ showWhenOffline: v })}
                  trackColor={{ false: colors.border, true: colors.success }}
                  thumbColor={colors.background}
                />
              </SettingRow>
            </Group>
          </View>

          <View>
            <SectionHead title={`If ${dispatcherName} doesn't respond`} />
            <Group>
              <SelectRow
                title="After"
                sub="Counting from when the request arrives"
                value={`${fallbackMinutes} min`}
                disabled={disabled}
                onPress={() => openPicker("minutes", `${fallbackMinutes} min`)}
              />
              <SelectRow
                title="Then"
                sub={ACTIONS.find((a) => a.value === fallbackAction)?.sub}
                value={
                  ACTIONS.find((a) => a.value === fallbackAction)?.label ?? ""
                }
                disabled={disabled}
                onPress={() =>
                  openPicker(
                    "action",
                    ACTIONS.find((a) => a.value === fallbackAction)?.label ??
                      ACTIONS[0].label,
                  )
                }
              />
            </Group>
          </View>

          <View>
            <SectionHead title="Assigned drivers" />
            <Group>
              <SettingRow
                title={`"Can't take it" goes back to ${dispatcherName}`}
                sub="Instead of on to another driver"
              >
                <Switch
                  value={cfg.returnToDispatcher !== false}
                  disabled={disabled}
                  onValueChange={(v) => void save({ returnToDispatcher: v })}
                  trackColor={{ false: colors.border, true: colors.success }}
                  thumbColor={colors.background}
                />
              </SettingRow>
            </Group>
          </View>

          <View style={styles.section}>
            <SectionHead title="Sandbox" />
            <Group>
              <SelectRow
                title="Test dispatcher"
                sub="Test riders book through this test driver"
                value={nameOf(cfg.testDispatcherId) || NONE}
                disabled={disabled}
                onPress={() =>
                  openPicker(
                    "testDispatcher",
                    testDrivers.find((d) => d.uid === cfg.testDispatcherId)
                      ? label(
                          testDrivers.find(
                            (d) => d.uid === cfg.testDispatcherId,
                          )!,
                        )
                      : NONE,
                  )
                }
              />
            </Group>
            <Caption text="With no test dispatcher, test riders keep choosing from the test drivers as before." />
          </View>

          <ConfirmSheet
            visible={picker !== null}
            title={
              picker === "dispatcher"
                ? "Dispatcher"
                : picker === "testDispatcher"
                  ? "Test dispatcher"
                  : picker === "minutes"
                    ? "Wait time"
                    : "Then"
            }
            options={pickerOptions}
            selected={pick}
            onSelect={setPick}
            cancelText="Cancel"
            onCancel={() => setPicker(null)}
            confirmText="Save"
            onConfirm={confirmPicker}
          />
        </>
      )}
    </AdminScreen>
  );
}

function SettingRow({
  title,
  sub,
  children,
}: {
  title: string;
  sub?: string;
  children: React.ReactNode;
}) {
  const { colors } = useTheme();
  return (
    <View style={[styles.row, { borderBottomColor: colors.border }]}>
      <View style={styles.text}>
        <AppText variant="bodyStrong">{title}</AppText>
        {sub ? (
          <AppText variant="small" color="textSecondary">
            {sub}
          </AppText>
        ) : null}
      </View>
      {children}
    </View>
  );
}

function SelectRow({
  title,
  sub,
  value,
  disabled,
  onPress,
}: {
  title: string;
  sub?: string;
  value: string;
  disabled?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        {
          borderBottomColor: colors.border,
          backgroundColor: pressed ? colors.surfaceRaised : "transparent",
          opacity: disabled ? 0.6 : 1,
        },
      ]}
    >
      <View style={styles.text}>
        <AppText variant="bodyStrong">{title}</AppText>
        {sub ? (
          <AppText variant="small" color="textSecondary">
            {sub}
          </AppText>
        ) : null}
      </View>
      <View style={styles.value}>
        <AppText variant="bodyStrong" color="primary" numberOfLines={1}>
          {value}
        </AppText>
        <Ionicons name="chevron-down" size={16} color={colors.primary} />
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  text: { flex: 1, gap: 2 },
  value: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    maxWidth: "45%",
  },
  section: { gap: spacing.sm },
});
