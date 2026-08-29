import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";

export type KaushalDatabase = Database.Database;

export function databasePath(): string {
  const configured = process.env.DATABASE_URL ?? "data/kaushal-ai.db";
  return resolve(configured.startsWith("file:") ? configured.slice("file:".length) : configured);
}

export function openDatabase(path = databasePath()): KaushalDatabase {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  return database;
}

let singleton: KaushalDatabase | undefined;
export function getDatabase(): KaushalDatabase {
  singleton ??= openDatabase();
  return singleton;
}
