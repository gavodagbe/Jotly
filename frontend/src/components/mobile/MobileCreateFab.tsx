"use client";

import { useState } from "react";
import { PlusIcon } from "@/components/ui/icons";
import { createActionForScreen, type MobileScreen } from "./mobile-screens";

type MobileCreateFabProps = {
  isFrench: boolean;
  screen: MobileScreen;
  disabled?: boolean;
  /** Hidden while a bottom sheet (alerts, assistant, triage) is open, so it never covers it. */
  isHidden?: boolean;
  onCreateTask: () => void;
  onCreateNote: () => void;
  onCreateReminder: () => void;
};

/** Distance kept above the tab bar (64px) and the iPhone home indicator. */
export const ABOVE_TAB_BAR = "calc(4rem + env(safe-area-inset-bottom) + 1rem)";

/** Floating "+" shown above the mobile tab bar; creates what fits the current screen. */
export function MobileCreateFab({ isFrench, screen, disabled, isHidden, onCreateTask, onCreateNote, onCreateReminder }: MobileCreateFabProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const action = createActionForScreen(screen);
  if (!action || isHidden) return null;

  const label =
    action === "task" ? (isFrench ? "Nouvelle tâche" : "New task") : isFrench ? "Créer une note ou un rappel" : "Create a note or reminder";

  function handlePress() {
    if (action === "task") onCreateTask();
    else setIsMenuOpen((open) => !open);
  }

  function choose(run: () => void) {
    setIsMenuOpen(false);
    run();
  }

  return (
    <div className="fixed right-4 z-40 flex flex-col items-end gap-2 lg:hidden" style={{ bottom: ABOVE_TAB_BAR }}>
      {isMenuOpen && (
        <div className="animate-scale-in flex flex-col gap-2" role="menu">
          <button type="button" role="menuitem" className="rounded-full bg-surface px-4 py-3 text-sm font-semibold text-foreground shadow-lg ring-1 ring-line" onClick={() => choose(onCreateNote)}>
            {isFrench ? "Note" : "Note"}
          </button>
          <button type="button" role="menuitem" className="rounded-full bg-surface px-4 py-3 text-sm font-semibold text-foreground shadow-lg ring-1 ring-line" onClick={() => choose(onCreateReminder)}>
            {isFrench ? "Rappel" : "Reminder"}
          </button>
        </div>
      )}
      <button
        type="button"
        aria-label={label}
        aria-expanded={action === "noteOrReminder" ? isMenuOpen : undefined}
        disabled={disabled}
        onClick={handlePress}
        className={`inline-flex h-14 w-14 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white shadow-lg transition-transform active:scale-95 disabled:opacity-60 [&_svg]:h-6 [&_svg]:w-6 ${isMenuOpen ? "rotate-45" : ""}`}
      >
        <PlusIcon />
      </button>
    </div>
  );
}
