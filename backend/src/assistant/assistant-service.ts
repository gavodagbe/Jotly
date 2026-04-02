import { TaskPriority, TaskStatus } from "@prisma/client";
import { AssistantContextStore } from "./assistant-context-store";
import { AssistantSearchResult } from "./assistant-search-document-store";
import {
  AssistantSearchRetriever,
  shouldUseAssistantSearch,
} from "./assistant-search-retriever";
import { AssistantSearchSyncService } from "./assistant-search-sync";
import { CommentStore } from "../comments/comment-store";
import { formatDateOnly, TaskStore } from "../tasks/task-store";
import { WeeklyEntryStore } from "../weekly-entry/weekly-entry-store";
import { MonthlyEntryStore } from "../monthly-entry/monthly-entry-store";

export type AssistantDomain =
  | "tasks"
  | "reminders"
  | "calendar"
  | "reflections"
  | "profile"
  | "overview";

export type AssistantTaskContext = {
  id: string;
  title: string;
  description: string | null;
  status: TaskStatus;
  targetDate: string;
  priority: TaskPriority;
  project: string | null;
  plannedTime: number | null;
  comments: string[];
};

export type AssistantProfileContext = {
  email: string;
  displayName: string | null;
  preferredLocale: string;
  preferredTimeZone: string | null;
};

export type AssistantDayAffirmationContext = {
  targetDate: string;
  text: string;
  isCompleted: boolean;
  completedAt: string | null;
};

export type AssistantDayBilanContext = {
  targetDate: string;
  mood: number | null;
  wins: string | null;
  blockers: string | null;
  lessonsLearned: string | null;
  tomorrowTop3: string | null;
};

export type AssistantWeeklyEntryContext = {
  year: number;
  isoWeek: number;
  objective: string | null;
  review: string | null;
};

export type AssistantMonthlyEntryContext = {
  year: number;
  month: number;
  objective: string | null;
  review: string | null;
};

export type AssistantReminderContext = {
  title: string;
  description: string | null;
  project: string | null;
  assignees: string | null;
  remindAt: string;
  isFired: boolean;
  isDismissed: boolean;
};

export type AssistantCalendarEventContext = {
  title: string;
  description: string | null;
  location: string | null;
  startTime: string;
  endTime: string;
  isAllDay: boolean;
  startDate: string | null;
  endDate: string | null;
  organizer: string | null;
  attendees: string | null;
  note: string | null;
  linkedTaskTitles: string[];
};

export type AssistantReplyInput = {
  question: string;
  userDisplayName: string | null;
  preferredLocale?: "en" | "fr" | null;
  profile: AssistantProfileContext | null;
  tasks: AssistantTaskContext[];
  dayAffirmations: AssistantDayAffirmationContext[];
  dayBilans: AssistantDayBilanContext[];
  reminders: AssistantReminderContext[];
  calendarEvents: AssistantCalendarEventContext[];
  searchMatches: AssistantSearchResult[];
};

export type AssistantPipelineInput = {
  question: string;
  userId: string;
  userDisplayName: string | null;
  preferredLocale?: "en" | "fr" | null;
};

export type AssistantReply = {
  answer: string;
  source: "openai" | "heuristic";
  warning: string | null;
  usedDomains: string[];
  retrievalMode:
    | "structured"
    | "fulltext"
    | "vector"
    | "structured+fulltext"
    | "structured+vector"
    | "structured+fulltext+vector";
  matchedRecordsCount: number;
};

export type AssistantService = {
  generateReply(input: AssistantPipelineInput): Promise<AssistantReply>;
};

export type AssistantServiceOptions = {
  provider: "openai" | "heuristic";
  openAiApiKey?: string;
  openAiModel: string;
  openAiBaseUrl: string;
  requestTimeoutMs: number;
  taskStore?: TaskStore;
  commentStore?: CommentStore;
  assistantContextStore?: AssistantContextStore;
  assistantSearchRetriever?: AssistantSearchRetriever;
  assistantSearchSyncService?: AssistantSearchSyncService;
  weeklyEntryStore?: WeeklyEntryStore;
  monthlyEntryStore?: MonthlyEntryStore;
};

type OpenAiChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

type RetrievedDomainData = {
  profile: AssistantProfileContext | null;
  tasks: AssistantTaskContext[];
  reminders: AssistantReminderContext[];
  calendarEvents: AssistantCalendarEventContext[];
  dayAffirmations: AssistantDayAffirmationContext[];
  dayBilans: AssistantDayBilanContext[];
  overviewCounts: {
    affirmationCount: number;
    bilanCount: number;
    reminderCount: number;
    eventCount: number;
  } | null;
  searchMatches: AssistantSearchResult[];
  weeklyEntries: AssistantWeeklyEntryContext[];
  monthlyEntries: AssistantMonthlyEntryContext[];
};

function emptyDomainData(): RetrievedDomainData {
  return {
    profile: null,
    tasks: [],
    reminders: [],
    calendarEvents: [],
    dayAffirmations: [],
    dayBilans: [],
    overviewCounts: null,
    searchMatches: [],
    weeklyEntries: [],
    monthlyEntries: [],
  };
}

function isSmallTalkQuestion(question: string): boolean {
  const normalized = normalizeAssistantQuestion(question);

  if (!normalized) {
    return false;
  }

  const smallTalkPatterns = [
    /^hi\b/,
    /^hello\b/,
    /^hey\b/,
    /^how are you\b/,
    /^how's it going\b/,
    /^whats up\b/,
    /^what's up\b/,
    /^good (morning|afternoon|evening)\b/,
    /^salut\b/,
    /^bonjour\b/,
    /^bonsoir\b/,
    /^ca va\b/,
    /^comment ca va\b/,
    /^tu vas bien\b/,
  ];

  return smallTalkPatterns.some((pattern) => pattern.test(normalized));
}

function normalizeAssistantQuestion(question: string): string {
  return question.trim().toLowerCase();
}

function preferFrench(question: string): boolean {
  const normalized = normalizeAssistantQuestion(question);

  if (!normalized) {
    return false;
  }

  return /\b(bonjour|bonsoir|salut|merci|ca va|rappel|rappels|agenda|bilan|tache|taches|recherche|document)\b/.test(
    normalized
  );
}

function shouldReplyInFrench(
  question: string,
  preferredLocale?: "en" | "fr" | null
): boolean {
  return preferFrench(question) || preferredLocale === "fr";
}

function isTaskQuestion(question: string): boolean {
  return /\b(task|tasks|todo|to do|priority|priorities|focus|plan|planning|roadmap|tache|taches|priorite|priorites)\b/i.test(
    question
  );
}

function isReminderQuestion(question: string): boolean {
  return /\b(reminder|reminders|rappel|rappels)\b/i.test(question);
}

