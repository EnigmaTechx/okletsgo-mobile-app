# Phase 5 — Shared and admin

Everything the parity tracker still had open: the owner-role Admin section,
the flagged Payment and Payouts pages, profile and vehicle photos. The gate
for this phase is the table at the end: every route in the Ionic `App.tsx`
has a screen here, or a deliberate "not carried" note.

## What landed

| Area                 | Screen / module                                                                                                     | Ionic source                                                                  |
| -------------------- | ------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Admin home           | `admin/index`                                                                                                       | `pages/admin/AdminHome.tsx`                                                   |
| Clients              | `admin/clients/index`, `admin/clients/[id]` (Activity / Profile)                                                    | `AdminClients`, `AdminClientDetail`                                           |
| Drivers              | `admin/drivers/index`, `admin/drivers/[id]` (Activity / Pay / Profile), `…/rides`, `…/weeks/[week]`                 | `AdminDrivers`, `AdminDriverDetail`, `AdminDriverRides`, `AdminDriverWeek`    |
| Rides                | `admin/rides/index` (summary + chart), `admin/rides/all` (Today / Upcoming / History, driver filter), `admin/ride/[id]` | `AdminRides`, `AdminAllRides`, `AdminRideDetail`                           |
| Admin building blocks | `components/admin/AdminUi.tsx` (loader, tiles, pills, rows, bar chart, search, chips)                              | `AdminHome.css`, `AdminPageHeader`                                            |
| Data                 | `services/adminStatsService.ts` (+ `fetchOpenRides`, open rides on both details), `utils/adminRideBuckets.ts`       | same names                                                                    |
| Payment              | `(common)/payment` behind the `payment` flag                                                                        | `pages/common/Payment.tsx`                                                    |
| Earnings & Payouts   | `(drive)/payouts` behind the `driver_payouts` flag                                                                  | `pages/common/Earnings.tsx`                                                   |
| Photos               | `hooks/usePhotoPicker.ts`; avatar on Edit profile, photo row on Vehicle                                             | `CircularPhotoCropModal`, `storageService` (`@capacitor/camera`)              |
| Account entries      | "Money" (Payment, Payouts) and "Owner tools" (Admin) sections on the Account tab                                   | side menu entries                                                             |

## Admin section

- Entered from Account → Owner tools → Admin, shown only to a profile with
  an app role (`config/appRoles.ts`, written by the admin dashboard). The
  root layout keeps the group out of the navigator otherwise and the
  group's layout redirects if the role is revoked while it is open.
- Every page fetches on focus (first open and each return from a
  sub-page), pulls to refresh, and retries on error, through
  `useAdminLoad`. Sandbox accounts and rides are filtered the same way the
  Ionic service did; nothing here needs a rules change.
- The driver's Activity tab shows a "Now" card with the live ride's
  `driverLocation` on the shared `RideMap` (location is only tracked during
  a trip). The Pay tab reuses `driverStatsService` (`buildDriverStats`,
  `buildWeeklyPay`), so the owner's weekly pay and the driver's own Earnings
  page can never disagree.
- Detail pages switch tabs with the `SegmentedControl` at the top rather
  than Ionic's footer tabs; History loads more with a button rather than
  infinite scroll.

## Photos

`usePhotoPicker` asks "Take photo / Choose from library", uses the system
picker's own crop (square for the profile, 4:3 for the vehicle), shrinks
the result with expo-image-manipulator (512 px / 1000 px JPEG) and hands
back a local file. Uploads go to the same Storage paths as before
(`users/{uid}/profile.jpg`, `users/{uid}/vehicle.jpg`), so the admin
dashboard keeps showing them. A new vehicle photo is uploaded straight
away and travels with the change request, as in the Ionic app.

Native modules added: `expo-image-picker`, `expo-image-manipulator` (and
the picker's config plugin with the permission strings). After pulling:
`npm install`, `npx expo prebuild --clean`, `npx expo run:android`.

## Route parity (the phase gate)

| Ionic route                              | Here                                                     |
| ---------------------------------------- | -------------------------------------------------------- |
| `/onboarding`                            | `(auth)/onboarding`, `(auth)/welcome`                    |
| `/auth/login`, `/auth/otp`               | `(auth)/login`, `(auth)/otp`                             |
| `/auth/role-select`                      | `(auth)/role-select`                                     |
| `/auth/complete-profile`                 | `(auth)/complete-profile`                                |
| `/auth/driver-vehicle-info`              | `(auth)/driver-vehicle-info`                             |
| `/client/ride-wizard/*` (4 steps)        | `(ride)/book/locations`, `schedule`, `driver`, `confirm` |
| `/client/booking-success`                | `(ride)/book/success`                                    |
| `/client/home`                           | `(client)/index`                                         |
| `/client/ride-status/:id`                | `(ride)/live/[id]` (+ `(ride)/complete/[id]`)            |
| `/client/coupons`                        | `(client)/rewards`                                       |
| `/saved-addresses`, `/add`, `/edit/:id`  | `(ride)/places/index`, `(ride)/places/edit`              |
| `/history`                               | `(client)/trips`, `(driver)/trips`                       |
| `/history/:id`                           | `(common)/history/[id]`                                  |
| `/driver/dashboard`                      | `(driver)/index`                                         |
| `/driver/ride/:id`                       | `(drive)/ride/[id]`                                      |
| `/driver/earnings`                       | `(driver)/earnings` (flag `driver_earnings`)             |
| `/profile`                               | `(common)/profile`                                       |
| `/driver/profile`                        | `(common)/profile` + `(drive)/vehicle`                   |
| `/settings`                              | Account tab (`(client)/account`, `(driver)/account`)     |
| `/support`, `/terms`                     | `(common)/support`, `(common)/terms`                     |
| `/payment`                               | `(common)/payment` (flag `payment`)                      |
| `/earnings`                              | `(drive)/payouts` (flag `driver_payouts`)                |
| `/admin`                                 | `admin/index`                                            |
| `/admin/clients`, `/admin/clients/:id`   | `admin/clients/index`, `admin/clients/[id]`              |
| `/admin/rides`                           | `admin/rides/index`                                      |
| `/admin/rides/all`                       | `admin/rides/all`                                        |
| `/admin/ride/:id`                        | `admin/ride/[id]`                                        |
| `/admin/drivers`, `/admin/drivers/:id`   | `admin/drivers/index`, `admin/drivers/[id]`              |
| `/admin/drivers/:id/weeks/:week`         | `admin/drivers/[id]/weeks/[week]`                        |
| `/admin/drivers/:id/rides`               | `admin/drivers/[id]/rides`                               |
| `auth/SignUp.tsx`                        | Not carried: unrouted in the Ionic app (dead file)       |
| Side menu                                | Not carried: tabs + Account replace it (phase 1 decision) |

## Not in this phase

- Card payments themselves (`FEATURES.STRIPE_PAYMENTS` stays off; the
  Payment page is the notice until then).
- A payout provider behind Cash Out / Link Bank Account.
- The ride-details UI match to Ionic v1.6.0 (ConfirmSheet, compact cards,
  "You're early"), kept for the polish pass after this phase.
