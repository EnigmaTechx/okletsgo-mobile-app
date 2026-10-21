import { useEffect, useRef, useState } from "react";
import {
  ActivityIndicator,
  Keyboard,
  Pressable,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useBooking } from "../../../components/booking/BookingContext";
import { RideMap } from "../../../components/map/RideMap";
import { AppText } from "../../../components/ui/AppText";
import { Button } from "../../../components/ui/Button";
import { Screen } from "../../../components/ui/Screen";
import { showAlert } from "../../../components/ui/alerts";
import { useAuth } from "../../../contexts/AuthContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { useDrivingRoute } from "../../../hooks/useDrivingRoute";
import { getCurrentPlace } from "../../../hooks/useGeolocation";
import {
  usePlaceSearch,
  type PickedPlace,
} from "../../../hooks/usePlaceSearch";
import { drivingDistanceKm, hasMapsKey } from "../../../services/googleMaps";
import {
  getRecentPlaces,
  type RecentPlace,
} from "../../../services/rideService";
import {
  subscribeSavedPlaces,
  type SavedPlace,
} from "../../../services/savedPlacesService";
import { isSamePlace } from "../../../utils/address";
import {
  calculateFare,
  getActivePricing,
  isPricingReady,
  onPricingReady,
} from "../../../utils/fareCalculator";
import { cad } from "../../../utils/money";
import { formatPredictionText } from "../../../utils/places";
import { fontFamily, radius, spacing } from "../../../theme/tokens";

type Field = "pickup" | "destination";

const quoteKeyFor = (a: PickedPlace, b: PickedPlace) =>
  `${a.lat},${a.lng}>${b.lat},${b.lng}`;

/**
 * Step 1 of 4: where from, where to. Typing searches Ontario addresses;
 * an empty field offers current location, saved places and recent trips.
 * With both ends set the fare is quoted on Google's driving distance and
 * the route is previewed on the map.
 */