function isCalendarQuestion(question: string): boolean {
  return /\b(calendar|agenda|meeting|meetings|event|events|schedule|scheduled|reunion|reunions|evenement|evenements)\b/i.test(
    question
  );
}

function isReflectionQuestion(question: string): boolean {
  return /\b(affirmation|affirmations|bilan|bilans|mood|wins|blockers|lessons|reflection|reflections|objectif|objectifs|objective|objectives|mensuel|mensuelle|hebdomadaire|semaine|revue|weekly|monthly)\b/i.test(
    question
  );
}

function isProfileQuestion(question: string): boolean {
  return /\b(profile|preferences|timezone|time zone|locale|language|email|profil|preference|preferences|fuseau|langue)\b/i.test(
    question
  );
}

function isSearchQuestion(question: string): boolean {
  return /\b(document|documents|pdf|note|notes|comment|comments|search|find|where|mention|mentions|said|says|theme|themes|pattern|patterns|summary|summarize|resume|resumer|chercher|rechercher)\b/i.test(
    question
  );
}

function analyzeQuery(question: string): AssistantDomain[] {
  const domains: AssistantDomain[] = [];

  if (isTaskQuestion(question)) domains.push("tasks");
  if (isReminderQuestion(question)) domains.push("reminders");
  if (isCalendarQuestion(question)) domains.push("calendar");
  if (isReflectionQuestion(question)) domains.push("reflections");
  if (isProfileQuestion(question)) domains.push("profile");

  if (domains.length === 0) {
    domains.push("overview");
  }

  return domains;
}

async function retrieveByDomain(
  userId: string,
  domains: AssistantDomain[],
  stores: {
    taskStore?: TaskStore;
    commentStore?: CommentStore;
    assistantContextStore?: AssistantContextStore;
    weeklyEntryStore?: WeeklyEntryStore;
    monthlyEntryStore?: MonthlyEntryStore;
  }
): Promise<RetrievedDomainData> {
  const data = emptyDomainData();
  const { taskStore, commentStore, assistantContextStore, weeklyEntryStore, monthlyEntryStore } = stores;

  const promises: Promise<void>[] = [];

  for (const domain of domains) {
    switch (domain) {
      case "tasks":
        if (taskStore) {
          promises.push(
            (async () => {
              const tasks = await taskStore.listByUser(userId);
              const sorted = [...tasks].sort((a, b) => {
                const scoreDiff =
                  priorityScore(b.priority) - priorityScore(a.priority) ||
                  statusScore(b.status) - statusScore(a.status);
                if (scoreDiff !== 0) return scoreDiff;
                return b.targetDate.getTime() - a.targetDate.getTime();
              });
              const limited = sorted.slice(0, 20);
              const top5ForComments = limited.slice(0, 5);

              data.tasks = await Promise.all(
                limited.map(async (task) => {
                  const shouldLoadComments =
                    commentStore && top5ForComments.some((candidate) => candidate.id === task.id);
                  const comments = shouldLoadComments
                    ? await commentStore.listByTaskId(task.id)
                    : [];

                  return {
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    status: task.status,
                    targetDate: formatDateOnly(task.targetDate),
                    priority: task.priority,
                    project: task.project,
                    plannedTime: task.plannedTime,
                    comments: comments
                      .map((comment) => comment.body)
                      .filter((value) => value.trim().length > 0),
                  };
                })
              );
            })()
          );
        }
        break;

      case "reminders":
        if (assistantContextStore) {
          promises.push(
            (async () => {
              const reminders = await assistantContextStore.getReminders(userId, {
                activeOnly: true,
                limit: 10,
              });
              data.reminders = reminders.map((reminder) => ({
                title: reminder.title,
                description: reminder.description,
                project: reminder.project,
                assignees: reminder.assignees,
                remindAt: reminder.remindAt.toISOString(),
                isFired: reminder.isFired,
                isDismissed: reminder.isDismissed,
              }));
            })()
          );
        }
        break;

      case "calendar":
        if (assistantContextStore) {
          promises.push(
            (async () => {
              const events = await assistantContextStore.getCalendarEvents(userId, 10);
              data.calendarEvents = events.map((event) => ({
                title: event.title,
                description: event.description,
                location: event.location,
                startTime: event.startTime.toISOString(),
                endTime: event.endTime.toISOString(),
                isAllDay: event.isAllDay,
                startDate: event.startDate ? formatDateOnly(event.startDate) : null,
                endDate: event.endDate ? formatDateOnly(event.endDate) : null,
                organizer: event.organizer,
                attendees: event.attendees,
                note: event.note,
                linkedTaskTitles: [],
              }));
            })()
          );
        }
        break;

      case "reflections":
        if (assistantContextStore) {
          promises.push(
            (async () => {
              const [affirmations, bilans] = await Promise.all([
                assistantContextStore.getAffirmations(userId, 5),
                assistantContextStore.getBilans(userId, 5),
              ]);
              data.dayAffirmations = affirmations.map((affirmation) => ({
                targetDate: formatDateOnly(affirmation.targetDate),
                text: affirmation.text,
                isCompleted: affirmation.isCompleted,
                completedAt: affirmation.completedAt?.toISOString() ?? null,
              }));
              data.dayBilans = bilans.map((bilan) => ({
                targetDate: formatDateOnly(bilan.targetDate),
                mood: bilan.mood,
                wins: bilan.wins,
                blockers: bilan.blockers,
                lessonsLearned: bilan.lessonsLearned,
                tomorrowTop3: bilan.tomorrowTop3,
              }));
            })()
          );
        }
        if (weeklyEntryStore) {
          promises.push(
            (async () => {
              const entries = await weeklyEntryStore.listByUser(userId);
              data.weeklyEntries = entries.map((e) => ({
                year: e.year,
                isoWeek: e.isoWeek,
                objective: e.objective,
                review: e.review,
              }));
            })()
          );
        }
        if (monthlyEntryStore) {
          promises.push(
            (async () => {
              const entries = await monthlyEntryStore.listByUser(userId);
              data.monthlyEntries = entries.map((e) => ({
                year: e.year,
                month: e.month,
                objective: e.objective,
                review: e.review,
              }));
            })()
          );
        }
        break;

      case "profile":
        if (assistantContextStore) {
          promises.push(
            (async () => {
              const profile = await assistantContextStore.getProfile(userId);
              if (profile) {
                data.profile = {
                  email: profile.email,
                  displayName: profile.displayName,
                  preferredLocale: profile.preferredLocale,
                  preferredTimeZone: profile.preferredTimeZone,
                };
              }
            })()
          );
        }
        break;

      case "overview":
        promises.push(
          (async () => {
            const overviewPromises: Promise<void>[] = [];

            if (assistantContextStore) {
              overviewPromises.push(
                (async () => {
                  data.overviewCounts =
                    await assistantContextStore.getOverviewCounts(userId);
                })()
              );
              overviewPromises.push(
                (async () => {
                  const reminders = await assistantContextStore.getReminders(userId, {
                    activeOnly: true,
                    limit: 1,
                  });
                  data.reminders = reminders.map((reminder) => ({
                    title: reminder.title,
                    description: reminder.description,
                    project: reminder.project,
                    assignees: reminder.assignees,
                    remindAt: reminder.remindAt.toISOString(),
                    isFired: reminder.isFired,
                    isDismissed: reminder.isDismissed,
                  }));
                })()
              );
              overviewPromises.push(
                (async () => {
                  const events = await assistantContextStore.getCalendarEvents(
                    userId,
                    1
                  );
                  data.calendarEvents = events.map((event) => ({
                    title: event.title,
                    description: event.description,
                    location: event.location,
                    startTime: event.startTime.toISOString(),
                    endTime: event.endTime.toISOString(),
                    isAllDay: event.isAllDay,
                    startDate: event.startDate ? formatDateOnly(event.startDate) : null,
                    endDate: event.endDate ? formatDateOnly(event.endDate) : null,
                    organizer: event.organizer,
                    attendees: event.attendees,
                    note: event.note,
                    linkedTaskTitles: [],
                  }));
                })()
              );
              overviewPromises.push(
                (async () => {
                  const [affirmations, bilans] = await Promise.all([
                    assistantContextStore.getAffirmations(userId, 1),
                    assistantContextStore.getBilans(userId, 1),
                  ]);
                  data.dayAffirmations = affirmations.map((affirmation) => ({
                    targetDate: formatDateOnly(affirmation.targetDate),
                    text: affirmation.text,
                    isCompleted: affirmation.isCompleted,
                    completedAt: affirmation.completedAt?.toISOString() ?? null,
                  }));
                  data.dayBilans = bilans.map((bilan) => ({
                    targetDate: formatDateOnly(bilan.targetDate),
                    mood: bilan.mood,
                    wins: bilan.wins,
                    blockers: bilan.blockers,
                    lessonsLearned: bilan.lessonsLearned,
                    tomorrowTop3: bilan.tomorrowTop3,
                  }));
                })()
              );
            }

            if (taskStore) {
              overviewPromises.push(
                (async () => {
                  const tasks = await taskStore.listByUser(userId);
                  const sorted = [...tasks].sort((a, b) => {
                    const scoreDiff =
                      priorityScore(b.priority) - priorityScore(a.priority) ||
                      statusScore(b.status) - statusScore(a.status);
                    if (scoreDiff !== 0) return scoreDiff;
                    return b.targetDate.getTime() - a.targetDate.getTime();
                  });
                  data.tasks = sorted.slice(0, 3).map((task) => ({
                    id: task.id,
                    title: task.title,
                    description: task.description,
                    status: task.status,
                    targetDate: formatDateOnly(task.targetDate),
                    priority: task.priority,
                    project: task.project,
                    plannedTime: task.plannedTime,
                    comments: [],
                  }));
                })()
              );
            }

            if (weeklyEntryStore) {
              overviewPromises.push(
                (async () => {
                  const entries = await weeklyEntryStore.listByUser(userId);
                  data.weeklyEntries = entries
                    .sort((a, b) => b.year - a.year || b.isoWeek - a.isoWeek)
                    .slice(0, 3)
                    .map((e) => ({ year: e.year, isoWeek: e.isoWeek, objective: e.objective, review: e.review }));
                })()
              );
            }
            if (monthlyEntryStore) {
              overviewPromises.push(
                (async () => {
                  const entries = await monthlyEntryStore.listByUser(userId);
                  data.monthlyEntries = entries
                    .sort((a, b) => b.year - a.year || b.month - a.month)
                    .slice(0, 3)
                    .map((e) => ({ year: e.year, month: e.month, objective: e.objective, review: e.review }));
                })()
              );
            }

            await Promise.all(overviewPromises);
          })()
        );
        break;
    }
  }

  await Promise.all(promises);
  return data;
}

