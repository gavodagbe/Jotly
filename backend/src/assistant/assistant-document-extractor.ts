const MAX_EXTRACTED_TEXT_LENGTH = 20_000;

export type AssistantDocumentExtraction = {
  text: string;
  status: "ready" | "empty" | "unsupported" | "error";
  warning: string | null;
  parser: "text" | "html" | "json" | "pdf" | "ocr" | "none";
};

export type AssistantAttachmentLike = {
  name: string;
  url: string;
  contentType: string | null;
};

export type AssistantDocumentExtractor = {
  extractFromAttachment(
    attachment: AssistantAttachmentLike
  ): Promise<AssistantDocumentExtraction>;
};

type ParsedDataUrl = {
  contentType: string | null;
  buffer: Buffer;
};

function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function stripHtml(value: string): string {
  return decodeHtmlEntities(
    value
      .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
      .replace(/<\/(?:p|div|blockquote|li|ul|ol|tr|section|article|h[1-6])>/gi, "\n")
      .replace(/<li\b[^>]*>/gi, "- ")
      .replace(/<[^>]+>/g, " ")
  )
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function clip(value: string): string {
  if (value.length <= MAX_EXTRACTED_TEXT_LENGTH) {
    return value;
  }

  return value.slice(0, MAX_EXTRACTED_TEXT_LENGTH);
}

function normalizePlainText(value: string): string {
  return value
    .replace(/\r/g, "")
    .replace(/\u0000/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

function parseDataUrl(value: string): ParsedDataUrl | null {
  const match = /^data:([^;,]+)?((?:;[^,]+)*?),(.*)$/s.exec(value);

  if (!match) {
    return null;
  }

  const [, contentTypeRaw, modifiers, payload] = match;
  const contentType = contentTypeRaw?.trim() || null;
  const isBase64 = /;base64/i.test(modifiers ?? "");

  try {
    const buffer = isBase64
      ? Buffer.from(payload, "base64")
      : Buffer.from(decodeURIComponent(payload), "utf8");

    return {
      contentType,
      buffer,
    };
  } catch {
    return null;
  }
}

async function loadOptionalModule(moduleName: string): Promise<unknown | null> {
  try {
    const dynamicImport = new Function(
      "moduleName",
      "return import(moduleName);"
    ) as (moduleName: string) => Promise<unknown>;
    return await dynamicImport(moduleName);
  } catch {
    return null;
  }
}

async function extractPdfText(buffer: Buffer): Promise<AssistantDocumentExtraction> {
  const moduleValue = (await loadOptionalModule("pdf-parse")) as
    | { default?: ((buffer: Buffer) => Promise<{ text?: string }>) }
    | ((buffer: Buffer) => Promise<{ text?: string }>)
    | null;

  if (!moduleValue) {
    return {
      text: "",
      status: "unsupported",
      warning: "pdf-parse is not installed; PDF text extraction is disabled.",
      parser: "pdf",
    };
  }

  try {
    const parser =
      typeof moduleValue === "function" ? moduleValue : moduleValue.default;

    if (!parser) {
      throw new Error("pdf-parse did not expose a parser function.");
    }

    const parsed = await parser(buffer);
    const text = normalizePlainText(parsed.text ?? "");

    return {
      text: clip(text),
      status: text.length > 0 ? "ready" : "empty",
      warning: text.length > 0 ? null : "The PDF did not contain extractable text.",
      parser: "pdf",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to extract text from PDF.";
    return {
      text: "",
      status: "error",
      warning: message,
      parser: "pdf",
    };
  }
}

async function extractImageText(buffer: Buffer): Promise<AssistantDocumentExtraction> {
  const moduleValue = (await loadOptionalModule("tesseract.js")) as
    | {
        recognize?: (
          image: Buffer,
          languages?: string
        ) => Promise<{ data?: { text?: string } }>;
      }
    | null;

  if (!moduleValue?.recognize) {
    return {
      text: "",
      status: "unsupported",
      warning: "tesseract.js is not installed; image OCR is disabled.",
      parser: "ocr",
    };
  }

  try {
    const result = await moduleValue.recognize(buffer, "eng+fra");
    const text = normalizePlainText(result.data?.text ?? "");

    return {
      text: clip(text),
      status: text.length > 0 ? "ready" : "empty",
      warning: text.length > 0 ? null : "The image did not produce any OCR text.",
      parser: "ocr",
    };
  } catch (error) {
    const message =
      error instanceof Error ? error.message : "Unable to extract text from image.";
    return {
      text: "",
      status: "error",
      warning: message,
      parser: "ocr",
    };
  }
}

export function createAssistantDocumentExtractor(): AssistantDocumentExtractor {
  return {
    async extractFromAttachment(attachment) {
      const parsed = parseDataUrl(attachment.url);

      if (!parsed) {
        return {
          text: "",
          status: "unsupported",
          warning: "Only inline data URLs can be indexed for attachments.",
          parser: "none",
        };
      }

      const contentType = attachment.contentType ?? parsed.contentType ?? "";
      const normalizedType = contentType.toLowerCase();

      if (
        normalizedType.startsWith("text/") ||
        normalizedType === "application/xml" ||
        normalizedType === "application/x-yaml"
      ) {
        const text = normalizePlainText(parsed.buffer.toString("utf8"));
        return {
          text: clip(text),
          status: text.length > 0 ? "ready" : "empty",
          warning: text.length > 0 ? null : "The attachment text was empty.",
          parser: "text",
        };
      }

      if (
        normalizedType === "text/html" ||
        normalizedType === "application/xhtml+xml" ||
        normalizedType === "image/svg+xml"
      ) {
        const text = stripHtml(parsed.buffer.toString("utf8"));
        return {
          text: clip(text),
          status: text.length > 0 ? "ready" : "empty",
          warning: text.length > 0 ? null : "The HTML attachment did not contain visible text.",
          parser: "html",
        };
      }

      if (normalizedType === "application/json") {
        const text = normalizePlainText(parsed.buffer.toString("utf8"));
        return {
          text: clip(text),
          status: text.length > 0 ? "ready" : "empty",
          warning: text.length > 0 ? null : "The JSON attachment was empty.",
          parser: "json",
        };
      }

      if (normalizedType === "application/pdf") {
        return extractPdfText(parsed.buffer);
      }

      if (normalizedType.startsWith("image/")) {
        return extractImageText(parsed.buffer);
      }

      return {
        text: "",
        status: "unsupported",
        warning: `Attachments of type "${contentType || "unknown"}" are not indexed yet.`,
        parser: "none",
      };
    },
  };
}
