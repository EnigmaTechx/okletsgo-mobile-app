import { useEffect, useMemo, useState } from "react";
import { ActivityIndicator, Pressable, StyleSheet, View } from "react-native";
import { Ionicons } from "@expo/vector-icons";
import Markdown from "react-native-markdown-display";
import { Screen } from "../../components/ui/Screen";
import { AppText } from "../../components/ui/AppText";
import { useTheme } from "../../contexts/ThemeContext";
import {
  BUILT_IN_TERMS_EFFECTIVE_DATE,
  BUILT_IN_TERMS_MARKDOWN,
} from "../../content/termsOfUse";
import {
  fetchTermsOfUse,
  type RemoteTerms,
} from "../../services/profileService";
import { parseMarkdownSections } from "../../utils/terms";
import { fontFamily, radius, spacing, typography } from "../../theme/tokens";

/**
 * Terms of Use: the admin-managed markdown in config/termsOfUse, or the
 * built-in copy when that is missing. Sections (level-2 headings) collapse
 * like the Ionic page's accordion; a document without sections renders whole.
 */
export default function TermsOfUse() {
  const { colors } = useTheme();
  const [remote, setRemote] = useState<RemoteTerms | null | undefined>(
    undefined,
  );
  const [open, setOpen] = useState<Record<number, boolean>>({ 0: true });

  useEffect(() => {
    let active = true;
    fetchTermsOfUse().then((t) => {
      if (active) setRemote(t);
    });
    return () => {
      active = false;
    };
  }, []);

  const markdown = remote?.markdown ?? BUILT_IN_TERMS_MARKDOWN;
  const effectiveDate = remote?.effectiveDate ?? BUILT_IN_TERMS_EFFECTIVE_DATE;
  const sections = useMemo(() => parseMarkdownSections(markdown), [markdown]);

  const mdStyle = useMemo(
    () => ({
      body: { ...typography.body, color: colors.textSecondary },
      paragraph: { marginTop: 0, marginBottom: spacing.md },
      strong: { fontFamily: fontFamily.bold, color: colors.text },
      em: { fontStyle: "italic" as const },
      heading1: {
        ...typography.title,
        color: colors.text,
        marginBottom: spacing.md,
      },
      heading2: {
        ...typography.heading,
        color: colors.text,
        marginBottom: spacing.sm,
      },
      heading3: {
        ...typography.bodyStrong,
        color: colors.text,
        marginBottom: spacing.sm,
      },
      bullet_list: { marginBottom: spacing.md },
      list_item: { marginBottom: spacing.xs },
      bullet_list_icon: { color: colors.textMuted },
      link: { color: colors.secondary },
      hr: { backgroundColor: colors.border },
    }),
    [colors],
  );

  if (remote === undefined) {
    return (
      <Screen edges={["left", "right"]}>
        <View style={styles.loading}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="small" color="textMuted">
            Loading terms…
          </AppText>
        </View>
      </Screen>
    );
  }

  return (
    <Screen scroll edges={["left", "right"]}>
      <AppText variant="small" color="textMuted" style={styles.date}>
        Effective date: {effectiveDate}
      </AppText>

      {sections.length === 0 ? (
        <Markdown style={mdStyle}>{markdown}</Markdown>
      ) : (
        sections.map((s, i) => {
          const expanded = !!open[i];
          return (
            <View
              key={s.heading}
              style={[
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded }}
                onPress={() => setOpen((cur) => ({ ...cur, [i]: !cur[i] }))}
                style={styles.cardHeader}
              >
                <AppText variant="bodyStrong" style={styles.cardTitle}>
                  {s.heading}
                </AppText>
                <Ionicons
                  name={expanded ? "chevron-up" : "chevron-down"}
                  size={18}
                  color={colors.textMuted}
                />
              </Pressable>
              {expanded ? (
                <View style={styles.cardBody}>
                  <Markdown style={mdStyle}>{s.body}</Markdown>
                </View>
              ) : null}
            </View>
          );
        })
      )}
    </Screen>
  );
}

const styles = StyleSheet.create({
  loading: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.md,
  },
  date: { paddingVertical: spacing.lg },
  card: {
    borderWidth: 1,
    borderRadius: radius.md,
    marginBottom: spacing.sm,
    overflow: "hidden",
  },
  cardHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.lg,
    paddingVertical: spacing.md,
  },
  cardTitle: { flex: 1 },
  cardBody: { paddingHorizontal: spacing.lg, paddingBottom: spacing.sm },
});
