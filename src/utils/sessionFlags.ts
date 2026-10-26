/**
 * Once-per-app-session guards, replacing the Ionic app's sessionStorage keys.
 * They reset when the app process restarts, which is the behaviour the
 * rating nudge and the ride-outcome pop-up rely on.
 */
const flags = new Set<string>();

export const sessionFlag = {
  has: (key: string): boolean => flags.has(key),
  set: (key: string): void => {
    flags.add(key);
  },
  /** Test helper. */
  reset: (): void => flags.clear(),
};

export const ratingNudgedKey = (rideId: string) => `ratingNudged:${rideId}`;
export const rideOutcomeShownKey = (rideId: string) =>
  `rideOutcomeShown:${rideId}`;
/** The "You've arrived" screen for a ride has been shown this session. */
export const tripCompleteShownKey = (rideId: string) =>
  `tripCompleteShown:${rideId}`;
/** A promotion pop-up has been shown this launch (at most one per launch). */
export const promoPopupShownKey = () => "promoPopupShown";
