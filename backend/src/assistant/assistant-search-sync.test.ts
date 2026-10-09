import assert from "node:assert/strict";
import test from "node:test";
import { AssistantDocumentExtractor } from "./assistant-document-extractor";
import { createInMemoryAssistantSearchDocumentStore } from "./assistant-search-document-store.in-memory";
import { AssistantEmbeddingClient } from "./assistant-embedding-client";
import {
  SearchIndexEntry,
  SearchIndexPlugin,
  createAssistantSearchSyncService,
} from "./assistant-search-sync";

const USER_ID = "user-1";
const UPDATED_AT = new Date("2026-10-09T08:00:00.000Z");

const disabledEmbeddingClient: AssistantEmbeddingClient = {
  isEnabled: () => false,
  embedTexts: async () => [],
};

function createCountingExtractor(text: string) {
  let calls = 0;
  const extractor: AssistantDocumentExtractor = {
    async extractFromAttachment() {
      calls += 1;
      return { text, status: "ready", warning: null, parser: "pdf" };
    },
  };
  return { extractor, getCalls: () => calls };
}

function createStaticPlugin(
  sourceTypes: SearchIndexPlugin["sourceTypes"],
  entries: SearchIndexEntry[],
  onFetch?: () => Promise<void>
): SearchIndexPlugin {
  return {
    sourceTypes,
    async fetchEntries() {
      await onFetch?.();
      return entries;
    },
  };
}

const noteEntry: SearchIndexEntry = {
  sourceType: "note",
  sourceId: "note-1",
  title: "Meeting notes",
  bodyText: "Discussed the roadmap for the next quarter with the team.",
  metadata: {},
  updatedAt: UPDATED_AT,
};

const attachmentEntry: SearchIndexEntry = {
  sourceType: "noteAttachment",
  sourceId: "att-1",
  title: "report.pdf",
  bodyText: "",
  metadata: { noteId: "note-1" },
  updatedAt: UPDATED_AT,
  attachment: { name: "report.pdf", url: "data:application/pdf;base64,AAAA", contentType: "application/pdf" },
};

const taskEntry: SearchIndexEntry = {
  sourceType: "task",
  sourceId: "task-1",
  title: "Prepare quarterly review",
  bodyText: "Collect metrics and draft the slides.",
  metadata: {},
  updatedAt: UPDATED_AT,
};

test("sync does not re-extract an unchanged chunked attachment", async () => {
  const searchDocumentStore = createInMemoryAssistantSearchDocumentStore();
  const longText = "Quarterly figures and commentary for the board. ".repeat(60);
  const { extractor, getCalls } = createCountingExtractor(longText);
  const service = createAssistantSearchSyncService({
    plugins: [createStaticPlugin(["note", "noteAttachment"], [noteEntry, attachmentEntry])],
    searchDocumentStore,
    documentExtractor: extractor,
    embeddingClient: disabledEmbeddingClient,
    embeddingModel: "test-model",
  });

  await service.syncUserWorkspace(USER_ID);
  const chunkCount = (await searchDocumentStore.listByUser(USER_ID)).filter((document) =>
    document.sourceId.startsWith("att-1:chunk:")
  ).length;
  assert.ok(chunkCount > 1, "attachment text should be stored as several chunks");

  const second = await service.syncUserWorkspace(USER_ID);

  assert.equal(getCalls(), 1);
  assert.equal(second.changedCount, 0);
  assert.equal(
    (await searchDocumentStore.listByUser(USER_ID)).filter((document) =>
      document.sourceId.startsWith("att-1:chunk:")
    ).length,
    chunkCount
  );
});

test("partial sync keeps documents owned by other plugins", async () => {
  const searchDocumentStore = createInMemoryAssistantSearchDocumentStore();
  const { extractor } = createCountingExtractor("");
  const service = createAssistantSearchSyncService({
    plugins: [
      createStaticPlugin(["task", "comment", "attachment"], [taskEntry]),
      createStaticPlugin(["note", "noteAttachment"], [noteEntry]),
    ],
    searchDocumentStore,
    documentExtractor: extractor,
    embeddingClient: disabledEmbeddingClient,
    embeddingModel: "test-model",
  });

  await service.syncUserWorkspace(USER_ID);
  await service.syncUserWorkspace(USER_ID, { onlySourceTypes: ["note", "noteAttachment"] });

  const sourceIds = (await searchDocumentStore.listByUser(USER_ID))
    .map((document) => document.sourceId)
    .sort();
  assert.deepEqual(sourceIds, ["note-1", "task-1"]);
});

test("concurrent syncs for a user run one at a time and coalesce", async () => {
  const searchDocumentStore = createInMemoryAssistantSearchDocumentStore();
  const { extractor } = createCountingExtractor("");
  let active = 0;
  let maxActive = 0;
  let runs = 0;
  let releaseFirst: () => void = () => {};
  const firstRunGate = new Promise<void>((resolve) => {
    releaseFirst = resolve;
  });

  const plugin = createStaticPlugin(["note", "noteAttachment"], [noteEntry], async () => {
    active += 1;
    runs += 1;
    maxActive = Math.max(maxActive, active);
    if (runs === 1) await firstRunGate;
    active -= 1;
  });
  const service = createAssistantSearchSyncService({
    plugins: [plugin],
    searchDocumentStore,
    documentExtractor: extractor,
    embeddingClient: disabledEmbeddingClient,
    embeddingModel: "test-model",
  });

  const options = { onlySourceTypes: ["note" as const] };
  const first = service.syncUserWorkspace(USER_ID, options);
  const second = service.syncUserWorkspace(USER_ID, options);
  const third = service.syncUserWorkspace(USER_ID, options);
  assert.equal(second, third, "queued requests share the same follow-up run");

  releaseFirst();
  await Promise.all([first, second, third]);

  assert.equal(maxActive, 1);
  assert.equal(runs, 2);
});
