export type RideStatus =
  | "pending"
  | "accepted"
  | "heading_to_pickup"
  | "arrived"
  | "confirmed"
  | "en_route"
  | "in_progress"
  | "completed"
  | "cancelled"
  | "declined"
  | "processing_payment";

export interface DeclineRecord {
  driverId: string;
  reason: string;
  timestamp: string;
}

export interface LocationPoint {
  address: string;
  lat?: number;
  lng?: number;
}

export interface RideRequest {
  id?: string;

  // Users
  clientId: string;
  clientFirstName: string;
  clientLastName: string;
  passengerName?: string;
  passengerPhone?: string;

  driverId: string;
  driverFirstName?: string;
  driverLastName?: string;

  // Locations
  pickup: LocationPoint;
  destination: LocationPoint;
  stops?: LocationPoint[]; // Future

  // Status & Time
  status: RideStatus;
  scheduledTime: string;
  createdAt: string;

  // --- LEGACY FIELDS (Kept to prevent breaking current UI) ---
  estimatedPrice: number;
  distance: number;
  driverVehicle?: string;
  driverVehicleColor?: string;
  driverPlateNumber?: string;
  driverLocation?: { lat: number; lng: number; updatedAt?: string };
  driverStartLocation?: { lat: number; lng: number };
  totalKmTravelled?: number;

  // --- NEW GRANULAR TIMESTAMPS (For Dashboard & Minimum Wage) ---
  headedToPickupAt?: string;
  arrivedAtPickupAt?: string;
  waitingTimerStartedAt?: string;
  tripStartedAt?: string;
  tripCompletedAt?: string;
  completedAt?: string;
  reminderSent?: boolean; // driver ~45-60 min reminder sent
  clientReminderSent?: boolean; // client ~30 min reminder sent

  // Sandbox: true when the client or driver is a test account, so sandbox
  // rides can be filtered from real usage and archived separately.
  isTest?: boolean;

  // --- EARLY TRIP COMPLETION (Slide-to-complete guard) ---
  actualDistanceKm?: number;
  endedEarly?: boolean;
  earlyEndReason?: string;

  // --- NEW FINANCIAL BREAKDOWN (For Dashboard) ---
  baseFare?: number;
  taxAmount?: number;
  totalClientCharge?: number;
  driverPayout?: number;
  platformFee?: number;

  // Payments (Restored "vaulted")
  paymentStatus:
    | "pending"
    | "added_to_ledger"
    | "paid_direct"
    | "authorized"
    | "vaulted"
    | "captured"
    | "refunded"
    | "failed";
  paymentIntentId?: string;
  setupIntentId?: string;

  // Coupons (scaffold — not yet active)
  couponCode?: string;
  discountAmount?: number;

  // Cancellations & Declines
  declinedBy?: DeclineRecord[];
  cancelledBy?: "client" | "driver" | "system";
  systemExpiryType?: "driver_no_start";
  cancellationReason?: string;
  driverNoStartPenalty?: number;
  cancellationFee?: number;
  cancelledAt?: string;

  // Post-Ride
  driverRatingByClient?: number;
  clientReviewText?: string;
  ratedAt?: string;

  // --- AUTO-FORWARD (driver declines → next best driver) ---
  // Set at booking from the rider's switch (default on). When the chosen
  // driver declines, the declineRide function hands the request to the next
  // highest-rated online driver instead of ending it. Each handoff is logged.
  autoForward?: boolean;
  forwardHistory?: {
    fromDriverId: string;
    fromDriverFirstName: string;
    toDriverId: string;
    toDriverFirstName: string;
    reason: string;
    at: string;
  }[];
  forwardedAt?: string;

  // --- SCHEDULED-RIDE TIME EDIT (client changes pickup time before start) ---
  // A change to `scheduledTime` the client requested that still needs the
  // driver's approval (only set for a material change on an accepted ride).
  pendingTimeChange?: {
    requestedTime: string; // proposed new scheduledTime (ISO)
    previousTime: string; // scheduledTime before the request (for revert)
    requestedAt: string;
    status: "pending"; // awaiting driver decision
  } | null;
  // Audit trail of applied time edits.
  timeEditHistory?: {
    from: string;
    to: string;
    at: string;
    requiredApproval: boolean;
  }[];
}
