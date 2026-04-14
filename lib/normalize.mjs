export function normalize(value) {
  return String(value || "")
    .toLowerCase()
    .replace(/[`*_#:[\]().>{}|\\/,-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}
