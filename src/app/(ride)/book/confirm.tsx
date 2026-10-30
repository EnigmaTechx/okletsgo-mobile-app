import { useEffect, useState } from "react";
import {
  Image,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useNavigation, useRouter } from "expo-router";
import { Ionicons } from "@expo/vector-icons";
import { useBooking } from "../../../components/booking/BookingContext";
import { RideMap } from "../../../components/map/RideMap";
import { RouteTimeline } from "../../../components/rides/RouteTimeline";
import { AppText } from "../../../components/ui/AppText";
import { Button } from "../../../components/ui/Button";
import { Screen } from "../../../components/ui/Screen";
import { TextField } from "../../../components/ui/TextField";
import { useToast } from "../../../components/ui/Toast";
import { useAuth } from "../../../contexts/AuthContext";
import { useFeatureFlags } from "../../../contexts/FeatureFlagsContext";
import { usePromotions } from "../../../contexts/PromotionsContext";
import { useTheme } from "../../../contexts/ThemeContext";
import { useDrivingRoute } from "../../../hooks/useDrivingRoute";
import { distanceDiscount } from "../../../config/promotions";
import {
  bookRide,
  effectiveDiscount,
  promoName,
  totalDue,
  type BookingPromo,
} from "../../../services/bookingService";
import { validateCouponRemote } from "../../../services/couponService";
import { isDriverOnline } from "../../../services/rideService";
import { formatDateTime } from "../../../utils/address";
import { formatKm } from "../../../utils/geo";
import { calculateFare, SERVICE_FEE } from "../../../utils/fareCalculator";
import { cad, round2 } from "../../../utils/money";
import { formatPhone } from "../../../utils/phone";
import { fontFamily, radius, spacing } from "../../../theme/tokens";

/**
 * Step 4 of 4: everything in one card, the discount (the welcome gift
 * applied by itself, a banked km credit, or a promo code), the hand-off
 * switch, optional passenger details, a map preview, and Confirm.
 */
