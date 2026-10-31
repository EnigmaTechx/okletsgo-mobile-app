# Chat and dispatch

Port of the Ionic app's two post-freeze features (v1.7.1): in-app ride chat
and dispatch. Nothing changes on the backend; both ride on the functions,
rules and documents the Ionic app already uses.

## In-app chat

- `services/chat.ts`: the same window rule as the function (`chatIsOpen`:
  heading to pickup through 15 minutes after the trip ends; a ride cancelled
  before the trip never opens it), `chatAvailable`, `unreadFor`,
  `sendRideMessage` (callable), `markChatRead`, `useRideMessages`,
  `useChatFlags`, the quick replies.
- `(common)/chat/[id]`: the chat screen. Header shows the other party (the
  driver sees the rider and "Pickup 7:00 PM · street"; the rider sees the
  driver, car and, once the driver has set off, the plate). Bubbles, time
  separators every 5 minutes, "A phone number was hidden" under a masked
  message, the payment reminder for the sender only. Quick-reply chips and
  the input while the chat is open, a lock line otherwise. Admins and the
  owner open it read-only from the admin ride page and see what was masked.
  Unread count is zeroed while the screen is open.
- Entry points: the Chat button on the driver's trip sheet (replaces Call;
  disabled until the trip starts, with an unread badge), the round chat
  button in the rider's driver row (from acceptance; enabled when the driver
  sets off), and a push with `type: "chat"` (routed straight to the chat; no
  banner when that chat is already on screen).
- The owner keeps a Call button, reading the number from
  `rides/{id}/private/contact` (the function moves `passengerPhone` there)
  with the ride field as the fallback for older rides.

## Dispatch

- `services/dispatch.ts`: `config/dispatch`, `dispatcherFor`,
  `fetchDispatchConfig` (any failure reads as "off" so booking never
  breaks), `useDispatchConfig`, `assignRide`, `reassignRide`,
  `updateDispatchSettings`.
- `services/publicProfiles.ts`: `publicProfiles/{uid}` with a fallback to
  `users/{uid}` while the old rules still allow it, as in the Ionic app.
  Booking, the Assign sheet and the Dispatch page read drivers through it.
- Booking (`book/driver.tsx`): with dispatch on, the list is only the
  dispatcher (also when offline unless the owner turned that off), with the
  note "Andy confirms every ride and may assign it to another vetted OK Let's
  Go driver." `viaDispatch` goes into the booking draft: no hand-off switch,
  `autoForward: false`, and the dispatcher passes the availability check
  while offline. The ride is written with `driverLastName: ""`; the
  function fills it in.
- Rider wording (`utils/eta.ts`): pending through the dispatcher reads
  "Confirming your driver…"; an assigned driver's acceptance reads "Driver
  confirmed" / "Andy confirmed your ride". No hand-off note on dispatched
  rides.
- Driver request sheet (`IncomingRequestPanel`): the dispatcher sees his
  countdown ("Auto-assigns in 4:59 if you don't respond" / "Reminder in…")
  and an "Assign to driver" button next to Decline (declining ends the
  ride; the sheet says so). An assigned driver sees "Assigned by Andy", the
  note, and "Can't take it", which sends the ride back with the reason
  (toast "Sent back to Andy").
- `AssignDriverSheet`: eligible drivers (approved, with a car, active, same
  sandbox bucket), online first then by rating, optional 200-character
  note. In reassign mode it lists everyone but the current driver, the
  dispatcher included, to take the ride back.
- Driver trip sheet (`ActiveRidePanel`): the dispatcher's own accepted ride
  gets Reassign beside Cancel. The screen leaves on its own when the ride is
  no longer this driver's (assignment, reassignment or the fallback).
- Driver home: today's and tomorrow's requests are pinned on top under
  "N requests need a response · 1 today" (shown offline too, with a note),
  with "Pickup in 20 min" or the dispatcher's "Auto-assigns in 7 min" chip;
  accepted rides and later requests share the "Coming up" day groups
  (`utils/driverHome.ts`).
- Admin: `admin/dispatch` (owner only) with the same rows as the Ionic page:
  the dispatcher toggle and picker, show-when-offline, the fallback (after
  5–60 min: next driver / remind me / keep waiting), return-to-dispatcher,
  and the sandbox test dispatcher. The admin ride page adds a Dispatch
  section (booked through, assigned by, the assignment history, Reassign
  for the dispatcher) and a Messages section (open the chat, flag counts).

## Not ported (still listed in UI-PARITY.md)

Address privacy for drivers, account purge, App Check, phone validation
before the SMS, hiding per-trip ratings from drivers.
