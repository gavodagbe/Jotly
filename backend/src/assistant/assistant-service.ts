import { TaskPriority, TaskStatus } from "@prisma/client";

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

export type AssistantReplyInput = {
  question: string;
  userDisplayName: string | null;
  preferredLocale?: "en" | "fr" | null;
  tasks: AssistantTaskContext[];
};

export type AssistantReply = {
  answer: string;
  source: "openai" | "heuristic";
  warning: string | null;
};

export type AssistantService = {
  generateReply(input: AssistantReplyInput): Promise<AssistantReply>;
};

export type AssistantServiceOptions = {
  provider: "openai" | "heuristic";
  openAiApiKey?: string;
  openAiModel: string;
  openAiBaseUrl: string;
  requestTimeoutMs: number;
};

type OpenAiChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string | null } }>;
  error?: { message?: string };
};

function isSmallTalkQuestion(question: string): boolean {
  const normalized = question.trim().toLowerCase();

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
    /^ça va\b/,
    /^comment ca va\b/,
    /^comment ça va\b/,
    /^tu vas bien\b/,
  ];

  return smallTalkPatterns.some((pattern) => pattern.test(normalized));
}

function preferFrench(question: string): boolean {
  const normalized = question.trim().toLowerCase();

  if (!normalized) {
    return false;
  }

  return /\b(bonjour|bonsoir|salut|merci|ça|ca va|comment)\b/.test(normalized);
}

function shouldReplyInFrench(question: string, preferredLocale?: "en" | "fr" | null): boolean {
  return preferFrench(question) || preferredLocale === "fr";
}

