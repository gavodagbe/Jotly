"use client";

import { type KeyboardEvent, type ReactNode, useEffect, useRef, useState } from "react";
import { SearchIcon } from "@/components/ui/icons";

type UserLocale = "en" | "fr";

export type SearchSourceType =
  | "task"
  | "comment"
  | "affirmation"
  | "bilan"
  | "reminder"
  | "calendarEvent"
  | "calendarNote"
  | "attachment"
  | "note"
  | "noteAttachment"
  | "weeklyObjective"
  | "weeklyReview"
  | "monthlyObjective"
  | "monthlyReview";

export type SearchResult = {
  sourceType: SearchSourceType;
  sourceId: string;
  title: string | null;
  snippet: string;
  score: number;
  matchedBy: "fulltext" | "vector";
  metadataJson: Record<string, unknown> | null;
  updatedAt: string;
};

export type GlobalSearchState = {
  query: string;
  results: SearchResult[];
  isLoading: boolean;
  errorMessage: string | null;
  page: number;
  totalCount: number;
  hasMore: boolean;
  typeFilter: SearchSourceType | "all";
  from: string;
  to: string;
  recentResults: SearchResult[];
  isLoadingRecent: boolean;
};

const SOURCE_TYPE_LABELS: Record<SearchSourceType, { fr: string; en: string }> = {
  task: { fr: "Tâche", en: "Task" },
  comment: { fr: "Commentaire", en: "Comment" },
  affirmation: { fr: "Affirmation", en: "Affirmation" },
  bilan: { fr: "Bilan", en: "Bilan" },
  reminder: { fr: "Rappel", en: "Reminder" },
  calendarEvent: { fr: "Événement", en: "Event" },
  calendarNote: { fr: "Note agenda", en: "Cal. Note" },
  attachment: { fr: "Pièce jointe", en: "Attachment" },
  note: { fr: "Note", en: "Note" },
  noteAttachment: { fr: "Doc note", en: "Note Doc" },
  weeklyObjective: { fr: "Obj. semaine", en: "Weekly Obj." },
  weeklyReview: { fr: "Bilan semaine", en: "Weekly Review" },
  monthlyObjective: { fr: "Obj. mois", en: "Monthly Obj." },
  monthlyReview: { fr: "Bilan mois", en: "Monthly Review" },
};

const ALL_SEARCH_SOURCE_TYPES: SearchSourceType[] = [
  "task",
  "comment",
  "affirmation",
  "bilan",
  "reminder",
  "calendarEvent",
  "calendarNote",
  "attachment",
  "note",
  "noteAttachment",
  "weeklyObjective",
  "weeklyReview",
  "monthlyObjective",
  "monthlyReview",
];

const TYPE_BADGE: Record<SearchSourceType, string> = {
  task: "bg-indigo-50 text-indigo-500",
  comment: "bg-sky-50 text-sky-500",
  affirmation: "bg-amber-50 text-amber-500",
  bilan: "bg-emerald-50 text-emerald-500",
  reminder: "bg-rose-50 text-rose-500",
  calendarEvent: "bg-purple-50 text-purple-500",
  calendarNote: "bg-violet-50 text-violet-500",
  attachment: "bg-slate-100 text-slate-500",
  note: "bg-teal-50 text-teal-500",
  noteAttachment: "bg-cyan-50 text-cyan-500",
  weeklyObjective: "bg-indigo-50 text-indigo-600",
  weeklyReview: "bg-violet-50 text-violet-600",
  monthlyObjective: "bg-blue-50 text-blue-600",
  monthlyReview: "bg-amber-50 text-amber-600",
};

