import os from 'os';
import path from 'path';
import { createClient, type Client } from '@libsql/client';
import { drizzle } from 'drizzle-orm/libsql';
import * as schema from './schema';

let client: Client | null = null;
let db: ReturnType<typeof drizzle<typeof schema>> | null = null;
let initPromise: Promise<void> | null = null;

export async function getDb() {
  if (!db) {
    const defaultDbPath = path.join(os.tmpdir(), 'mousse_data.db');
    const url =
      process.env.DATABASE_URL ||
      process.env.TURSO_DATABASE_URL ||
      process.env.LIBSQL_URL ||
      `file:${defaultDbPath}`;
    const authToken =
      process.env.DATABASE_AUTH_TOKEN ||
      process.env.TURSO_AUTH_TOKEN ||
      process.env.LIBSQL_AUTH_TOKEN;

    client = createClient({
      url,
      authToken,
    });

    db = drizzle(client, { schema });

    initPromise = client
      .batch([
        `CREATE TABLE IF NOT EXISTS audit_records (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id TEXT,
          kind TEXT NOT NULL,
          payload_json TEXT NOT NULL,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE TABLE IF NOT EXISTS audit_logs (
          id INTEGER PRIMARY KEY AUTOINCREMENT,
          owner_id TEXT NOT NULL,
          record_id INTEGER,
          kind TEXT NOT NULL,
          action TEXT NOT NULL,
          before_json TEXT,
          after_json TEXT,
          created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
          updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
        );`,
        `CREATE INDEX IF NOT EXISTS idx_audit_records_owner ON audit_records(owner_id);`,
        `CREATE INDEX IF NOT EXISTS idx_audit_records_kind ON audit_records(kind);`,
        `CREATE INDEX IF NOT EXISTS idx_audit_logs_owner ON audit_logs(owner_id);`,
      ])
      .then(() => {})
      .catch((err) => {
        console.warn('Auto-init SQLite tables warning:', err);
      });
  }

  if (initPromise) {
    await initPromise;
  }

  return db;
}


