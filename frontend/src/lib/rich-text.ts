export type RichTextSanitizationOptions = {
  preserveTextColor?: boolean;
};

export type RichTextRenderOptions = RichTextSanitizationOptions & {
  recoverPlainText?: boolean;
};

const allowedRichTextTags = new Set([
  "a",
  "blockquote",
  "br",
  "code",
  "col",
  "colgroup",
  "div",
  "em",
  "hr",
  "img",
  "input",
  "label",
  "li",
  "mark",
  "ol",
  "p",
  "s",
  "span",
  "strong",
  "table",
  "tbody",
  "td",
  "tfoot",
  "th",
  "thead",
  "tr",
  "u",
  "ul",
]);

export function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function decodeHtmlEntities(value: string): string {
  return value
    .replaceAll("&nbsp;", " ")
    .replaceAll("&amp;", "&")
    .replaceAll("&lt;", "<")
    .replaceAll("&gt;", ">")
    .replaceAll("&quot;", '"')
    .replaceAll("&#39;", "'");
}

function getHtmlAttributeValue(source: string, attributeName: string): string | null {
  const quotedMatch = new RegExp(`${attributeName}\\s*=\\s*(['"])(.*?)\\1`, "i").exec(source);
  if (quotedMatch?.[2]) {
    return quotedMatch[2];
  }
  const unquotedMatch = new RegExp(`${attributeName}\\s*=\\s*([^\\s>]+)`, "i").exec(source);
  return unquotedMatch?.[1] ?? null;
}

function sanitizeRichTextUrl(value: string): string | null {
  const normalized = value.trim();
  return /^https?:\/\//i.test(normalized) ? normalized : null;
}

