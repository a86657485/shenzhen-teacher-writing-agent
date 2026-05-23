import crypto from "node:crypto";
import { getDb, type ChunkRow, type DocumentRow } from "./db";
import { chunkText, normalizeText } from "./chunk";
import { cosineSimilarity, embedText, embedTexts } from "./embeddings";

export type IngestDocumentInput = {
  title: string;
  text: string;
  kind?: string;
  sourceType: "upload" | "url" | "seed";
  sourceUrl?: string;
  fileName?: string;
  replaceExisting?: boolean;
};

export type SearchResult = {
  documentId: string;
  title: string;
  sourceType: string;
  sourceUrl: string | null;
  chunkIndex: number;
  content: string;
  score: number;
};

function nowIso() {
  return new Date().toISOString();
}

function existingDocumentId(input: IngestDocumentInput) {
  const db = getDb();
  if (input.sourceType === "url" && input.sourceUrl) {
    return db.prepare("SELECT id FROM documents WHERE source_type = 'url' AND source_url = ?").get(input.sourceUrl) as
      | { id: string }
      | undefined;
  }
  if (input.fileName) {
    return db
      .prepare("SELECT id FROM documents WHERE source_type = ? AND file_name = ?")
      .get(input.sourceType, input.fileName) as { id: string } | undefined;
  }
  return undefined;
}

export async function ingestDocument(input: IngestDocumentInput) {
  const text = normalizeText(input.text);
  if (text.length < 40) throw new Error("资料正文太短，无法入库。");

  const db = getDb();
  const existing = existingDocumentId(input);
  if (existing && !input.replaceExisting) {
    return { id: existing.id, skipped: true, chunkCount: 0 };
  }
  if (existing && input.replaceExisting) {
    db.prepare("DELETE FROM documents WHERE id = ?").run(existing.id);
  }

  const id = crypto.randomUUID();
  const createdAt = nowIso();
  const chunks = chunkText(text);
  const embeddings = await embedTexts(chunks);

  const insertDocument = db.prepare(`
    INSERT INTO documents (id, title, kind, source_type, source_url, file_name, created_at, updated_at, char_count, chunk_count)
    VALUES (@id, @title, @kind, @sourceType, @sourceUrl, @fileName, @createdAt, @updatedAt, @charCount, @chunkCount)
  `);
  const insertChunk = db.prepare(`
    INSERT INTO chunks (id, document_id, chunk_index, content, embedding, created_at)
    VALUES (@id, @documentId, @chunkIndex, @content, @embedding, @createdAt)
  `);

  const transaction = db.transaction(() => {
    insertDocument.run({
      id,
      title: input.title.trim() || "未命名资料",
      kind: input.kind ?? "资料",
      sourceType: input.sourceType,
      sourceUrl: input.sourceUrl ?? null,
      fileName: input.fileName ?? null,
      createdAt,
      updatedAt: createdAt,
      charCount: text.length,
      chunkCount: chunks.length,
    });

    chunks.forEach((content, index) => {
      insertChunk.run({
        id: crypto.randomUUID(),
        documentId: id,
        chunkIndex: index,
        content,
        embedding: JSON.stringify(embeddings[index]),
        createdAt,
      });
    });
  });

  transaction();
  return { id, skipped: false, chunkCount: chunks.length };
}

export function listDocuments() {
  return getDb()
    .prepare("SELECT * FROM documents ORDER BY created_at DESC")
    .all() as DocumentRow[];
}

export function deleteDocument(id: string) {
  return getDb().prepare("DELETE FROM documents WHERE id = ?").run(id);
}

export function listChunks(documentId: string) {
  return getDb()
    .prepare(
      `SELECT chunks.*, documents.title AS document_title, documents.source_type, documents.source_url
       FROM chunks
       JOIN documents ON documents.id = chunks.document_id
       WHERE document_id = ?
       ORDER BY chunk_index ASC`,
    )
    .all(documentId) as ChunkRow[];
}

export async function searchKnowledge(query: string, limit = 8): Promise<SearchResult[]> {
  const db = getDb();
  const rows = db
    .prepare(
      `SELECT chunks.*, documents.title AS document_title, documents.source_type, documents.source_url
       FROM chunks
       JOIN documents ON documents.id = chunks.document_id`,
    )
    .all() as ChunkRow[];

  if (!rows.length) return [];

  const queryEmbedding = await embedText(query);
  return rows
    .map((row) => ({
      documentId: row.document_id,
      title: row.document_title,
      sourceType: row.source_type,
      sourceUrl: row.source_url,
      chunkIndex: row.chunk_index,
      content: row.content,
      score: cosineSimilarity(queryEmbedding, JSON.parse(row.embedding) as number[]),
    }))
    .filter((result) => result.score >= 0.12)
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
}
