import { normalizePlainText } from "../../assistant/assistant-search-sync";
import type { AssistantSearchSourceType } from "../../assistant/assistant-search-document-types";
import { z } from "zod";
import { parseDateOnly } from "../../tasks/task-store";
import { dayBoundsUtc, formatDateOnly, formatLocalDateTime } from "../mcp-dates";
import { describeTask } from "./day-tools";
import { McpTool } from "./tool-definition";
import { McpDomainStores, McpMemoryStores, McpToolError, requireMemory, truncate } from "./tool-kit";

const MAX_BODY = 20_000;
const MAX_ATTACHMENT_TEXT = 3_000;

/** French labels for the search index source types, and the reverse mapping for filters. */
const TYPE_LABELS: Record<AssistantSearchSourceType, string> = {
  task: "tache",
  comment: "commentaire",
  attachment: "piece_jointe",
  note: "note",
  noteAttachment: "piece_jointe_note",
  calendarEvent: "reunion",
  calendarNote: "note_reunion",
  reminder: "rappel",
  affirmation: "affirmation",
  bilan: "bilan",
  weeklyObjective: "objectif_semaine",
  weeklyReview: "revue_semaine",
  monthlyObjective: "objectif_mois",
  monthlyReview: "revue_mois",
};
const FILTERS = {
  taches: ["task", "comment", "attachment"],
  notes: ["note", "noteAttachment"],
  reunions: ["calendarEvent", "calendarNote"],
  rappels: ["reminder"],
  journal: ["affirmation", "bilan"],
  objectifs: ["weeklyObjective", "weeklyReview", "monthlyObjective", "monthlyReview"],
} as const satisfies Record<string, readonly AssistantSearchSourceType[]>;

type ElementType = "tache" | "note" | "reunion";

/** Where to read the full content of a search hit with lire_element. */
function readTarget(sourceType: AssistantSearchSourceType, sourceId: string, metadata: Record<string, unknown>) {
  const ref = (type: ElementType, id: unknown) => (typeof id === "string" && id ? { type, id } : null);
  switch (sourceType) {
    case "task":
      return ref("tache", sourceId);
    case "comment":
    case "attachment":
      return ref("tache", metadata.taskId);
    case "note":
      return ref("note", sourceId);
    case "noteAttachment":
      return ref("note", metadata.noteId);
    case "calendarEvent":
      return ref("reunion", sourceId);
    case "calendarNote":
      return ref("reunion", metadata.calendarEventId);
    default:
      return null;
  }
}

const baseSourceId = (sourceId: string) => sourceId.split(":chunk:")[0];

function parseDay(value: string, label: string): Date {
  const parsed = parseDateOnly(value);
  if (!parsed) throw new McpToolError(`${label} invalide « ${value} » : format AAAA-MM-JJ.`);
  return parsed;
}

const chercherShape = {
  requete: z.string().trim().min(2).max(300).describe("Mots-clés (nom d'un client, d'un projet, d'une personne, d'un sujet)."),
  types: z
    .array(z.enum(["taches", "notes", "reunions", "rappels", "journal", "objectifs"]))
    .optional()
    .describe("Limiter à certains contenus. Par défaut : tout Jotly."),
  du: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Modifiés depuis ce jour (AAAA-MM-JJ)."),
  au: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().describe("Modifiés jusqu'à ce jour inclus (AAAA-MM-JJ)."),
  limite: z.number().int().min(1).max(30).optional(),
};

export const chercher: McpTool<typeof chercherShape> = {
  name: "chercher",
  title: "Chercher dans Jotly",
  description:
    "Recherche dans tout Jotly : notes, notes de réunion, tâches et leurs commentaires, pièces jointes (texte extrait), rappels, affirmations, bilans, objectifs. Renvoie des extraits ; lire le contenu complet avec lire_element (champ lire_avec).",
  inputSchema: chercherShape,
  write: false,
  async handler({ requete, types, du, au, limite }, ctx, stores) {
    const memory = requireMemory(stores);
    const sourceTypes = types ? [...new Set(types.flatMap((type) => FILTERS[type]))] : undefined;
    const from = du ? dayBoundsUtc(parseDay(du, "Date de début"), ctx.timeZone).start : undefined;
    const to = au ? dayBoundsUtc(parseDay(au, "Date de fin"), ctx.timeZone).end : undefined;

    let embedding: number[] | undefined;
    if (memory.embeddingClient?.isEnabled()) {
      embedding = (await memory.embeddingClient.embedTexts([requete]).catch(() => []))[0];
    }
    const { results, totalCount } = await memory.searchDocumentStore.searchDirect(ctx.userId, requete, {
      sourceTypes,
      from,
      to,
      limit: limite ?? 10,
      embedding,
    });

    return {
      requete,
      total: totalCount,
      resultats: results.map((result) => {
        const metadata = (result.metadataJson ?? {}) as Record<string, unknown>;
        const id = baseSourceId(result.sourceId);
        return {
          type: TYPE_LABELS[result.sourceType] ?? result.sourceType,
          id,
          titre: result.title,
          extrait: result.snippet,
          modifie_le: formatDateOnly(result.updatedAt),
          lire_avec: readTarget(result.sourceType, id, metadata),
        };
      }),
    };
  },
};

