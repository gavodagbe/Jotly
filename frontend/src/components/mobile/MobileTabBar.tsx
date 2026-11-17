"use client";

import type { ReactNode } from "react";
import type { MobileScreen } from "./mobile-screens";

type Tab = { id: MobileScreen; fr: string; en: string; icon: ReactNode };

const iconProps = { viewBox: "0 0 20 20", className: "h-6 w-6", fill: "none", stroke: "currentColor", strokeWidth: 1.7 } as const;

const TABS: Tab[] = [
  {
    id: "today",
    fr: "Aujourd'hui",
    en: "Today",
    icon: (
      <svg {...iconProps}>
        <rect x="3" y="4" width="14" height="13" rx="2" />
        <path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "tasks",
    fr: "Tâches",
    en: "Tasks",
    icon: (
      <svg {...iconProps}>
        <path d="M4 5.5l1.5 1.5L8 4.5M4 10.5l1.5 1.5L8 9.5M4 15.5l1.5 1.5L8 14.5M11 6h5M11 11h5M11 16h5" strokeLinecap="round" strokeLinejoin="round" />
      </svg>
    ),
  },
  {
    id: "journal",
    fr: "Journal",
    en: "Journal",
    icon: (
      <svg {...iconProps}>
        <path d="M5 3h9a2 2 0 012 2v11a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
        <path d="M7 3v14M10 7h3M10 10h3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "notes",
    fr: "Notes",
    en: "Notes",
    icon: (
      <svg {...iconProps}>
        <path d="M5 3h10a1 1 0 011 1v8l-5 5H5a1 1 0 01-1-1V4a1 1 0 011-1z" strokeLinejoin="round" />
        <path d="M11 17v-4a1 1 0 011-1h4M7 7h6M7 10h3" strokeLinecap="round" />
      </svg>
    ),
  },
  {
    id: "more",
    fr: "Plus",
    en: "More",
    icon: (
      <svg {...iconProps}>
        <circle cx="5" cy="10" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="10" cy="10" r="1.3" fill="currentColor" stroke="none" />
        <circle cx="15" cy="10" r="1.3" fill="currentColor" stroke="none" />
      </svg>
    ),
  },
];

type MobileTabBarProps = {
  isFrench: boolean;
  activeScreen: MobileScreen;
  onSelect: (screen: MobileScreen) => void;
  badges?: Partial<Record<MobileScreen, number>>;
};

/** Bottom tab bar shown below the `lg` breakpoint: one tab per mobile screen. */
export function MobileTabBar({ isFrench, activeScreen, onSelect, badges = {} }: MobileTabBarProps) {
  return (
    <nav
      aria-label={isFrench ? "Navigation principale" : "Main navigation"}
      className="fixed inset-x-0 bottom-0 z-30 border-t border-line bg-surface/95 backdrop-blur-sm lg:hidden"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <ul className="mx-auto flex max-w-xl">
        {TABS.map((tab) => {
          const isActive = tab.id === activeScreen;
          const badge = badges[tab.id] ?? 0;
          return (
            <li key={tab.id} className="flex-1">
              <button
                type="button"
                onClick={() => onSelect(tab.id)}
                aria-current={isActive ? "page" : undefined}
                className={`relative flex h-16 w-full flex-col items-center justify-center gap-1 text-[11px] font-medium transition-colors ${
                  isActive ? "text-accent" : "text-muted active:text-foreground"
                }`}
              >
                <span className={`relative grid h-8 w-14 place-items-center rounded-full transition-colors ${isActive ? "bg-accent-soft" : ""}`}>
                  {tab.icon}
                  {badge > 0 && (
                    <span className="absolute right-2 top-0 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white">
                      {badge > 9 ? "9+" : badge}
                    </span>
                  )}
                </span>
                {isFrench ? tab.fr : tab.en}
              </button>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