export default function BookLocations() {
  const router = useRouter();
  const { colors } = useTheme();
  const { currentUser } = useAuth();
  const { draft, update } = useBooking();

  const [pickup, setPickup] = useState<PickedPlace | null>(draft.pickup);
  const [destination, setDestination] = useState<PickedPlace | null>(
    draft.destination,
  );
  const [active, setActive] = useState<Field | null>(null);
  const [savedPlaces, setSavedPlaces] = useState<SavedPlace[]>([]);
  const [recent, setRecent] = useState<RecentPlace[]>([]);
  const [locating, setLocating] = useState(false);
  const [pricingReady, setPricingReady] = useState(isPricingReady);
  const [quoteResult, setQuoteResult] = useState<{
    key: string;
    quote: { distanceKm: number; fare: number } | null;
    error: string | null;
  } | null>(
    draft.pickup && draft.destination && draft.distanceKm && draft.fare
      ? {
          key: quoteKeyFor(draft.pickup, draft.destination),
          quote: { distanceKm: draft.distanceKm, fare: draft.fare },
          error: null,
        }
      : null,
  );

  const pickupSearch = usePlaceSearch();
  const destSearch = usePlaceSearch();
  const pickupInput = useRef<TextInput>(null);
  const destInput = useRef<TextInput>(null);

  // Prefill the fields when returning from a later step.
  useEffect(() => {
    if (draft.pickup) pickupSearch.seed(draft.pickup.address);
    if (draft.destination) destSearch.seed(draft.destination.address);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => onPricingReady(() => setPricingReady(true)), []);

  useEffect(() => {
    if (!currentUser) return;
    const unsub = subscribeSavedPlaces(currentUser.uid, setSavedPlaces);
    getRecentPlaces(currentUser.uid).then(setRecent);
    return unsub;
  }, [currentUser]);

  // Quote once both ends are known and the admin pricing has loaded.
  const quoteKey =
    pickup && destination ? quoteKeyFor(pickup, destination) : null;
  useEffect(() => {
    if (!pickup || !destination || !quoteKey || !pricingReady) return;
    let activeReq = true;
    drivingDistanceKm(pickup, destination)
      .then((km) => {
        if (!activeReq) return;
        setQuoteResult(
          km === null
            ? {
                key: quoteKey,
                quote: null,
                error:
                  "We couldn't find a driving route between those two places.",
              }
            : {
                key: quoteKey,
                quote: { distanceKm: km, fare: calculateFare(km) },
                error: null,
              },
        );
      })
      .catch((err: unknown) => {
        if (!activeReq) return;
        console.warn("Distance lookup failed:", err);
        setQuoteResult({
          key: quoteKey,
          quote: null,
          error: "We couldn't price this trip right now. Please try again.",
        });
      });
    return () => {
      activeReq = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [quoteKey, pricingReady]);
  const settled = !!quoteKey && quoteResult?.key === quoteKey;
  const quote = settled ? quoteResult.quote : null;
  const quoteError = settled ? quoteResult.error : null;
  const quoting = !!quoteKey && (!pricingReady || !settled);

  const route = useDrivingRoute(pickup, destination);

  const search = active === "pickup" ? pickupSearch : destSearch;
  const setPlace = (field: Field, place: PickedPlace | null) => {
    if (field === "pickup") {
      setPickup(place);
      pickupSearch.seed(place?.address ?? "");
    } else {
      setDestination(place);
      destSearch.seed(place?.address ?? "");
    }
  };
  const close = () => {
    setActive(null);
    Keyboard.dismiss();
  };
  const choose = (place: PickedPlace) => {
    if (!active) return;
    setPlace(active, place);
    close();
  };

  const onType = (field: Field, text: string) => {
    (field === "pickup" ? pickupSearch : destSearch).setQuery(text);
    if (field === "pickup" && pickup && text !== pickup.address)
      setPickup(null);
    if (field === "destination" && destination && text !== destination.address)
      setDestination(null);
  };

  const pickPrediction = async (p: (typeof search.predictions)[number]) => {
    const field = active;
    if (!field) return;
    const place = await search.pick(p);
    if (place) setPlace(field, place);
    else
      showAlert(
        "Address unavailable",
        "We couldn't locate that address. Please try another.",
      );
    close();
  };

  const fillCurrentLocation = async () => {
    setLocating(true);
    try {
      const place = await getCurrentPlace();
      if (place) choose(place);
      else
        showAlert(
          "Location unavailable",
          "Allow location access in Settings, or type your pickup address.",
        );
    } catch (err) {
      console.warn("Current location failed:", err);
      showAlert(
        "Location unavailable",
        "We couldn't get a GPS fix. Please type your pickup address.",
      );
    } finally {
      setLocating(false);
    }
  };

  const next = () => {
    if (!pickup || !destination || !quote) return;
    if (isSamePlace(pickup, destination)) {
      showAlert(
        "Same pickup and drop-off",
        "Your pickup and drop-off addresses are the same. Please change one of them.",
      );
      return;
    }
    update({
      pickup,
      destination,
      distanceKm: quote.distanceKm,
      fare: quote.fare,
    });
    router.push("/(ride)/book/schedule");
  };

  const savedKeys = new Set(
    savedPlaces.map((p) => p.address.trim().toLowerCase()),
  );
  const recentSuggestions = recent.filter(
    (r) => !savedKeys.has(r.address.trim().toLowerCase()),
  );
  const typed = search.query.trim().length >= 2;
  const showPredictions = !!active && typed;
  const showQuickPick = !!active && !typed;
  const minFare = getActivePricing().minFare;
  const minKm = getActivePricing().minKm;
  const canNext = !!pickup && !!destination && !!quote && !quoting;

  const fieldStyle = (field: Field) => [
    styles.field,
    {
      backgroundColor: colors.background,
      borderColor: active === field ? colors.secondary : colors.border,
    },
  ];

  return (
    <Screen scroll edges={["left", "right"]} padded={false}>
      {!hasMapsKey() ? (
        <View style={[styles.banner, { backgroundColor: colors.dangerSoft }]}>
          <AppText variant="small" color="danger">
            Address search is not configured in this build (missing Google Maps
            key).
          </AppText>
        </View>
      ) : null}

      <View style={styles.body}>
        <View
          style={[
            styles.card,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}
        >
          <View style={fieldStyle("pickup")}>
            <Ionicons
              name="radio-button-on"
              size={20}
              color={colors.secondary}
            />
            <TextInput
              ref={pickupInput}
              value={pickupSearch.query}
              onChangeText={(t) => onType("pickup", t)}
              onFocus={() => setActive("pickup")}
              placeholder="Pickup location"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              autoCorrect={false}
              style={[styles.input, { color: colors.text }]}
            />
            {pickupSearch.query ? (
              <Pressable
                accessibilityLabel="Clear pickup"
                hitSlop={8}
                onPress={() => {
                  setPlace("pickup", null);
                  pickupSearch.clear();
                  setActive("pickup");
                  pickupInput.current?.focus();
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            ) : null}
          </View>
          <View style={fieldStyle("destination")}>
            <Ionicons name="radio-button-on" size={20} color={colors.primary} />
            <TextInput
              ref={destInput}
              value={destSearch.query}
              onChangeText={(t) => onType("destination", t)}
              onFocus={() => setActive("destination")}
              placeholder="Where are you going?"
              placeholderTextColor={colors.textMuted}
              returnKeyType="search"
              autoCorrect={false}
              style={[styles.input, { color: colors.text }]}
            />
            {destSearch.query ? (
              <Pressable
                accessibilityLabel="Clear destination"
                hitSlop={8}
                onPress={() => {
                  setPlace("destination", null);
                  destSearch.clear();
                  setActive("destination");
                  destInput.current?.focus();
                }}
              >
                <Ionicons
                  name="close-circle"
                  size={20}
                  color={colors.textMuted}
                />
              </Pressable>
            ) : null}
          </View>
        </View>

        {active ? (
          <View
            style={[
              styles.suggestions,
              { backgroundColor: colors.surface, borderColor: colors.border },
            ]}
          >
            {showQuickPick && active === "pickup" ? (
              <SuggestionRow
                icon="navigate"
                tint={colors.secondary}
                title="Use current location"
                busy={locating}
                onPress={() => void fillCurrentLocation()}
              />
            ) : null}
            {showQuickPick
              ? savedPlaces.map((p) => (
                  <SuggestionRow
                    key={p.id}
                    icon="bookmark"
                    tint={
                      active === "pickup" ? colors.secondary : colors.primary
                    }
                    title={p.label}
                    subtitle={p.address}
                    onPress={() =>
                      choose({ address: p.address, lat: p.lat, lng: p.lng })
                    }
                  />
                ))
              : null}
            {showQuickPick
              ? recentSuggestions.map((p, i) => (
                  <SuggestionRow
                    key={`recent-${i}`}
                    icon="time"
                    tint={
                      active === "pickup" ? colors.secondary : colors.primary
                    }
                    title={p.address}
                    onPress={() => choose(p)}
                  />
                ))
              : null}
            {showPredictions
              ? search.predictions.map((p) => (
                  <SuggestionRow
                    key={p.placeId}
                    icon="location"
                    tint={
                      active === "pickup" ? colors.secondary : colors.primary
                    }
                    title={formatPredictionText(p.description)}
                    onPress={() => void pickPrediction(p)}
                  />
                ))
              : null}
            {showPredictions &&
            search.searching &&
            search.predictions.length === 0 ? (
              <View style={styles.hint}>
                <ActivityIndicator color={colors.primary} />
              </View>
            ) : null}
            {showPredictions &&
            !search.searching &&
            search.predictions.length === 0 ? (
              <View style={styles.hint}>
                <AppText variant="small" color="textMuted">
                  {search.error ?? "No matching Ontario addresses."}
                </AppText>
              </View>
            ) : null}
            <Pressable
              onPress={close}
              style={styles.hint}
              accessibilityRole="button"
            >
              <AppText variant="smallStrong" color="textMuted">
                Close
              </AppText>
            </Pressable>
          </View>
        ) : (
          <>
            <View
              style={[
                styles.fareCard,
                { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <AppText variant="bodyStrong">Estimated fare</AppText>
              {quoting ? (
                <ActivityIndicator color={colors.primary} />
              ) : quote ? (
                <View style={styles.fareValue}>
                  <AppText variant="title" color="primary">
                    {cad(quote.fare)}
                  </AppText>
                  <AppText variant="small" color="textMuted">
                    · {quote.distanceKm} km
                  </AppText>
                </View>
              ) : (
                <AppText variant="small" color="textMuted">
                  Select a route
                </AppText>
              )}
            </View>
            {quoteError ? (
              <AppText variant="small" color="danger">
                {quoteError}
              </AppText>
            ) : null}
            {quote && quote.distanceKm < minKm ? (
              <AppText variant="small" color="textMuted" style={styles.note}>
                A minimum fare of {cad(minFare)} applies to trips under {minKm}{" "}
                km to ensure fair driver compensation.
              </AppText>
            ) : null}

            <AppText variant="bodyStrong" style={styles.mapLabel}>
              Track on map
            </AppText>
            <RideMap
              style={styles.map}
              pickup={pickup}
              dropoff={destination}
              routes={
                route ? [{ coords: route.coords, color: colors.primary }] : []
              }
              followFrame
              interactive={false}
            />
          </>
        )}
      </View>

      {!active ? (
        <View style={styles.footer}>
          <Button title="Next" onPress={next} disabled={!canNext} />
        </View>
      ) : null}
    </Screen>
  );
}

function SuggestionRow({
  icon,
  tint,
  title,
  subtitle,
  busy,
  onPress,
}: {
  icon: React.ComponentProps<typeof Ionicons>["name"];
  tint: string;
  title: string;
  subtitle?: string;
  busy?: boolean;
  onPress: () => void;
}) {
  const { colors } = useTheme();
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      disabled={busy}
      style={({ pressed }) => [
        styles.suggestion,
        {
          borderBottomColor: colors.border,
          backgroundColor: pressed ? colors.surfaceRaised : "transparent",
        },
      ]}
    >
      {busy ? (
        <ActivityIndicator color={tint} />
      ) : (
        <Ionicons name={icon} size={20} color={tint} />
      )}
      <View style={styles.suggestionText}>
        <AppText variant="bodyStrong" numberOfLines={2}>
          {title}
        </AppText>
        {subtitle ? (
          <AppText variant="small" color="textMuted" numberOfLines={1}>
            {subtitle}
          </AppText>
        ) : null}
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  banner: {
    marginHorizontal: spacing.screen,
    marginTop: spacing.md,
    padding: spacing.md,
    borderRadius: radius.md,
  },
  body: {
    paddingHorizontal: spacing.screen,
    paddingTop: spacing.md,
    gap: spacing.md,
  },
  card: {
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  field: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    minHeight: 52,
    paddingHorizontal: spacing.md,
    borderRadius: radius.md,
    borderWidth: 1,
  },
  input: {
    flex: 1,
    fontFamily: fontFamily.bold,
    fontSize: 16,
    paddingVertical: 10,
  },
  suggestions: { borderRadius: radius.lg, borderWidth: 1, overflow: "hidden" },
  suggestion: {
    flexDirection: "row",
    alignItems: "center",
    gap: spacing.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  suggestionText: { flex: 1, gap: 1 },
  hint: { alignItems: "center", paddingVertical: spacing.md },
  fareCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    minHeight: 64,
  },
  fareValue: { flexDirection: "row", alignItems: "baseline", gap: spacing.sm },
  note: { paddingHorizontal: spacing.xs, fontStyle: "italic" },
  mapLabel: { marginTop: spacing.sm },
  map: { height: 240, borderRadius: radius.lg },
  footer: { padding: spacing.screen, paddingTop: spacing.lg },
});
