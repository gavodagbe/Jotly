import { FastifyBaseLogger } from "fastify";
import { AssistantSearchSyncService } from "../assistant/assistant-search-sync";

export function triggerAssistantSearchSync(
  assistantSearchSyncService: AssistantSearchSyncService | undefined,
  userId: string,
  logger: FastifyBaseLogger,
  reason: string
): void {
  if (!assistantSearchSyncService) {
    return;
  }

  void assistantSearchSyncService.syncUserWorkspace(userId).catch((error) => {
    logger.error(
      { err: error, userId },
      `Failed to sync assistant search index after ${reason}`
    );
  });
}
