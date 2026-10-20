import React, { useRef, useState } from "react";
import { FlatList, Image, type ImageSourcePropType, StyleSheet, useWindowDimensions, View } from "react-native";
import { useRouter } from "expo-router";
import { Screen } from "../../components/ui/Screen";
import { AppText } from "../../components/ui/AppText";
import { Button } from "../../components/ui/Button";
import { Logo } from "../../components/ui/Logo";
import { useTheme } from "../../contexts/ThemeContext";
import { useOnboardingSeen } from "../../hooks/useOnboardingSeen";
import { radius, spacing } from "../../theme/tokens";

// The same three slides as the Ionic app, each with a full-bleed photo and the
// logo over it. The files in assets/images/onboarding/ are generated
// placeholders (a night skyline in the brand palette); replace them with real
// photos of local streets under the same names, 1200 × 900 or larger, 4:3.
// Free-to-use sources: Unsplash or Pexels (both allow commercial use without
// attribution). Keep the file names so no code changes.
const SLIDES: {
  key: string;
  image: ImageSourcePropType;
  eyebrow: string;
  heading: string;
  body: string;
}[] = [
  {
    key: "welcome",
    image: require("../../../assets/images/onboarding/welcome.jpg"),
    eyebrow: "WELCOME",
    heading: "Your city. Your ride. Your way.",
    body: "Fast, reliable rides across Kitchener, Waterloo and Toronto.",
  },
  {
    key: "book",
    image: require("../../../assets/images/onboarding/book.jpg"),
    eyebrow: "BOOK IN SECONDS",
    heading: "Pick your driver, not just a car.",
    body: "Enter your destination, choose from the drivers online, and you're on your way.",
  },
  {
    key: "track",
    image: require("../../../assets/images/onboarding/track.jpg"),
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
        bounces={false}
        showsHorizontalScrollIndicator={false}
        onMomentumScrollEnd={(e) => setIndex(Math.round(e.nativeEvent.contentOffset.x / width))}
        renderItem={({ item }) => (
          <View style={[styles.slide, { width }]}>
            <View style={[styles.art, { backgroundColor: colors.surfaceRaised }]}>
              <Image source={item.image} resizeMode="cover" style={styles.photo} accessible={false} />
              <View style={styles.logoBadge}>
                <Logo width={150} />
              </View>
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
  art: {
    height: 360,
    marginHorizontal: spacing.lg,
    marginTop: spacing.sm,
    borderRadius: radius.xxl,
    overflow: "hidden",
  },
  photo: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0, width: undefined, height: undefined },
  logoBadge: {
    position: "absolute",
    left: spacing.lg,
    bottom: spacing.lg,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
    borderRadius: radius.md,
    backgroundColor: "rgba(11, 18, 32, 0.55)",
  },
  copy: { paddingHorizontal: 28, paddingTop: 26, gap: spacing.md },
  heading: { marginTop: spacing.xs },
  dots: { flexDirection: "row", justifyContent: "center", gap: 8, marginBottom: spacing.xl },
  dot: { height: 8, borderRadius: 4 },
  actions: { paddingHorizontal: spacing.xl, paddingBottom: spacing.lg, gap: spacing.sm },
});
