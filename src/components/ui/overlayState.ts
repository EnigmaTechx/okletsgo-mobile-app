import { useEffect } from "react";

/**
 * How many sheets or dialogs are open right now. Gestures under them (the
 * draggable ride panel) check this so a swipe inside a sheet never moves
 * what is behind it.
 */
let openOverlays = 0;

export const anyOverlayOpen = (): boolean => openOverlays > 0;

/** Count this overlay while `visible`. */
export function useOverlayOpen(visible: boolean): void {
  useEffect(() => {
    if (!visible) return;
    openOverlays += 1;
    return () => {
      openOverlays -= 1;
    };
  }, [visible]);
}
