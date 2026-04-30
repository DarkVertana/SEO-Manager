// Strip control characters and zero-width oddities that occasionally sneak in
// from rich source pages and trigger react-pdf glyph errors. Used by the
// rewrite summary PDF so impossibly-encoded copy doesn't blow up layout.

const CONTROL_RE = new RegExp("[" + String.fromCharCode(0) + "-" + String.fromCharCode(0x1f) + String.fromCharCode(0x7f) + "]", "g");
const ZERO_WIDTH_RE = new RegExp(
  "[" +
    String.fromCharCode(0x200b) + // zero-width space
    String.fromCharCode(0x200c) + // ZWNJ
    String.fromCharCode(0x200d) + // ZWJ
    String.fromCharCode(0xfeff) + // BOM
    "]",
  "g",
);

export function sanitizeForPdf(s: string): string {
  return s
    .replace(CONTROL_RE, " ")
    .replace(ZERO_WIDTH_RE, "")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 4000);
}
