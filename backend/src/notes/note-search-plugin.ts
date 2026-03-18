import { SearchIndexEntry, SearchIndexPlugin, normalizePlainText } from "../assistant/assistant-search-sync";
import { NoteAttachmentStore } from "./note-attachment-store";
import { NoteStore } from "./note-store";

export function createNoteSearchPlugin(options: {
  noteStore: NoteStore;
  noteAttachmentStore?: NoteAttachmentStore;
}): SearchIndexPlugin {
  return {
    async fetchEntries(userId) {
      const entries: SearchIndexEntry[] = [];
      const notes = await options.noteStore.listByUser(userId);

      for (const note of notes) {
        entries.push({
          sourceType: "note",
          sourceId: note.id,
          title: note.title ?? null,
          bodyText: normalizePlainText(note.body),
          metadata: {
            targetDate: note.targetDate
              ? note.targetDate.toISOString().substring(0, 10)
              : null,
            color: note.color,
          },
          updatedAt: note.updatedAt,
        });

        if (options.noteAttachmentStore) {
          const attachments = await options.noteAttachmentStore.listByNoteId(
            note.id,
            userId
          );
          for (const attachment of attachments) {
            entries.push({
              sourceType: "noteAttachment",
              sourceId: attachment.id,
              title: attachment.name,
              bodyText: "",
              metadata: {
                noteId: note.id,
                noteTitle: note.title ?? null,
                targetDate: note.targetDate
                  ? note.targetDate.toISOString().substring(0, 10)
                  : null,
                contentType: attachment.contentType,
                sizeBytes: attachment.sizeBytes,
              },
              updatedAt: attachment.createdAt,
              attachment: {
                name: attachment.name,
                url: attachment.url,
                contentType: attachment.contentType,
              },
            });
          }
        }
      }

      return entries;
    },
  };
}
