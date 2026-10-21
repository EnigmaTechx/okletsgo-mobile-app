import {
  buildRideRequest,
  effectiveDiscount,
  totalDue,
} from "./bookingService";
import type { UserProfile } from "../interfaces/user";

const rider: UserProfile = {
  uid: "c1",
  firstName: "Jane",
  lastName: "Dozer",
  email: "jane@example.com",
  phone: "+15195550123",
  role: "client",
  createdAt: "2026-01-01T00:00:00Z",
};
const driver: UserProfile = {
  uid: "d1",
  firstName: "Marcus",
  lastName: "Dee",
  email: "m@example.com",
  phone: "+15195550999",
  role: "driver",
  createdAt: "2026-01-01T00:00:00Z",
  isTestAccount: true,
  vehicle: {
    make: "Toyota",
    model: "Camry",
    color: "Black",
    plateNumber: "CKPB 441",
    licenseNumber: "D1234-56789-01234",
  },
};

const input = {
  rider,
  driver,
  pickup: { address: "A", lat: 43.45, lng: -80.49 },
  destination: { address: "B", lat: 43.46, lng: -80.48 },
  distanceKm: 8.6,
  fare: 8.7,
  serviceFee: 1.5,
  scheduledForIso: "2026-10-22T18:10:00.000Z",
  autoForward: true,
};

describe("booking document", () => {
  it("keeps the full fare on estimatedPrice and discounts the client total", () => {
    const ride = buildRideRequest(
      { ...input, coupon: { code: "WELCOME", discountAmount: 50 } },
      "2026-10-21T00:00:00.000Z",
    );
    expect(ride.estimatedPrice).toBe(8.7);
    expect(ride.discountAmount).toBe(8.7);
    expect(ride.totalClientCharge).toBe(1.5);
    expect(ride.couponCode).toBe("WELCOME");
    expect(ride.isTest).toBe(true);
    expect(ride.driverVehicle).toBe("Toyota Camry");
    expect(ride.passengerName).toBe("Jane Dozer");
    expect(ride.paymentStatus).toBe("paid_direct");
    expect(ride.status).toBe("pending");
  });

  it("omits coupon fields when none is applied", () => {
    const ride = buildRideRequest(input, "2026-10-21T00:00:00.000Z");
    expect(ride).not.toHaveProperty("couponCode");
    expect(ride.totalClientCharge).toBe(10.2);
  });

  it("caps the discount and floors the total", () => {
    expect(effectiveDiscount({ code: "X", discountAmount: 3 }, 8.7)).toBe(3);
    expect(effectiveDiscount(null, 8.7)).toBe(0);
    expect(totalDue(8.7, 1.5, 20)).toBe(0);
    expect(totalDue(8.7, 1.5, 0.3)).toBe(9.9);
  });
});
