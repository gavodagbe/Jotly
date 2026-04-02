type OpenAiEmbeddingResponse = {
  data?: Array<{ embedding?: number[] }>;
  error?: { message?: string };
};

export type AssistantEmbeddingClient = {
  isEnabled(): boolean;
  embedTexts(input: string[]): Promise<number[][]>;
};

export type AssistantEmbeddingClientOptions = {
  apiKey?: string;
  baseUrl: string;
  model: string;
  requestTimeoutMs: number;
};

export function createAssistantEmbeddingClient(
  options: AssistantEmbeddingClientOptions
): AssistantEmbeddingClient {
  return {
    isEnabled() {
      return Boolean(options.apiKey);
    },

    async embedTexts(input) {
      const normalized = input.map((value) => value.trim()).filter((value) => value.length > 0);

      if (!options.apiKey || normalized.length === 0) {
        return [];
      }

      // Batch to avoid exceeding the API token limit (300k tokens per request).
      // ~50 texts per batch is a safe conservative size for typical document content.
      const BATCH_SIZE = 50;
      const results: number[][] = [];

      for (let i = 0; i < normalized.length; i += BATCH_SIZE) {
        const batch = normalized.slice(i, i + BATCH_SIZE);

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), options.requestTimeoutMs);

        try {
          const response = await fetch(`${options.baseUrl.replace(/\/$/, "")}/embeddings`, {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${options.apiKey}`,
            },
            body: JSON.stringify({
              model: options.model,
              input: batch,
            }),
            signal: controller.signal,
          });

          const payload = (await response.json().catch(() => null)) as OpenAiEmbeddingResponse | null;

          if (!response.ok) {
            const message = payload?.error?.message ?? `OpenAI embeddings request failed (HTTP ${response.status})`;
            throw new Error(message);
          }

          const batchEmbeddings = (payload?.data ?? [])
            .map((item) => item.embedding ?? [])
            .filter((embedding) => Array.isArray(embedding) && embedding.length > 0);

          results.push(...batchEmbeddings);
        } finally {
          clearTimeout(timeout);
        }
      }

      return results;
    },
  };
}
