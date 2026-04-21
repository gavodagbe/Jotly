"use client";

import type { MouseEvent as ReactMouseEvent } from "react";

import { APP_NAME } from "@/lib/app-meta";
import { controlButtonClass } from "@/components/ui/constants";
import { BellIcon, SearchIcon } from "@/components/ui/icons";

type UserLocale = "en" | "fr";

type AuthUser = {
  id: string;
  email: string;
  displayName: string | null;
  preferredLocale: UserLocale;
  preferredTimeZone: string | null;
  requireDailyAffirmation: boolean;
  requireDailyBilan: boolean;
  requireWeeklySynthesis: boolean;
  requireMonthlySynthesis: boolean;
  createdAt: string;
};

type AlertsSummary = {
  count: number;
  overdueCount: number;
  todayCount: number;
  tomorrowCount: number;
};

type AppNavbarProps = {
  locale: UserLocale;
  user: AuthUser | null;
  onLogout?: () => void;
  onOpenProfile?: () => void;
  onLogin?: () => void;
  alertsSummary?: AlertsSummary | null;
  isTaskAlertsPanelOpen?: boolean;
  onOpenTaskAlerts?: () => void;
  onOpenSearch?: () => void;
  isBusy?: boolean;
  isProjectPlanningOpen?: boolean;
  onOpenProjectPlanning?: () => void;
  showMonthlyReview?: boolean;
  showWeeklyReview?: boolean;
  activeSectionId?: string;
  onSectionChange?: (id: string) => void;
  isProfileDialogOpen?: boolean;
  isAssistantPanelOpen?: boolean;
  isSidebarCollapsed?: boolean;
  onToggleSidebar?: () => void;
};

