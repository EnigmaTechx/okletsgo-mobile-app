import { useState } from "react";
import { FEATURES } from "../../config/features";
import type { RideRequest } from "../../interfaces/ride";
import {
  MID_TRIP_CANCELLATION_FEE,
  SERVICE_FEE,
  earlyCancellationFee,
} from "../../utils/fareCalculator";
import { cad } from "../../utils/money";
import { ConfirmSheet } from "../ui/ConfirmSheet";

const PRE_TRIP_REASONS = [
  "Driver is taking too long",
  "Changed my mind",
  "Booked by mistake",
  "Other",
];
const MID_TRIP_REASONS = [
  "Need to get out early",
  "Change of plans",
  "Safety concern",
  "Other",
];

interface Props {
  visible: boolean;
  ride: RideRequest;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

/** "Cancel Ride" / "End Trip Early?": the warning, a reason, two buttons. */
export function CancelRideSheet({ visible, ride, onClose, onConfirm }: Props) {
  const inProgress = ride.status === "in_progress";
  const reasons = inProgress ? MID_TRIP_REASONS : PRE_TRIP_REASONS;
  const [reason, setReason] = useState(reasons[0]);

  const total = ride.totalClientCharge || 0;
  const feeApplies = FEATURES.STRIPE_PAYMENTS && ride.status !== "pending";
  const message = inProgress
    ? `Your trip is already in progress. Ending it now will charge you for the distance covered so far, plus the ${cad(SERVICE_FEE)} service fee and a ${cad(MID_TRIP_CANCELLATION_FEE)} mid-trip cancellation fee.`
    : feeApplies
      ? `Are you sure you want to cancel? A 20% cancellation fee (${cad(earlyCancellationFee(total))}) will be charged because the driver has already been dispatched.`
      : ride.status === "pending"
        ? "Are you sure you want to cancel? You will not be charged."
        : "Are you sure you want to cancel? Please select a reason below.";

  return (
    <ConfirmSheet
      visible={visible}
      tone="primary"
      icon={inProgress ? "warning-outline" : "close-circle-outline"}
      title={inProgress ? "End Trip Early?" : "Cancel Ride"}
      message={message}
      options={reasons}
      selected={reason}
      onSelect={setReason}
      cancelText={inProgress ? "Continue Trip" : "Keep Ride"}
      onCancel={onClose}
      confirmText={inProgress ? "End Trip" : "Cancel Ride"}
      onConfirm={() => onConfirm(reason)}
    />
  );
}
