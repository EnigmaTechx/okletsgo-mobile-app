# Phase 4 — Promotions

The first-ride-free gift, Andy's km program and admin-managed pop-ups. All
of it rides on the coupon path that already exists: fares, the driver's
payout and the ride document keep their shape, the platform absorbs the
discount.

## What landed

| Area                 | Module                                                                | Backed by                                                                 |
| -------------------- | --------------------------------------------------------------------- | ------------------------------------------------------------------------- |
| Config               | `config/promotions.ts` (types, eligibility, km math), tests           | `config/promotions` document, written by the admin's Promotions page      |
| Live state           | `contexts/PromotionsContext.tsx`                                      | one `onSnapshot`, a completed-rides check, the rider's open rides         |
| Pop-up               | `components/promo/PromoSheet.tsx`, `PromoPopup.tsx`                   | mounted on both Homes; dismissal stored in `users/{uid}.promoSeen`        |
| Home                 | yellow `WelcomeStrip` under the header                                | until the gift is used or expires                                         |
| Rewards tab          | `WelcomeHeroCard`, `KmBankCard`, then the coupon codes                | `kmBank()` from `totalKmTravelled` and `rewardKmRedeemed`                 |
| Checkout             | `(ride)/book/confirm`: gift applied by itself, "Use a km credit" row   | `bookingService.BookingPromo`; preview with `distanceDiscount`            |
| Server               | `services/promotionsService.ts`                                       | `claimWelcomePromo`, `redeemKmReward` (Ionic repo `functions/`, PR 153)   |
| Ride panels, history | `utils/promoLabels.ts`: "First ride free", "10 km credit applied"     | `promoId` / `kmRewardApplied` on the ride                                 |

## How the gift works

1. The admin creates a `welcome` item (title, body, `couponCode`,
   `maxFreeKm`, `newAccountDays`, dates) and the hidden `distance` coupon
   behind it, from the Promotions page.
2. The app shows the pop-up once to a client whose account is younger than
   `newAccountDays`, has no completed ride, and has not dismissed it (on any
   device). One pop-up per launch, never over an open ride, only on Home.
3. The confirm step applies the gift by itself: the trip fare is crossed out
   and "First ride free (up to 10 km)" shows. A longer trip has its first
   `maxFreeKm` km covered, valued at the active pricing.
4. `bookRide` writes the ride with `couponCode` and the previewed discount,
   then calls `claimWelcomePromo`. The function re-checks everything,
   redeems the hidden coupon (one per user, in the same transaction the
   coupon path uses) and writes `promoId` and the authoritative discount.
   If it refuses, the ride stays at full price and the rider is told.
5. A cancelled or expired ride returns the gift; the first completed ride
   ends it.

## Km rewards

`config/promotions.kmRewards = { enabled, kmPerCredit: 200, creditKm: 10 }`.
Credits = floor(`totalKmTravelled` / 200) − `rewardKmRedeemed`. The Rewards
tab shows the bank and the progress bar; checkout offers "Use a 10 km
credit" whenever one is banked (not alongside the gift: one discount per
ride). `redeemKmReward` spends it whole, prices it at the active pricing or
the whole fare when the trip is shorter, and records it in
`kmRewardRedemptions` so a cancellation can give it back. The rules stop a
rider writing either counter on their own profile.

Two details for Andy to confirm are unchanged from the roadmap: a credit
used on a trip shorter than 10 km is spent whole, and credits never expire.

## Pop-up copy

`{firstName}` in a title or body becomes the rider's first name. `ctaRoute`
is one of `book`, `rewards`, `trips`, `account`, `earnings` (named, so the
config can never point the app at an arbitrary route). `coupon` items show
their code with a copy button; `info` items are plain announcements.
Motion: 250 ms backdrop fade, a spring from 94 % scale; fade only with
Reduce Motion on.

## Not in this phase

- Points, milestones and referrals (no backend; see the roadmap's
  decisions list).
- A "You're early" or any other change to the ride screens' layout (the
  Ionic v1.6.0 match is a later polish pass).
