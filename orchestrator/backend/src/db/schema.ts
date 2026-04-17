import { DatabaseSync } from 'node:sqlite';
import path from 'path';

const DB_PATH = path.resolve(process.cwd(), 'orchestrator.db');

let db: DatabaseSync;

export function getDb(): DatabaseSync {
  if (!db) {
    db = new DatabaseSync(DB_PATH);
  }
  return db;
}

export function initDb(): void {
  const db = getDb();

  // Each row is one full pipeline run from document upload to final phase completion
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_runs (
      id          TEXT PRIMARY KEY,
      created_at  TEXT NOT NULL DEFAULT (datetime('now')),
      status      TEXT NOT NULL DEFAULT 'running',

      current_phase  TEXT NOT NULL DEFAULT 'requirements',

      file_name   TEXT,
      file_path   TEXT,

      requirements_output  TEXT,
      design_output        TEXT,
      qa_output            TEXT,

      requirements_started_at   TEXT,
      requirements_completed_at TEXT,
      design_started_at         TEXT,
      design_completed_at       TEXT,
      qa_started_at             TEXT,
      qa_completed_at           TEXT,

      completed_at TEXT
    );
  `);

  // Each row is one human review action (approve or reject) on a pipeline run phase
  db.exec(`
    CREATE TABLE IF NOT EXISTS pipeline_reviews (
      id          INTEGER PRIMARY KEY AUTOINCREMENT,
      run_id      TEXT NOT NULL REFERENCES pipeline_runs(id),
      phase       TEXT NOT NULL,
      action      TEXT NOT NULL,
      feedback    TEXT,
      reviewed_at TEXT NOT NULL DEFAULT (datetime('now'))
    );
  `);

  console.log(`[db] SQLite initialised at: ${DB_PATH}`);
}
