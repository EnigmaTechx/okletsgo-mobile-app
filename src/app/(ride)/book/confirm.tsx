import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Image,
  Pressable,
  StyleSheet,
  Switch,
  TextInput,
  View,
} from "react-native";
import { useRouter } from "expo-router";
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
import { useTheme } from "../../../contexts/ThemeContext";
import { useDrivingRoute } from "../../../hooks/useDrivingRoute";
import {
  bookRide,
  effectiveDiscount,
  totalDue,
} from "../../../services/bookingService";
import {
  validateCouponRemote,
  type AppliedCoupon,
} from "../../../services/couponService";
import { isDriverOnline } from "../../../services/rideService";
import { formatDateTime } from "../../../utils/address";
import { SERVICE_FEE } from "../../../utils/fareCalculator";
import { cad } from "../../../utils/money";
import { formatPhone } from "../../../utils/phone";
import { fontFamily, radius, spacing } from "../../../theme/tokens";

/**
 * Step 4 of 4: everything in one card, a promo code, the hand-off switch,
 * optional passenger details, a map preview, and Confirm.
 */
export default function BookConfirm() {
  const router = useRouter();
  const toast = useToast();
  const { colors } = useTheme();
  const { userProfile } = useAuth();
  const { isVisible } = useFeatureFlags();
  const { draft, reset } = useBooking();

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
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
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

  if (!complete || !userProfile) return null;

  const discount = effectiveDiscount(coupon, fare);
  const total = totalDue(fare, SERVICE_FEE, discount);
  const { date, time } = formatDateTime(scheduledForIso);

  const applyPromo = async () => {
    const code = promoCode.trim().toUpperCase();
    if (!code) return;
    setPromoBusy(true);
    setPromoError(null);
    try {
      setCoupon(await validateCouponRemote(code, fare));
      setPromoCode(code);
    } catch (err) {
      setCoupon(null);
      setPromoError((err as Error).message || "That coupon can't be applied.");
    } finally {
      setPromoBusy(false);
    }
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
        coupon,
      });
      if (result.couponDropped) {
        toast(
          "Your coupon couldn't be applied, so the trip was booked at the regular price.",
          { type: "error", durationMs: 4000 },
        );
      }
      setBooked(true);
      reset();
      // Leave the wizard behind: the success screen becomes the only screen
      // in this stack, so back (and swipe-back) lands on Home, never on a
      // finished booking step.
      router.dismissAll();
      router.replace({
        pathname: "/(ride)/book/success",
        params: {
          rideId: result.rideId,
          driverFirstName: driver.firstName,
          driverPhotoUrl: driver.photoUrl ?? "",
          pickupAddress: pickup.address,
          destinationAddress: destination.address,
          totalDue: String(
            result.couponDropped ? totalDue(fare, SERVICE_FEE, 0) : total,
          ),
          dateStr: date,
          timeStr: time,
        },
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
          <CostRow label="Trip" value={cad(fare)} />
          <CostRow label="Service" value={cad(SERVICE_FEE)} />
          {coupon && discount > 0 ? (
            <CostRow
              label={`Discount (${coupon.code})`}
              value={`-${cad(discount)}`}
              tint={colors.success}
            />
          ) : null}

          {coupon ? (
            <View style={styles.rowBetween}>
              <AppText variant="smallStrong" color="success">
                ✓ {coupon.code} applied
              </AppText>
              <Pressable
                accessibilityRole="button"
                onPress={() => {
                  setCoupon(null);
                  setPromoCode("");
                  setPromoError(null);
                }}
              >
                <AppText variant="smallStrong" color="textMuted">
                  Remove
                </AppText>
              </Pressable>
            </View>
          ) : (
            <>
              <Pressable
                accessibilityRole="button"
                accessibilityState={{ expanded: promoOpen }}
                onPress={() => setPromoOpen((o) => !o)}
                style={styles.rowBetween}
              >
                <View style={styles.inline}>
                  <Ionicons
                    name="pricetag-outline"
                    size={16}
                    color={colors.primary}
                  />
                  <AppText variant="smallStrong">Have a promo code?</AppText>
                </View>
                <View style={styles.inline}>
                  <AppText variant="smallStrong" color="primary">
                    {promoOpen ? "Close" : "Add"}
                  </AppText>
                  <Ionicons
                    name={promoOpen ? "chevron-up" : "chevron-down"}
                    size={16}
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
      {booking ? (
        <View style={styles.inlineCenter}>
          <ActivityIndicator color={colors.primary} />
          <AppText variant="small" color="textMuted">
            Booking your ride…
          </AppText>
        </View>
      ) : null}
    </Screen>
  );
}

function CostRow({
  label,
  value,
  tint,
}: {
  label: string;
  value: string;
  tint?: string;
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
      <AppText variant="bodyStrong" style={tint ? { color: tint } : undefined}>
        {value}
      </AppText>
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
  inlineCenter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
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
  passenger: { gap: spacing.lg },
  map: { height: 200, borderRadius: radius.lg, marginTop: spacing.md },
  cta: { marginTop: spacing.xl },
});
