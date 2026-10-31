import { doc, updateDoc } from "@react-native-firebase/firestore";
import { db } from "./firebase";
import { createRideRequest } from "./rideService";
import { redeemCouponRemote, type AppliedCoupon } from "./couponService";
import {
  claimWelcomePromoRemote,
  redeemKmRewardRemote,
} from "./promotionsService";
import { FEATURES } from "../config/features";
import type { RideRequest } from "../interfaces/ride";
import type { UserProfile } from "../interfaces/user";
import type { PublicProfile } from "./publicProfiles";
import { round2 } from "../utils/money";

/**
 * Booking a ride: the exact document the Ionic confirmation step writes,
 * then the server-side discount lock. Kept out of the screen so the pure
 * parts can be tested and phase 5 (Stripe) can slot in before `createRide`.
 */

export interface PlaceInput {
  address: string;
  lat: number;
  lng: number;
}

/**
 * The one discount a ride can carry. The app previews the amount; the
 * server decides it (redeemCoupon, claimWelcomePromo, redeemKmReward) once
 * the ride document exists.
 */
export type BookingPromo =
  | { kind: "coupon"; coupon: AppliedCoupon }
  | {
      kind: "welcome";
      promoId: string;
      couponCode: string;
      maxFreeKm: number | null;
      discountAmount: number;
    }
  | { kind: "km_reward"; creditKm: number; discountAmount: number };

/** What the booking needs to know about the driver: the public profile. */
export type BookingDriver = Pick<
  PublicProfile,
  "uid" | "firstName" | "photoUrl" | "isTestAccount" | "vehicle" | "isOnline"
> & { lastName?: string };

export interface BookingInput {
  rider: UserProfile;
  driver: BookingDriver;
  pickup: PlaceInput;
  destination: PlaceInput;
  /** Rounded driving distance (one decimal), as priced. */
  distanceKm: number;
  /** Trip fare before the service fee and any discount. */
  fare: number;
  serviceFee: number;
  scheduledForIso: string;
  /** Hand the request to the next driver if this one declines. Always
   *  false when the rider booked through the dispatcher. */
  autoForward: boolean;
  passengerName?: string;
  passengerPhone?: string;
  promo?: BookingPromo | null;
}

const promoAmount = (promo: BookingPromo): number =>
  promo.kind === "coupon" ? promo.coupon.discountAmount : promo.discountAmount;

/** Discount never exceeds the trip fare; total never goes below zero. */
export const effectiveDiscount = (
  promo: BookingPromo | null | undefined,
  fare: number,
): number => (promo ? Math.min(promoAmount(promo), fare) : 0);

export const totalDue = (
  fare: number,
  serviceFee: number,
  discount: number,
): number => round2(Math.max(0, fare + serviceFee - discount));

/** What the rider sees the discount called: "WELCOME10 applied", etc. */
export function promoName(promo: BookingPromo): string {
  switch (promo.kind) {
    case "coupon":
      return promo.coupon.code;
    case "welcome":
      return "First ride free";
    case "km_reward":
      return `${promo.creditKm} km credit`;
  }
}

/** Pure: the ride document for a booking. */
export function buildRideRequest(
  input: BookingInput,
  nowIso: string,
): RideRequest {
  const { rider, driver, promo } = input;
  const discount = effectiveDiscount(promo, input.fare);
  const vehicle = driver.vehicle;
  const couponCode =
    promo?.kind === "coupon"
      ? promo.coupon.code
      : promo?.kind === "welcome"
        ? promo.couponCode
        : null;
  return {
    clientId: rider.uid,
    clientFirstName: rider.firstName,
    clientLastName: rider.lastName,
    passengerName:
      input.passengerName?.trim() || `${rider.firstName} ${rider.lastName}`,
    passengerPhone: input.passengerPhone?.trim() || rider.phone || "",
    driverId: driver.uid,
    driverFirstName: driver.firstName,
    // The public profile has no last name; the notifyNewRideRequest
    // function fills it in from the driver's private profile.
    driverLastName: driver.lastName ?? "",
    driverVehicle: `${vehicle?.make || ""} ${vehicle?.model || ""}`.trim(),
    driverVehicleColor: vehicle?.color || "",
    driverPlateNumber: vehicle?.plateNumber || "",
    // Sandbox: rides involving a test client or test driver are tagged so
    // they can be filtered from real usage and archived separately.
    isTest: !!(rider.isTestAccount || driver.isTestAccount),
    status: "pending",
    pickup: { ...input.pickup },
    destination: { ...input.destination },
    distance: input.distanceKm,
    // estimatedPrice stays the FULL fare so the driver's payout (computed
    // from it) is unaffected: the platform absorbs the discount.
    estimatedPrice: input.fare,
    platformFee: input.serviceFee,
    totalClientCharge: totalDue(input.fare, input.serviceFee, discount),
    // promoId / kmRewardApplied are set by the functions, never here.
    ...(promo
      ? { ...(couponCode ? { couponCode } : {}), discountAmount: discount }
      : {}),
    paymentStatus: "paid_direct",
    autoForward: input.autoForward,
    scheduledTime: input.scheduledForIso,
    createdAt: nowIso,
  };
}

export interface BookingResult {
  rideId: string;
  /** The discount failed to lock in at booking; the ride went at full price. */
  promoDropped: boolean;
}

/** The server's authoritative discount for the promo, or a throw. */
async function lockPromo(
  promo: BookingPromo,
  rideId: string,
  input: BookingInput,
): Promise<number> {
  switch (promo.kind) {
    case "coupon":
      return redeemCouponRemote(
        promo.coupon.code,
        rideId,
        input.fare,
        input.distanceKm,
      );
    case "welcome":
      return (await claimWelcomePromoRemote(rideId, promo.promoId))
        .discountAmount;
    case "km_reward":
      return (await redeemKmRewardRemote(rideId)).discountAmount;
  }
}

/**
 * Create the ride, then lock the discount in server-side (atomic usage
 * limits, authoritative amount). If it stopped being valid between preview
 * and booking, the ride is kept at the regular price rather than blocked.
 */
export async function bookRide(input: BookingInput): Promise<BookingResult> {
  if (FEATURES.STRIPE_PAYMENTS) {
    // Phase 5: createSetupIntent + the native payment sheet go here, and the
    // ride is written with paymentStatus "vaulted" and its setupIntentId.
    throw new Error("Card payments are not available in this build yet.");
  }
  const ride = buildRideRequest(input, new Date().toISOString());
  const rideId = await createRideRequest(ride);

  let promoDropped = false;
  if (input.promo) {
    const previewDiscount = effectiveDiscount(input.promo, input.fare);
    try {
      const authoritative = await lockPromo(input.promo, rideId, input);
      if (Math.abs(authoritative - previewDiscount) > 0.001) {
        await updateDoc(doc(db, "rides", rideId), {
          discountAmount: authoritative,
          totalClientCharge: totalDue(
            input.fare,
            input.serviceFee,
            authoritative,
          ),
        });
      }
    } catch (err) {
      console.warn("Discount lock failed at booking:", err);
      promoDropped = true;
      await updateDoc(doc(db, "rides", rideId), {
        couponCode: null,
        discountAmount: null,
        totalClientCharge: totalDue(input.fare, input.serviceFee, 0),
      });
    }
  }
  return { rideId, promoDropped };
}
