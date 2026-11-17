/**
 * Mobile navigation model (below the `lg` breakpoint): the dashboard sections are
 * grouped into five screens, one per bottom tab. Desktop keeps the single page.
 */

export const MOBILE_SCREENS = ["today", "tasks", "journal", "notes", "more"] as const;

export type MobileScreen = (typeof MOBILE_SCREENS)[number];

export const DEFAULT_MOBILE_SCREEN: MobileScreen = "today";

/** Which screen shows each dashboard section (section ids are the DOM ids). */
export const SECTION_SCREEN: Readonly<Record<string, MobileScreen>> = {
  overview: "today",
  dailyControls: "today",
  routine: "today",
  board: "tasks",
  affirmation: "journal",
  bilan: "journal",
  weeklyObjective: "journal",
  weeklyReview: "journal",
  monthlyObjective: "journal",
  monthlyReview: "journal",
  notes: "notes",
  reminders: "notes",
  gaming: "more",
};

export function isMobileScreen(value: unknown): value is MobileScreen {
  return typeof value === "string" && (MOBILE_SCREENS as readonly string[]).includes(value);
}

export function screenForSection(sectionId: string): MobileScreen | null {
  return SECTION_SCREEN[sectionId] ?? null;
}

/**
 * Reads the screen from a URL hash. Accepts a screen name (`#tasks`) or a legacy
 * section anchor (`#board` → tasks), so old links and the desktop sidebar keep working.
 */
export function screenFromHash(hash: string): MobileScreen {
  const value = hash.replace(/^#/, "");
  if (isMobileScreen(value)) return value;
  return screenForSection(value) ?? DEFAULT_MOBILE_SCREEN;
}

export function hashForScreen(screen: MobileScreen): string {
  return `#${screen}`;
}

/** Whether the floating "+" button is shown on a screen, and what it creates. */
export type CreateAction = "task" | "noteOrReminder" | null;

export function createActionForScreen(screen: MobileScreen): CreateAction {
  if (screen === "today" || screen === "tasks") return "task";
  if (screen === "notes") return "noteOrReminder";
  return null;
}
