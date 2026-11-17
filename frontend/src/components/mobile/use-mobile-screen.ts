"use client";

import { useCallback, useEffect, useState } from "react";
import { DEFAULT_MOBILE_SCREEN, hashForScreen, screenFromHash, type MobileScreen } from "./mobile-screens";

/**
 * Current mobile screen, kept in the URL hash so the browser / Android back button
 * returns to the previous screen. Switching screens scrolls back to the top.
 */
export function useMobileScreen(): [MobileScreen, (screen: MobileScreen) => void] {
  const [screen, setScreen] = useState<MobileScreen>(DEFAULT_MOBILE_SCREEN);

  useEffect(() => {
    const sync = () => setScreen(screenFromHash(window.location.hash));
    sync();
    window.addEventListener("popstate", sync);
    window.addEventListener("hashchange", sync);
    return () => {
      window.removeEventListener("popstate", sync);
      window.removeEventListener("hashchange", sync);
    };
  }, []);

  const goTo = useCallback((next: MobileScreen) => {
    // Side effects stay outside the state updater (React may call updaters during render).
    if (screenFromHash(window.location.hash) !== next) {
      window.history.pushState(null, "", hashForScreen(next));
    }
    setScreen(next);
    window.scrollTo({ top: 0 });
  }, []);

  return [screen, goTo];
}