const DEFAULT_CONTEXT_BUDGET = 8000;

function addBlockWithinBudget(
  blocks: string[],
  label: string,
  content: string,
  remaining: { value: number }
): void {
  const block = `${label}:\n${content}`;

  if (block.length <= remaining.value) {
    blocks.push(block);
    remaining.value -= block.length;
    return;
  }

  if (remaining.value > label.length + 10) {
    const truncated = `${label}:\n${content.slice(0, remaining.value - label.length - 5)}...`;
    blocks.push(truncated);
    remaining.value = 0;
  }
}

function buildSearchMatchesBlock(matches: AssistantSearchResult[]): string {
  if (matches.length === 0) {
    return "No relevant text matches found.";
  }

  return matches
    .map((match) => {
      const title = match.title ? ` | ${clip(match.title, 80)}` : "";
      return `${formatSearchSourceType(match.sourceType)}${title} | ${clip(stripRichTextToPlainText(match.snippet), 220)}`;
    })
    .join("\n");
}

function buildWeeklyEntriesBlock(entries: AssistantWeeklyEntryContext[]): string {
  return entries
    .map((e) => {
      const lines = [`W${e.isoWeek}/${e.year}`];
      if (e.objective) lines.push(`Objective:\n${clip(stripRichTextToPlainText(e.objective), 1500)}`);
      if (e.review) lines.push(`Review:\n${clip(stripRichTextToPlainText(e.review), 1500)}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

function buildMonthlyEntriesBlock(entries: AssistantMonthlyEntryContext[]): string {
  return entries
    .map((e) => {
      const lines = [`${e.month}/${e.year}`];
      if (e.objective) lines.push(`Objective:\n${clip(stripRichTextToPlainText(e.objective), 1500)}`);
      if (e.review) lines.push(`Review:\n${clip(stripRichTextToPlainText(e.review), 1500)}`);
      return lines.join("\n");
    })
    .join("\n\n");
}

function buildContext(
  retrieved: RetrievedDomainData,
  budget: number = DEFAULT_CONTEXT_BUDGET
): string {
  const blocks: string[] = [];
  const remaining = { value: budget };

  if (retrieved.profile) {
    addBlockWithinBudget(
      blocks,
      "Profile",
      buildProfileBlockFromData(retrieved.profile),
      remaining
    );
  }

  if (retrieved.overviewCounts) {
    const counts = retrieved.overviewCounts;
    addBlockWithinBudget(
      blocks,
      "Overview",
      `${counts.affirmationCount} affirmations, ${counts.bilanCount} bilans, ${counts.reminderCount} reminders, ${counts.eventCount} events`,
      remaining
    );
  }

  if (retrieved.searchMatches.length > 0 && remaining.value > 0) {
    addBlockWithinBudget(
      blocks,
      "Search matches",
      buildSearchMatchesBlock(retrieved.searchMatches),
      remaining
    );
  }

  if (retrieved.tasks.length > 0 && remaining.value > 0) {
    addBlockWithinBudget(blocks, "Tasks", buildTasksBlock(makeReplyInput(retrieved)), remaining);
  }

  if (retrieved.reminders.length > 0 && remaining.value > 0) {
    addBlockWithinBudget(
      blocks,
      "Reminders",
      buildRemindersBlock(makeReplyInput(retrieved)),
      remaining
    );
  }

  if (retrieved.calendarEvents.length > 0 && remaining.value > 0) {
    addBlockWithinBudget(
      blocks,
      "Calendar events",
      buildCalendarEventsBlock(makeReplyInput(retrieved)),
      remaining
    );
  }

  if (retrieved.dayAffirmations.length > 0 && remaining.value > 0) {
    addBlockWithinBudget(
      blocks,
      "Day affirmations",
      buildAffirmationsBlock(makeReplyInput(retrieved)),
      remaining
    );
  }

  if (retrieved.dayBilans.length > 0 && remaining.value > 0) {
    addBlockWithinBudget(
      blocks,
      "Day bilans",
      buildBilansBlock(makeReplyInput(retrieved)),
      remaining
    );
  }

  if (retrieved.weeklyEntries.length > 0 && remaining.value > 0) {
    addBlockWithinBudget(
      blocks,
      "Weekly objectives & reviews",
      buildWeeklyEntriesBlock(retrieved.weeklyEntries),
      remaining
    );
  }

  if (retrieved.monthlyEntries.length > 0 && remaining.value > 0) {
    addBlockWithinBudget(
      blocks,
      "Monthly objectives & reviews",
      buildMonthlyEntriesBlock(retrieved.monthlyEntries),
      remaining
    );
  }

  return blocks.join("\n\n");
}

function countRecords(retrieved: RetrievedDomainData): number {
  const baseCount =
    retrieved.tasks.length +
    retrieved.reminders.length +
    retrieved.calendarEvents.length +
    retrieved.dayAffirmations.length +
    retrieved.dayBilans.length +
    retrieved.weeklyEntries.length +
    retrieved.monthlyEntries.length +
    (retrieved.profile ? 1 : 0);

  const searchCount = new Set(
    retrieved.searchMatches.map((match) => `${match.sourceType}:${match.sourceId}`)
  ).size;

  return baseCount + searchCount;
}

function makeReplyInput(data: RetrievedDomainData): AssistantReplyInput {
  return {
    question: "",
    userDisplayName: null,
    profile: data.profile,
    tasks: data.tasks,
    dayAffirmations: data.dayAffirmations,
    dayBilans: data.dayBilans,
    reminders: data.reminders,
    calendarEvents: data.calendarEvents,
    searchMatches: data.searchMatches,
  };
}

function summarizeTask(task: AssistantTaskContext): string {
  const parts = [
    `date: ${task.targetDate}`,
    task.priority.toUpperCase(),
    task.status,
    task.title,
    task.project ? `project: ${task.project}` : null,
    typeof task.plannedTime === "number" ? `planned: ${task.plannedTime}m` : null,
  ].filter((value): value is string => Boolean(value));

  return parts.join(" | ");
}

function clip(value: string, maxLength: number): string {
  if (value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 3)}...`;
}

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function stripRichTextToPlainText(value: string): string {
  const normalized = value
    .replace(/<input\b[^>]*type=["']checkbox["'][^>]*checked[^>]*>/gi, "[x] ")
    .replace(/<input\b[^>]*type=["']checkbox["'][^>]*>/gi, "[ ] ")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|blockquote|li|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(normalized)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function formatIsoTimestamp(value: string): string {
  const parsed = new Date(value);

  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toISOString().replace(".000Z", "Z");
}

function buildProfileBlockFromData(profile: AssistantProfileContext): string {
  return [
    `email: ${profile.email}`,
    profile.displayName ? `displayName: ${profile.displayName}` : null,
    `preferredLocale: ${profile.preferredLocale}`,
    profile.preferredTimeZone ? `preferredTimeZone: ${profile.preferredTimeZone}` : null,
  ]
    .filter((value): value is string => Boolean(value))
    .join(" | ");
}

function buildTasksBlock(input: AssistantReplyInput): string {
  if (input.tasks.length === 0) {
    return "No tasks found for this user.";
  }

  return input.tasks
    .map((task) => {
      const summary = summarizeTask(task);
      const plainDescription = task.description
        ? stripRichTextToPlainText(task.description)
        : "";
      const description = plainDescription ? `desc: ${clip(plainDescription, 240)}` : null;
      const plainComments = task.comments
        .map((item) => stripRichTextToPlainText(item))
        .filter((item) => item.length > 0);
      const comments =
        plainComments.length > 0
          ? `comments: ${plainComments.map((item) => clip(item, 180)).join(" || ")}`
          : null;

      return [summary, description, comments]
        .filter((value): value is string => Boolean(value))
        .join("\n");
    })
    .join("\n\n");
}

function buildAffirmationsBlock(input: AssistantReplyInput): string {
  if (input.dayAffirmations.length === 0) {
    return "No day affirmations found.";
  }

  return input.dayAffirmations
    .map((affirmation) =>
      [
        affirmation.targetDate,
        affirmation.isCompleted ? "completed" : "pending",
        clip(stripRichTextToPlainText(affirmation.text), 180),
      ].join(" | ")
    )
    .join("\n");
}

function buildBilansBlock(input: AssistantReplyInput): string {
  if (input.dayBilans.length === 0) {
    return "No day bilans found.";
  }

  return input.dayBilans
    .map((bilan) => {
      const parts = [
        bilan.targetDate,
        bilan.mood !== null ? `mood: ${bilan.mood}/5` : null,
        bilan.wins ? `wins: ${clip(stripRichTextToPlainText(bilan.wins), 120)}` : null,
        bilan.blockers
          ? `blockers: ${clip(stripRichTextToPlainText(bilan.blockers), 120)}`
          : null,
        bilan.lessonsLearned
          ? `lessons: ${clip(stripRichTextToPlainText(bilan.lessonsLearned), 120)}`
          : null,
        bilan.tomorrowTop3
          ? `next: ${clip(stripRichTextToPlainText(bilan.tomorrowTop3), 120)}`
          : null,
      ].filter((value): value is string => Boolean(value));

      return parts.join(" | ");
    })
    .join("\n");
}

function buildRemindersBlock(input: AssistantReplyInput): string {
  if (input.reminders.length === 0) {
    return "No reminders found.";
  }

  return input.reminders
    .map((reminder) => {
      const parts = [
        formatIsoTimestamp(reminder.remindAt),
        reminder.title,
        reminder.project ? `project: ${reminder.project}` : null,
        reminder.assignees ? `assignees: ${reminder.assignees}` : null,
        reminder.isDismissed ? "dismissed" : reminder.isFired ? "fired" : "scheduled",
        reminder.description
          ? `desc: ${clip(stripRichTextToPlainText(reminder.description), 140)}`
          : null,
      ].filter((value): value is string => Boolean(value));

      return parts.join(" | ");
    })
    .join("\n");
}

function buildCalendarEventsBlock(input: AssistantReplyInput): string {
  if (input.calendarEvents.length === 0) {
    return "No calendar events found.";
  }

  return input.calendarEvents
    .map((event) => {
      const dateLabel = event.isAllDay
        ? `${event.startDate ?? "unknown"} -> ${event.endDate ?? "unknown"}`
        : `${formatIsoTimestamp(event.startTime)} -> ${formatIsoTimestamp(event.endTime)}`;
      const parts = [
        dateLabel,
        event.title,
        event.location ? `location: ${event.location}` : null,
        event.organizer ? `organizer: ${event.organizer}` : null,
        event.attendees ? `attendees: ${clip(event.attendees, 140)}` : null,
        event.description
          ? `desc: ${clip(stripRichTextToPlainText(event.description), 140)}`
          : null,
        event.note ? `note: ${clip(stripRichTextToPlainText(event.note), 140)}` : null,
        event.linkedTaskTitles.length > 0
          ? `linkedTasks: ${event.linkedTaskTitles.join(", ")}`
          : null,
      ].filter((value): value is string => Boolean(value));

      return parts.join(" | ");
    })
    .join("\n");
}

function currentIsoWeek(): number {
  const now = new Date();
  const thursday = new Date(now);
  thursday.setDate(now.getDate() + 4 - (now.getDay() || 7));
  const yearStart = new Date(thursday.getFullYear(), 0, 1);
  return Math.ceil(((thursday.getTime() - yearStart.getTime()) / 86400000 + 1) / 7);
}

function buildOpenAiPrompt(
  question: string,
  contextString: string,
  userDisplayName: string | null,
  preferredLocale?: "en" | "fr" | null
): string {
  const now = new Date();
  const isoWeek = currentIsoWeek();
  const dateInfo = `Current date: ${now.toISOString().substring(0, 10)} (ISO week W${isoWeek}/${now.getFullYear()})\n`;
  const userName = userDisplayName ? `User display name: ${userDisplayName}\n` : "";
  const preferredLocaleLine = preferredLocale
    ? `Preferred locale: ${preferredLocale}\n`
    : "";

  return `${dateInfo}${userName}${preferredLocaleLine}User question: ${question}

Workspace context:
${contextString}

Instructions:
- You are Jotly's workspace assistant, not only a task planner.
- First detect intent:
  - If the question is small talk or generic conversation, reply naturally in 1-2 short sentences.
  - If the question is about tasks, planning, reminders, affirmations, bilans, profile/preferences, or calendar context, use any relevant data from the workspace context above.
  - If the user asks a broad question about their productivity, documents, notes, or workspace, synthesize across the full context and search matches.
- Mirror the user's language.
- If the user message language is ambiguous, default to preferred locale when available.
- Be concise, practical, and grounded in the provided context.
- Mention dates when they matter.
- Do not invent records or details that are not in context.`;
}

function priorityScore(priority: TaskPriority): number {
  if (priority === "high") return 3;
  if (priority === "medium") return 2;
  return 1;
}

function statusScore(status: TaskStatus): number {
  if (status === "in_progress") return 3;
  if (status === "todo") return 2;
  if (status === "done") return 1;
  return 0;
}

function findPotentiallyBlockedTasks(tasks: AssistantTaskContext[]): AssistantTaskContext[] {
  const blockerPattern =
    /\b(blocked|waiting|stuck|dependency|depends on|need review|need approval|blocked by)\b/i;
  return tasks.filter((task) => {
    const description = stripRichTextToPlainText(task.description ?? "");
    const comments = task.comments.map((item) => stripRichTextToPlainText(item)).join(" ");
    return blockerPattern.test(`${description} ${comments}`);
  });
}

function formatMinutes(totalMinutes: number): string {
  if (totalMinutes < 60) {
    return `${totalMinutes}m`;
  }

  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;
  return minutes === 0 ? `${hours}h` : `${hours}h ${minutes}m`;
}

function formatSearchSourceType(sourceType: AssistantSearchResult["sourceType"]): string {
  switch (sourceType) {
    case "task":
      return "task";
    case "comment":
      return "comment";
    case "attachment":
      return "attachment";
    case "affirmation":
      return "affirmation";
    case "bilan":
      return "bilan";
    case "reminder":
      return "reminder";
    case "calendarEvent":
      return "calendar event";
    case "calendarNote":
      return "calendar note";
    default:
      return sourceType;
  }
}

function createSmallTalkReply(
  question: string,
  taskCount: number,
  preferredLocale?: "en" | "fr" | null
): AssistantReply {
  if (shouldReplyInFrench(question, preferredLocale)) {
    const followUp =
      taskCount > 0
        ? `Tu as ${taskCount} tache${taskCount > 1 ? "s" : ""} au total. Tu veux une synthese globale ?`
        : "Tu veux que je resume ton espace Jotly ?";

    return {
      answer: `Je vais bien, merci. ${followUp}`,
      source: "heuristic",
      warning: null,
      usedDomains: [],
      retrievalMode: "structured",
      matchedRecordsCount: 0,
    };
  }

  const followUp =
    taskCount > 0
      ? `You have ${taskCount} task${taskCount > 1 ? "s" : ""} in total. Want a global workspace summary?`
      : "Want me to summarize your Jotly workspace?";

  return {
    answer: `I'm doing well, thanks. ${followUp}`,
    source: "heuristic",
    warning: null,
    usedDomains: [],
    retrievalMode: "structured",
    matchedRecordsCount: 0,
  };
}

function buildTaskLines(input: AssistantReplyInput, useFrench: boolean): string[] {
  const actionable = input.tasks.filter(
    (task) => task.status === "todo" || task.status === "in_progress"
  );
  const completed = input.tasks.filter((task) => task.status === "done");
  const cancelled = input.tasks.filter((task) => task.status === "cancelled");

  const focusTasks = [...actionable]
    .sort((left, right) => {
      const scoreDiff =
        statusScore(right.status) - statusScore(left.status) ||
        priorityScore(right.priority) - priorityScore(left.priority);

      if (scoreDiff !== 0) {
        return scoreDiff;
      }

      return (right.plannedTime ?? 0) - (left.plannedTime ?? 0);
    })
    .slice(0, 3);

  const quickWins = actionable
    .filter((task) => typeof task.plannedTime === "number" && task.plannedTime <= 30)
    .slice(0, 2);
  const blocked = findPotentiallyBlockedTasks(actionable).slice(0, 3);

  const lines: string[] = [];
  lines.push(useFrench ? "Vue taches" : "Task view");
  lines.push(
    useFrench
      ? `Tu as ${input.tasks.length} tache${input.tasks.length === 1 ? "" : "s"} au total (${actionable.length} actionnable${actionable.length === 1 ? "" : "s"}, ${completed.length} terminee${completed.length === 1 ? "" : "s"}, ${cancelled.length} annulee${cancelled.length === 1 ? "" : "s"}).`
      : `You have ${input.tasks.length} task${input.tasks.length === 1 ? "" : "s"} total (${actionable.length} actionable, ${completed.length} done, ${cancelled.length} cancelled).`
  );

  if (focusTasks.length > 0) {
    lines.push("");
    lines.push(useFrench ? "Priorites principales:" : "Top focus:");
    for (const task of focusTasks) {
      const effort =
        typeof task.plannedTime === "number" ? `, ${formatMinutes(task.plannedTime)}` : "";
      lines.push(
        `- ${task.title} [${task.priority}, ${task.status}, ${task.targetDate}${effort}]`
      );
    }
  }

  if (blocked.length > 0) {
    lines.push("");
    lines.push(useFrench ? "Blocages potentiels:" : "Potential blockers:");
    for (const task of blocked) {
      lines.push(`- ${task.title}`);
    }
  }

  if (quickWins.length > 0) {
    lines.push("");
    lines.push(useFrench ? "Victoires rapides:" : "Quick wins:");
    for (const task of quickWins) {
      lines.push(`- ${task.title} (${formatMinutes(task.plannedTime ?? 0)})`);
    }
  }

  return lines;
}

function createReminderReply(
  input: AssistantReplyInput,
  useFrench: boolean
): Omit<AssistantReply, "usedDomains" | "retrievalMode" | "matchedRecordsCount"> {
  const activeReminders = input.reminders.filter((reminder) => !reminder.isDismissed);
  const nextReminders = activeReminders.slice(0, 4);
  const lines: string[] = [];

  lines.push(useFrench ? "Vue rappels" : "Reminder view");
  lines.push(
    useFrench
      ? `${input.reminders.length} rappel${input.reminders.length === 1 ? "" : "s"} trouves, dont ${activeReminders.length} encore actifs.`
      : `${input.reminders.length} reminder${input.reminders.length === 1 ? "" : "s"} found, ${activeReminders.length} still active.`
  );

  if (nextReminders.length > 0) {
    lines.push("");
    lines.push(useFrench ? "Prochains rappels:" : "Next reminders:");
    for (const reminder of nextReminders) {
      lines.push(`- ${reminder.title} [${formatIsoTimestamp(reminder.remindAt)}]`);
    }
  }

  if (nextReminders.length === 0) {
    lines.push("");
    lines.push(useFrench ? "Aucun rappel actif a signaler." : "No active reminders to highlight.");
  }

  return {
    answer: lines.join("\n"),
    source: "heuristic",
    warning: null,
  };
}

function createCalendarReply(
  input: AssistantReplyInput,
  useFrench: boolean
): Omit<AssistantReply, "usedDomains" | "retrievalMode" | "matchedRecordsCount"> {
  const nextEvents = input.calendarEvents.slice(0, 4);
  const lines: string[] = [];

  lines.push(useFrench ? "Vue agenda" : "Calendar view");
  lines.push(
    useFrench
      ? `${input.calendarEvents.length} evenement${input.calendarEvents.length === 1 ? "" : "s"} synchronise${input.calendarEvents.length === 1 ? "" : "s"}.`
      : `${input.calendarEvents.length} synced event${input.calendarEvents.length === 1 ? "" : "s"}.`
  );

  if (nextEvents.length > 0) {
    lines.push("");
    lines.push(useFrench ? "Prochains evenements:" : "Next events:");
    for (const event of nextEvents) {
      const dateLabel = event.isAllDay
        ? event.startDate ?? "unknown"
        : formatIsoTimestamp(event.startTime);
      const linkedTasks =
        event.linkedTaskTitles.length > 0
          ? useFrench
            ? `, taches liees: ${event.linkedTaskTitles.join(", ")}`
            : `, linked tasks: ${event.linkedTaskTitles.join(", ")}`
          : "";
      lines.push(`- ${event.title} [${dateLabel}${linkedTasks}]`);
    }
  }

  if (nextEvents.length === 0) {
    lines.push("");
    lines.push(useFrench ? "Aucun evenement calendrier disponible." : "No calendar events available.");
  }

  return {
    answer: lines.join("\n"),
    source: "heuristic",
    warning: null,
  };
}

function createReflectionReply(
  input: AssistantReplyInput,
  useFrench: boolean
): Omit<AssistantReply, "usedDomains" | "retrievalMode" | "matchedRecordsCount"> {
  const latestAffirmation = input.dayAffirmations[input.dayAffirmations.length - 1] ?? null;
  const latestBilan = input.dayBilans[input.dayBilans.length - 1] ?? null;
  const lines: string[] = [];

  lines.push(useFrench ? "Vue reflexion" : "Reflection view");
  lines.push(
    useFrench
      ? `${input.dayAffirmations.length} affirmation${input.dayAffirmations.length === 1 ? "" : "s"} et ${input.dayBilans.length} bilan${input.dayBilans.length === 1 ? "" : "s"} trouves.`
      : `${input.dayAffirmations.length} affirmation${input.dayAffirmations.length === 1 ? "" : "s"} and ${input.dayBilans.length} bilan${input.dayBilans.length === 1 ? "" : "s"} found.`
  );

  if (latestAffirmation) {
    lines.push("");
    lines.push(useFrench ? "Derniere affirmation:" : "Latest affirmation:");
    lines.push(
      `- ${latestAffirmation.targetDate}: ${clip(
        stripRichTextToPlainText(latestAffirmation.text),
        180
      )}`
    );
  }

  if (latestBilan) {
    lines.push("");
    lines.push(useFrench ? "Dernier bilan:" : "Latest bilan:");
    const bilanSummary = [
      latestBilan.targetDate,
      latestBilan.mood !== null ? `${useFrench ? "humeur" : "mood"} ${latestBilan.mood}/5` : null,
      latestBilan.blockers
        ? `${useFrench ? "blocages" : "blockers"}: ${clip(
            stripRichTextToPlainText(latestBilan.blockers),
            120
          )}`
        : null,
      latestBilan.tomorrowTop3
        ? `${useFrench ? "prochain focus" : "next focus"}: ${clip(
            stripRichTextToPlainText(latestBilan.tomorrowTop3),
            120
          )}`
        : null,
    ]
      .filter((value): value is string => Boolean(value))
      .join(" | ");
    lines.push(`- ${bilanSummary}`);
  }

  return {
    answer: lines.join("\n"),
    source: "heuristic",
    warning: null,
  };
}

function createProfileReply(
  input: AssistantReplyInput,
  useFrench: boolean
): Omit<AssistantReply, "usedDomains" | "retrievalMode" | "matchedRecordsCount"> {
  const lines: string[] = [];

  lines.push(useFrench ? "Vue profil" : "Profile view");

  if (!input.profile) {
    lines.push(useFrench ? "Aucune information profil disponible." : "No profile information available.");
  } else {
    lines.push(
      useFrench
        ? `Email: ${input.profile.email} | langue: ${input.profile.preferredLocale} | fuseau: ${input.profile.preferredTimeZone ?? "non defini"}`
        : `Email: ${input.profile.email} | locale: ${input.profile.preferredLocale} | timezone: ${input.profile.preferredTimeZone ?? "not set"}`
    );
  }

  lines.push("");
  lines.push(
    useFrench
      ? `Contexte disponible: ${input.tasks.length} taches, ${input.reminders.length} rappels, ${input.dayAffirmations.length} affirmations, ${input.dayBilans.length} bilans, ${input.calendarEvents.length} evenements.`
      : `Available context: ${input.tasks.length} tasks, ${input.reminders.length} reminders, ${input.dayAffirmations.length} affirmations, ${input.dayBilans.length} bilans, ${input.calendarEvents.length} events.`
  );

  return {
    answer: lines.join("\n"),
    source: "heuristic",
    warning: null,
  };
}

function createSearchReply(
  input: AssistantReplyInput,
  useFrench: boolean
): Omit<AssistantReply, "usedDomains" | "retrievalMode" | "matchedRecordsCount"> {
  const lines: string[] = [];

  lines.push(useFrench ? "Vue recherche" : "Search view");
  lines.push(
    useFrench
      ? `${input.searchMatches.length} resultat${input.searchMatches.length === 1 ? "" : "s"} textuel${input.searchMatches.length === 1 ? "" : "s"} pertinent${input.searchMatches.length === 1 ? "" : "s"}.`
      : `${input.searchMatches.length} relevant text match${input.searchMatches.length === 1 ? "" : "es"} found.`
  );

  if (input.searchMatches.length === 0) {
    lines.push("");
    lines.push(
      useFrench
        ? "Je n'ai pas trouve de contenu textuel pertinent dans l'index."
        : "I did not find relevant indexed text content."
    );
  } else {
    lines.push("");
    lines.push(useFrench ? "Correspondances principales:" : "Top matches:");
    for (const match of input.searchMatches.slice(0, 5)) {
      const title = match.title ? ` - ${clip(match.title, 80)}` : "";
      lines.push(
        `- ${formatSearchSourceType(match.sourceType)}${title}: ${clip(
          stripRichTextToPlainText(match.snippet),
          180
        )}`
      );
    }
  }

  return {
    answer: lines.join("\n"),
    source: "heuristic",
    warning: null,
  };
}

function createWorkspaceOverviewReply(
  input: AssistantReplyInput,
  useFrench: boolean
): Omit<AssistantReply, "usedDomains" | "retrievalMode" | "matchedRecordsCount"> {
  const lines: string[] = [];

  lines.push(useFrench ? "Vue globale de l'espace utilisateur" : "Workspace overview");
  lines.push(
    useFrench
      ? `${input.tasks.length} taches, ${input.reminders.length} rappels, ${input.dayAffirmations.length} affirmations, ${input.dayBilans.length} bilans, ${input.calendarEvents.length} evenements calendrier.`
      : `${input.tasks.length} tasks, ${input.reminders.length} reminders, ${input.dayAffirmations.length} affirmations, ${input.dayBilans.length} bilans, ${input.calendarEvents.length} calendar events.`
  );

  const taskLines = buildTaskLines(input, useFrench);
  if (taskLines.length > 0) {
    lines.push("");
    lines.push(...taskLines);
  }

  const nextReminder = input.reminders.find((reminder) => !reminder.isDismissed) ?? null;
  if (nextReminder) {
    lines.push("");
    lines.push(
      useFrench
        ? `Prochain rappel: ${nextReminder.title} le ${formatIsoTimestamp(nextReminder.remindAt)}.`
        : `Next reminder: ${nextReminder.title} at ${formatIsoTimestamp(nextReminder.remindAt)}.`
    );
  }

  const nextEvent = input.calendarEvents[0] ?? null;
  if (nextEvent) {
    const dateLabel = nextEvent.isAllDay ? nextEvent.startDate ?? "unknown" : formatIsoTimestamp(nextEvent.startTime);
    lines.push(
      useFrench
        ? `Prochain evenement: ${nextEvent.title} le ${dateLabel}.`
        : `Next event: ${nextEvent.title} at ${dateLabel}.`
    );
  }

  if (input.searchMatches.length > 0) {
    lines.push("");
    lines.push(useFrench ? "Textes pertinents trouves:" : "Relevant indexed text:");
    for (const match of input.searchMatches.slice(0, 3)) {
      lines.push(
        `- ${formatSearchSourceType(match.sourceType)}: ${clip(
          stripRichTextToPlainText(match.snippet),
          120
        )}`
      );
    }
  }

  if (input.dayAffirmations.length > 0 || input.dayBilans.length > 0) {
    const latestAffirmation = input.dayAffirmations[input.dayAffirmations.length - 1] ?? null;
    const latestBilan = input.dayBilans[input.dayBilans.length - 1] ?? null;
    lines.push("");
    lines.push(useFrench ? "Derniere reflexion:" : "Latest reflection:");
    if (latestAffirmation) {
      lines.push(`- ${latestAffirmation.targetDate}: ${clip(stripRichTextToPlainText(latestAffirmation.text), 120)}`);
    }
    if (latestBilan?.tomorrowTop3) {
      lines.push(
        useFrench
          ? `- Focus suivant: ${clip(stripRichTextToPlainText(latestBilan.tomorrowTop3), 120)}`
          : `- Next focus: ${clip(stripRichTextToPlainText(latestBilan.tomorrowTop3), 120)}`
      );
    }
  }

  lines.push("");
  lines.push(
    useFrench
      ? `Question recue: "${input.question.trim()}"`
      : `Question received: "${input.question.trim()}"`
  );

  return {
    answer: lines.join("\n"),
    source: "heuristic",
    warning: null,
  };
}

function createHeuristicReply(
  input: AssistantReplyInput
): Omit<AssistantReply, "usedDomains" | "retrievalMode" | "matchedRecordsCount"> {
  const useFrench = shouldReplyInFrench(input.question, input.preferredLocale);

  if (input.searchMatches.length > 0 && isSearchQuestion(input.question)) {
    return createSearchReply(input, useFrench);
  }

  if (isReminderQuestion(input.question)) {
    return createReminderReply(input, useFrench);
  }

  if (isCalendarQuestion(input.question)) {
    return createCalendarReply(input, useFrench);
  }

  if (isReflectionQuestion(input.question)) {
    return createReflectionReply(input, useFrench);
  }

  if (isProfileQuestion(input.question)) {
    return createProfileReply(input, useFrench);
  }

  if (isTaskQuestion(input.question)) {
    return {
      answer: buildTaskLines(input, useFrench).join("\n"),
      source: "heuristic",
      warning: null,
    };
  }

  if (input.searchMatches.length > 0) {
    return createSearchReply(input, useFrench);
  }

  return createWorkspaceOverviewReply(input, useFrench);
}

async function createOpenAiReply(
  question: string,
  contextString: string,
  userDisplayName: string | null,
  preferredLocale: "en" | "fr" | null | undefined,
  options: AssistantServiceOptions
): Promise<Omit<AssistantReply, "usedDomains" | "retrievalMode" | "matchedRecordsCount">> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);

  try {
    const response = await fetch(`${options.openAiBaseUrl.replace(/\/$/, "")}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${options.openAiApiKey}`,
      },
      body: JSON.stringify({
        model: options.openAiModel,
        temperature: 0.3,
        max_tokens: 700,
        messages: [
          {
            role: "system",
            content:
              "You are Jotly's workspace assistant. Give concise, actionable answers using only the provided workspace context.",
          },
          {
            role: "user",
            content: buildOpenAiPrompt(question, contextString, userDisplayName, preferredLocale),
          },
        ],
      }),
      signal: controller.signal,
    });

    const payload = (await response.json().catch(() => null)) as OpenAiChatCompletionResponse | null;

    if (!response.ok) {
      const message = payload?.error?.message ?? `OpenAI request failed (HTTP ${response.status})`;
      throw new Error(message);
    }

    const content = payload?.choices?.[0]?.message?.content?.trim();

    if (!content) {
      throw new Error("OpenAI response did not contain assistant text.");
    }

    return {
      answer: content,
      source: "openai",
      warning: null,
    };
  } finally {
    clearTimeout(timeout);
  }
}

function combineWarning(
  primary: string | null,
  secondary: string | null
): string | null {
  if (!primary) return secondary;
  if (!secondary) return primary;
  return `${primary} ${secondary}`;
}

function combineRetrievalMode(
  searchMode: "none" | "fulltext" | "vector" | "fulltext+vector"
): AssistantReply["retrievalMode"] {
  switch (searchMode) {
    case "fulltext":
      return "structured+fulltext";
    case "vector":
      return "structured+vector";
    case "fulltext+vector":
      return "structured+fulltext+vector";
    default:
      return "structured";
  }
}

// Per-user sync cooldown: avoid re-indexing on every single query.
const SYNC_COOLDOWN_MS = 5 * 60 * 1000; // 5 minutes
const lastSyncByUser = new Map<string, number>();

function shouldRunSync(userId: string): boolean {
  const last = lastSyncByUser.get(userId) ?? 0;
  return Date.now() - last > SYNC_COOLDOWN_MS;
}

function markSyncDone(userId: string): void {
  lastSyncByUser.set(userId, Date.now());
}

export function createAssistantService(options: AssistantServiceOptions): AssistantService {
  const stores = {
    taskStore: options.taskStore,
    commentStore: options.commentStore,
    assistantContextStore: options.assistantContextStore,
    weeklyEntryStore: options.weeklyEntryStore,
    monthlyEntryStore: options.monthlyEntryStore,
  };

  return {
    async generateReply(input) {
      const { question, userId, userDisplayName, preferredLocale } = input;

      if (isSmallTalkQuestion(question)) {
        let taskCount = 0;
        if (stores.taskStore) {
          const tasks = await stores.taskStore.listByUser(userId);
          taskCount = tasks.length;
        }
        return createSmallTalkReply(question, taskCount, preferredLocale);
      }

      const domains = analyzeQuery(question);
      const retrieved = await retrieveByDomain(userId, domains, stores);

      let searchWarning: string | null = null;
      let searchMode: "none" | "fulltext" | "vector" | "fulltext+vector" = "none";

      if (
        options.assistantSearchRetriever &&
        shouldUseAssistantSearch(question, domains)
      ) {
        if (shouldRunSync(userId)) {
          try {
            await options.assistantSearchSyncService?.syncUserWorkspace(userId);
            markSyncDone(userId);
          } catch (syncError) {
            console.warn("[assistant] syncUserWorkspace failed (non-fatal):", syncError);
          }
        }

        try {
          const searchRetrieval = await options.assistantSearchRetriever.search({
            userId,
            question,
            domains,
          });
          retrieved.searchMatches = searchRetrieval.matches;
          searchMode = searchRetrieval.mode;
        } catch {
          searchWarning =
            "Workspace text search is unavailable right now. Returned structured guidance only.";
        }
      }

      const contextString = buildContext(retrieved);
      const matchedRecordsCount = countRecords(retrieved);
      const retrievalMode = combineRetrievalMode(searchMode);

      if (options.provider === "openai" && options.openAiApiKey) {
        try {
          const openAiResult = await createOpenAiReply(
            question,
            contextString,
            userDisplayName,
            preferredLocale,
            options
          );
          return {
            ...openAiResult,
            warning: combineWarning(openAiResult.warning, searchWarning),
            usedDomains: domains,
            retrievalMode,
            matchedRecordsCount,
          };
        } catch {
          const replyInput: AssistantReplyInput = {
            question,
            userDisplayName,
            preferredLocale,
            ...retrieved,
          };
          const fallback = createHeuristicReply(replyInput);
          return {
            ...fallback,
            warning: combineWarning(
              "OpenAI is unavailable right now. Returned heuristic guidance instead.",
              searchWarning
            ),
            usedDomains: domains,
            retrievalMode,
            matchedRecordsCount,
          };
        }
      }

      const replyInput: AssistantReplyInput = {
        question,
        userDisplayName,
        preferredLocale,
        ...retrieved,
      };
      const heuristicResult = createHeuristicReply(replyInput);
      return {
        ...heuristicResult,
        warning: combineWarning(heuristicResult.warning, searchWarning),
        usedDomains: domains,
        retrievalMode,
        matchedRecordsCount,
      };
    },
  };
}
