import React, { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { Stack, useLocalSearchParams } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useReanimatedKeyboardAnimation } from "react-native-keyboard-controller";
import Reanimated, { useAnimatedStyle } from "react-native-reanimated";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { AppText } from "../../../components/ui/AppText";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { canAccessAdminSection } from "../../../config/appRoles";
import type { RideRequest } from "../../../interfaces/ride";
import {
  chatIsOpen,
  DRIVER_QUICK_REPLIES,
  markChatRead,
  RIDER_QUICK_REPLIES,
  sendRideMessage,
  useChatFlags,
  useRideMessages,
  type ChatMessage,
} from "../../../services/chat";
import { callableMessage } from "../../../services/dispatch";
import { setOpenChatRide } from "../../../services/pushService";
import { subscribeRide } from "../../../services/rideService";
import { firstLine, formatTime } from "../../../utils/address";
import { fontFamily, radius, spacing } from "../../../theme/tokens";

/*
 * In-app chat between a ride's rider and driver (no phone numbers), as the
 * Ionic RideChat page. Opened from the ride sheets or a chat notification.
 * Admins / the owner open it read-only from the admin ride page and also
 * see what was masked.
 */

const MAX = 500;

const maskedLabel = (m: ChatMessage) =>
  m.masked?.includes("phone") && m.masked.includes("email")
    ? "A phone number and email were hidden"
    : m.masked?.includes("email")
      ? "An email was hidden"
      : "A phone number was hidden";