export default function BookConfirm() {
  const router = useRouter();
  // The (ride) stack's own navigation: popToTop + replace in one go leaves
  // the success screen as the stack's only screen, which router.dismissAll
  // followed by router.replace did not (the replace targeted the screen
  // that had just been popped).
  const stack = useNavigation() as unknown as {
    popToTop(): void;
    replace(name: string, params?: Record<string, string>): void;
  };
  const toast = useToast();
  const { colors } = useTheme();
  const { userProfile } = useAuth();
  const { isVisible } = useFeatureFlags();
  const { draft, reset } = useBooking();
  const promotions = usePromotions();

  const [passengerName, setPassengerName] = useState(
    userProfile?.firstName ?? "",
  );
  const [passengerPhone, setPassengerPhone] = useState(
    userProfile?.phone
      ? formatPhone(userProfile.phone.replace(/\D/g, "").slice(-10))
      : "",
  );
  const [autoForward, setAutoForward] = useState(true);
  const [promoOpen, setPromoOpen] = useState(false);
  const [promoCode, setPromoCode] = useState("");
  const [promoBusy, setPromoBusy] = useState(false);
  const [promoError, setPromoError] = useState<string | null>(null);
  const [promo, setPromo] = useState<BookingPromo | null>(null);
  const [booking, setBooking] = useState(false);
  const [booked, setBooked] = useState(false);

  const { pickup, destination, distanceKm, fare, scheduledForIso, driver } =
    draft;
  const complete =
    !!pickup &&
    !!destination &&
    distanceKm !== null &&
    fare !== null &&
    !!scheduledForIso &&
    !!driver;

  useEffect(() => {
    if (!complete) router.replace("/(ride)/book/locations");
  }, [complete, router]);

  const route = useDrivingRoute(pickup, destination);

  // The welcome gift: previewed here exactly as the server will value it,
  // applied by itself the first time this step knows the rider has it.
  const welcome = promotions.welcomeAvailable ? promotions.welcome : null;
  const welcomePromo = (): BookingPromo | null =>
    welcome && fare !== null && distanceKm !== null
      ? {
          kind: "welcome",
          promoId: welcome.id,
          couponCode: welcome.couponCode as string,
          maxFreeKm: welcome.maxFreeKm,
          discountAmount: distanceDiscount(
            fare,
            distanceKm,
            welcome.maxFreeKm ?? Number.POSITIVE_INFINITY,
            calculateFare,
          ),
        }
      : null;
  const [seededFor, setSeededFor] = useState<string | null>(null);
  if (welcome && seededFor !== welcome.id) {
    setSeededFor(welcome.id);
    if (!promo) setPromo(welcomePromo());
  }

  if (!complete || !userProfile) return null;

  const bank = promotions.bank;
  const kmCreditPromo = (): BookingPromo | null =>
    bank && bank.credits > 0
      ? {
          kind: "km_reward",
          creditKm: bank.creditKm,
          discountAmount: distanceDiscount(
            fare,
            distanceKm,
            bank.creditKm,
            calculateFare,
          ),
        }
      : null;

  const discount = effectiveDiscount(promo, fare);
  const total = totalDue(fare, SERVICE_FEE, discount);
  const { date, time } = formatDateTime(scheduledForIso);
  // Gift and credit cover the trip fare itself: show it crossed out.
  const coversTrip = !!promo && promo.kind !== "coupon";

  const applyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      const coupon = await validateCouponRemote(code, fare, distanceKm);
      setPromo({ kind: "coupon", coupon });
      setPromoCode(code);
    } catch (err) {
      setPromoError((err as Error).message || "That coupon can't be applied.");
    } finally {
      setPromoBusy(false);
    }
  };

  const removePromo = () => {
    setPromo(null);
    setPromoCode("");
    setPromoError(null);
  };

  const confirm = async () => {
    setBooking(true);
    try {
      if (!(await isDriverOnline(driver.uid))) {
        toast(`${driver.firstName} is no longer available.`, { type: "error" });
        router.replace("/(ride)/book/driver");
        return;
      }
      const result = await bookRide({
        rider: userProfile,
        driver,
        pickup,
        destination,
        distanceKm,
        fare,
        serviceFee: SERVICE_FEE,
        scheduledForIso,
        autoForward,
        passengerName,
        passengerPhone:
          passengerPhone.replace(/\D/g, "").length === 10
            ? `+1${passengerPhone.replace(/\D/g, "")}`
            : undefined,
        promo,
      });
      if (result.promoDropped && promo) {
        toast(
          `${promo.kind === "coupon" ? "Your coupon" : promo.kind === "welcome" ? "The welcome gift" : "Your km credit"} couldn't be applied, so the trip was booked at the regular price.`,
          { type: "error", durationMs: 4000 },
        );
      }
      setBooked(true);
      reset();
      // Leave the wizard behind: the success screen becomes the only screen
      // in this stack, so back (and swipe-back) lands on Home, never on a
      // finished booking step.
      stack.popToTop();
      stack.replace("book/success", {
        rideId: result.rideId,
        driverFirstName: driver.firstName,
        driverPhotoUrl: driver.photoUrl ?? "",
        pickupAddress: pickup.address,
        destinationAddress: destination.address,
        totalDue: String(
          result.promoDropped ? totalDue(fare, SERVICE_FEE, 0) : total,
        ),
        dateStr: date,
        timeStr: time,
      });
    } catch (err) {
      console.error("Booking error:", err);
      toast((err as Error).message || "Booking failed. Please try again.", {
        type: "error",
      });
    } finally {
      setBooking(false);
    }
  };

  const card = { backgroundColor: colors.surface, borderColor: colors.border };
  const divider = { borderTopColor: colors.border };

  return (
    <Screen scroll edges={["left", "right"]}>
      <View style={[styles.card, card]}>
        <RouteTimeline
          pickup={pickup.address}
          dropoff={destination.address}
          compact
        />

        <View style={[styles.rowBetween, styles.divided, divider]}>
          <View style={styles.inline}>
            <Ionicons
              name="calendar-outline"
              size={16}
              color={colors.textMuted}
            />
            <AppText variant="smallStrong" color="textSecondary">
              {date}
            </AppText>
          </View>
          <View style={styles.inline}>
            <Ionicons name="time-outline" size={16} color={colors.textMuted} />
            <AppText variant="smallStrong" color="textSecondary">
              {time}
            </AppText>
          </View>
        </View>

        <View style={[styles.rowBetween, styles.divided, divider]}>
          <View>
            <AppText variant="heading">{driver.firstName}</AppText>
            <AppText variant="small" color="textSecondary">
              {driver.vehicle?.make} {driver.vehicle?.model}
              {driver.vehicle?.color ? ` (${driver.vehicle.color})` : ""}
            </AppText>
          </View>
          {driver.vehicle?.photoUrl ? (
            <Image
              source={{ uri: driver.vehicle.photoUrl }}
              style={styles.carPhoto}
            />
          ) : (
            <Ionicons name="car-sport" size={34} color={colors.text} />
          )}
        </View>

        <View style={[styles.divided, divider, styles.costs]}>
          <CostRow
            label={`Trip · ${formatKm(distanceKm)}`}
            value={cad(fare)}
            was={coversTrip ? cad(fare) : undefined}
            now={coversTrip ? cad(round2(fare - discount)) : undefined}
          />
          <CostRow label="Service" value={cad(SERVICE_FEE)} />
          {promo?.kind === "coupon" && discount > 0 ? (
            <CostRow
              label={`Discount (${promo.coupon.code})`}
              value={`-${cad(discount)}`}
              tint={colors.success}
            />
          ) : null}

          {promo ? (
            <View style={styles.rowBetween}>
              <AppText variant="smallStrong" color="success">
                ✓{" "}
                {promo.kind === "coupon"
                  ? `${promo.coupon.code} applied`
                  : promo.kind === "welcome"
                    ? `${promoName(promo)}${promo.maxFreeKm ? ` (up to ${promo.maxFreeKm} km)` : ""}`
                    : `${promoName(promo)} applied`}
              </AppText>
              <Pressable accessibilityRole="button" onPress={removePromo}>
                <AppText variant="smallStrong" color="textMuted">
                  Remove
                </AppText>
              </Pressable>
            </View>
          ) : (
            <>
              {welcome ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPromo(welcomePromo())}
                  style={styles.rowBetween}
                >
                  <View style={styles.inline}>
                    <Ionicons
                      name="gift-outline"
                      size={18}
                      color={colors.primary}
                    />
                    <AppText variant="body" color="primary">
                      Use your welcome gift
                    </AppText>
                  </View>
                  <AppText variant="bodyStrong" color="primary">
                    Apply
                  </AppText>
                </Pressable>
              ) : null}
              {bank && bank.credits > 0 ? (
                <Pressable
                  accessibilityRole="button"
                  onPress={() => setPromo(kmCreditPromo())}
                  style={styles.rowBetween}
                >
                  <View style={styles.inline}>
                    <Ionicons
                      name="speedometer-outline"
                      size={18}
                      color={colors.primary}
                    />
                    <AppText variant="body" color="primary">
                      Use a {bank.creditKm} km credit ({bank.credits} banked)
                    </AppText>
                  </View>
                  <AppText variant="bodyStrong" color="primary">
                    Apply
                  </AppText>
                </Pressable>
              ) : null}
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: promoOpen }}
                onPress={() => setPromoOpen((o) => !o)}
                style={styles.rowBetween}
              >
                <View style={styles.inline}>
                  <Ionicons
                    name="pricetag-outline"
                    size={18}
                    color={colors.primary}
                  />
                  <AppText variant="body" color="primary">
                    Have a promo code?
                  </AppText>
                </View>
                <View style={styles.inline}>
                  <AppText variant="bodyStrong" color="primary">
                    {promoOpen ? "Close" : "Add"}
                  </AppText>
                  <Ionicons
                    name={promoOpen ? "chevron-up" : "chevron-down"}
                    size={18}
                    color={colors.primary}
                  />
                </View>
              </Pressable>
              {promoOpen ? (
                <View style={styles.promo}>
                  <View style={styles.promoRow}>
                    <TextInput
                      value={promoCode}
                      onChangeText={(t) => setPromoCode(t.toUpperCase())}
                      placeholder="Promo code"
                      placeholderTextColor={colors.textMuted}
                      autoCapitalize="characters"
                      autoCorrect={false}
                      returnKeyType="done"
                      onSubmitEditing={() => void applyPromo()}
                      style={[
                        styles.promoInput,
                        {
                          color: colors.text,
                          backgroundColor: colors.background,
                          borderColor: colors.border,
                        },
                      ]}
                    />
                    <Button
                      title="Apply"
                      block={false}
                      onPress={() => void applyPromo()}
                      loading={promoBusy}
                      disabled={!promoCode.trim()}
                      style={styles.promoBtn}
                    />
                  </View>
                  {promoError ? (
                    <AppText variant="small" color="danger">
                      {promoError}
                    </AppText>
                  ) : null}
                </View>
              ) : null}
            </>
          )}

          <View style={[styles.rowBetween, styles.totalRow, divider]}>
            <AppText variant="heading">Total</AppText>
            <AppText variant="title" color="primary">
              {cad(total)}
            </AppText>
          </View>
        </View>
      </View>

      <View style={[styles.card, card, styles.rowBetween]}>
        <View style={styles.flex}>
          <AppText variant="bodyStrong">
            If {driver.firstName || "this driver"} can&apos;t take it
          </AppText>
          <AppText variant="small" color="textMuted">
            Offer my ride to the next available driver
          </AppText>
        </View>
        <Switch
          value={autoForward}
          onValueChange={setAutoForward}
          trackColor={{ false: colors.border, true: colors.success }}
          thumbColor={colors.background}
        />
      </View>

      {isVisible("book_for_others") ? (
        <View style={[styles.card, card, styles.passenger]}>
          <AppText variant="heading">Passenger details</AppText>
          <TextField
            label="Passenger name"
            value={passengerName}
            onChangeText={setPassengerName}
            placeholder="Who is riding?"
            autoCapitalize="words"
          />
          <TextField
            label="Phone number"
            prefix="+1"
            value={passengerPhone}
            onChangeText={(t) => setPassengerPhone(formatPhone(t))}
            placeholder="Driver will call this number"
            keyboardType="phone-pad"
          />
        </View>
      ) : null}

      <RideMap
        style={styles.map}
        pickup={pickup}
        dropoff={destination}
        routes={route ? [{ coords: route.coords, color: colors.primary }] : []}
        interactive={false}
      />

      <Button
        title={booked ? "Booked!" : "Confirm booking"}
        variant={booked ? "success" : "primary"}
        onPress={() => void confirm()}
        loading={booking}
        disabled={booking || booked}
        style={styles.cta}
      />
    </Screen>
  );
}