const TYPE_ICON_COLOR: Record<SearchSourceType, string> = {
  task: "text-indigo-400",
  comment: "text-sky-400",
  affirmation: "text-amber-400",
  bilan: "text-emerald-400",
  reminder: "text-rose-400",
  calendarEvent: "text-purple-400",
  calendarNote: "text-violet-400",
  attachment: "text-slate-400",
  note: "text-teal-400",
  noteAttachment: "text-cyan-400",
  weeklyObjective: "text-indigo-400",
  weeklyReview: "text-violet-400",
  monthlyObjective: "text-blue-400",
  monthlyReview: "text-amber-400",
};

function SearchTypeIcon({ type }: { type: SearchSourceType }) {
  const cls = "h-4 w-4 shrink-0";

  switch (type) {
    case "task":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="3" width="18" height="18" rx="3" />
          <path d="M8 12l3 3 5-5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "comment":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" strokeLinejoin="round" />
        </svg>
      );
    case "affirmation":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <circle cx="12" cy="12" r="4" />
          <path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M4.93 19.07l1.41-1.41M17.66 6.34l1.41-1.41" strokeLinecap="round" />
        </svg>
      );
    case "bilan":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M9 11l3 3L22 4" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M21 12v7a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11" strokeLinecap="round" />
        </svg>
      );
    case "reminder":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M18 8A6 6 0 0 0 6 8c0 7-3 9-3 9h18s-3-2-3-9" strokeLinejoin="round" />
          <path d="M13.73 21a2 2 0 0 1-3.46 0" strokeLinecap="round" />
        </svg>
      );
    case "calendarEvent":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
        </svg>
      );
    case "calendarNote":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
          <path d="M8 14h5M8 18h3" strokeLinecap="round" />
        </svg>
      );
    case "attachment":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M21.44 11.05l-9.19 9.19a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66L9.41 17.41a2 2 0 0 1-2.83-2.83l8.49-8.48" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "note":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
          <polyline points="14 2 14 8 20 8" />
          <line x1="8" y1="13" x2="16" y2="13" strokeLinecap="round" />
          <line x1="8" y1="17" x2="13" y2="17" strokeLinecap="round" />
        </svg>
      );
    case "noteAttachment":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" strokeLinejoin="round" />
          <polyline points="14 2 14 8 20 8" />
          <path d="M10 17l2-2 2 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      );
    case "weeklyObjective":
    case "weeklyReview":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <path d="M4 6h16M4 12h12M4 18h8" strokeLinecap="round" />
        </svg>
      );
    case "monthlyObjective":
    case "monthlyReview":
      return (
        <svg className={cls} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
          <rect x="3" y="4" width="18" height="18" rx="2" />
          <path d="M16 2v4M8 2v4M3 10h18" strokeLinecap="round" />
          <path d="M8 14h8M8 18h5" strokeLinecap="round" />
        </svg>
      );
  }
}

function formatSearchResultDate(metadataJson: Record<string, unknown> | null, locale: UserLocale): string | null {
  if (!metadataJson) return null;

  const raw = (metadataJson.targetDate ?? metadataJson.remindAt ?? metadataJson.startTime) as string | undefined;
  if (!raw) return null;

  try {
    return new Intl.DateTimeFormat(locale === "fr" ? "fr-FR" : "en-US", {
      month: "short",
      day: "numeric",
    }).format(new Date(raw));
  } catch {
    return null;
  }
}

function renderHighlightedSnippet(snippet: string, query: string): ReactNode {
  if (snippet.includes("[[")) {
    const parts: ReactNode[] = [];
    let remaining = snippet;
    let key = 0;

    while (remaining.length > 0) {
      const start = remaining.indexOf("[[");
      if (start === -1) {
        parts.push(remaining);
        break;
      }

      if (start > 0) {
        parts.push(remaining.slice(0, start));
      }

      const end = remaining.indexOf("]]", start + 2);
      if (end === -1) {
        parts.push(remaining.slice(start));
        break;
      }

      const term = remaining.slice(start + 2, end);
      parts.push(
        <span key={key++} className="font-medium text-accent">
          {term}
        </span>
      );
      remaining = remaining.slice(end + 2);
    }

    return <>{parts}</>;
  }

  const trimmedQuery = query.trim();
  if (!trimmedQuery) return snippet;

  const tokens = [...new Set(trimmedQuery.split(/\s+/).filter((token) => token.length >= 2))];
  if (tokens.length === 0) return snippet;

  const pattern = new RegExp(`(${tokens.map((token) => token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("|")})`, "gi");
  const parts = snippet.split(pattern);

  return (
    <>
      {parts.map((part, index) =>
        pattern.test(part) ? (
          <span key={index} className="font-medium text-accent">
            {part}
          </span>
        ) : (
          part
        )
      )}
    </>
  );
}