function createSmallTalkReply(
  question: string,
  taskCount: number,
  preferredLocale?: "en" | "fr" | null
): AssistantReply {
  if (shouldReplyInFrench(question, preferredLocale)) {
    const followUp =
      taskCount > 0
        ? `Tu as ${taskCount} tâche${taskCount > 1 ? "s" : ""} au total. Tu veux un plan rapide ?`
        : "Tu veux que je t'aide à organiser tes tâches ?";

    return {
      answer: `Je vais bien, merci. ${followUp}`,
      source: "heuristic",
      warning: null,
    };
  }

  const followUp =
    taskCount > 0
      ? `You have ${taskCount} task${taskCount > 1 ? "s" : ""} in total. Want a quick priority plan?`
      : "Want help planning your tasks?";

  return {
    answer: `I'm doing well, thanks. ${followUp}`,
    source: "heuristic",
    warning: null,
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

function buildOpenAiPrompt(input: AssistantReplyInput): string {
  const tasksBlock =
    input.tasks.length === 0
      ? "No tasks found for this user."
      : input.tasks
          .map((task) => {
            const summary = summarizeTask(task);
            const plainDescription = task.description ? stripRichTextToPlainText(task.description) : "";
            const description = plainDescription ? `desc: ${clip(plainDescription, 280)}` : null;
            const plainComments = task.comments
              .map((item) => stripRichTextToPlainText(item))
              .filter((item) => item.length > 0);
            const comments =
              plainComments.length > 0
                ? `comments: ${plainComments.map((item) => clip(item, 200)).join(" || ")}`
                : null;

            return [summary, description, comments]
              .filter((value): value is string => Boolean(value))
              .join("\n");
          })
          .join("\n\n");

  const userName = input.userDisplayName ? `User display name: ${input.userDisplayName}\n` : "";

  const preferredLocaleLine = input.preferredLocale
    ? `Preferred locale: ${input.preferredLocale}\n`
    : "";

  return `${userName}${preferredLocaleLine}User question: ${input.question}

Tasks context:
${tasksBlock}

Instructions:
- First detect intent:
  - If the question is small talk or generic conversation (for example "how are you?", "ça va?"), reply naturally in 1-2 short sentences and do not force a planning template.
  - If the question is about tasks/planning/priorities/progress, provide practical guidance grounded in all available tasks across dates.
- Mirror the user's language.
- If the user message language is ambiguous, default to preferred locale when available.
- Be concise and practical.
- For task/planning replies, use target dates when relevant, mention blockers only if visible, and suggest clear next steps in priority order.
- Do not invent tasks or details that are not in context.`;
}

function priorityScore(priority: TaskPriority): number {
  if (priority === "high") {
    return 3;
  }

  if (priority === "medium") {
    return 2;
  }

  return 1;
}

function statusScore(status: TaskStatus): number {
  if (status === "in_progress") {
    return 3;
  }

  if (status === "todo") {
    return 2;
  }

  if (status === "done") {
    return 1;
  }

  return 0;
}

function findPotentiallyBlockedTasks(tasks: AssistantTaskContext[]): AssistantTaskContext[] {
  const blockerPattern = /\b(blocked|waiting|stuck|dependency|depends on|need review|need approval)\b/i;
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

function createHeuristicReply(input: AssistantReplyInput): AssistantReply {
  const useFrench = input.preferredLocale === "fr";

  if (isSmallTalkQuestion(input.question)) {
    return createSmallTalkReply(input.question, input.tasks.length, input.preferredLocale);
  }

  const actionable = input.tasks.filter((task) => task.status === "todo" || task.status === "in_progress");
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
  if (useFrench) {
    lines.push("Vue d'ensemble des taches utilisateur");
    lines.push(
      `Tu as ${input.tasks.length} tache${input.tasks.length === 1 ? "" : "s"} au total (${actionable.length} actionnable${actionable.length === 1 ? "" : "s"}, ${completed.length} terminee${completed.length === 1 ? "" : "s"}, ${cancelled.length} annulee${cancelled.length === 1 ? "" : "s"}).`
    );
  } else {
    lines.push("User task overview");
    lines.push(
      `You have ${input.tasks.length} task${input.tasks.length === 1 ? "" : "s"} total (${actionable.length} actionable, ${completed.length} done, ${cancelled.length} cancelled).`
    );
  }

  if (focusTasks.length > 0) {
    lines.push("");
    lines.push(useFrench ? "Priorites principales:" : "Top focus:");
    for (const task of focusTasks) {
      const effort = typeof task.plannedTime === "number" ? `, ${formatMinutes(task.plannedTime)}` : "";
      lines.push(`- ${task.title} [${task.priority}, ${task.status}, ${task.targetDate}${effort}]`);
    }
  }

  if (blocked.length > 0) {
    lines.push("");
    lines.push(useFrench ? "Blocages potentiels a lever en premier:" : "Potential blockers to clear first:");
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

  lines.push("");
  lines.push(
    useFrench
      ? `Question recue: "${input.question.trim()}"`
      : `Question received: "${input.question.trim()}"`
  );
  lines.push(
    useFrench
      ? "Prochaine etape recommandee: termine la premiere priorite avant de commencer une nouvelle tache."
      : "Recommended next step: finish the first focus task before starting new work."
  );

  return {
    answer: lines.join("\n"),
    source: "heuristic",
    warning: null,
  };
}

async function createOpenAiReply(
  input: AssistantReplyInput,
  options: AssistantServiceOptions
): Promise<AssistantReply> {
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
        max_tokens: 550,
        messages: [
          {
            role: "system",
            content:
              "You are Jotly's task planning assistant. Give concise, actionable guidance using only provided context.",
          },
          {
            role: "user",
            content: buildOpenAiPrompt(input),
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

export function createAssistantService(options: AssistantServiceOptions): AssistantService {
  return {
    async generateReply(input) {
      if (options.provider !== "openai" || !options.openAiApiKey) {
        return createHeuristicReply(input);
      }

      try {
        return await createOpenAiReply(input, options);
      } catch {
        const fallback = createHeuristicReply(input);
        return {
          ...fallback,
          warning: "OpenAI is unavailable right now. Returned heuristic guidance instead.",
        };
      }
    },
  };
}
