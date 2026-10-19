import React, { useRef, useState } from "react";
import { FlatList, StyleSheet, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { AppText } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { Logo } from "../../components/ui/Logo";
import { useTheme } from "../../contexts/ThemeContext";
import { useOnboardingSeen } from "../../hooks/useOnboardingSeen";
import { spacing } from "../../theme/tokens";

// The same three slides as the Ionic app. Slide art: one real photo of a local
// street (per Andy), dropped in as assets/images/onboarding-*.jpg in phase 1.
const SLIDES = [
  {
    key: "welcome",
    eyebrow: "WELCOME",
    heading: "Your city. Your ride. Your way.",
    body: "Fast, reliable rides across Kitchener, Waterloo and Toronto.",
  },
  {
    key: "book",
    eyebrow: "BOOK IN SECONDS",
    heading: "Pick your driver, not just a car.",
    body: "Enter your destination, choose from the drivers online, and you're on your way.",
  },
  {
    key: "track",
    eyebrow: "TRACK LIVE",
    heading: "Know exactly when they'll arrive.",
    body: "Follow your driver on the map from pickup to drop-off.",
  },
];

export default function Onboarding() {
  const router = useRouter();
  const { colors } = useTheme();
  const { width } = useWindowDimensions();
  const { markSeen } = useOnboardingSeen();
  const [index, setIndex] = useState(0);
  const listRef = useRef<FlatList>(null);

  const finish = () => {
    markSeen();
    router.replace("/(auth)/welcome");
  };

  const next = () => {
    if (index >= SLIDES.length - 1) return finish();
    listRef.current?.scrollToIndex({ index: index + 1, animated: true });
  };

  return (
    <Screen padded={false} edges={["top", "bottom", "left", "right"]}>
      <FlatList
        ref={listRef}
        data={SLIDES}
        keyExtractor={(s) => s.key}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) =>
          setIndex(Math.round(e.nativeEvent.contentOffset.x / width))
        }
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.art, { backgroundColor: colors.surfaceRaised }]}>
              <Logo width={240} />
            </View>
            <View style={styles.copy}>
              <AppText variant="eyebrow" color="success">
                {item.eyebrow}
              </AppText>
              <AppText variant="display" style={styles.heading}>
                {item.heading}
              </AppText>
              <AppText variant="body" color="textSecondary">
                {item.body}
              </AppText>
            </View>
          </View>
        )}
      />
      <View style={styles.dots}>
        {SLIDES.map((s, i) => (
          <View
            key={s.key}
            style={[
              styles.dot,
              { backgroundColor: i === index ? colors.primary : colors.border, width: i === index ? 22 : 8 },
            ]}
          />
        ))}
      </View>
      <View style={styles.actions}>
        <Button title={index === SLIDES.length - 1 ? "Get started" : "Next"} onPress={next} />
        <Button title="Skip" variant="ghost" onPress={finish} />
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  slide: { flex: 1 },
  art: { height: 360, alignItems: "center", justifyContent: "center" },
  copy: { paddingHorizontal: 28, paddingTop: 30, gap: spacing.md },
  heading: { marginTop: spacing.xs },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: spacing.xl },
  dot: { height: 8, borderRadius: 4 },
  actions: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm },
});
