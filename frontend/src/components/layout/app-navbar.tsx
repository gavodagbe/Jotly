"use client";

import { APP_NAME } from "@/lib/app-meta";
import { BellIcon, CalendarIcon, PlusIcon, SearchIcon } from "./app-shell.icons";
import { controlButtonClass } from "./app-shell.styles";
import type { UserLocale } from "./app-shell.types";

type NavbarUser = {
  email: string;
  displayName: string | null;
} | null;

type NavbarAlertsSummary = {
  count: number;
} | null;

export type AppNavbarProps = {
  locale: UserLocale;
  user: NavbarUser;
  onLogout?: () => void;
  onOpenProfile?: () => void;
  onLogin?: () => void;
  alertsSummary?: NavbarAlertsSummary;
  isTaskAlertsPanelOpen?: boolean;
  onOpenTaskAlerts?: () => void;
  onOpenSearch?: () => void;
  isBusy?: boolean;
  isProjectPlanningOpen?: boolean;
  onOpenProjectPlanning?: () => void;
  onCreateTask?: () => void;
  showMonthlyObjective?: boolean;
  showMonthlyReview?: boolean;
  showWeeklyObjective?: boolean;
  showWeeklyReview?: boolean;
  activeSectionId?: string;
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
  onCreateTask,
  showMonthlyObjective = false,
  showMonthlyReview = false,
  showWeeklyObjective = false,
  showWeeklyReview = false,
  activeSectionId = "",
  isSidebarCollapsed = false,
  onToggleSidebar,
}: AppNavbarProps) {
  const isLoggedIn = user !== null;
  const isFrench = locale === "fr";
  const profileLabel = user?.displayName ?? user?.email ?? (isFrench ? "Invite" : "Guest");
  const initials = profileLabel.slice(0, 2).toUpperCase();
  const taskAlertsCount = alertsSummary?.count ?? 0;
  const taskAlertsLabel = isFrench ? "Alertes" : "Alerts";
  const showPeriodicGroup = showWeeklyObjective || showWeeklyReview || showMonthlyObjective || showMonthlyReview;

  const activeMobileTab =
    ["overview", "dailyControls", "reminders"].includes(activeSectionId)
      ? "jour"
      : activeSectionId === "board"
        ? "kanban"
        : activeSectionId === "affirmation"
          ? "focus"
          : ["bilan", "monthlyObjective", "monthlyReview", "weeklyObjective", "weeklyReview", "notes", "gaming"].includes(activeSectionId)
            ? "insights"
              : "";
  const activeMobileLabel =
    activeMobileTab === "kanban"
      ? isFrench ? "Tableau" : "Board"
      : activeMobileTab === "focus"
        ? "Focus"
        : activeMobileTab === "insights"
          ? isFrench ? "Suivi" : "Insights"
          : isFrench ? "Aujourd'hui" : "Today";

  function navItem(ids: string | string[], collapsed: boolean) {
    const idList = Array.isArray(ids) ? ids : [ids];
    const isActive = idList.includes(activeSectionId);
    if (collapsed) {
      return `group mx-auto flex h-11 w-11 items-center justify-center rounded-[20px] text-sm transition-all duration-200 ${
        isActive
          ? "bg-gradient-to-br from-accent to-accent-strong text-white shadow-[0_18px_32px_rgba(53,37,205,0.24)]"
          : "text-foreground/58 hover:-translate-y-0.5 hover:bg-surface hover:text-accent"
      }`;
    }
    return `group flex w-full items-center gap-3 rounded-full px-4 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] transition-all duration-200 ${
      isActive
        ? "bg-gradient-to-br from-accent to-accent-strong text-white shadow-[0_18px_32px_rgba(53,37,205,0.24)]"
        : "text-foreground/58 hover:translate-x-1 hover:text-accent"
    }`;
  }

  function groupHeader(fr: string, en: string) {
    if (isSidebarCollapsed) return <div className="mx-2 my-2 border-t border-line" />;
    return (
      <p className="px-2 pb-1 pt-5 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted">
        {isFrench ? fr : en}
      </p>
    );
  }

  return (
    <>
      <aside
        className={`nav-shell fixed left-0 top-0 z-30 hidden h-screen flex-col transition-[width] duration-200 lg:flex ${
          isSidebarCollapsed ? "w-[56px]" : "w-[260px]"
        }`}
      >
        <div className={`flex items-center gap-3 py-5 ${isSidebarCollapsed ? "justify-center px-0" : "px-5"}`}>
          <div className="grid h-10 w-10 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-accent to-accent-strong text-sm font-bold text-white shadow-[0_14px_30px_rgba(53,37,205,0.28)]">
            J
          </div>
          {!isSidebarCollapsed ? (
            <div className="overflow-hidden">
              <p className="truncate text-sm font-semibold text-foreground">{APP_NAME}</p>
              <p className="text-[11px] text-muted">{isFrench ? "Planification quotidienne" : "Daily planner"}</p>
            </div>
          ) : null}
        </div>

        {isLoggedIn ? (
          <div className={isSidebarCollapsed ? "px-2 pb-3" : "px-3 pb-4"}>
            <button
              type="button"
              className={
                isSidebarCollapsed
                  ? "mx-auto flex h-11 w-11 items-center justify-center rounded-[20px] bg-gradient-to-br from-accent to-accent-strong text-white shadow-[0_18px_32px_rgba(53,37,205,0.24)] transition-all hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
                  : "flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-br from-accent to-accent-strong px-4 py-3 text-sm font-bold text-white shadow-[0_18px_32px_rgba(53,37,205,0.24)] transition-all hover:-translate-y-0.5 hover:brightness-105 disabled:cursor-not-allowed disabled:opacity-50"
              }
              onClick={onCreateTask}
              disabled={isBusy || !onCreateTask}
              aria-label={isFrench ? "Nouvelle entree" : "New Entry"}
              title={isSidebarCollapsed ? (isFrench ? "Nouvelle entree" : "New Entry") : undefined}
            >
              <PlusIcon />
              {!isSidebarCollapsed ? (isFrench ? "Nouvelle entree" : "New Entry") : null}
            </button>
          </div>
        ) : null}

        <div className="flex-1 overflow-y-auto px-3">
          <nav className="space-y-0.5">
            {groupHeader("Aujourd'hui", "Today")}
            <a href="#overview" title={isSidebarCollapsed ? (isFrench ? "Vue d'ensemble" : "Overview") : undefined} className={navItem("overview", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="3" y="3" width="6" height="6" rx="1.5" />
                <rect x="11" y="3" width="6" height="6" rx="1.5" />
                <rect x="3" y="11" width="6" height="6" rx="1.5" />
                <rect x="11" y="11" width="6" height="6" rx="1.5" />
              </svg>
              {!isSidebarCollapsed ? (isFrench ? "Vue d'ensemble" : "Overview") : null}
            </a>
            <a href="#dailyControls" title={isSidebarCollapsed ? (isFrench ? "Calendrier" : "Calendar") : undefined} className={navItem("dailyControls", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="3" y="4" width="14" height="13" rx="2" />
                <path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round" />
              </svg>
              {!isSidebarCollapsed ? (isFrench ? "Calendrier" : "Calendar") : null}
            </a>
            <a href="#affirmation" title={isSidebarCollapsed ? "Affirmation" : undefined} className={navItem("affirmation", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M10 3l2 4h4l-3 3 1 4-4-2-4 2 1-4-3-3h4z" />
              </svg>
              {!isSidebarCollapsed ? "Affirmation" : null}
            </a>
            <a href="#reminders" title={isSidebarCollapsed ? (isFrench ? "Rappels" : "Reminders") : undefined} className={navItem("reminders", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M10 4a5 5 0 00-5 5v3l-1 2h12l-1-2V9a5 5 0 00-5-5zM8.5 16a1.5 1.5 0 003 0" strokeLinecap="round" strokeLinejoin="round" />
              </svg>
              {!isSidebarCollapsed ? (isFrench ? "Rappels" : "Reminders") : null}
            </a>
            <a href="#bilan" title={isSidebarCollapsed ? (isFrench ? "Bilan du jour" : "Day Bilan") : undefined} className={navItem("bilan", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M4 15V8M8 15V5M12 15V9M16 15V6" strokeLinecap="round" />
              </svg>
              {!isSidebarCollapsed ? (isFrench ? "Bilan du jour" : "Day Bilan") : null}
            </a>

            {showPeriodicGroup ? (
              <>
                {groupHeader("Semaine & Mois", "Week & Month")}
                {showWeeklyObjective ? (
                  <a href="#weeklyObjective" title={isSidebarCollapsed ? (isFrench ? "Objectif semaine" : "Weekly Objective") : undefined} className={navItem(["weeklyObjective", "weeklyReview"], isSidebarCollapsed)}>
                    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M3 5h14M3 10h10M3 15h7" strokeLinecap="round" />
                    </svg>
                    {!isSidebarCollapsed ? (isFrench ? "Objectif de la semaine" : "Weekly Objective") : null}
                  </a>
                ) : null}
                {showWeeklyReview ? (
                  <a
                    href="#weeklyReview"
                    title={isSidebarCollapsed ? (isFrench ? "Bilan semaine" : "Weekly Review") : undefined}
                    className={`${navItem("weeklyReview", isSidebarCollapsed)} ${activeSectionId !== "weeklyReview" ? "text-violet-700 hover:bg-violet-50 hover:text-violet-800" : ""}`}
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-violet-500" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <path d="M3 5h14M3 10h10M3 15h7" strokeLinecap="round" />
                      <path d="M14 12l2 2 3-3" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {!isSidebarCollapsed ? (isFrench ? "Bilan de la semaine" : "Weekly Review") : null}
                  </a>
                ) : null}
                {showMonthlyObjective ? (
                  <a href="#monthlyObjective" title={isSidebarCollapsed ? (isFrench ? "Objectif du mois" : "Monthly Objective") : undefined} className={navItem(["monthlyObjective", "monthlyReview"], isSidebarCollapsed)}>
                    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <rect x="3" y="4" width="14" height="13" rx="2" />
                      <path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round" />
                      <path d="M7 12h6M7 15h4" strokeLinecap="round" />
                    </svg>
                    {!isSidebarCollapsed ? (isFrench ? "Objectif du mois" : "Monthly Objective") : null}
                  </a>
                ) : null}
                {showMonthlyReview ? (
                  <a
                    href="#monthlyReview"
                    title={isSidebarCollapsed ? (isFrench ? "Bilan du mois" : "Monthly Review") : undefined}
                    className={`${navItem("monthlyReview", isSidebarCollapsed)} ${activeSectionId !== "monthlyReview" ? "text-amber-700 hover:bg-amber-50 hover:text-amber-800" : ""}`}
                  >
                    <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0 text-amber-500" fill="none" stroke="currentColor" strokeWidth="1.7">
                      <rect x="3" y="4" width="14" height="13" rx="2" />
                      <path d="M3 8h14M7 2v4M13 2v4" strokeLinecap="round" />
                      <path d="M7 12l2 2 4-4" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                    {!isSidebarCollapsed ? (isFrench ? "Bilan du mois" : "Monthly Review") : null}
                  </a>
                ) : null}
              </>
            ) : null}

            {groupHeader("Workspace", "Workspace")}
            <a href="#board" title={isSidebarCollapsed ? (isFrench ? "Tableau Kanban" : "Kanban Board") : undefined} className={navItem("board", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="3" y="3" width="14" height="14" rx="2" />
                <path d="M3 7h14M8 7v10M13 7v10" />
              </svg>
              {!isSidebarCollapsed ? (isFrench ? "Tableau Kanban" : "Kanban Board") : null}
            </a>
            <button
              type="button"
              title={isSidebarCollapsed ? (isFrench ? "Planification projet" : "Project Planning") : undefined}
              className={`${navItem("", isSidebarCollapsed)} ${isProjectPlanningOpen ? "bg-accent-soft text-accent" : ""}`}
              onClick={onOpenProjectPlanning}
              disabled={isBusy || !onOpenProjectPlanning}
            >
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
                <rect x="2" y="4" width="16" height="2.5" rx="1" />
                <rect x="2" y="8.75" width="11" height="2.5" rx="1" />
                <rect x="2" y="13.5" width="14" height="2.5" rx="1" />
              </svg>
              {!isSidebarCollapsed ? <span className="flex-1 text-left">{isFrench ? "Planification projet" : "Project Planning"}</span> : null}
            </button>

            {groupHeader("Mon suivi", "My Track")}
            <a href="#notes" title={isSidebarCollapsed ? "Notes" : undefined} className={navItem("notes", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M5 3h10a1 1 0 011 1v12a1 1 0 01-1 1H5a1 1 0 01-1-1V4a1 1 0 011-1z" />
                <path d="M7 7h6M7 10h6M7 13h4" strokeLinecap="round" />
              </svg>
              {!isSidebarCollapsed ? "Notes" : null}
            </a>
            <a href="#gaming" title="Gaming Track" className={navItem("gaming", isSidebarCollapsed)}>
              <svg viewBox="0 0 20 20" className="h-4 w-4 shrink-0" fill="none" stroke="currentColor" strokeWidth="1.7">
                <path d="M5 3h10l-1.5 7a3.5 3.5 0 01-7 0L5 3z" strokeLinejoin="round" />
                <path d="M10 13.5V16" strokeLinecap="round" />
                <path d="M7 16h6" strokeLinecap="round" />
                <path d="M3 3h2M15 3h2" strokeLinecap="round" />
              </svg>
              {!isSidebarCollapsed ? "Gaming Track" : null}
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
                {taskAlertsCount > 0 ? (
                  <span className="absolute -right-2 -top-2 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white">
                    {taskAlertsCount > 9 ? "9+" : taskAlertsCount}
                  </span>
                ) : null}
              </span>
              {!isSidebarCollapsed ? <span className="flex-1 text-left">{taskAlertsLabel}</span> : null}
            </button>
          </nav>
        </div>

        <div className="border-t border-line px-3 py-4">
          {isLoggedIn && !isSidebarCollapsed ? (
            <>
              <div className="app-panel-soft flex items-center gap-3 rounded-[22px] px-2.5 py-2.5">
                <div className="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent">{initials}</div>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium text-foreground">{profileLabel}</p>
                </div>
              </div>
              <div className="mt-1 flex items-center gap-1 px-1">
                <button
                  type="button"
                  className="flex-1 rounded-full px-2.5 py-2 text-xs font-semibold text-muted transition-colors hover:bg-surface-elevated hover:text-foreground"
                  onClick={onOpenProfile}
                  disabled={isBusy || !onOpenProfile}
                >
                  {isFrench ? "Profil" : "Settings"}
                </button>
                <button
                  type="button"
                  className="flex-1 rounded-full px-2.5 py-2 text-xs font-semibold text-muted transition-colors hover:bg-red-50 hover:text-red-500"
                  onClick={onLogout}
                  disabled={isBusy || !onLogout}
                >
                  {isFrench ? "Deconnexion" : "Logout"}
                </button>
              </div>
            </>
          ) : null}
          {isLoggedIn && isSidebarCollapsed ? (
            <div className="mb-2 flex justify-center">
              <button
                type="button"
                title={profileLabel}
                className="grid h-8 w-8 place-items-center rounded-full bg-accent-soft text-xs font-semibold text-accent"
                onClick={onOpenProfile}
                disabled={isBusy || !onOpenProfile}
              >
                {initials}
              </button>
            </div>
          ) : null}
          <button
            type="button"
            onClick={onToggleSidebar}
            title={isSidebarCollapsed ? (isFrench ? "Développer" : "Expand") : isFrench ? "Réduire" : "Collapse"}
            className={`flex items-center gap-1.5 rounded-md px-2 py-1.5 text-xs text-muted transition-colors hover:bg-surface-soft hover:text-foreground ${isSidebarCollapsed ? "mx-auto h-8 w-8 justify-center" : "w-full"}`}
          >
            <svg viewBox="0 0 20 20" className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isSidebarCollapsed ? "rotate-180" : ""}`} fill="none" stroke="currentColor" strokeWidth="1.7">
              <path d="M12 5l-5 5 5 5" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {!isSidebarCollapsed ? <span>{isFrench ? "Réduire" : "Collapse"}</span> : null}
          </button>
        </div>
      </aside>

      <nav className="sticky top-0 z-30 flex items-center justify-between border-b border-line/50 bg-surface/80 px-5 py-4 shadow-[0_18px_32px_rgba(16,0,105,0.06)] backdrop-blur-xl lg:hidden">
        <div className="flex min-w-0 items-center gap-3">
          {isLoggedIn ? (
            <button
              type="button"
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border-2 border-white bg-accent-soft text-xs font-black text-accent shadow-[0_12px_24px_rgba(16,0,105,0.08)]"
              onClick={onOpenProfile}
              disabled={isBusy || !onOpenProfile}
              aria-label={profileLabel}
              title={profileLabel}
            >
              {initials}
            </button>
          ) : (
            <div className="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-xs font-black text-white shadow-[0_12px_24px_rgba(53,37,205,0.18)]">
              J
            </div>
          )}
          <div className="min-w-0">
            <p className="truncate text-xl font-extrabold tracking-tight text-foreground">{APP_NAME}</p>
            <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-muted">{activeMobileLabel}</p>
          </div>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {isLoggedIn ? (
            <>
              <button
                type="button"
                className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-surface-elevated text-muted transition-colors hover:bg-surface-soft hover:text-accent"
                onClick={onOpenSearch}
                disabled={!onOpenSearch}
                aria-label={isFrench ? "Rechercher" : "Search"}
              >
                <SearchIcon />
              </button>
              <button
                type="button"
                className={`relative inline-flex h-10 w-10 items-center justify-center rounded-full transition-colors ${isTaskAlertsPanelOpen ? "bg-accent-soft text-accent" : "bg-surface-elevated text-muted hover:bg-surface-soft hover:text-accent"}`}
                onClick={onOpenTaskAlerts}
                disabled={isBusy || !onOpenTaskAlerts}
                aria-label={taskAlertsLabel}
              >
                <BellIcon />
                {taskAlertsCount > 0 ? (
                  <span className="absolute -right-1 -top-1 inline-flex min-w-4 items-center justify-center rounded-full bg-rose-500 px-1 text-[10px] font-semibold leading-4 text-white">
                    {taskAlertsCount > 9 ? "9+" : taskAlertsCount}
                  </span>
                ) : null}
              </button>
              {activeMobileTab === "kanban" ? (
                <button
                  type="button"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white shadow-[0_14px_28px_rgba(53,37,205,0.24)]"
                  onClick={onCreateTask}
                  disabled={isBusy || !onCreateTask}
                  aria-label={isFrench ? "Nouvelle tache" : "New task"}
                >
                  <PlusIcon />
                </button>
              ) : (
                <a
                  href="#dailyControls"
                  className="inline-flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-accent to-accent-strong text-white shadow-[0_14px_28px_rgba(53,37,205,0.24)]"
                  aria-label={isFrench ? "Calendrier" : "Calendar"}
                >
                  <CalendarIcon />
                </a>
              )}
            </>
          ) : (
            <button type="button" className={controlButtonClass} onClick={onLogin} disabled={isBusy || !onLogin}>
              {isFrench ? "Connexion" : "Login"}
            </button>
          )}
        </div>
      </nav>

      {isLoggedIn ? (
        <nav
          className="fixed bottom-0 left-0 right-0 z-30 flex justify-around rounded-t-[2.5rem] border-t border-line/40 bg-surface/90 px-3 pb-3 pt-2 shadow-[0_-14px_36px_rgba(16,0,105,0.08)] backdrop-blur-xl lg:hidden"
          style={{ paddingBottom: "max(0.75rem, env(safe-area-inset-bottom))" }}
        >
          {(
            [
              {
                id: "jour",
                href: "#overview",
                label: isFrench ? "Jour" : "Today",
                icon: (
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <rect x="3" y="3" width="6" height="6" rx="1.5" />
                    <rect x="11" y="3" width="6" height="6" rx="1.5" />
                    <rect x="3" y="11" width="6" height="6" rx="1.5" />
                    <rect x="11" y="11" width="6" height="6" rx="1.5" />
                  </svg>
                ),
              },
              {
                id: "kanban",
                href: "#board",
                label: isFrench ? "Tâches" : "Tasks",
                icon: (
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <rect x="3" y="3" width="14" height="14" rx="2" />
                    <path d="M3 7h14M8 7v10M13 7v10" />
                  </svg>
                ),
              },
              {
                id: "focus",
                href: "#affirmation",
                label: "Focus",
                icon: (
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <circle cx="10" cy="10" r="6.5" />
                    <path d="M10 6.2v4.1l2.6 1.6" strokeLinecap="round" />
                  </svg>
                ),
              },
              {
                id: "insights",
                href: "#gaming",
                label: isFrench ? "Suivi" : "Insights",
                icon: (
                  <svg viewBox="0 0 20 20" className="h-5 w-5" fill="none" stroke="currentColor" strokeWidth="1.7">
                    <path d="M4 15V8M8 15V5M12 15V9M16 15V6" strokeLinecap="round" />
                  </svg>
                ),
              },
            ] as const
          ).map((tab) => (
            <a
              key={tab.id}
              href={tab.href}
              className={`flex min-w-0 flex-1 flex-col items-center justify-center gap-1 rounded-[2rem] px-2 py-2.5 text-[10px] font-bold uppercase tracking-[0.08em] transition-all ${
                activeMobileTab === tab.id
                  ? "scale-[1.04] bg-accent-soft text-accent shadow-[0_10px_24px_rgba(53,37,205,0.1)]"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab.icon}
              {tab.label}
            </a>
          ))}
        </nav>
      ) : null}
    </>
  );
}
