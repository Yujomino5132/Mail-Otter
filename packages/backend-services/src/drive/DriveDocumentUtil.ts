const TEXT_MIME_TYPES = new Set(['text/plain', 'text/markdown', 'text/csv']);

// Best-effort PDF content stream token patterns; input is bounded to MAX_ATTACHMENT_SIZE_BYTES.
// eslint-disable-next-line sonarjs/super-linear-regex
const TJ_RE = /\(([^)]*)\)\s*Tj/g;
// eslint-disable-next-line sonarjs/super-linear-regex
const TJ_ARRAY_RE = /\[([^\]]+)\]\s*TJ/g;
// eslint-disable-next-line sonarjs/super-linear-regex
const TJ_ARRAY_ITEM_RE = /\(([^)]*)\)/g;

function unescapePdfString(s: string): string {
  return s
    .replaceAll(String.raw`\n`, '\n')
    .replaceAll(String.raw`\r`, '\r')
    .replaceAll(String.raw`\t`, '\t')
    .replaceAll('\\\\', '\\')
    .replaceAll(/\\([)(])/g, '$1');
}

class DriveDocumentUtil {
  public static extractText(data: ArrayBuffer, mimeType: string): string | null {
    const mimeTypeLower = mimeType.toLowerCase().split(';', 1)[0].trim();
    if (TEXT_MIME_TYPES.has(mimeTypeLower)) {
      const text = new TextDecoder('utf-8', { fatal: false }).decode(data);
      return text.trim() || null;
    }
    if (mimeTypeLower === 'application/pdf') {
      return this.extractTextFromPdf(data);
    }
    return null;
  }

  // Best-effort PDF text extraction via Tj/TJ content stream operators.
  // Works for most standard PDFs; encrypted or glyph-encoded PDFs may yield nothing.
  private static extractTextFromPdf(data: ArrayBuffer): string | null {
    const raw = new TextDecoder('utf-8', { fatal: false }).decode(data);
    const texts: string[] = [];

    let m: RegExpExecArray | null;

    TJ_RE.lastIndex = 0;
    while ((m = TJ_RE.exec(raw)) !== null) {
      const s = unescapePdfString(m[1]);
      if (s.trim().length > 0) texts.push(s);
    }

    TJ_ARRAY_RE.lastIndex = 0;
    while ((m = TJ_ARRAY_RE.exec(raw)) !== null) {
      const block = m[1];
      let item: RegExpExecArray | null;
      TJ_ARRAY_ITEM_RE.lastIndex = 0;
      while ((item = TJ_ARRAY_ITEM_RE.exec(block)) !== null) {
        const s = unescapePdfString(item[1]);
        if (s.trim().length > 0) texts.push(s);
      }
    }

    if (texts.length === 0) return null;
    const combined = texts.join(' ').trim();
    return combined.length > 0 ? combined : null;
  }

  public static buildIndexedText(filename: string, appName: string, body: string, maxChars: number): string {
    const text = [`File: ${filename}`, `Mailbox: ${appName}`, '', body].join('\n');
    return this.truncateToMaxChars(text, maxChars);
  }

  public static truncateToMaxChars(text: string, maxChars: number): string {
    return text.length <= maxChars ? text : text.slice(0, maxChars);
  }
}

export { DriveDocumentUtil };
