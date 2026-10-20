import { Image, StyleSheet, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { fontFamily } from "../../theme/tokens";
import { AppText } from "./AppText";

interface Props {
  firstName?: string;
  lastName?: string;
  photoUrl?: string;
  size?: number;
  /** Ring colour: blue for riders, orange for drivers. */
  tint?: string;
}

/** Initials on a tinted ring, or the profile photo when one is set. */
export function Avatar({
  firstName,
  lastName,
  photoUrl,
  size = 72,
  tint,
}: Props) {
  const { colors } = useTheme();
  const ring = tint ?? colors.secondary;
  const initials =
    `${firstName?.charAt(0) ?? ""}${lastName?.charAt(0) ?? ""}`.toUpperCase() ||
    "?";
  return (
    <View
      style={[
        styles.ring,
        {
          width: size,
          height: size,
          borderRadius: size / 2,
          borderColor: ring,
          backgroundColor: colors.surface,
        },
      ]}
    >
      {photoUrl ? (
        <Image
          source={{ uri: photoUrl }}
          style={{
            width: size - 6,
            height: size - 6,
            borderRadius: (size - 6) / 2,
          }}
          accessibilityLabel="Profile photo"
        />
      ) : (
        <AppText
          style={{
            fontFamily: fontFamily.extrabold,
            fontSize: size * 0.34,
            color: ring,
          }}
        >
          {initials}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  ring: { borderWidth: 2, alignItems: "center", justifyContent: "center" },
});
