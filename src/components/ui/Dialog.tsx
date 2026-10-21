import React from "react";
import {
  KeyboardAvoidingView,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { radius, spacing } from "../../theme/tokens";
import { useOverlayOpen } from "./overlayState";

interface Props {
  visible: boolean;
  /** Called on back / backdrop; omit to make the dialog modal. */
  onClose?: () => void;
  children: React.ReactNode;
}

/**
 * A centred card over a dim backdrop, for the rating prompt and the
 * ride-outcome notice (Ionic's branded modals). KeyboardAvoidingView is
 * fine here: the card is short and floats, so nothing ends up under the
 * keyboard the way a full form would.
 */
export function Dialog({ visible, onClose, children }: Props) {
  const { colors } = useTheme();
  useOverlayOpen(visible);
  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      statusBarTranslucent
      onRequestClose={() => onClose?.()}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        style={styles.root}
      >
        <Pressable
          style={[styles.backdrop, { backgroundColor: colors.backdrop }]}
          onPress={() => onClose?.()}
          accessibilityLabel="Close"
        />
        <View
          style={[
            styles.card,
            { backgroundColor: colors.background, borderColor: colors.border },
          ]}
        >
          <ScrollView
            bounces={false}
            keyboardShouldPersistTaps="handled"
            contentContainerStyle={styles.content}
          >
            {children}
          </ScrollView>
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, alignItems: "center", justifyContent: "center" },
  backdrop: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  card: {
    width: "90%",
    maxWidth: 400,
    maxHeight: "85%",
    borderRadius: radius.xl,
    borderWidth: 1,
    overflow: "hidden",
  },
  content: {
    paddingHorizontal: spacing.xl,
    paddingTop: spacing.xxl,
    paddingBottom: spacing.xl,
    alignItems: "center",
    gap: spacing.sm,
  },
});
