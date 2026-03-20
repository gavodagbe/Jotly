import { AssistantEmbeddingClient } from "./assistant-embedding-client";
import {
  AssistantSearchDocumentStore,
  AssistantSearchResult,
  AssistantSearchSourceType,
} from "./assistant-search-document-store";
import type { AssistantDomain } from "./assistant-service";

export type AssistantSearchRetrieval = {
  matches: AssistantSearchResult[];
  mode: "none" | "fulltext" | "vector" | "fulltext+vector";
};

export type AssistantSearchRetriever = {
  search(input: {
    userId: string;
    question: string;
    domains: AssistantDomain[];
  }): Promise<AssistantSearchRetrieval>;
};

export type AssistantSearchRetrieverOptions = {
  searchDocumentStore: AssistantSearchDocumentStore;
  embeddingClient: AssistantEmbeddingClient;
};

const FULLTEXT_LIMIT = 5;
const VECTOR_LIMIT = 5;
const SEARCH_STOP_WORDS = new Set([
  "a",
  "about",
  "an",
  "and",
  "are",
  "au",
  "aux",
  "avec",
  "can",
  "comment",
  "dans",
  "de",
  "des",
  "do",
  "does",
  "du",
  "est",
  "et",
  "for",
  "i",
  "in",
  "is",
  "je",
  "la",
  "le",
  "les",
  "me",
  "mes",
  "my",
  "of",
  "on",
  "ou",
  "où",
  "pour",
  "qu",
  "que",
  "quel",
  "quelle",
  "quels",
  "quelles",
  "say",
  "sur",
  "the",
  "this",
  "to",
  "tu",
  "un",
  "une",
  "what",
  "where",
]);

function normalizeQuestion(question: string): string {
  return question.trim().toLowerCase();
}

export function shouldUseAssistantSearch(question: string, domains: AssistantDomain[]): boolean {
  const normalized = normalizeQuestion(question);

  if (normalized.length < 4) {
    return false;
  }

  if (domains.includes("overview") || domains.includes("reflections")) {
    return true;
  }

  return /\b(document|documents|doc|pdf|note|notes|comment|comments|search|find|where|mention|mentions|said|says|talk|theme|themes|pattern|patterns|summary|summarize|resume|resume-moi|resumez|chercher|rechercher|documentaire)\b/i.test(
    normalized
  );
}

function shouldUseVectorSearch(question: string): boolean {
  const normalized = normalizeQuestion(question);

  return /\b(theme|themes|pattern|patterns|trend|trends|similar|similarity|concept|conceptual|why|insight|insights|summarize|summary|resume|tendance|motif|motifs|insight)\b/i.test(
    normalized
  );
}

function buildFullTextQuery(question: string): string {
  const tokens = normalizeQuestion(question)
    .split(/[^a-z0-9]+/i)
    .map((token) => token.trim())
    .filter(
      (token) =>
        token.length > 2 &&
        !SEARCH_STOP_WORDS.has(token)
    );

  return [...new Set(tokens)].slice(0, 8).join(" OR ");
}

function sourceTypesForDomains(domains: AssistantDomain[]): AssistantSearchSourceType[] {
  const values = new Set<AssistantSearchSourceType>();

  for (const domain of domains) {
    switch (domain) {
      case "tasks":
        values.add("task");
        values.add("comment");
        values.add("attachment");
        values.add("note");
        values.add("noteAttachment");
        break;
      case "reminders":
        values.add("reminder");
        break;
      case "calendar":
        values.add("calendarEvent");
        values.add("calendarNote");
        break;
      case "reflections":
        values.add("affirmation");
        values.add("bilan");
        break;
      case "overview":
        values.add("task");
        values.add("comment");
        values.add("attachment");
        values.add("affirmation");
        values.add("bilan");
        values.add("reminder");
        values.add("calendarEvent");
        values.add("calendarNote");
        values.add("note");
        values.add("noteAttachment");
        break;
      case "profile":
        break;
    }
  }

  return [...values];
}

function mergeMatches(
  ...groups: AssistantSearchResult[][]
): AssistantSearchResult[] {
  const merged = new Map<string, AssistantSearchResult>();

  for (const group of groups) {
    for (const match of group) {
      const key = `${match.sourceType}:${match.sourceId}`;
      const existing = merged.get(key);

      if (!existing || match.score > existing.score) {
        merged.set(key, match);
      }
    }
  }

  return [...merged.values()].sort(
    (left, right) =>
      right.score - left.score ||
      right.updatedAt.getTime() - left.updatedAt.getTime()
  );
}

export function createAssistantSearchRetriever(
  options: AssistantSearchRetrieverOptions
): AssistantSearchRetriever {
  return {
    async search(input) {
      const { userId, question, domains } = input;

      if (!shouldUseAssistantSearch(question, domains)) {
        return {
          matches: [],
          mode: "none",
        };
      }

      const sourceTypes = sourceTypesForDomains(domains);
      if (sourceTypes.length === 0) {
        return {
          matches: [],
          mode: "none",
        };
      }

      const fullTextQuery = buildFullTextQuery(question) || question;
      const fullTextMatches = await options.searchDocumentStore.fullTextSearch(
        userId,
        fullTextQuery,
        { sourceTypes, limit: FULLTEXT_LIMIT }
      );

      let vectorMatches: AssistantSearchResult[] = [];
      if (
        shouldUseVectorSearch(question) &&
        options.embeddingClient.isEnabled() &&
        (await options.searchDocumentStore.supportsVectorSearch())
      ) {
        const [embedding] = await options.embeddingClient.embedTexts([question]);

        if (Array.isArray(embedding) && embedding.length > 0) {
          vectorMatches = await options.searchDocumentStore.vectorSearch(
            userId,
            embedding,
            { sourceTypes, limit: VECTOR_LIMIT }
          );
        }
      }

      const matches = mergeMatches(fullTextMatches, vectorMatches).slice(
        0,
        FULLTEXT_LIMIT
      );

      if (fullTextMatches.length > 0 && vectorMatches.length > 0) {
        return {
          matches,
          mode: "fulltext+vector",
        };
      }

      if (vectorMatches.length > 0) {
        return {
          matches,
          mode: "vector",
        };
      }

      if (fullTextMatches.length > 0) {
        return {
          matches,
          mode: "fulltext",
        };
      }

      return {
        matches: [],
        mode: "none",
      };
    },
  };
}
