import { doc, updateDoc } from "@react-native-firebase/firestore";
import { db } from "./firebase";
import { createRideRequest } from "./rideService";
import { redeemCouponRemote, type AppliedCoupon } from "./couponService";
import { FEATURES } from "../config/features";
import type { RideRequest } from "../interfaces/ride";
import type { UserProfile } from "../interfaces/user";
import { round2 } from "../utils/money";

/**
 * Booking a ride: the exact document the Ionic confirmation step writes,
 * then the server-side coupon lock. Kept out of the screen so the pure
 * parts can be tested and phase 5 (Stripe) can slot in before `createRide`.
 */

export interface PlaceInput {
  address: string;
  lat: number;
  lng: number;
}

export interface BookingInput {
  rider: UserProfile;
  driver: UserProfile;
  pickup: PlaceInput;
  destination: PlaceInput;
  /** Rounded driving distance (one decimal), as priced. */
  distanceKm: number;
  /** Trip fare before the service fee and any discount. */
  fare: number;
  serviceFee: number;
  scheduledForIso: string;
  autoForward: boolean;
  passengerName?: string;
  passengerPhone?: string;
  coupon?: AppliedCoupon | null;
}

/** Discount never exceeds the trip fare; total never goes below zero. */
export const effectiveDiscount = (
  coupon: AppliedCoupon | null | undefined,
  fare: number,
): number => (coupon ? Math.min(coupon.discountAmount, fare) : 0);

export const totalDue = (
  fare: number,
  serviceFee: number,
  discount: number,
): number => round2(Math.max(0, fare + serviceFee - discount));

/** Pure: the ride document for a booking. */
export function buildRideRequest(
  input: BookingInput,
  nowIso: string,
): RideRequest {
  const { rider, driver } = input;
  const discount = effectiveDiscount(input.coupon, input.fare);
  const vehicle = driver.vehicle;
  return {
    clientId: rider.uid,
    clientFirstName: rider.firstName,
    clientLastName: rider.lastName,
    passengerName:
      input.passengerName?.trim() || `${rider.firstName} ${rider.lastName}`,
    passengerPhone: input.passengerPhone?.trim() || rider.phone || "",
    driverId: driver.uid,
    driverFirstName: driver.firstName,
    driverLastName: driver.lastName,
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
    // from it) is unaffected: the platform absorbs the coupon discount.
    estimatedPrice: input.fare,
    platformFee: input.serviceFee,
    totalClientCharge: totalDue(input.fare, input.serviceFee, discount),
    ...(input.coupon
      ? { couponCode: input.coupon.code, discountAmount: discount }
      : {}),
    paymentStatus: "paid_direct",
    autoForward: input.autoForward,
    scheduledTime: input.scheduledForIso,
    createdAt: nowIso,
  };
}

export interface BookingResult {
  rideId: string;
  /** The coupon failed to lock in at booking; the ride went at full price. */
  couponDropped: boolean;
}

/**
 * Create the ride, then lock the coupon in server-side (atomic usage limits,
 * authoritative discount). If the coupon stopped being valid between
 * preview and booking, the ride is kept at the regular price rather than
 * blocked.
 */
export async function bookRide(input: BookingInput): Promise<BookingResult> {
  if (FEATURES.STRIPE_PAYMENTS) {
    // Phase 5: createSetupIntent + the native payment sheet go here, and the
    // ride is written with paymentStatus "vaulted" and its setupIntentId.
    throw new Error("Card payments are not available in this build yet.");
  }
  const ride = buildRideRequest(input, new Date().toISOString());
  const rideId = await createRideRequest(ride);

  let couponDropped = false;
  if (input.coupon) {
    const previewDiscount = effectiveDiscount(input.coupon, input.fare);
    try {
      const authoritative = await redeemCouponRemote(
        input.coupon.code,
        rideId,
        input.fare,
      );
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
      console.warn("Coupon redemption failed at booking:", err);
      couponDropped = true;
      await updateDoc(doc(db, "rides", rideId), {
        couponCode: null,
        discountAmount: null,
        totalClientCharge: totalDue(input.fare, input.serviceFee, 0),
      });
    }
  }
  return { rideId, couponDropped };
}
