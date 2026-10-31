import { StyleSheet, View } from "react-native";
import { useTheme } from "../../contexts/ThemeContext";
import { splitAddress } from "../../utils/address";
import { fontFamily, spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";

/** Text sizes: "lg" for the driver's request sheet, "md" for the active and
 *  rider sheets (the Ionic app's compact cards), "sm" for list rows. */
export type RouteSize = "lg" | "md" | "sm";

interface Props {
  pickup?: string | null;
  dropoff?: string | null;
  /** Right-hand column per row (a time, a tag). */
  pickupAside?: React.ReactNode;
  dropoffAside?: React.ReactNode;
  /** Appended to the sub line: "Mississauga · 3.2 km to pickup". */
  pickupSuffix?: string | null;
  dropoffSuffix?: string | null;
  /** A small control after the pickup sub line (the rider's "Edit time"). */
  pickupAfter?: React.ReactNode;
  size?: RouteSize;
  /** @deprecated use size="md" */
  compact?: boolean;
}

const MAIN_SIZE: Record<RouteSize, number> = { lg: 18, md: 15, sm: 15 };
const SUB_SIZE: Record<RouteSize, number> = { lg: 14, md: 13, sm: 12 };

/**
 * The two-stop route: blue pickup dot, a gradient-coloured line, orange
 * drop-off dot, each address split into its street line and the rest.
 */
export function RouteTimeline({
  pickup,
  dropoff,
  pickupAside,
  dropoffAside,
  pickupSuffix,
  dropoffSuffix,
  pickupAfter,
  size,
  compact = false,
}: Props) {
  const { colors } = useTheme();
  const a = splitAddress(pickup);
  const b = splitAddress(dropoff);
  const s: RouteSize = size ?? (compact ? "md" : "lg");
  const gap = s === "lg" ? spacing.xl : spacing.md;
  return (
    <View style={styles.row}>
      <View style={styles.rail}>
        <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
        <View style={styles.lineWrap}>
          <View
            style={[styles.lineTop, { backgroundColor: colors.secondary }]}
          />
          <View
            style={[styles.lineBottom, { backgroundColor: colors.primary }]}
          />
        </View>
        <View style={[styles.dot, { backgroundColor: colors.primary }]} />
      </View>
      <View style={styles.stops}>
        <Stop
          main={a.main}
          sub={a.sub}
          suffix={pickupSuffix}
          after={pickupAfter}
          aside={pickupAside}
          bottom={gap}
          size={s}
        />
        <Stop
          main={b.main}
          sub={b.sub}
          suffix={dropoffSuffix}
          aside={dropoffAside}
          bottom={0}
          size={s}
        />
      </View>
    </View>
  );
}

function Stop({
  main,
  sub,
  suffix,
  after,
  aside,
  bottom,
  size,
}: {
  main: string;
  sub: string;
  suffix?: string | null;
  after?: React.ReactNode;
  aside?: React.ReactNode;
  bottom: number;
  size: RouteSize;
}) {
  const { colors } = useTheme();
  const subLine = [sub, suffix].filter(Boolean).join(" · ");
  return (
    <View style={[styles.stop, { paddingBottom: bottom }]}>
      <View style={styles.text}>
        <AppText
          style={[
            styles.main,
            { fontSize: MAIN_SIZE[size], lineHeight: MAIN_SIZE[size] * 1.35 },
          ]}
          numberOfLines={2}
        >
          {main || "—"}
        </AppText>
        {subLine || after ? (
          <View style={styles.subRow}>
            {subLine ? (
              <AppText
                style={[
                  styles.sub,
                  {
                    color: colors.textMuted,
                    fontSize: SUB_SIZE[size],
                    lineHeight: SUB_SIZE[size] * 1.4,
                  },
                ]}
                numberOfLines={2}
              >
                {subLine}
              </AppText>
            ) : null}
            {after}
          </View>
        ) : null}
      </View>
      {aside ? <View style={styles.aside}>{aside}</View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: "row", gap: spacing.md },
  rail: { width: 14, alignItems: "center", paddingTop: 4 },
  dot: { width: 13, height: 13, borderRadius: 7 },
  lineWrap: { flex: 1, width: 3, marginVertical: 4, minHeight: 18 },
  lineTop: { flex: 1, width: 3 },
  lineBottom: { flex: 1, width: 3 },
  stops: { flex: 1 },
  stop: { flexDirection: "row", alignItems: "flex-start", gap: spacing.md },
  text: { flex: 1, gap: 2 },
  main: { fontFamily: fontFamily.bold },
  subRow: {
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  sub: { fontFamily: fontFamily.semibold, flexShrink: 1 },
  aside: { alignItems: "flex-end" },
});
