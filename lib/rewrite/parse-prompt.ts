// Parse @section selectors out of a user prompt.
//
// Supported forms (1-based for the user; converted to 0-based internally):
//   @section1, @section 1, @section_1
//   @s1, @s 1
//   @1
// Multiple selectors are allowed: "@1 @3 translate to french" → {0, 2}.
//
// The lookbehind ensures we don't match emails or URLs that contain `@`.

const RE = /(?<![A-Za-z0-9])@(?:s(?:ection)?[\s_-]*)?(\d+)/gi;

export function parsePromptTargets(prompt: string): {
  targetIndices: Set<number> | null;
  cleaned: string;
  rawHits: number;
} {
  const indices = new Set<number>();
  let m: RegExpExecArray | null;
  let count = 0;
  RE.lastIndex = 0;
  while ((m = RE.exec(prompt)) !== null) {
    const n = parseInt(m[1], 10);
    if (!Number.isNaN(n) && n > 0) {
      indices.add(n - 1);
      count++;
    }
  }
  const cleaned = prompt.replace(RE, " ").replace(/\s+/g, " ").trim();
  return {
    targetIndices: indices.size > 0 ? indices : null,
    cleaned,
    rawHits: count,
  };
}