function CostRow({
  label,
  value,
  tint,
  was,
  now,
}: {
  label: string;
  value: string;
  tint?: string;
  /** When a gift covers this line: the crossed-out amount and what is left. */
  was?: string;
  now?: string;
}) {
  return (
    <View style={styles.rowBetween}>
      <AppText
        variant="body"
        color="textSecondary"
        style={tint ? { color: tint } : undefined}
      >
        {label}
      </AppText>
      {was !== undefined && now !== undefined ? (
        <View style={styles.inline}>
          <AppText variant="small" color="textMuted" style={styles.strike}>
            {was}
          </AppText>
          <AppText variant="bodyStrong" color="success">
            {now}
          </AppText>
        </View>
      ) : (
        <AppText
          variant="bodyStrong"
          style={tint ? { color: tint } : undefined}
        >
          {value}
        </AppText>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginTop: spacing.md,
    padding: spacing.lg,
    borderRadius: radius.lg,
    borderWidth: 1,
    gap: spacing.md,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    gap: spacing.md,
  },
  inline: { flexDirection: "row", alignItems: "center", gap: 6 },
  divided: { paddingTop: spacing.md, borderTopWidth: StyleSheet.hairlineWidth },
  carPhoto: { width: 60, height: 60, borderRadius: radius.sm },
  costs: { gap: spacing.sm },
  promo: { gap: spacing.sm },
  promoRow: { flexDirection: "row", gap: spacing.sm, alignItems: "stretch" },
  promoInput: {
    flex: 1,
    borderRadius: radius.sm,
    borderWidth: 1,
    paddingHorizontal: spacing.md,
    fontFamily: fontFamily.bold,
    fontSize: 15,
  },
  promoBtn: { minHeight: 44, paddingHorizontal: 16 },
  totalRow: {
    marginTop: spacing.xs,
    paddingTop: spacing.md,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  flex: { flex: 1 },
  strike: { textDecorationLine: "line-through" },
  passenger: { gap: spacing.lg },
  map: { height: 200, borderRadius: radius.lg, marginTop: spacing.md },
  cta: { marginTop: spacing.xl },
});
