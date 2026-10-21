import React, {
  forwardRef,
  useEffect,
  useImperativeHandle,
  useRef,
} from "react";
import { Platform, StyleSheet, View, type ViewStyle } from "react-native";
import MapView, {
  Marker,
  Polyline,
  PROVIDER_GOOGLE,
  type Region,
} from "react-native-maps";
import { Ionicons } from "@expo/vector-icons";
import Constants from "expo-constants";
import { useTheme } from "../../contexts/ThemeContext";
import { spacing } from "../../theme/tokens";
import { AppText } from "../ui/AppText";
import type { LatLng } from "../../utils/geo";
import { DARK_MAP_STYLE } from "./mapStyles";

/** Kitchener–Waterloo: where the map opens before anything is known. */
export const DEFAULT_CENTER: LatLng = { lat: 43.4643, lng: -80.5204 };

export interface RouteLine {
  coords: LatLng[];
  color: string;
  width?: number;
}

export interface RideMapHandle {
  /** Animate to a point (zoomed in). */
  focus: (point: LatLng, zoomDelta?: number) => void;
  /** Fit every given point in view. */
  fit: (points: LatLng[]) => void;
}

interface Props {
  pickup?: LatLng | null;
  dropoff?: LatLng | null;
  driver?: LatLng | null;
  /** The rider's own position (blue dot). */
  me?: LatLng | null;
  routes?: RouteLine[];
  /** Points to keep framed; defaults to pickup + dropoff + driver. */
  frame?: LatLng[];
  /** Re-frame whenever these points change (default: only the first time). */
  followFrame?: boolean;
  interactive?: boolean;
  /** Extra space under the framed points, e.g. for a bottom panel. */
  bottomPadding?: number;
  style?: ViewStyle;
}

const region = (p: LatLng, delta = 0.02): Region => ({
  latitude: p.lat,
  longitude: p.lng,
  latitudeDelta: delta,
  longitudeDelta: delta,
});

const toCoord = (p: LatLng) => ({ latitude: p.lat, longitude: p.lng });

/**
 * Google Maps on Android refuses to start without a manifest key, and the
 * crash takes the whole app with it. The key is baked in at prebuild from
 * `.env` (docs/PHASE2.md); app.config.ts records whether it was present.
 */
const NATIVE_MAP_AVAILABLE =
  Platform.OS !== "android" ||
  Constants.expoConfig?.extra?.googleMapsAndroidKeySet === true;

/**
 * The one map used by booking, the live ride and previews: brand-coloured
 * pins (blue pickup, orange drop-off), the driver's car, the rider's dot and
 * any number of route lines. Google on Android, Apple on iOS.
 */
