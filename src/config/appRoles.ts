import type { AppRole, UserProfile } from "../interfaces/user";

/**
 * The single place that answers "what may this signed-in user see beyond a
 * normal client/driver?". Pages and the side menu ask these helpers instead of
 * inspecting `appRoles` directly, so adding a role later is a one-line change.
 *
 * `appRoles` is written only by the admin dashboard (Firestore rules reject a
 * user setting it on themselves), so trusting it here is safe. It is still
 * UI-level gating: the data these screens read is already readable by any
 * signed-in user under the current rules.
 */

/** Roles that unlock the in-app Admin section. */
const ADMIN_SECTION_ROLES: readonly AppRole[] = ["owner", "support", "developer"];

export const getAppRoles = (profile: UserProfile | null | undefined): AppRole[] =>
  Array.isArray(profile?.appRoles) ? profile!.appRoles! : [];

export const hasAppRole = (
  profile: UserProfile | null | undefined,
  role: AppRole,
): boolean => getAppRoles(profile).includes(role);

/** True when the user should see the Admin entry in the menu and its pages. */
export const canAccessAdminSection = (
  profile: UserProfile | null | undefined,
): boolean => getAppRoles(profile).some((r) => ADMIN_SECTION_ROLES.includes(r));

/** Product owner: full Admin section (clients, km, summaries). */
export const isProductOwner = (profile: UserProfile | null | undefined): boolean =>
  hasAppRole(profile, "owner");
