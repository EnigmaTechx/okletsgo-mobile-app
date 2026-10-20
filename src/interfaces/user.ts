export type UserRole = "client" | "driver" | "admin";

/**
 * In-app elevated roles, separate from `role` (which decides whether someone
 * is a client or a driver and must not change). Granted only from the admin
 * dashboard; Firestore rules reject any self-assignment.
 *
 *  - owner     — product owner: sees the Admin section (clients, km, summaries)
 *  - support   — reserved: support staff (read-only client/ride lookup)
 *  - developer — reserved: engineering tools / diagnostics
 */
export type AppRole = "owner" | "support" | "developer";

export interface VehicleInfo {
  make: string;
  model: string;
  color: string;
  plateNumber: string;
  licenseNumber: string;
  photoUrl?: string;
  insuranceDocumentUrl?: string;
}

export interface UserProfile {
  uid: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string;
  role: UserRole;
  createdAt: string;

  // --- LEGACY FIELDS (Kept to prevent breaking current UI) ---
  isApproved?: boolean;

  // --- NEW STATUS FIELD (Made optional for backward compatibility) ---
  status?:
    "active" | "suspended" | "pending_approval" | "scheduled_for_deletion";

  // Images (Future)
  photoUrl?: string;
  driversLicenseUrl?: string;

  // Financials
  debt?: number;
  earnings?: number;

  // Lifetime km the client has travelled (credited by the completeRide
  // function on each completed trip) — the basis for promos/discounts.
  totalKmTravelled?: number;

  // ISO timestamp set when the client dismissed the one-time v1.3.7
  // "fresh start" notice — stored per account so a reinstall or a second
  // device never shows it again.
  freshStartNoticeSeenAt?: string;

  // Driver Specific
  isOnline?: boolean;
  vehicle?: VehicleInfo;
  rating?: number;
  ratingCount?: number;

  // Tax & Legal Info (Future)
  taxId?: string;

  // Internal test accounts — hidden from real users
  isTestAccount?: boolean;

  // In-app elevated roles (see AppRole). Managed from the admin dashboard.
  appRoles?: AppRole[];
}
