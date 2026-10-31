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
- Chat replaced Call on the driver's sheet (the owner keeps Call), see
  `docs/CHAT-DISPATCH.md`.

## Not matched: features the Ionic app added after the freeze

These are behaviour, not styling, and need their own decision and phase.
Each is live in the Ionic app at v1.7.1. **In-app ride chat**, **dispatch**
and the **public profiles** reader (with its fallback to `users/{uid}`) are
now ported: see `docs/CHAT-DISPATCH.md`. Still open:

- **Address privacy**: drivers see street and city only outside a trip
  (`utils/addressPrivacy.ts`), with GPS and the full address opening at trip
  start.
- **Account purge** function (30 days after the request, rides anonymised).
- **App Check** (Play Integrity / App Attest) on the Firebase project.
- Smaller: impossible phone numbers caught before sending a code, the
  SMS-region block message, per-trip ratings hidden from drivers, larger
  rider detail text. (Today's and tomorrow's requests pinned on the driver
  home and the owner's Call button came with the chat/dispatch port.)
