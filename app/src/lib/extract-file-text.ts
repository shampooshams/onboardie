// Browser-only text extraction for TXT, DOCX and PDF files.
// Every failure carries a message that tells the manager what to do next,
// instead of one generic "couldn't read that file".

import { translate, type MessageKey } from "./i18n/translate";

export const ACCEPTED_FILE_TYPES =
  ".pdf,.docx,.txt,.md,.rtf,.csv,application/pdf,text/plain,application/vnd.openxmlformats-officedocument.wordprocessingml.document";

const MAX_BYTES = 25 * 1024 * 1024;

/** Carries a translation key so the page can show the reason in the user's language. */
export class ExtractionError extends Error {
  constructor(
    readonly key: MessageKey,
    readonly vars?: Record<string, string>,
  ) {
    super(translate("en", key, vars));
  }
}

function extension(name: string) {
  const idx = name.lastIndexOf(".");
  return idx === -1 ? "" : name.slice(idx + 1).toLowerCase();
}

async function extractTxt(file: File) {
  return await file.text();
}

async function extractDocx(file: File) {
  const mammoth = await import("mammoth/mammoth.browser.js");
  const arrayBuffer = await file.arrayBuffer();
  const result = await (mammoth as any).extractRawText({ arrayBuffer });
  return String(result?.value ?? "");
}

async function extractPdf(file: File) {
  const pdfjs: any = await import("pdfjs-dist/build/pdf.mjs");
  const workerSrc = (await import("pdfjs-dist/build/pdf.worker.mjs?url")).default;
  pdfjs.GlobalWorkerOptions.workerSrc = workerSrc;

  const data = new Uint8Array(await file.arrayBuffer());
  const pdf = await pdfjs.getDocument({ data }).promise;
  const pages: string[] = [];
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const textContent = await page.getTextContent();
    // Keep paragraphs on their own lines: pdf.js marks a paragraph's end with an
    // empty item that ends a line, while ordinary line wraps inside a paragraph
    // are joined with a space.
    pages.push(
      textContent.items
        .map((item: any) => {
          if (!("str" in item)) return "";
          if (item.hasEOL) return item.str.trim() === "" ? `${item.str}\n` : `${item.str} `;
          return `${item.str} `;
        })
        .join("")
        .replace(/[ \t]+\n/g, "\n")
        .replace(/[ \t]{2,}/g, " ")
        .trim(),
    );
  }
  return pages.join("\n\n");
}

/** Strips RTF control words so a .rtf export still yields readable text. */
function rtfToText(raw: string) {
  return raw
    .replace(/\\'[0-9a-f]{2}/gi, " ")
    .replace(/\\[a-z]+-?\d* ?/gi, " ")
    .replace(/[{}]/g, " ")
    .replace(/[ \t]{2,}/g, " ");
}

/** Extracts plain text from a manager-uploaded file. Throws ExtractionError on failure. */
export async function extractFileText(file: File): Promise<string> {
  if (file.size === 0) {
    throw new ExtractionError("file.empty");
  }
  if (file.size > MAX_BYTES) {
    throw new ExtractionError("file.tooLarge");
  }

  const ext = extension(file.name);
  let text = "";

  if (ext === "doc") {
    throw new ExtractionError("file.oldDoc");
  }
  if (ext === "pages" || ext === "key" || ext === "xlsx" || ext === "pptx") {
    throw new ExtractionError("file.unsupportedExport", { ext });
  }

  try {
    if (ext === "docx") {
      text = await extractDocx(file);
    } else if (ext === "pdf" || file.type === "application/pdf") {
      text = await extractPdf(file);
    } else if (ext === "rtf") {
      text = rtfToText(await extractTxt(file));
    } else if (
      ext === "txt" ||
      ext === "md" ||
      ext === "csv" ||
      file.type.startsWith("text/") ||
      ext === ""
    ) {
      text = await extractTxt(file);
    } else {
      throw new ExtractionError("file.unsupported", { ext });
    }
  } catch (err) {
    if (err instanceof ExtractionError) throw err;
    console.error("File extraction failed", err);
    throw new ExtractionError("file.unreadable");
  }

  const cleaned = text.replace(/\r\n/g, "\n").replace(/\n{3,}/g, "\n\n").trim();
  if (cleaned.length < 20) {
    throw new ExtractionError(ext === "pdf" ? "file.scannedPdf" : "file.noText");
  }
  return cleaned;
}