function SearchResultRow({
  result,
  locale,
  query,
  isFocused,
  onClick,
}: {
  result: SearchResult;
  locale: UserLocale;
  query: string;
  isFocused: boolean;
  onClick: () => void;
}) {
  const isFrench = locale === "fr";
  const label = SOURCE_TYPE_LABELS[result.sourceType]?.[isFrench ? "fr" : "en"] ?? result.sourceType;
  const date = formatSearchResultDate(result.metadataJson, locale);
  const isVector = result.matchedBy === "vector";

  return (
    <button
      type="button"
      data-search-result
      className={`group flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors ${
        isFocused ? "bg-accent/[0.07] outline-none" : "hover:bg-surface-soft"
      }`}
      onClick={onClick}
    >
      <span className={`shrink-0 ${TYPE_ICON_COLOR[result.sourceType]}`}>
        <SearchTypeIcon type={result.sourceType} />
      </span>

      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          {result.title ? (
            <span className={`truncate text-sm font-medium ${isFocused ? "text-accent" : "text-foreground group-hover:text-accent"}`}>
              {result.title.includes("[[") ? renderHighlightedSnippet(result.title, query) : result.title}
            </span>
          ) : (
            <span className={`truncate text-sm ${isFocused ? "text-accent" : "text-muted"}`}>
              {renderHighlightedSnippet(result.snippet.slice(0, 60), query)}
            </span>
          )}
          {isVector ? (
            <span className="shrink-0 rounded px-1 py-px text-[9px] font-medium tracking-wide text-accent/60 ring-1 ring-accent/20">
              {isFrench ? "sémantique" : "semantic"}
            </span>
          ) : null}
        </div>
        {result.title && result.snippet ? (
          <p className="mt-px truncate text-xs text-muted">{renderHighlightedSnippet(result.snippet, query)}</p>
        ) : null}
      </div>

      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className={`rounded px-1.5 py-px text-[9px] font-semibold uppercase tracking-widest ${TYPE_BADGE[result.sourceType]}`}>
          {label}
        </span>
        {date ? <span className="text-[10px] text-muted">{date}</span> : null}
      </div>
    </button>
  );
}

export type GlobalSearchModalProps = {
  locale: UserLocale;
  state: GlobalSearchState;
  onQueryChange: (value: string) => void;
  onTypeFilterChange: (filter: SearchSourceType | "all") => void;
  onDateFilterChange: (field: "from" | "to", value: string) => void;
  onLoadMore: () => void;
  onClose: () => void;
  onResultClick: (result: SearchResult) => void;
};

