# UI parity pass — the ride sheets

The ride screens now follow the Ionic app's current sheets (v1.6.0's "one
confirmation sheet everywhere, shorter notices, compact ride cards", plus
the later text-size tweaks), read from `rideshare-ionic-app` at v1.7.1.

## What changed

| Piece                       | Here                                                                 | Ionic source                              |
| --------------------------- | -------------------------------------------------------------------- | ----------------------------------------- |
| One confirmation dialog     | `components/ui/ConfirmSheet.tsx`                                     | `ConfirmSheet.tsx` / `.css`               |
| Status pill                 | `components/ui/SheetPill.tsx` (gold / blue / green / orange / grey)  | `SheetPill.tsx`, `SheetLayout.css`        |
| Sheet shell                 | `components/rides/SheetParts.tsx` (head, person row, price, card, note, buttons) | `SheetLayout.css`             |
| Route with inline distances | `RouteTimeline` `size` + `pickupSuffix` / `dropoffSuffix` / `pickupAfter` | `DistanceTag.tsx`, route CSS          |
| Driver: new request         | `drive/IncomingRequestPanel.tsx`                                     | `IncomingRequestCard.tsx`                 |
| Driver: active trip         | `drive/ActiveRidePanel.tsx`                                          | `ActiveRideControls.tsx`                  |
| Rider: live status          | `rides/ClientRideStatusPanel.tsx` (route, total, note, cancel)       | `ClientRideStatus.tsx`                    |
| Rider: cancel / end early   | `rides/CancelRideSheet.tsx` on `ConfirmSheet`                        | `ClientRideStatus.tsx`                    |
| Background-location consent | `(drive)/ride/[id]` disclosure as a `ConfirmSheet`                   | `DriverRideDetails.tsx`                   |
| Sign out, delete account    | `AccountScreen` on `ConfirmSheet`                                    | `Settings.tsx`                            |

`ReasonSheet` is gone: every pick-a-reason sheet is a `ConfirmSheet` with
`options`. The copy, button labels and tones are the Ionic ones ("Cancel
Job?", "Keep Ride", "Not at Drop-off Yet", "You're early", "Decline Ride").

The driver's sheet header (pill + one line) is measured and becomes the
collapsed panel, so a collapsed sheet shows the status and the pickup line
and nothing half-cut beneath it.

## Kept on purpose

- The rider's headline, four-step progress bar and driver row at the top of
  the live panel are the approved mockup from phase 2 and stay. Everything
  under them (route card with the date, time and Edit time inline, the
  Total card, the hand-off note, the outline Cancel button) follows the
  Ionic sheet.
- Call stays on the driver's sheet. The Ionic app replaced it with in-app
  chat on 27 Oct (see below); until chat is ported there is nothing else to
  put there.

## Not matched: features the Ionic app added after the freeze

These are behaviour, not styling, and need their own decision and phase.
Each is live in the Ionic app at v1.7.1:

- **In-app ride chat** (`sendRideMessage` function, `rides/{id}/messages`,
  masked contact details, unread badges, a RideChat page). Calling was
  removed from both sides.
- **Dispatch**: riders book through one dispatcher (Andy), who accepts,
  assigns or reassigns rides (`config/dispatch`, an Assign sheet, an admin
  Dispatch page, `dispatcherId` / `assignedBy` on the ride).
- **Public profiles**: `publicProfiles/{uid}` mirrored from `users/{uid}`
  by a function, read instead of other people's user documents. The rules
  still allow the old reads today; the Ionic code is written for the day
  they stop.
- **Address privacy**: drivers see street and city only outside a trip
  (`utils/addressPrivacy.ts`), with GPS and the full address opening at trip
  start.
- **Account purge** function (30 days after the request, rides anonymised).
- **App Check** (Play Integrity / App Attest) on the Firebase project.
- Smaller: impossible phone numbers caught before sending a code, the
  SMS-region block message, today's and tomorrow's requests pinned on the
  driver home, the owner's Call button, per-trip ratings hidden from
  drivers, larger rider detail text.
