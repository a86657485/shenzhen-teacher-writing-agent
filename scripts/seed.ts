import fs from "node:fs/promises";
import path from "node:path";
import { extractTextFromFile } from "../src/lib/extract";
import { ingestDocument, listDocuments } from "../src/lib/knowledge";

async function main() {
  const root = process.cwd();
  const entries = await fs.readdir(root);
  const docxFiles = entries.filter((entry) => entry.endsWith(".docx"));

  if (!docxFiles.length) {
    console.log("No .docx files found in project root.");
    return;
  }

  for (const fileName of docxFiles) {
    const buffer = await fs.readFile(path.join(root, fileName));
    const extracted = await extractTextFromFile(buffer, fileName);
    const result = await ingestDocument({
      title: extracted.title,
      text: extracted.text,
      kind: "高分范文风格库",
      sourceType: "seed",
      fileName,
      replaceExisting: true,
    });
    console.log(`${result.skipped ? "Skipped" : "Imported"} ${fileName}: ${result.chunkCount} chunks`);
  }

  console.log(`Knowledge documents: ${listDocuments().length}`);
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
