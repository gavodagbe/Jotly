"use client";

import { useState } from "react";
import { PencilIcon, TrashIcon } from "@/components/ui/icons";
import { controlIconButtonClass } from "@/components/ui/constants";
import type { RoutineTemplate } from "@/lib/api/routine-types";

type RoutineChecklistRowProps = {
  routine: RoutineTemplate;
  timeLabel: string;
  isCompleted: boolean;
  isPending: boolean;
  isFrench: boolean;
  onToggle: () => void;
  onEdit: () => void;
  onDelete: () => void;
};

/**
 * One routine of the "today" view. Phones get a compact checklist row (large
 * checkbox, edit / delete behind a menu); desktop keeps the original grid row.
 */
export function RoutineChecklistRow({ routine, timeLabel, isCompleted, isPending, isFrench, onToggle, onEdit, onDelete }: RoutineChecklistRowProps) {
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const isBonus = routine.challenge === "bonus";
  const toggleLabel = isFrench ? "Basculer la routine" : "Toggle routine";
  const challengeClass = isBonus ? "border-amber-200 bg-amber-50 text-amber-700" : "border-emerald-200 bg-emerald-50 text-emerald-700";

  return (
    <>
      {/* Phone / tablet */}
      <div className="relative flex min-h-14 items-center gap-3 rounded-lg border border-line bg-surface px-2 py-1.5 lg:hidden">
        <button
          type="button"
          role="checkbox"
          aria-checked={isCompleted}
          aria-label={`${toggleLabel} : ${routine.title}`}
          disabled={isPending}
          onClick={onToggle}
          className={`grid h-11 w-11 shrink-0 place-items-center rounded-lg border-2 text-lg transition-colors ${
            isCompleted ? "border-emerald-500 bg-emerald-500 text-white" : "border-line bg-surface-soft text-transparent"
          }`}
        >
          ✓
        </button>
        <button type="button" onClick={onToggle} disabled={isPending} className="min-w-0 flex-1 text-left">
          <span className="flex items-center gap-2 text-xs text-muted">
            {timeLabel}
            {isBonus && <span className={`rounded-full border px-1.5 text-[10px] font-semibold uppercase ${challengeClass}`}>bonus</span>}
          </span>
          <span className={`block truncate text-sm font-medium ${isCompleted ? "text-muted line-through" : "text-foreground"}`}>{routine.title}</span>
        </button>
        <button
          type="button"
          className="grid h-11 w-9 shrink-0 place-items-center rounded-md text-lg text-muted"
          aria-label={isFrench ? "Actions de la routine" : "Routine actions"}
          aria-expanded={isMenuOpen}
          onClick={() => setIsMenuOpen((open) => !open)}
        >
          ⋯
        </button>
        {isMenuOpen && (
          <div role="menu" className="animate-scale-in absolute right-2 top-12 z-20 flex flex-col overflow-hidden rounded-lg border border-line bg-surface shadow-lg">
            <button type="button" role="menuitem" className="px-4 py-3 text-left text-sm" onClick={() => { setIsMenuOpen(false); onEdit(); }}>
              {isFrench ? "Modifier" : "Edit"}
            </button>
            <button type="button" role="menuitem" className="px-4 py-3 text-left text-sm text-rose-600" onClick={() => { setIsMenuOpen(false); onDelete(); }}>
              {isFrench ? "Supprimer" : "Delete"}
            </button>
          </div>
        )}
      </div>

      {/* Desktop (unchanged layout) */}
      <div className="hidden gap-3 rounded-lg border border-line bg-surface px-3 py-2 lg:grid lg:grid-cols-[88px_80px_minmax(0,1fr)_auto] lg:items-center">
        <span className={`rounded-full border px-2 py-1 text-center text-[11px] font-semibold uppercase ${challengeClass}`}>{routine.challenge}</span>
        <span className="text-sm font-semibold text-muted">{timeLabel}</span>
        <button
          type="button"
          className={`min-w-0 text-left text-sm font-medium transition-colors ${isCompleted ? "text-muted line-through" : "text-foreground"}`}
          onClick={onToggle}
        >
          {routine.title}
        </button>
        <div className="flex items-center justify-end gap-2">
          <button
            type="button"
            className={`grid h-8 w-8 place-items-center rounded-md border transition-colors ${
              isCompleted ? "border-emerald-500 bg-emerald-500 text-white" : "border-line bg-surface-soft text-transparent hover:border-accent"
            }`}
            disabled={isPending}
            onClick={onToggle}
            aria-label={toggleLabel}
          >
            ✓
          </button>
          <button type="button" className={controlIconButtonClass} onClick={onEdit} aria-label={isFrench ? "Modifier" : "Edit"}>
            <PencilIcon />
          </button>
          <button type="button" className={controlIconButtonClass} onClick={onDelete} aria-label={isFrench ? "Supprimer" : "Delete"}>
            <TrashIcon />
          </button>
        </div>
      </div>
    </>
  );
}