/** Extracted text of attachments, as indexed (OCR included), keyed by their parent. */
async function indexedAttachmentTexts(
  memory: McpMemoryStores,
  userId: string,
  sourceType: "attachment" | "noteAttachment",
  parentKey: "taskId" | "noteId",
  parentId: string
) {
  const documents = await memory.searchDocumentStore.listByUser(userId, { sourceTypes: [sourceType] });
  const byAttachment = new Map<string, { nom: string | null; texte: string }>();
  for (const document of documents) {
    const metadata = (document.metadataJson ?? {}) as Record<string, unknown>;
    if (metadata[parentKey] !== parentId) continue;
    const id = baseSourceId(document.sourceId);
    const entry = byAttachment.get(id) ?? { nom: document.title, texte: "" };
    entry.texte = `${entry.texte}\n${document.bodyText}`.trim();
    byAttachment.set(id, entry);
  }
  return [...byAttachment.entries()].map(([id, entry]) => ({
    id,
    nom: entry.nom,
    texte_extrait: truncate(entry.texte, MAX_ATTACHMENT_TEXT),
  }));
}

async function readTask(memory: McpMemoryStores, userId: string, id: string, stores: McpDomainStores) {
  const task = await stores.taskStore.getById(id, userId);
  if (!task) return null;
  const comments = memory.commentStore ? await memory.commentStore.listByTaskId(task.id) : [];
  return {
    type: "tache",
    tache: { ...describeTask(task), description: truncate(task.description, MAX_BODY) },
    commentaires: comments.map((comment) => ({
      date: formatDateOnly(comment.createdAt),
      texte: truncate(normalizePlainText(comment.body), 2_000),
    })),
    pieces_jointes: await indexedAttachmentTexts(memory, userId, "attachment", "taskId", task.id),
  };
}

async function readNote(memory: McpMemoryStores, userId: string, id: string) {
  const note = await memory.noteStore.getById(id, userId);
  if (!note) return null;
  return {
    type: "note",
    note: {
      id: note.id,
      titre: note.title,
      date: note.targetDate ? formatDateOnly(note.targetDate) : formatDateOnly(note.createdAt),
      texte: truncate(normalizePlainText(note.body), MAX_BODY),
      reunion: note.calendarEvent ? { id: note.calendarEvent.id, titre: note.calendarEvent.title } : null,
    },
    pieces_jointes: await indexedAttachmentTexts(memory, userId, "noteAttachment", "noteId", note.id),
  };
}

async function readMeeting(memory: McpMemoryStores, userId: string, id: string, timeZone: string) {
  const event = memory.calendarEventStore ? await memory.calendarEventStore.getById(id, userId) : null;
  if (!event) return null;
  const [note, legacyNote] = await Promise.all([
    memory.noteStore.getByCalendarEventId(event.id, userId),
    memory.calendarEventNoteStore?.getByCalendarEventId(event.id, userId) ?? null,
  ]);
  const noteText = normalizePlainText(note?.body, legacyNote?.body);
  return {
    type: "reunion",
    reunion: {
      id: event.id,
      titre: event.title,
      debut: formatLocalDateTime(event.startTime, timeZone),
      fin: formatLocalDateTime(event.endTime, timeZone),
      lieu: event.location,
      organisateur: event.organizer,
      participants: event.attendees,
      description: truncate(normalizePlainText(event.description), 5_000),
    },
    note: noteText ? { id: note?.id ?? legacyNote?.id ?? null, texte: truncate(noteText, MAX_BODY) } : null,
  };
}

const lireElementShape = {
  type: z.enum(["tache", "note", "reunion"]),
  id: z.string().trim().min(1).max(100),
};

export const lireElement: McpTool<typeof lireElementShape> = {
  name: "lire_element",
  title: "Lire une note, une réunion ou une tâche",
  description:
    "Lit le contenu complet d'un élément trouvé avec chercher (utiliser son champ lire_avec) : note avec pièces jointes, réunion avec participants et notes, tâche avec commentaires et pièces jointes.",
  inputSchema: lireElementShape,
  write: false,
  async handler({ type, id }, ctx, stores) {
    const memory = requireMemory(stores);
    const result =
      type === "tache"
        ? await readTask(memory, ctx.userId, id, stores)
        : type === "note"
          ? await readNote(memory, ctx.userId, id)
          : await readMeeting(memory, ctx.userId, id, ctx.timeZone);
    if (!result) throw new McpToolError(`Élément introuvable : ${type} ${id}.`);
    return result;
  },
};