const firstName = (s?: string | null) => (s ?? "").trim().split(/\s+/)[0] ?? "";
const initials = (s: string) =>
  s
    .split(/[\s&]+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((w) => w[0]?.toUpperCase() ?? "")
    .join("") || "?";

export default function RideChat() {
  const { id: rideId } = useLocalSearchParams<{ id: string }>();
  const { currentUser, userProfile } = useAuth();
  const { colors, scheme } = useTheme();
  const insets = useSafeAreaInsets();
  const uid = currentUser?.uid;

  const [ride, setRide] = useState<RideRequest | null>(null);
  const [missing, setMissing] = useState(false);
  useEffect(() => {
    if (!rideId) return;
    return subscribeRide(
      rideId,
      (r) => (r ? setRide(r) : setMissing(true)),
      () => setMissing(true),
    );
  }, [rideId]);

  // No banner for this chat's own pushes while it is on screen.
  useEffect(() => {
    setOpenChatRide(rideId ?? null);
    return () => setOpenChatRide(null);
  }, [rideId]);

  const isRider = !!ride && ride.clientId === uid;
  const isDriver = !!ride && ride.driverId === uid;
  const isParty = isRider || isDriver;
  const isOverseer = !isParty && canAccessAdminSection(userProfile);

  const { messages, loading } = useRideMessages(
    isParty || isOverseer ? rideId : undefined,
  );
  const flags = useChatFlags(rideId, isOverseer);

  // Keep my unread count at zero while the chat is on screen.
  const myUnread = (uid && ride?.chatUnread?.[uid]) || 0;
  useEffect(() => {
    if (isParty && uid && rideId && myUnread > 0)
      void markChatRead(rideId, uid);
  }, [isParty, uid, rideId, myUnread]);

  // Re-check the window every 30 s so the input closes on time.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const t = setInterval(() => setNow(Date.now()), 30000);
    return () => clearInterval(t);
  }, []);
  const open = !!ride && isParty && chatIsOpen(ride, now);

  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [sendError, setSendError] = useState<string | null>(null);
  const submit = async (text: string, quick = false) => {
    const t = text.trim();
    if (!t || !rideId || sending) return;
    setSending(true);
    setSendError(null);
    try {
      await sendRideMessage(rideId, t, quick);
      if (!quick) setDraft("");
    } catch (e) {
      setSendError(callableMessage(e, "Couldn't send. Check your connection."));
    } finally {
      setSending(false);
    }
  };

  // Stick to the newest message, also when the keyboard takes the space.
  const list = useRef<ScrollView>(null);
  const count = messages.length;
  useEffect(() => {
    const t = setTimeout(
      () => list.current?.scrollToEnd({ animated: true }),
      60,
    );
    return () => clearTimeout(t);
  }, [count]);
  useEffect(() => {
    const sub = Keyboard.addListener("keyboardDidShow", () =>
      list.current?.scrollToEnd({ animated: true }),
    );
    return () => sub.remove();
  }, []);

  // The screen pads its bottom by the keyboard height (`height` is 0 when
  // closed, negative while open), and the footer gives up its safe-area
  // padding as the keyboard comes up. Measured padding, not a frame-based
  // avoiding view: under a native header the latter left the input hidden.
  const { height: keyboard, progress } = useReanimatedKeyboardAnimation();
  const bottomInset = insets.bottom;
  const rootPad = useAnimatedStyle(() => ({
    paddingBottom: -keyboard.value,
  }));
  const footerPad = useAnimatedStyle(
    () => ({
      paddingBottom: Math.max(spacing.sm, bottomInset * (1 - progress.value)),
    }),
    [bottomInset],
  );

  const other = (() => {
    if (!ride) return { name: "", sub: "" };
    const pickupMain = firstLine(ride.pickup?.address);
    const time = ride.scheduledTime ? formatTime(ride.scheduledTime) : "";
    const rider =
      firstName(ride.passengerName) || ride.clientFirstName || "Rider";
    if (isDriver)
      return {
        name: rider,
        sub: [time && `Pickup ${time}`, pickupMain].filter(Boolean).join(" · "),
      };
    const plateShown = [
      "heading_to_pickup",
      "arrived",
      "in_progress",
      "completed",
    ].includes(ride.status);
    const car = [ride.driverVehicleColor, ride.driverVehicle]
      .filter(Boolean)
      .join(" ");
    if (isRider)
      return {
        name: ride.driverFirstName || "Your driver",
        sub: [car, plateShown && ride.driverPlateNumber]
          .filter(Boolean)
          .join(" · "),
      };
    return {
      name: `${rider} & ${ride.driverFirstName || "driver"}`,
      sub: [time && `Pickup ${time}`, pickupMain].filter(Boolean).join(" · "),
    };
  })();

  const quickReplies = isDriver ? DRIVER_QUICK_REPLIES : RIDER_QUICK_REPLIES;
  const mineBg = colors.primary;
  const theirsBg = scheme === "dark" ? colors.surfaceRaised : colors.surface;

  return (
    <Reanimated.View
      style={[styles.root, { backgroundColor: colors.background }, rootPad]}
    >
      <Stack.Screen
        options={{
          headerTitle: () =>
            ride ? (
              <View style={styles.head}>
                <View
                  style={[styles.avatar, { backgroundColor: colors.secondary }]}
                >
                  <AppText
                    variant="smallStrong"
                    style={{ color: colors.background }}
                  >
                    {initials(other.name)}
                  </AppText>
                </View>
                <View style={styles.headText}>
                  <AppText variant="bodyStrong" numberOfLines={1}>
                    {other.name}
                  </AppText>
                  {other.sub ? (
                    <AppText
                      variant="small"
                      color="textSecondary"
                      numberOfLines={1}
                    >
                      {other.sub}
                    </AppText>
                  ) : null}
                </View>
              </View>
            ) : (
              <AppText variant="bodyStrong">Chat</AppText>
            ),
        }}
      />

      <ScrollView
        ref={list}
        style={styles.flex}
        contentContainerStyle={styles.list}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {missing ? (
          <AppText variant="body" color="textMuted" align="center">
            This ride isn&apos;t available.
          </AppText>
        ) : !ride || (loading && (isParty || isOverseer)) ? (
          <ActivityIndicator color={colors.primary} style={styles.spinner} />
        ) : !isParty && !isOverseer ? (
          <AppText variant="body" color="textMuted" align="center">
            Only the rider and driver can see this chat.
          </AppText>
        ) : (
          <>
            <AppText
              variant="small"
              color="textMuted"
              align="center"
              style={styles.sys}
            >
              {isOverseer
                ? "Admin view (read-only). Masked messages show what was hidden."
                : "Chat opens when the driver starts the trip and closes 15 minutes after it ends. Phone numbers and emails are hidden, and payments go through the app only. Messages are kept with the ride."}
            </AppText>
            {messages.length === 0 ? (
              <AppText variant="small" color="textMuted" align="center">
                No messages yet.
              </AppText>
            ) : null}
            {messages.map((m, i) => {
              const mine = isParty
                ? m.senderId === uid
                : m.senderRole === "driver";
              const prev = messages[i - 1];
              const showTime =
                !prev ||
                new Date(m.createdAt).getTime() -
                  new Date(prev.createdAt).getTime() >
                  5 * 60000;
              const showWho =
                isOverseer && (!prev || prev.senderRole !== m.senderRole);
              const flag = (text: string) => (
                <View style={[styles.flag, mine ? styles.right : styles.left]}>
                  <Ionicons
                    name="warning-outline"
                    size={13}
                    color={colors.textMuted}
                  />
                  <AppText
                    variant="small"
                    color="textMuted"
                    style={styles.flex}
                  >
                    {text}
                  </AppText>
                </View>
              );
              return (
                <React.Fragment key={m.id}>
                  {showTime ? (
                    <AppText
                      variant="small"
                      color="textMuted"
                      align="center"
                      style={styles.time}
                    >
                      {formatTime(m.createdAt)}
                    </AppText>
                  ) : null}
                  {showWho ? (
                    <AppText
                      variant="small"
                      color="textMuted"
                      style={[styles.who, mine ? styles.right : styles.left]}
                    >
                      {m.senderFirstName}
                    </AppText>
                  ) : null}
                  <View
                    style={[
                      styles.bubble,
                      mine
                        ? [styles.bubbleMine, { backgroundColor: mineBg }]
                        : [
                            styles.bubbleTheirs,
                            {
                              backgroundColor: theirsBg,
                              borderColor: colors.border,
                            },
                          ],
                    ]}
                  >
                    <AppText
                      variant="body"
                      style={{ color: mine ? colors.onPrimary : colors.text }}
                    >
                      {m.text}
                    </AppText>
                  </View>
                  {m.masked?.length
                    ? flag(
                        `${maskedLabel(m)}${
                          isOverseer && flags[m.id]
                            ? `: “${flags[m.id].original}”`
                            : ""
                        }`,
                      )
                    : null}
                  {/* Payment talk is flagged, not hidden: the owner sees why,
                      the sender gets a gentle reminder, the other side nothing. */}
                  {m.flagged?.includes("payment") && (isOverseer || mine)
                    ? flag(
                        isOverseer
                          ? "Mentions paying outside the app"
                          : "Payments go through the app only",
                      )
                    : null}
                </React.Fragment>
              );
            })}
          </>
        )}
      </ScrollView>

      {ride && isParty ? (
        <Reanimated.View
          style={[styles.footer, { borderTopColor: colors.border }, footerPad]}
        >
          {open ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                keyboardShouldPersistTaps="handled"
                contentContainerStyle={styles.quick}
              >
                {quickReplies.map((q) => (
                  <Pressable
                    key={q}
                    accessibilityRole="button"
                    disabled={sending}
                    onPress={() => void submit(q, true)}
                    style={({ pressed }) => [
                      styles.chip,
                      {
                        borderColor: colors.border,
                        backgroundColor: pressed
                          ? colors.surfaceRaised
                          : colors.surface,
                        opacity: sending ? 0.6 : 1,
                      },
                    ]}
                  >
                    <AppText variant="smallStrong">{q}</AppText>
                  </Pressable>
                ))}
              </ScrollView>
              {sendError ? (
                <AppText variant="small" color="danger" style={styles.error}>
                  {sendError}
                </AppText>
              ) : null}
              <View style={styles.inputRow}>
                <TextInput
                  value={draft}
                  onChangeText={(t) => setDraft(t.slice(0, MAX))}
                  placeholder="Message…"
                  placeholderTextColor={colors.textMuted}
                  maxLength={MAX}
                  multiline
                  returnKeyType="send"
                  blurOnSubmit={false}
                  onSubmitEditing={() => void submit(draft)}
                  accessibilityLabel="Message"
                  style={[
                    styles.input,
                    {
                      color: colors.text,
                      backgroundColor: colors.surface,
                      borderColor: colors.border,
                    },
                  ]}
                />
                <Pressable
                  accessibilityRole="button"
                  accessibilityLabel="Send"
                  disabled={!draft.trim() || sending}
                  onPress={() => void submit(draft)}
                  style={[
                    styles.send,
                    {
                      backgroundColor: colors.primary,
                      opacity: !draft.trim() || sending ? 0.5 : 1,
                    },
                  ]}
                >
                  {sending ? (
                    <ActivityIndicator color={colors.onPrimary} />
                  ) : (
                    <Ionicons name="send" size={20} color={colors.onPrimary} />
                  )}
                </Pressable>
              </View>
            </>
          ) : (
            <View style={styles.ended}>
              <Ionicons
                name="lock-closed-outline"
                size={16}
                color={colors.textMuted}
              />
              <AppText variant="smallStrong" color="textMuted">
                {[
                  "pending",
                  "accepted",
                  "processing_payment",
                  "confirmed",
                ].includes(ride.status)
                  ? "Chat opens when the driver starts the trip."
                  : "This chat has ended."}
              </AppText>
            </View>
          )}
        </Reanimated.View>
      ) : null}
    </Reanimated.View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  head: { flexDirection: "row", alignItems: "center", gap: 10 },
  avatar: {
    width: 34,
    height: 34,
    borderRadius: 17,
    alignItems: "center",
    justifyContent: "center",
  },
  headText: { gap: 0, flexShrink: 1 },
  list: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    paddingBottom: spacing.lg,
    gap: 6,
  },
  spinner: { marginTop: 40 },
  sys: { marginBottom: spacing.sm, paddingHorizontal: spacing.lg },
  time: { marginTop: spacing.sm, marginBottom: 2 },
  who: { marginTop: 4 },
  bubble: {
    maxWidth: "82%",
    paddingVertical: 9,
    paddingHorizontal: 13,
    borderRadius: 18,
  },
  bubbleMine: { alignSelf: "flex-end", borderBottomRightRadius: 6 },
  bubbleTheirs: {
    alignSelf: "flex-start",
    borderBottomLeftRadius: 6,
    borderWidth: 1,
  },
  flag: {
    flexDirection: "row",
    alignItems: "center",
    gap: 5,
    maxWidth: "82%",
  },
  right: { alignSelf: "flex-end" },
  left: { alignSelf: "flex-start" },
  footer: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingTop: spacing.sm,
    gap: spacing.sm,
  },
  quick: { paddingHorizontal: spacing.screen, gap: spacing.sm },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: radius.pill,
    borderWidth: 1,
  },
  error: { paddingHorizontal: spacing.screen },
  inputRow: {
    flexDirection: "row",
    alignItems: "flex-end",
    gap: spacing.sm,
    paddingHorizontal: spacing.screen,
  },
  input: {
    flex: 1,
    minHeight: 44,
    maxHeight: 120,
    borderRadius: 22,
    borderWidth: 1,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontFamily: fontFamily.medium,
    fontSize: 16,
  },
  send: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: "center",
    justifyContent: "center",
  },
  ended: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 6,
    paddingVertical: spacing.sm,
    paddingHorizontal: spacing.screen,
  },
});