export const RideMap = forwardRef<RideMapHandle, Props>(function RideMap(
  {
    pickup,
    dropoff,
    driver,
    me,
    routes = [],
    frame,
    followFrame = false,
    interactive = true,
    bottomPadding = 0,
    style,
  },
  ref,
) {
  const { colors, scheme } = useTheme();
  const map = useRef<MapView>(null);
  const framedOnce = useRef(false);

  const framePoints = frame ?? [pickup, dropoff, driver].filter(isPoint);
  const frameKey = framePoints
    .map((p) => `${p.lat.toFixed(4)},${p.lng.toFixed(4)}`)
    .join("|");

  const fit = (points: LatLng[]) => {
    if (!map.current || points.length === 0) return;
    if (points.length === 1) {
      map.current.animateToRegion(region(points[0], 0.015), 600);
      return;
    }
    map.current.fitToCoordinates(points.map(toCoord), {
      edgePadding: { top: 80, right: 60, bottom: 60 + bottomPadding, left: 60 },
      animated: true,
    });
  };

  useImperativeHandle(ref, () => ({
    focus: (point, delta = 0.01) =>
      map.current?.animateToRegion(region(point, delta), 700),
    fit,
  }));

  useEffect(() => {
    if (framePoints.length === 0) return;
    if (!followFrame && framedOnce.current) return;
    framedOnce.current = true;
    // Give the native map a frame to lay out before fitting.
    const t = setTimeout(() => fit(framePoints), 250);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [frameKey, followFrame]);

  const initial = framePoints[0] ?? pickup ?? me ?? DEFAULT_CENTER;

  if (!NATIVE_MAP_AVAILABLE) {
    return (
      <View
        style={[
          styles.root,
          styles.unavailable,
          { backgroundColor: colors.surfaceRaised },
          style,
        ]}
      >
        <Ionicons name="map-outline" size={32} color={colors.textMuted} />
        <AppText variant="small" color="textMuted" align="center">
          Map unavailable: add EXPO_PUBLIC_GOOGLE_MAPS_API_KEY to .env and run
          prebuild again.
        </AppText>
      </View>
    );
  }

  return (
    <View
      style={[styles.root, { backgroundColor: colors.surfaceRaised }, style]}
    >
      <MapView
        ref={map}
        style={StyleSheet.absoluteFill}
        provider={Platform.OS === "android" ? PROVIDER_GOOGLE : undefined}
        initialRegion={region(initial, 0.03)}
        customMapStyle={scheme === "dark" ? DARK_MAP_STYLE : []}
        userInterfaceStyle={scheme}
        scrollEnabled={interactive}
        zoomEnabled={interactive}
        rotateEnabled={false}
        pitchEnabled={false}
        showsCompass={false}
        showsPointsOfInterests={false}
        toolbarEnabled={false}
        onMapReady={() => {
          if (framePoints.length > 0) fit(framePoints);
        }}
      >
        {routes.map((r, i) =>
          r.coords.length > 1 ? (
            <Polyline
              key={i}
              coordinates={r.coords.map(toCoord)}
              strokeColor={r.color}
              strokeWidth={r.width ?? 5}
              lineCap="round"
              lineJoin="round"
            />
          ) : null,
        )}
        {me ? (
          <Marker
            coordinate={toCoord(me)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View
              style={[
                styles.dot,
                styles.meDot,
                { backgroundColor: colors.secondary },
              ]}
            />
          </Marker>
        ) : null}
        {pickup ? (
          <Marker
            coordinate={toCoord(pickup)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={[styles.dot, { backgroundColor: colors.secondary }]} />
          </Marker>
        ) : null}
        {dropoff ? (
          <Marker
            coordinate={toCoord(dropoff)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={[styles.dot, { backgroundColor: colors.primary }]} />
          </Marker>
        ) : null}
        {driver ? (
          <Marker
            coordinate={toCoord(driver)}
            anchor={{ x: 0.5, y: 0.5 }}
            tracksViewChanges={false}
          >
            <View style={[styles.car, { borderColor: colors.primary }]}>
              <Ionicons name="car" size={22} color={colors.primary} />
            </View>
          </Marker>
        ) : null}
      </MapView>
    </View>
  );
});

const isPoint = (p: LatLng | null | undefined): p is LatLng => !!p;

const styles = StyleSheet.create({
  root: { overflow: "hidden" },
  unavailable: {
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    padding: spacing.xl,
  },
  dot: {
    width: 18,
    height: 18,
    borderRadius: 9,
    borderWidth: 3,
    borderColor: "#FFFFFF",
    shadowColor: "#000",
    shadowOpacity: 0.3,
    shadowRadius: 3,
    shadowOffset: { width: 0, height: 1 },
    elevation: 3,
  },
  meDot: { width: 16, height: 16, borderRadius: 8, opacity: 0.9 },
  car: {
    width: 42,
    height: 42,
    borderRadius: 21,
    borderWidth: 2.5,
    backgroundColor: "#FFFFFF",
    alignItems: "center",
    justifyContent: "center",
    shadowColor: "#000",
    shadowOpacity: 0.28,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 3 },
    elevation: 5,
  },
});
