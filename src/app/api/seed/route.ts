import fs from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { extractTextFromFile } from "@/lib/extract";
import { ingestDocument } from "@/lib/knowledge";

export const runtime = "nodejs";

export async function POST() {
  const root = process.cwd();
  const entries = await fs.readdir(root);
  const docxFiles = entries.filter((entry) => entry.endsWith(".docx"));
  const imported = [];

  for (const fileName of docxFiles) {
    const filePath = path.join(root, fileName);
    const buffer = await fs.readFile(filePath);
    const extracted = await extractTextFromFile(buffer, fileName);
    const result = await ingestDocument({
      title: extracted.title,
      text: extracted.text,
      kind: "高分范文风格库",
      sourceType: "seed",
      fileName,
      replaceExisting: true,
    });
    imported.push({ fileName, ...result });
  }

  return NextResponse.json({ ok: true, imported });
}
