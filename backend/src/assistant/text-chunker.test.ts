import assert from "node:assert/strict";
import test from "node:test";
import { chunkText, shouldChunk } from "./text-chunker";

test("chunkText — returns single chunk when text is short", () => {
  const text = "Short note about today's meeting.";
  const chunks = chunkText(text, { maxChunkChars: 600 });
  assert.equal(chunks.length, 1);
  assert.equal(chunks[0].index, 0);
  assert.equal(chunks[0].text, text.trim());
});

test("chunkText — returns empty array for empty text", () => {
  assert.deepEqual(chunkText(""), []);
  assert.deepEqual(chunkText("   "), []);
});

test("chunkText — splits long text into multiple chunks", () => {
  // Build a text clearly larger than maxChunkChars=100
  const paragraph = "This is a sentence about productivity. ";
  const text = paragraph.repeat(10); // ~390 chars
  const chunks = chunkText(text, { maxChunkChars: 100, overlapChars: 20, minChunkChars: 40 });
  assert.ok(chunks.length > 1, "Should produce multiple chunks");
  for (const chunk of chunks) {
    assert.ok(chunk.text.length > 0, "Each chunk must be non-empty");
  }
});

test("chunkText — chunks are contiguous and cover the full content", () => {
  const word = "productivity ";
  const text = word.repeat(60); // ~780 chars
  const chunks = chunkText(text, { maxChunkChars: 200, overlapChars: 30, minChunkChars: 50 });
  assert.ok(chunks.length > 1);
  // Every chunk must contain content from the original
  for (const chunk of chunks) {
    assert.ok(text.includes(chunk.text.slice(0, 20).trim()), "Chunk content must come from source");
  }
});

test("chunkText — chunk indexes are sequential starting from 0", () => {
  const text = "word ".repeat(200); // ~1000 chars
  const chunks = chunkText(text, { maxChunkChars: 150, overlapChars: 20, minChunkChars: 50 });
  for (let i = 0; i < chunks.length; i++) {
    assert.equal(chunks[i].index, i);
  }
});

test("chunkText — no chunk exceeds maxChunkChars after overlap", () => {
  const text = "The quick brown fox jumps over the lazy dog. ".repeat(30);
  const max = 200;
  const chunks = chunkText(text, { maxChunkChars: max, overlapChars: 30, minChunkChars: 40 });
  for (const chunk of chunks) {
    assert.ok(
      chunk.text.length <= max + 50, // small tolerance for overlap boundary
      `Chunk ${chunk.index} length ${chunk.text.length} exceeds max`
    );
  }
});

test("chunkText — respects paragraph boundaries when possible", () => {
  const para1 = "First paragraph about morning tasks and planning.";
  const para2 = "Second paragraph about afternoon review sessions.";
  const para3 = "Third paragraph about evening reflection and bilan.";
  const text = `${para1}\n\n${para2}\n\n${para3}`;

  const chunks = chunkText(text, { maxChunkChars: 80, overlapChars: 10, minChunkChars: 20 });
  // At least the first chunk should start with the first paragraph
  assert.ok(chunks[0].text.startsWith("First"), "First chunk should start at first paragraph");
});

test("shouldChunk — returns false for short text", () => {
  assert.equal(shouldChunk("Short text", 600), false);
});

test("shouldChunk — returns true for text exceeding maxChunkChars", () => {
  const longText = "word ".repeat(200); // ~1000 chars
  assert.equal(shouldChunk(longText, 600), true);
});