export function GlobalSearchModal({
  locale,
  state,
  onQueryChange,
  onTypeFilterChange,
  onDateFilterChange,
  onLoadMore,
  onClose,
  onResultClick,
}: GlobalSearchModalProps) {
  const isFrench = locale === "fr";
  const inputRef = useRef<HTMLInputElement | null>(null);
  const listRef = useRef<HTMLDivElement | null>(null);
  const [focusedIndex, setFocusedIndex] = useState(-1);
  const hasResults = state.results.length > 0;
  const hasQuery = state.query.trim().length >= 2;

  useEffect(() => {
    const timeoutId = setTimeout(() => inputRef.current?.focus(), 60);
    return () => clearTimeout(timeoutId);
  }, []);

  useEffect(() => {
    const timeoutId = window.setTimeout(() => setFocusedIndex(-1), 0);
    return () => window.clearTimeout(timeoutId);
  }, [state.results]);

  function scrollResultIntoView(index: number) {
    if (!listRef.current) return;
    const rows = listRef.current.querySelectorAll<HTMLElement>("[data-search-result]");
    rows[index]?.scrollIntoView({ block: "nearest" });
  }

  function handleKeyDown(event: KeyboardEvent) {
    if (!hasResults) return;

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setFocusedIndex((previousIndex) => {
        const nextIndex = Math.min(previousIndex + 1, state.results.length - 1);
        scrollResultIntoView(nextIndex);
        return nextIndex;
      });
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setFocusedIndex((previousIndex) => {
        const nextIndex = Math.max(previousIndex - 1, 0);
        scrollResultIntoView(nextIndex);
        return nextIndex;
      });
      return;
    }

    if (event.key === "Enter" && focusedIndex >= 0) {
      event.preventDefault();
      const result = state.results[focusedIndex];
      if (result) {
        onResultClick(result);
        onClose();
      }
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-start justify-center bg-black/50 px-4 pt-[10vh] backdrop-blur-sm"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
      onKeyDown={handleKeyDown}
    >
      <div className="flex w-full max-w-xl flex-col overflow-hidden rounded-2xl border border-line bg-surface shadow-2xl">
        <div className="flex items-center gap-3 px-4 py-3.5">
          <span className="shrink-0 text-muted">
            <SearchIcon />
          </span>
          <input
            ref={inputRef}
            type="text"
            value={state.query}
            onChange={(event) => {
              onQueryChange(event.target.value);
            }}
            onKeyDown={handleKeyDown}
            placeholder={isFrench ? "Rechercher dans votre espace..." : "Search your workspace..."}
            className="flex-1 bg-transparent text-sm text-foreground outline-none placeholder:text-muted"
          />
          {state.isLoading ? (
            <span className="h-3.5 w-3.5 shrink-0 animate-spin rounded-full border-2 border-accent border-t-transparent" />
          ) : null}
          <kbd
            onClick={onClose}
            className="hidden cursor-pointer rounded border border-line px-1.5 py-0.5 text-[10px] font-medium text-muted hover:text-foreground sm:block"
          >
            Esc
          </kbd>
        </div>

        <div className="scrollbar-none flex items-center gap-1.5 overflow-x-auto border-t border-line px-4 py-2">
          <button
            type="button"
            onClick={() => onTypeFilterChange("all")}
            className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
              state.typeFilter === "all" ? "bg-accent text-white" : "text-muted hover:text-foreground"
            }`}
          >
            {isFrench ? "Tout" : "All"}
          </button>
          {ALL_SEARCH_SOURCE_TYPES.map((type) => (
            <button
              key={type}
              type="button"
              onClick={() => onTypeFilterChange(type)}
              className={`shrink-0 rounded-full px-2.5 py-0.5 text-[11px] font-medium transition-colors ${
                state.typeFilter === type ? "bg-accent text-white" : "text-muted hover:text-foreground"
              }`}
            >
              {SOURCE_TYPE_LABELS[type][isFrench ? "fr" : "en"]}
            </button>
          ))}
          <div className="ml-auto flex shrink-0 items-center gap-1.5 pl-2">
            <input
              type="date"
              value={state.from}
              onChange={(event) => onDateFilterChange("from", event.target.value)}
              className="w-28 rounded border border-line bg-surface-soft px-1.5 py-0.5 text-[10px] text-muted outline-none focus:border-accent"
              title={isFrench ? "Date de début" : "From"}
            />
            <span className="text-[10px] text-muted">–</span>
            <input
              type="date"
              value={state.to}
              onChange={(event) => onDateFilterChange("to", event.target.value)}
              className="w-28 rounded border border-line bg-surface-soft px-1.5 py-0.5 text-[10px] text-muted outline-none focus:border-accent"
              title={isFrench ? "Date de fin" : "To"}
            />
          </div>
        </div>

        <div ref={listRef} className="max-h-[52vh] overflow-y-auto border-t border-line">
          {state.errorMessage ? (
            <p className="px-4 py-8 text-center text-sm text-rose-500">{state.errorMessage}</p>
          ) : !hasQuery ? (
            state.isLoadingRecent ? (
              <div className="flex items-center justify-center py-12 text-muted">
                <span className="h-5 w-5 animate-spin rounded-full border-2 border-accent border-t-transparent" />
              </div>
            ) : state.recentResults.length > 0 ? (
              <div className="py-1">
                <p className="px-4 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-widest text-muted">
                  {isFrench ? "Récemment modifié" : "Recently modified"}
                </p>
                {state.recentResults.map((result, index) => (
                  <SearchResultRow
                    key={`recent-${result.sourceType}-${result.sourceId}`}
                    result={result}
                    locale={locale}
                    query=""
                    isFocused={index === focusedIndex}
                    onClick={() => {
                      onResultClick(result);
                      onClose();
                    }}
                  />
                ))}
              </div>
            ) : (
              <div className="flex flex-col items-center gap-2 py-12 text-muted">
                <svg className="h-8 w-8 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                  <circle cx="11" cy="11" r="8" />
                  <path d="m21 21-4.35-4.35" strokeLinecap="round" />
                </svg>
                <p className="text-sm">{isFrench ? "Tapez au moins 2 caractères" : "Type at least 2 characters"}</p>
              </div>
            )
          ) : !hasResults && !state.isLoading ? (
            <div className="flex flex-col items-center gap-2 py-12 text-muted">
              <svg className="h-8 w-8 opacity-30" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5">
                <circle cx="11" cy="11" r="8" />
                <path d="m21 21-4.35-4.35" strokeLinecap="round" />
              </svg>
              <p className="text-sm">{isFrench ? "Aucun résultat" : "No results found"}</p>
              <p className="text-xs opacity-60">
                {isFrench ? `Aucun résultat pour « ${state.query} »` : `No matches for "${state.query}"`}
              </p>
            </div>
          ) : (
            <div className="py-1">
              {state.results.map((result, index) => (
                <SearchResultRow
                  key={`${result.sourceType}-${result.sourceId}`}
                  result={result}
                  locale={locale}
                  query={state.query}
                  isFocused={index === focusedIndex}
                  onClick={() => {
                    onResultClick(result);
                    onClose();
                  }}
                />
              ))}
              {state.hasMore ? (
                <div className="px-4 py-2">
                  <button
                    type="button"
                    onClick={onLoadMore}
                    disabled={state.isLoading}
                    className="w-full rounded-lg border border-line py-2 text-xs text-muted transition-colors hover:bg-surface-soft hover:text-foreground disabled:opacity-50"
                  >
                    {state.isLoading
                      ? isFrench
                        ? "Chargement..."
                        : "Loading..."
                      : isFrench
                        ? "Voir plus de résultats"
                        : "Load more results"}
                  </button>
                </div>
              ) : null}
            </div>
          )}
        </div>

        <div className="flex items-center justify-between border-t border-line px-4 py-2">
          <div className="flex items-center gap-3 text-[10px] text-muted">
            <span>↑↓ {isFrench ? "naviguer" : "navigate"}</span>
            <span>↵ {isFrench ? "ouvrir" : "open"}</span>
            <span>Esc {isFrench ? "fermer" : "close"}</span>
          </div>
          {hasResults ? (
            <p className="text-[10px] text-muted">
              {state.totalCount} {isFrench ? "résultat(s)" : "result(s)"}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}
