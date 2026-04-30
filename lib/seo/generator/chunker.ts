// TS port of LangChain's RecursiveCharacterTextSplitter as used in
// brightdata/seo-article-generator (chunk_size=1000, chunk_overlap=200,
// separators=["\n\n", "\n", ".", "!", "?", ",", " ", ""]).
//
// Strategy: try each separator in priority order; for the first one that
// actually splits the text, recursively merge adjacent splits up to chunkSize,
// pulling `overlap` characters from the tail of the previous chunk into the
// next one (so context survives chunk boundaries).

const DEFAULT_SEPARATORS = ["\n\n", "\n", ". ", "! ", "? ", ", ", " ", ""];

export type ChunkOptions = {
  chunkSize?: number;
  chunkOverlap?: number;
  separators?: string[];
};

export function chunkText(text: string, opts: ChunkOptions = {}): string[] {
  const chunkSize = opts.chunkSize ?? 1000;
  const overlap = opts.chunkOverlap ?? 200;
  const separators = opts.separators ?? DEFAULT_SEPARATORS;
  const cleaned = text.replace(/\r\n/g, "\n").trim();
  if (cleaned.length === 0) return [];
  return splitRecursive(cleaned, separators, chunkSize, overlap);
}

function splitRecursive(
  text: string,
  separators: string[],
  chunkSize: number,
  overlap: number,
): string[] {
  if (text.length <= chunkSize) return [text];

  let separator = "";
  let nextSeparators = separators;
  for (let i = 0; i < separators.length; i++) {
    const sep = separators[i];
    if (sep === "") {
      separator = "";
      nextSeparators = [];
      break;
    }
    if (text.includes(sep)) {
      separator = sep;
      nextSeparators = separators.slice(i + 1);
      break;
    }
  }

  const parts: string[] = separator === ""
    ? hardSplit(text, chunkSize)
    : text.split(separator).map((p, i, arr) => (i < arr.length - 1 ? p + separator : p));

  const goodSplits: string[] = [];
  for (const part of parts) {
    if (part.length === 0) continue;
    if (part.length <= chunkSize) {
      goodSplits.push(part);
    } else if (nextSeparators.length > 0) {
      goodSplits.push(...splitRecursive(part, nextSeparators, chunkSize, overlap));
    } else {
      goodSplits.push(...hardSplit(part, chunkSize));
    }
  }

  return mergeSplits(goodSplits, chunkSize, overlap);
}

function hardSplit(text: string, chunkSize: number): string[] {
  const out: string[] = [];
  for (let i = 0; i < text.length; i += chunkSize) out.push(text.slice(i, i + chunkSize));
  return out;
}

function mergeSplits(splits: string[], chunkSize: number, overlap: number): string[] {
  const merged: string[] = [];
  let buffer: string[] = [];
  let bufferLen = 0;

  for (const piece of splits) {
    if (bufferLen + piece.length > chunkSize && buffer.length > 0) {
      merged.push(buffer.join("").trim());
      // Keep the tail of the previous chunk as overlap context
      while (
        bufferLen > overlap ||
        (bufferLen + piece.length > chunkSize && bufferLen > 0)
      ) {
        bufferLen -= buffer[0].length;
        buffer.shift();
        if (buffer.length === 0) break;
      }
    }
    buffer.push(piece);
    bufferLen += piece.length;
  }
  if (buffer.length > 0) {
    const last = buffer.join("").trim();
    if (last.length > 0) merged.push(last);
  }
  return merged.filter((c) => c.length > 0);
}