export function AppNavbar({
  locale,
  user,
  onLogout,
  onOpenProfile,
  onLogin,
  alertsSummary,
  isTaskAlertsPanelOpen = false,
  onOpenTaskAlerts,
  onOpenSearch,
  isBusy = false,
  isProjectPlanningOpen = false,
  onOpenProjectPlanning,
  showMonthlyReview = false,
  showWeeklyReview = false,
  activeSectionId = "",
  onSectionChange,
  isProfileDialogOpen = false,
  isAssistantPanelOpen = false,
  isSidebarCollapsed = false,
  onToggleSidebar,
}: AppNavbarProps) {
  const isLoggedIn = user !== null;
  const isFrench = locale === "fr";
  const profileLabel = user?.displayName ?? user?.email ?? (isFrench ? "Invite" : "Guest");
  const initials = profileLabel.slice(0, 2).toUpperCase();
  const taskAlertsCount = alertsSummary?.count ?? 0;
  const taskAlertsLabel = isFrench ? "Alertes" : "Alerts";

  const activeMobileTab =
    isProfileDialogOpen ? "profil" :
    isAssistantPanelOpen ? "assistant" :
    ["overview", "dailyControls", "reminders"].includes(activeSectionId) ? "jour" :
    activeSectionId === "board" ? "kanban" :
    activeSectionId === "affirmation" ? "affirmation" :
    ["bilan", "monthlyObjective", "monthlyReview", "weeklyObjective", "weeklyReview"].includes(activeSectionId) ? "bilan" :
    ["notes", "gaming"].includes(activeSectionId) ? "espace" : "";

  function handleTabClick(event: ReactMouseEvent<HTMLAnchorElement>, targetId: string) {
    const elementId = targetId.replace("#", "");
    const element = document.getElementById(elementId);
    if (element) {
      event.preventDefault();
      window.history.pushState(null, "", targetId);
      element.scrollIntoView({ behavior: "smooth" });
      onSectionChange?.(elementId);
    }
  }

  function navItem(ids: string | string[], collapsed: boolean) {
    const idList = Array.isArray(ids) ? ids : [ids];
    const isActive = idList.includes(activeSectionId);
    if (collapsed) {
      return `flex h-9 w-9 mx-auto items-center justify-center rounded-lg text-sm transition-colors duration-150 ${
        isActive ? "bg-accent-soft text-accent border-l-2 border-accent" : "text-foreground/80 hover:bg-surface-soft hover:text-foreground"
      }`;
    }
    return `flex w-full items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm transition-colors duration-150 ${
      isActive ? "bg-accent-soft text-accent border-l-2 border-accent" : "text-foreground/80 hover:bg-surface-soft hover:text-foreground"
    }`;
  }

  function groupHeader(fr: string, en: string) {
    if (isSidebarCollapsed) return <div className="my-2 mx-2 border-t border-line" />;
    return (
      <p className="px-2 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {isFrench ? fr : en}
      </p>
    );
  }

  return (
    <>
      <aside
        className={`fixed left-0 top-0 z-30 hidden h-screen flex-col border-r border-line bg-surface transition-[width] duration-200 lg:flex ${
          isSidebarCollapsed ? "w-[56px]" : "w-[260px]"
        }`}
      >
        <div className={`flex items-center gap-3 py-5 ${isSidebarCollapsed ? "justify-center px-0" : "px-5"}`}>
          <div className="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-sm font-bold text-white">J</div>
          {!isSidebarCollapsed && (
            <div className="overflow-hidden">
              <p className="truncate text-sm font-semibold text-foreground">{APP_NAME}</p>
              <p className="text-[11px] text-muted">{isFrench ? "Planification quotidienne" : "Daily planner"}</p>
            </div>
          )}
        </div>

        <div className={`pb-2 ${isSidebarCollapsed ? "flex justify-center px-2" : "px-3"}`}>
          {isSidebarCollapsed ? (
            <button
              type="button"
              onClick={onOpenSearch}
              disabled={!onOpenSearch}
              title={isFrench ? "Rechercher" : "Search"}
              className="flex h-9 w-9 items-center justify-center rounded-lg border border-line bg-surface-soft text-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent"
            >
              <SearchIcon />
            </button>
          ) : (
            <button
              type="button"
              onClick={onOpenSearch}
              disabled={!onOpenSearch}
              className="flex w-full items-center gap-2.5 rounded-lg border border-line bg-surface-soft px-3 py-2 text-sm text-muted transition-colors hover:border-accent/40 hover:bg-accent-soft hover:text-accent"
            >
              <SearchIcon />
              <span className="flex-1 text-left">{isFrench ? "Rechercher..." : "Search..."}</span>
              <kbd className="rounded border border-line px-1.5 py-0.5 text-[10px] text-muted">⌘K</kbd>
            </button>
          )}
        </div>

        <div className="flex-1 overflow-y-auto px-3">
          <nav className="space-y-0.5">
            {groupHeader("Aujourd'hui", "Today")}
            <a href="#overview" title={isSidebarCollapsed ? (isFrench ? "Vue d'ensemble" : "Overview") : undefined} className={navItem("overview", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="6" height="6" rx="1.5"/><rect x="11" y="3" width="6" height="6" rx="1.5"/><rect x="3" y="11" width="6" height="6" rx="1.5"/><rect x="11" y="11" width="6" height="6" rx="1.5"/></svg>
              {!isSidebarCollapsed && (isFrench ? "Vue d'ensemble" : "Overview")}
            </a>
            <a href="#dailyControls" title={isSidebarCollapsed ? (isFrench ? "Pilotage du jour" : "Day Controls") : undefined} className={navItem("dailyControls", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round"/></svg>
              {!isSidebarCollapsed && (isFrench ? "Pilotage du jour" : "Day Controls")}
            </a>
            <a href="#affirmation" title={isSidebarCollapsed ? "Affirmation" : undefined} className={navItem("affirmation", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 3l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z"/></svg>
              {!isSidebarCollapsed && "Affirmation"}
            </a>
            <a href="#reminders" title={isSidebarCollapsed ? (isFrench ? "Rappels" : "Reminders") : undefined} className={navItem("reminders", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 4a5 5 0 00-5 5v3l-1 2h12l-1-2V9a5 5 0 00-5-5zM8.5 16a1.5 1.5 0 003 0" strokeLinecap="round" strokeLinejoin="round"/></svg>
              {!isSidebarCollapsed && (isFrench ? "Rappels" : "Reminders")}
            </a>
            <a href="#bilan" title={isSidebarCollapsed ? (isFrench ? "Bilan du jour" : "Day Bilan") : undefined} className={navItem("bilan", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 15V8M8 15V5M12 15V9M16 15V6" strokeLinecap="round"/></svg>
              {!isSidebarCollapsed && (isFrench ? "Bilan du jour" : "Day Bilan")}
            </a>

            {groupHeader("Semaine & Mois", "Week & Month")}
            <a href="#weeklyObjective" title={isSidebarCollapsed ? (isFrench ? "Objectif semaine" : "Weekly Objective") : undefined} className={navItem(["weeklyObjective", "weeklyReview"], isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 5h14M3 10h10M3 15h7" strokeLinecap="round"/></svg>
              {!isSidebarCollapsed && (isFrench ? "Objectif de la semaine" : "Weekly Objective")}
            </a>
            {showWeeklyReview && (
              <a href="#weeklyReview" title={isSidebarCollapsed ? (isFrench ? "Bilan semaine" : "Weekly Review") : undefined}
                className={`${navItem("weeklyReview", isSidebarCollapsed)} ${activeSectionId !== "weeklyReview" ? "text-violet-700 hover:bg-violet-50 hover:text-violet-800" : ""}`}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-violet-500" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M3 5h14M3 10h10M3 15h7" strokeLinecap="round"/><path d="M14 12l2 2 3-3" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {!isSidebarCollapsed && (isFrench ? "Bilan de la semaine" : "Weekly Review")}
              </a>
            )}
            <a href="#monthlyObjective" title={isSidebarCollapsed ? (isFrench ? "Objectif du mois" : "Monthly Objective") : undefined} className={navItem(["monthlyObjective", "monthlyReview"], isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round"/><path d="M7 12h6M7 15h4" strokeLinecap="round"/></svg>
              {!isSidebarCollapsed && (isFrench ? "Objectif du mois" : "Monthly Objective")}
            </a>
            {showMonthlyReview && (
              <a href="#monthlyReview" title={isSidebarCollapsed ? (isFrench ? "Bilan du mois" : "Monthly Review") : undefined}
                className={`${navItem("monthlyReview", isSidebarCollapsed)} ${activeSectionId !== "monthlyReview" ? "text-amber-700 hover:bg-amber-50 hover:text-amber-800" : ""}`}
              >
                <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round"/><path d="M7 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round"/></svg>
                {!isSidebarCollapsed && (isFrench ? "Bilan du mois" : "Monthly Review")}
              </a>
            )}

            {groupHeader("Workspace", "Workspace")}
            <a href="#board" title={isSidebarCollapsed ? (isFrench ? "Tableau Kanban" : "Kanban Board") : undefined} className={navItem("board", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 7h14M8 7v10M13 7v10"/></svg>
              {!isSidebarCollapsed && (isFrench ? "Tableau Kanban" : "Kanban Board")}
            </a>
            <button
              type="button"
              title={isSidebarCollapsed ? (isFrench ? "Planification projet" : "Project Planning") : undefined}
              className={`${navItem("", isSidebarCollapsed)} ${isProjectPlanningOpen ? "bg-accent-soft text-accent" : ""}`}
              onClick={onOpenProjectPlanning}
              disabled={isBusy || !onOpenProjectPlanning}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="2" y="4" width="16" height="2.5" rx="1"/>
                <rect x="2" y="8.75" width="11" height="2.5" rx="1"/>
                <rect x="2" y="13.5" width="14" height="2.5" rx="1"/>
              </svg>
              {!isSidebarCollapsed && <span className="flex-1 text-left">{isFrench ? "Planification projet" : "Project Planning"}</span>}
            </button>

            {groupHeader("Mon suivi", "My Track")}
            <a href="#notes" title={isSidebarCollapsed ? "Notes" : undefined} className={navItem("notes", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 3h10a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M7 7h6M7 10h6M7 13h4" strokeLinecap="round"/></svg>
              {!isSidebarCollapsed && "Notes"}
            </a>
            <a href="#gaming" title="Gaming Track" className={navItem("gaming", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M5 3h10l-1.5 7a3.5 3.5 0 01-7 0L5 3z" strokeLinejoin="round"/>
                <path d="M10 13.5V16" strokeLinecap="round"/>
                <path d="M7 16h6" strokeLinecap="round"/>
                <path d="M3 3h2M15 3h2" strokeLinecap="round"/>
              </svg>
              {!isSidebarCollapsed && "Gaming Track"}
            </a>
            <button
              type="button"
              title={isSidebarCollapsed ? taskAlertsLabel : undefined}
              className={`${navItem("", isSidebarCollapsed)} ${isTaskAlertsPanelOpen ? "bg-rose-50 text-rose-600" : ""}`}
              onClick={onOpenTaskAlerts}
              disabled={isBusy || !onOpenTaskAlerts}
            >
              <span className="relative inline-flex h-4 w-4 shrink-0 items-center justify-center">
                <BellIcon />
                {taskAlertsCount > 0 && (
                  <span className="absolute -right-2 -top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white">
                    {taskAlertsCount > 9 ? "9+" : taskAlertsCount}
                  </span>
                )}
              </span>
              {!isSidebarCollapsed && <span className="flex-1 text-left">{taskAlertsLabel}</span>}
            </button>
          </nav>
        </div>

        <div className="border-t border-line px-3 py-4">
          {isLoggedIn && !isSidebarCollapsed && (
            <>
              <div className="flex items-center gap-3 rounded-lg px-2.5 py-2">
                <div className="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{initials}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{profileLabel}</p>
                </div>
              </div>
              <div className="mt-1 flex items-center gap-1 px-1">
                <button type="button" className="flex-1 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-surface-soft hover:text-foreground" onClick={onOpenProfile} disabled={isBusy || !onOpenProfile}>
                  {isFrench ? "Profil" : "Settings"}
                </button>
                <button type="button" className="flex-1 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-red-50 hover:text-red-500" onClick={onLogout} disabled={isBusy || !onLogout}>
                  {isFrench ? "Deconnexion" : "Logout"}
                </button>
              </div>
            </>
          )}
          {isLoggedIn && isSidebarCollapsed && (
            <div className="mb-2 flex justify-center">
              <button type="button" title={profileLabel} className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent" onClick={onOpenProfile} disabled={isBusy || !onOpenProfile}>
                {initials}
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? (isFrench ? "Développer" : "Expand") : (isFrench ? "Réduire" : "Collapse")}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-surface-soft hover:text-foreground ${isSidebarCollapsed ? "mx-auto h-8 w-8 justify-center" : "w-full"}`}
          >
            <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isSidebarCollapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
            {!isSidebarCollapsed && <span>{isFrench ? "Réduire" : "Collapse"}</span>}
          </button>
        </div>
      </aside>

      <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-line bg-surface/95 px-4 py-3 backdrop-blur-sm lg:hidden">
        <div className="flex items-center gap-2.5">
          <div className="grid h-8 w-8 place-items-center rounded-lg bg-gradient-to-br from-accent to-accent-strong text-xs font-bold text-white">J</div>
          <p className="text-sm font-semibold text-foreground">{APP_NAME}</p>
        </div>
        <div className="flex items-center gap-2">
          {isLoggedIn ? (
            <>
              <button type="button" className="inline-flex h-8 w-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-soft hover:text-foreground" onClick={onOpenSearch} disabled={!onOpenSearch} aria-label={isFrench ? "Rechercher" : "Search"}>
                <SearchIcon />
              </button>
              <button
                type="button"
                className={`relative inline-flex h-8 w-8 items-center justify-center rounded-lg transition-colors ${isTaskAlertsPanelOpen ? "bg-accent-soft text-accent" : "text-muted hover:bg-surface-soft hover:text-foreground"}`}
                onClick={onOpenTaskAlerts}
                disabled={isBusy || !onOpenTaskAlerts}
                aria-label={taskAlertsLabel}
              >
                <BellIcon />
                {taskAlertsCount > 0 && (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white">
                    {taskAlertsCount > 9 ? "9+" : taskAlertsCount}
                  </span>
                )}
              </button>
            </>
          ) : (
            <button type="button" className={controlButtonClass} onClick={onLogin} disabled={isBusy || !onLogin}>
              {isFrench ? "Connexion" : "Login"}
            </button>
          )}
        </div>
      </nav>

      {isLoggedIn && (
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex border-t border-line bg-surface/95 backdrop-blur-sm lg:hidden"
          style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
        >
          {(
            [
              {
                id: "jour",
                href: "#overview",
                label: isFrench ? "Jour" : "Day",
                icon: <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="4" width="14" height="13" rx="2"/><path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round"/></svg>,
              },
              {
                id: "kanban",
                href: "#board",
                label: isFrench ? "Tâches" : "Tasks",
                icon: <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><rect x="3" y="3" width="14" height="14" rx="2"/><path d="M3 7h14M8 7v10M13 7v10"/></svg>,
              },
              {
                id: "affirmation",
                href: "#affirmation",
                label: isFrench ? "Affirm." : "Affirm.",
                icon: <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M10 3l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z"/></svg>,
              },
              {
                id: "bilan",
                href: "#bilan",
                label: "Bilan",
                icon: <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M4 15V8M8 15V5M12 15V9M16 15V6" strokeLinecap="round"/></svg>,
              },
              {
                id: "espace",
                href: "#notes",
                label: isFrench ? "Espace" : "Space",
                icon: <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7"><path d="M5 3h10a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z"/><path d="M7 7h6M7 10h6M7 13h4" strokeLinecap="round"/></svg>,
              },
            ] as const
          ).map((tab) => (
            <a
              key={tab.id}
              href={tab.href}
              onClick={(event) => handleTabClick(event, tab.href)}
              className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
                activeMobileTab === tab.id ? "text-accent" : "text-muted hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </a>
          ))}
          <button
            type="button"
            className={`flex flex-1 flex-col items-center justify-center gap-1 py-2.5 text-[10px] font-medium transition-colors ${
              activeMobileTab === "profil" ? "text-accent" : "text-muted hover:text-foreground"
            }`}
            onClick={onOpenProfile}
            disabled={isBusy || !onOpenProfile}
          >
            <span className={`grid h-5 w-5 place-items-center rounded-full text-[9px] font-semibold ${
              activeMobileTab === "profil" ? "bg-accent text-white" : "bg-accent-soft text-accent"
            }`}>
              {initials}
            </span>
            {isFrench ? "Profil" : "Profile"}
          </button>
        </nav>
      )}
    </>
  );
}