function sanitizeRichTextTag(tag: string, options: RichTextSanitizationOptions = {}): string {
  const match = /^<\s*(\/?)\s*([a-z0-9-]+)([^>]*)>/i.exec(tag);
  if (!match) return "";

  const preserveTextColor = options.preserveTextColor ?? true;
  const [, closingSlash, rawTagName, rawAttributes] = match;
  const tagName = rawTagName.toLowerCase();

  if (!allowedRichTextTags.has(tagName)) return "";

  const isClosingTag = closingSlash === "/";
  if (isClosingTag) {
    return tagName === "br" || tagName === "hr" || tagName === "input" || tagName === "img" || tagName === "col" ? "" : `</${tagName}>`;
  }

  if (tagName === "br" || tagName === "hr" || tagName === "col") return `<${tagName}>`;

  if (tagName === "img") {
    const src = getHtmlAttributeValue(rawAttributes, "src");
    const alt = getHtmlAttributeValue(rawAttributes, "alt") ?? "";
    if (!src) return "";
    const trimmed = src.trim();
    const isSafeUrl = /^https?:\/\//i.test(trimmed);
    const isSafeDataUri = /^data:image\/(png|jpe?g|gif|webp|svg\+xml);base64,/i.test(trimmed);
    if (!isSafeUrl && !isSafeDataUri) return "";
    return `<img src="${escapeHtml(trimmed)}" alt="${escapeHtml(alt)}">`;
  }

  if (tagName === "a") {
    const href = getHtmlAttributeValue(rawAttributes, "href");
    const safeUrl = href ? sanitizeRichTextUrl(href) : null;
    return safeUrl ? `<a href="${escapeHtml(safeUrl)}" target="_blank" rel="noopener noreferrer">` : "<a>";
  }

  if (tagName === "ul") {
    const dataType = getHtmlAttributeValue(rawAttributes, "data-type");
    return dataType === "taskList" ? '<ul data-type="taskList">' : "<ul>";
  }

  if (tagName === "li") {
    const checkedState = getHtmlAttributeValue(rawAttributes, "data-checked");
    return checkedState === "true" || checkedState === "false"
      ? `<li data-checked="${checkedState}">`
      : "<li>";
  }

  if (tagName === "input") {
    const type = getHtmlAttributeValue(rawAttributes, "type");
    if (type?.toLowerCase() !== "checkbox") return "";
    const isChecked = /\bchecked(?:\s*=\s*(?:"checked"|'checked'|checked))?/i.test(rawAttributes);
    return `<input type="checkbox"${isChecked ? " checked" : ""} disabled>`;
  }

  if (tagName === "span") {
    const style = preserveTextColor ? getHtmlAttributeValue(rawAttributes, "style") : null;
    if (style) {
      const colorMatch = /color:\s*(#[0-9a-fA-F]{3,8}|rgb\([^)]+\)|[a-z]+)/i.exec(style);
      if (colorMatch) return `<span style="color:${escapeHtml(colorMatch[1])}">`;
    }
    return "<span>";
  }

  if (tagName === "td" || tagName === "th") {
    const colspan = getHtmlAttributeValue(rawAttributes, "colspan");
    const rowspan = getHtmlAttributeValue(rawAttributes, "rowspan");
    let attrs = "";
    if (colspan && /^\d+$/.test(colspan)) attrs += ` colspan="${colspan}"`;
    if (rowspan && /^\d+$/.test(rowspan)) attrs += ` rowspan="${rowspan}"`;
    return `<${tagName}${attrs}>`;
  }

  return `<${tagName}>`;
}

export function sanitizeRichTextHtml(value: string, options: RichTextSanitizationOptions = {}): string {
  return value.replace(/<[^>]+>/g, (tag) => sanitizeRichTextTag(tag, options));
}

export function isHtmlContent(text: string): boolean {
  return /<[a-z][\s\S]*>/i.test(text);
}

export function isRichTextEmpty(html: string): boolean {
  return html.replace(/<[^>]*>/g, "").trim() === "";
}

export function stripRichTextToPlainText(value: string): string {
  const normalized = value
    .replace(/<input\b[^>]*type=["']checkbox["'][^>]*checked[^>]*>/gi, "[x] ")
    .replace(/<input\b[^>]*type=["']checkbox["'][^>]*>/gi, "[ ] ")
    .replace(/<li\b[^>]*>/gi, "- ")
    .replace(/<(?:br|hr)\s*\/?>/gi, "\n")
    .replace(/<\/(?:p|div|blockquote|li|ul|ol)>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  return decodeHtmlEntities(normalized)
    .replace(/\r/g, "")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function getRichTextCharacterCount(value: string): number {
  const trimmed = value.trim();
  if (!trimmed) return 0;
  return isHtmlContent(trimmed) ? stripRichTextToPlainText(trimmed).length : trimmed.length;
}

function formatInlineMarkdown(value: string): string {
  let formatted = escapeHtml(value);
  formatted = formatted.replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_match, text: string, url: string) => {
    return `<a href="${url}" target="_blank" rel="noopener noreferrer">${text}</a>`;
  });
  formatted = formatted.replace(/`([^`]+)`/g, "<code>$1</code>");
  formatted = formatted.replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>");
  formatted = formatted.replace(/\*([^*]+)\*/g, "<em>$1</em>");
  return formatted;
}

function renderPlainTextDescriptionHtml(markdown: string): string {
  const lines = markdown.split(/\r?\n/);
  const htmlParts: string[] = [];
  let inList: "ul" | "ol" | null = null;

  function closeList() {
    if (inList) {
      htmlParts.push(`</${inList}>`);
      inList = null;
    }
  }

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine) { closeList(); continue; }

    if (/^#{1,3}\s+/.test(cleanLine)) {
      closeList();
      const level = Math.min(3, cleanLine.match(/^#+/)?.[0].length ?? 1);
      const tagName = `h${level}`;
      htmlParts.push(`<${tagName}>${formatInlineMarkdown(cleanLine.replace(/^#{1,3}\s+/, ""))}</${tagName}>`);
      continue;
    }

    if (/^[-*]\s+/.test(cleanLine)) {
      if (inList !== "ul") { closeList(); htmlParts.push("<ul>"); inList = "ul"; }
      htmlParts.push(`<li>${formatInlineMarkdown(cleanLine.replace(/^[-*]\s+/, ""))}</li>`);
      continue;
    }

    if (/^\d+\.\s+/.test(cleanLine)) {
      if (inList !== "ol") { closeList(); htmlParts.push("<ol>"); inList = "ol"; }
      htmlParts.push(`<li>${formatInlineMarkdown(cleanLine.replace(/^\d+\.\s+/, ""))}</li>`);
      continue;
    }

    closeList();

    if (/^>\s+/.test(cleanLine)) {
      htmlParts.push(`<blockquote>${formatInlineMarkdown(cleanLine.replace(/^>\s+/, ""))}</blockquote>`);
      continue;
    }

    htmlParts.push(`<p>${formatInlineMarkdown(cleanLine)}</p>`);
  }

  closeList();
  return htmlParts.join("");
}

export function renderDescriptionHtml(markdown: string, options: RichTextRenderOptions = {}): string {
  const trimmed = markdown.trim();
  if (!trimmed) return "";

  if (isHtmlContent(trimmed)) {
    const sanitized = sanitizeRichTextHtml(trimmed, options);
    if (!options.recoverPlainText || !isRichTextEmpty(sanitized)) {
      return sanitized;
    }
    const plainText = stripRichTextToPlainText(trimmed);
    return plainText ? renderPlainTextDescriptionHtml(plainText) : "";
  }

  return renderPlainTextDescriptionHtml(trimmed);
}
