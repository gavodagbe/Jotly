/**
 * Splits a long text into overlapping chunks suitable for embedding and retrieval.
 *
 * Strategy (in order of preference):
 *  1. Split on double newlines (paragraph boundaries)
 *  2. Split on single newlines
 *  3. Split on sentence endings (. ! ?)
 *  4. Hard-split at the character limit as a last resort
 *
 * Chunks below MIN_CHUNK_CHARS are merged with the next chunk to avoid
 * indexing near-empty documents.
 */

export type TextChunk = {
  index: number;
  text: string;
};

export type TextChunkerOptions = {
  /** Target maximum characters per chunk. Default: 600 */
  maxChunkChars?: number;
  /** Characters of overlap between consecutive chunks. Default: 80 */
  overlapChars?: number;
  /** Chunks shorter than this are merged with the next. Default: 100 */
  minChunkChars?: number;
};

const DEFAULT_MAX = 600;
const DEFAULT_OVERLAP = 80;
const DEFAULT_MIN = 100;

/** Returns candidate split positions for the given text, ordered by preference. */
function findSplitPoint(text: string, maxLen: number): number {
  // Prefer double newline (paragraph break)
  const paraBreak = text.lastIndexOf("\n\n", maxLen);
  if (paraBreak > 0) return paraBreak + 2;

  // Single newline
  const lineBreak = text.lastIndexOf("\n", maxLen);
  if (lineBreak > 0) return lineBreak + 1;

  // Sentence boundary (. ! ?) followed by a space
  const sentenceMatch = text.slice(0, maxLen).search(/[.!?]\s+(?=[A-Z\u00C0-\u024F])[^]$/);
  if (sentenceMatch > 0) return sentenceMatch + 2;

  // Word boundary
  const wordBreak = text.lastIndexOf(" ", maxLen);
  if (wordBreak > 0) return wordBreak + 1;

  // Hard cut
  return maxLen;
}

export function chunkText(
  text: string,
  options?: TextChunkerOptions
): TextChunk[] {
  const maxChunk = options?.maxChunkChars ?? DEFAULT_MAX;
  const overlap = Math.min(options?.overlapChars ?? DEFAULT_OVERLAP, Math.floor(maxChunk / 4));
  const minChunk = options?.minChunkChars ?? DEFAULT_MIN;

  const trimmed = text.trim();
  if (trimmed.length === 0) return [];

  // Text fits in a single chunk — no splitting needed
  if (trimmed.length <= maxChunk) {
    return [{ index: 0, text: trimmed }];
  }

  const raw: string[] = [];
  let cursor = 0;

  while (cursor < trimmed.length) {
    const remaining = trimmed.length - cursor;

    if (remaining <= maxChunk) {
      raw.push(trimmed.slice(cursor));
      break;
    }

    const splitAt = findSplitPoint(trimmed.slice(cursor), maxChunk);
    raw.push(trimmed.slice(cursor, cursor + splitAt).trim());
    cursor += splitAt - overlap;
  }

  // Merge chunks that are below the minimum length into the next one
  const merged: string[] = [];
  let buffer = "";

  for (const chunk of raw) {
    if (buffer.length > 0) {
      buffer += "\n\n" + chunk;
    } else {
      buffer = chunk;
    }

    if (buffer.length >= minChunk) {
      merged.push(buffer.trim());
      buffer = "";
    }
  }

  if (buffer.trim().length > 0) {
    if (merged.length > 0) {
      // Append leftover to the last chunk rather than create a tiny orphan
      merged[merged.length - 1] += "\n\n" + buffer.trim();
    } else {
      merged.push(buffer.trim());
    }
  }

  return merged.map((text, index) => ({ index, text }));
}

/**
 * Returns true when the extracted text is long enough to benefit from chunking.
 * Below this threshold a single document is used as-is.
 */
export function shouldChunk(text: string, maxChunkChars = DEFAULT_MAX): boolean {
  return text.trim().length > maxChunkChars;
}
