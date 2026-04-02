import { SearchIndexEntry, SearchIndexPlugin, normalizePlainText } from "../assistant/assistant-search-sync";
import { AssistantSearchSourceType } from "../assistant/assistant-search-document-store";
import { WeeklyEntryStore } from "../weekly-entry/weekly-entry-store";
import { MonthlyEntryStore } from "../monthly-entry/monthly-entry-store";

function isoWeekToMondayDate(year: number, isoWeek: number): string {
  // Jan 4th is always in ISO week 1
  const jan4 = new Date(year, 0, 4);
  const dayOfWeek = jan4.getDay() || 7; // convert Sun=0 to 7
  const week1Monday = new Date(jan4);
  week1Monday.setDate(jan4.getDate() - (dayOfWeek - 1));
  const monday = new Date(week1Monday);
  monday.setDate(week1Monday.getDate() + (isoWeek - 1) * 7);
  return monday.toISOString().substring(0, 10);
}

export function createPeriodicEntrySearchPlugin(options: {
  weeklyEntryStore: WeeklyEntryStore;
  monthlyEntryStore: MonthlyEntryStore;
}): SearchIndexPlugin {
  return {
    sourceTypes: ["weeklyObjective", "weeklyReview", "monthlyObjective", "monthlyReview"] as AssistantSearchSourceType[],
    async fetchEntries(userId) {
      const entries: SearchIndexEntry[] = [];

      const [weeklyEntries, monthlyEntries] = await Promise.all([
        options.weeklyEntryStore.listByUser(userId),
        options.monthlyEntryStore.listByUser(userId),
      ]);

      for (const entry of weeklyEntries) {
        const mondayDate = isoWeekToMondayDate(entry.year, entry.isoWeek);
        const label = `W${entry.isoWeek} ${entry.year}`;

        if (entry.objective) {
          entries.push({
            sourceType: "weeklyObjective",
            sourceId: entry.id,
            title: `Objectif semaine ${label}`,
            bodyText: normalizePlainText(entry.objective),
            metadata: { year: entry.year, isoWeek: entry.isoWeek, targetDate: mondayDate },
            updatedAt: entry.updatedAt,
          });
        }

        if (entry.review) {
          entries.push({
            sourceType: "weeklyReview",
            sourceId: entry.id,
            title: `Bilan semaine ${label}`,
            bodyText: normalizePlainText(entry.review),
            metadata: { year: entry.year, isoWeek: entry.isoWeek, targetDate: mondayDate },
            updatedAt: entry.updatedAt,
          });
        }
      }

      for (const entry of monthlyEntries) {
        const monthDate = `${entry.year}-${String(entry.month).padStart(2, "0")}-01`;
        const label = `${entry.month}/${entry.year}`;

        if (entry.objective) {
          entries.push({
            sourceType: "monthlyObjective",
            sourceId: entry.id,
            title: `Objectif mois ${label}`,
            bodyText: normalizePlainText(entry.objective),
            metadata: { year: entry.year, month: entry.month, targetDate: monthDate },
            updatedAt: entry.updatedAt,
          });
        }

        if (entry.review) {
          entries.push({
            sourceType: "monthlyReview",
            sourceId: entry.id,
            title: `Bilan mois ${label}`,
            bodyText: normalizePlainText(entry.review),
            metadata: { year: entry.year, month: entry.month, targetDate: monthDate },
            updatedAt: entry.updatedAt,
          });
        }
      }

      return entries;
    },
  };
}
