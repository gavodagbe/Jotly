import { AttachmentStore } from "../attachments/attachment-store";
import { CommentStore } from "../comments/comment-store";
import { SearchIndexEntry, SearchIndexPlugin, normalizePlainText } from "../assistant/assistant-search-sync";
import { AssistantSearchSourceType } from "../assistant/assistant-search-document-store";
import { formatDateOnly, TaskStore } from "./task-store";

export function createTaskSearchPlugin(options: {
  taskStore: TaskStore;
  commentStore?: CommentStore;
  attachmentStore?: AttachmentStore;
}): SearchIndexPlugin {
  return {
    sourceTypes: ["task", "comment", "attachment"] as AssistantSearchSourceType[],
    async fetchEntries(userId) {
      const entries: SearchIndexEntry[] = [];
      const tasks = await options.taskStore.listByUser(userId);

      for (const task of tasks) {
        entries.push({
          sourceType: "task",
          sourceId: task.id,
          title: task.title,
          bodyText: normalizePlainText(task.description, task.project),
          metadata: {
            targetDate: formatDateOnly(task.targetDate),
            dueDate: task.dueDate ? formatDateOnly(task.dueDate) : null,
            status: task.status,
            priority: task.priority,
            plannedTime: task.plannedTime,
            project: task.project,
          },
          updatedAt: task.updatedAt,
        });

        if (options.commentStore) {
          const comments = await options.commentStore.listByTaskId(task.id);
          for (const comment of comments) {
            entries.push({
              sourceType: "comment",
              sourceId: comment.id,
              title: `Comment on ${task.title}`,
              bodyText: normalizePlainText(comment.body),
              metadata: {
                taskId: task.id,
                taskTitle: task.title,
                targetDate: formatDateOnly(task.targetDate),
                createdAt: comment.createdAt.toISOString(),
              },
              updatedAt: comment.updatedAt,
            });
          }
        }

        if (options.attachmentStore) {
          const attachments = await options.attachmentStore.listByTaskId(task.id);
          for (const attachment of attachments) {
            entries.push({
              sourceType: "attachment",
              sourceId: attachment.id,
              title: attachment.name,
              bodyText: "",
              metadata: {
                taskId: task.id,
                taskTitle: task.title,
                targetDate: formatDateOnly(task.targetDate),
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
