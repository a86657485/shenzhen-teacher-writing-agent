const DEFAULT_MAX_CHARS = 1100;
const DEFAULT_MIN_CHARS = 800;
const DEFAULT_OVERLAP = 150;

export function normalizeText(text: string) {
  return text
    .replace(/\r/g, "\n")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

export function chunkText(text: string, maxChars = DEFAULT_MAX_CHARS, overlap = DEFAULT_OVERLAP) {
  const normalized = normalizeText(text);
  if (!normalized) return [];
  if (normalized.length <= maxChars) return [normalized];

  const paragraphs = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  const chunks: string[] = [];
  let current = "";

  for (const paragraph of paragraphs) {
    if (paragraph.length > maxChars) {
      if (current.trim()) {
        chunks.push(current.trim());
        current = "";
      }
      for (let start = 0; start < paragraph.length; start += maxChars - overlap) {
        chunks.push(paragraph.slice(start, start + maxChars).trim());
      }
      continue;
    }

    const candidate = current ? `${current}\n\n${paragraph}` : paragraph;
    if (candidate.length <= maxChars || current.length < DEFAULT_MIN_CHARS) {
      current = candidate;
      continue;
    }

    chunks.push(current.trim());
    const tail = current.slice(Math.max(0, current.length - overlap));
    current = `${tail}\n\n${paragraph}`;
  }

  if (current.trim()) chunks.push(current.trim());
  return chunks.filter((chunk) => chunk.length > 20);
}
