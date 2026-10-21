import { StyleSheet, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { splitAddress } from "../../utils/address";
import { spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

interface Props {
  pickup?: string | null;
  dropoff?: string | null;
  /** Right-hand column per row (a time, a tag). */
  pickupAside?: React.ReactNode;
  dropoffAside?: React.ReactNode;
  compact?: boolean;
}

/**
 * The two-stop route: blue pickup dot, a line, orange drop-off dot, with
 * each address split into its street line and the rest.
 */
export function RouteTimeline({
  pickup,
  dropoff,
  pickupAside,
  dropoffAside,
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const a = splitAddress(pickup);
  const b = splitAddress(dropoff);
  const gap = compact ? spacing.md : spacing.lg;
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
        <View style={[styles.line, { backgroundColor: colors.border }]} />
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      </View>
      <View style={styles.stops}>
        <Stop
          main={a.main}
          sub={a.sub}
          aside={pickupAside}
          bottom={gap}
          compact={compact}
        />
        <Stop
          main={b.main}
          sub={b.sub}
          aside={dropoffAside}
          bottom={0}
          compact={compact}
        />
      </View>
    </View>
  );
}

function Stop({
  main,
  sub,
  aside,
  bottom,
  compact,
}: {
  main: string;
  sub: string;
  aside?: React.ReactNode;
  bottom: number;
  compact: boolean;
}) {
  return (
    <View style={[styles.stop, { paddingBottom: bottom }]}>
      <View style={styles.text}>
        <AppText
          variant={compact ? "smallStrong" : "bodyStrong"}
          numberOfLines={2}
        >
          {main || "—"}
        </AppText>
        {sub ? (
          <AppText variant="small" color="textMuted" numberOfLines={1}>
            {sub}
          </AppText>
        ) : null}
      </View>
      {aside ? <View style={styles.aside}>{aside}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md },
  rail: { width: 14, alignItems: "center", paddingTop: 5 },
  dot: { width: 12, height: 12, borderRadius: 6 },
  line: { flex: 1, width: 2, marginVertical: 4, minHeight: 18 },
  stops: { flex: 1 },
  stop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  text: { flex: 1, gap: 1 },
  aside: { alignItems: "flex-end" },
});
