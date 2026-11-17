"use client";

import { useSyncExternalStore } from "react";

/** Same breakpoint as Tailwind `lg`: below it the app uses the mobile screens layout. */
export const MOBILE_LAYOUT_QUERY = "(max-width: 1023.98px)";

function subscribe(onChange: () => void): () => void {
  const query = window.matchMedia(MOBILE_LAYOUT_QUERY);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
}

const getSnapshot = () => window.matchMedia(MOBILE_LAYOUT_QUERY).matches;
const getServerSnapshot = () => false;

/** True below the `lg` breakpoint (phones and small tablets). */
export function useIsMobileLayout(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
}
