import fs from "node:fs";
import path from "node:path";
import Database from "better-sqlite3";
import { appConfig } from "./config";

let db: Database.Database | undefined;

export type DocumentRow = {
  id: string;
  title: string;
  kind: string;
  source_type: string;
  source_url: string | null;
  file_name: string | null;
  created_at: string;
  updated_at: string;
  char_count: number;
  chunk_count: number;
};

export type ChunkRow = {
  id: string;
  document_id: string;
  document_title: string;
  source_type: string;
  source_url: string | null;
  chunk_index: number;
  content: string;
  embedding: string;
  created_at: string;
};

export function getDb() {
  if (db) return db;

  fs.mkdirSync(path.dirname(appConfig.databasePath), { recursive: true });
  db = new Database(appConfig.databasePath);
  db.pragma("journal_mode = WAL");
  db.pragma("foreign_keys = ON");
  db.exec(`
    CREATE TABLE IF NOT EXISTS documents (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      kind TEXT NOT NULL DEFAULT '资料',
      source_type TEXT NOT NULL,
      source_url TEXT,
      file_name TEXT,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL,
      char_count INTEGER NOT NULL DEFAULT 0,
      chunk_count INTEGER NOT NULL DEFAULT 0
    );

    CREATE TABLE IF NOT EXISTS chunks (
      id TEXT PRIMARY KEY,
      document_id TEXT NOT NULL,
      chunk_index INTEGER NOT NULL,
      content TEXT NOT NULL,
      embedding TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (document_id) REFERENCES documents(id) ON DELETE CASCADE
    );

    CREATE TABLE IF NOT EXISTS conversations (
      id TEXT PRIMARY KEY,
      title TEXT NOT NULL,
      created_at TEXT NOT NULL,
      updated_at TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS messages (
      id TEXT PRIMARY KEY,
      conversation_id TEXT NOT NULL,
      role TEXT NOT NULL,
      content TEXT NOT NULL,
      created_at TEXT NOT NULL,
      FOREIGN KEY (conversation_id) REFERENCES conversations(id) ON DELETE CASCADE
    );

    CREATE INDEX IF NOT EXISTS idx_chunks_document_id ON chunks(document_id);
    CREATE INDEX IF NOT EXISTS idx_documents_source_type ON documents(source_type);
  `);

  return db;
}
