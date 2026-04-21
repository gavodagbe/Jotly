"use client";

type UserLocale = "en" | "fr";

type MainContentSectionId =
  | "overview"
  | "board"
  | "dailyControls"
  | "affirmation"
  | "reminders"
  | "bilan"
  | "weeklyObjective"
  | "weeklyReview"
  | "monthlyObjective"
  | "monthlyReview"
  | "notes"
  | "gaming";

const MAIN_CONTENT_SECTION_META: Record<
  MainContentSectionId,
  {
    group: { fr: string; en: string };
    label: { fr: string; en: string };
    chipClass: string;
    activeRingClass: string;
  }
> = {
  overview: {
    group: { fr: "Aujourd'hui", en: "Today" },
    label: { fr: "Vue d'ensemble", en: "Overview" },
    chipClass: "border-sky-200 bg-sky-50 text-sky-700",
    activeRingClass: "ring-sky-200",
  },
  board: {
    group: { fr: "Aujourd'hui", en: "Today" },
    label: { fr: "Tableau Kanban", en: "Kanban Board" },
    chipClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
    activeRingClass: "ring-indigo-200",
  },
  dailyControls: {
    group: { fr: "Aujourd'hui", en: "Today" },
    label: { fr: "Pilotage du jour", en: "Day Controls" },
    chipClass: "border-sky-200 bg-sky-50 text-sky-700",
    activeRingClass: "ring-sky-200",
  },
  affirmation: {
    group: { fr: "Affirmation", en: "Affirmation" },
    label: { fr: "Affirmation du jour", en: "Day Affirmation" },
    chipClass: "border-violet-200 bg-violet-50 text-violet-700",
    activeRingClass: "ring-violet-200",
  },
  reminders: {
    group: { fr: "Aujourd'hui", en: "Today" },
    label: { fr: "Rappels", en: "Reminders" },
    chipClass: "border-rose-200 bg-rose-50 text-rose-700",
    activeRingClass: "ring-rose-200",
  },
  bilan: {
    group: { fr: "Bilan", en: "Reflection" },
    label: { fr: "Bilan du jour", en: "Day Bilan" },
    chipClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    activeRingClass: "ring-emerald-200",
  },
  weeklyObjective: {
    group: { fr: "Semaine", en: "Week" },
    label: { fr: "Objectif de la semaine", en: "Weekly Objective" },
    chipClass: "border-indigo-200 bg-indigo-50 text-indigo-700",
    activeRingClass: "ring-indigo-200",
  },
  weeklyReview: {
    group: { fr: "Semaine", en: "Week" },
    label: { fr: "Bilan de la semaine", en: "Weekly Review" },
    chipClass: "border-violet-200 bg-violet-50 text-violet-700",
    activeRingClass: "ring-violet-200",
  },
  monthlyObjective: {
    group: { fr: "Mois", en: "Month" },
    label: { fr: "Objectif du mois", en: "Monthly Objective" },
    chipClass: "border-blue-200 bg-blue-50 text-blue-700",
    activeRingClass: "ring-blue-200",
  },
  monthlyReview: {
    group: { fr: "Mois", en: "Month" },
    label: { fr: "Bilan du mois", en: "Monthly Review" },
    chipClass: "border-amber-200 bg-amber-50 text-amber-700",
    activeRingClass: "ring-amber-200",
  },
  notes: {
    group: { fr: "Espace", en: "Space" },
    label: { fr: "Notes", en: "Notes" },
    chipClass: "border-teal-200 bg-teal-50 text-teal-700",
    activeRingClass: "ring-teal-200",
  },
  gaming: {
    group: { fr: "Espace", en: "Space" },
    label: { fr: "Gaming Track", en: "Gaming Track" },
    chipClass: "border-fuchsia-200 bg-fuchsia-50 text-fuchsia-700",
    activeRingClass: "ring-fuchsia-200",
  },
};

function isMainContentSectionId(value: string): value is MainContentSectionId {
  return Object.prototype.hasOwnProperty.call(MAIN_CONTENT_SECTION_META, value);
}

export function getMainContentSectionClass(sectionId: MainContentSectionId, activeSectionId: string): string {
  return [
    "relative scroll-mt-24 transition-all duration-300 lg:scroll-mt-8",
    activeSectionId === sectionId
      ? `-translate-y-0.5 ring-2 ring-offset-2 ring-offset-background shadow-xl shadow-black/5 ${MAIN_CONTENT_SECTION_META[sectionId].activeRingClass}`
      : "",
  ].join(" ");
}

export function SectionIdentityPills({
  sectionId,
  locale,
  isActive,
}: {
  sectionId: MainContentSectionId;
  locale: UserLocale;
  isActive: boolean;
}) {
  const isFrench = locale === "fr";
  const meta = MAIN_CONTENT_SECTION_META[sectionId];

  return (
    <div className="mb-3 flex flex-wrap items-center gap-2">
      <span
        className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${meta.chipClass}`}
      >
        {isFrench ? meta.group.fr : meta.group.en}
      </span>
      {isActive ? (
        <span className="inline-flex items-center rounded-full border border-accent/20 bg-accent-soft px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] text-accent">
          {isFrench ? "Section active" : "Active section"}
        </span>
      ) : null}
    </div>
  );
}

export function ActiveSectionIndicator({
  activeSectionId,
  locale,
}: {
  activeSectionId: string;
  locale: UserLocale;
}) {
  if (!isMainContentSectionId(activeSectionId)) {
    return null;
  }

  const isFrench = locale === "fr";
  const meta = MAIN_CONTENT_SECTION_META[activeSectionId];

  return (
    <div className="sticky top-[4.75rem] z-20 lg:top-4">
      <div className="rounded-2xl border border-line bg-white/90 px-4 py-3 shadow-sm backdrop-blur-sm">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`inline-flex items-center rounded-full border px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.16em] ${meta.chipClass}`}
          >
            {isFrench ? meta.group.fr : meta.group.en}
          </span>
          <span className="text-[10px] font-semibold uppercase tracking-[0.16em] text-muted">
            {isFrench ? "Repère principal" : "Main context"}
          </span>
        </div>
        <p className="mt-2 text-sm font-semibold text-foreground">
          {isFrench ? "Section active : " : "Active section: "}
          {isFrench ? meta.label.fr : meta.label.en}
        </p>
      </div>
    </div>
  );
}
