import Database from "better-sqlite3";
import { mkdirSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { importCatalog } from "@/data/catalog-import";
import { seedFoundation } from "@/data/seeds";
import { migrate } from "./migrate";

export type KaushalDatabase = Database.Database;

export function databasePath(): string {
  const configured = process.env.DATABASE_URL;
  if (process.env.VERCEL === "1") return "/tmp/kaushal-ai.db";
  const databaseUrl = configured ?? "data/kaushal-ai.db";
  return resolve(databaseUrl.startsWith("file:") ? databaseUrl.slice("file:".length) : databaseUrl);
}

export function openDatabase(path = databasePath()): KaushalDatabase {
  if (path !== ":memory:") mkdirSync(dirname(path), { recursive: true });
  const database = new Database(path);
  database.pragma("foreign_keys = ON");
  database.pragma("journal_mode = WAL");
  return database;
}

let singleton: KaushalDatabase | undefined;
export function initializeDatabase(database: KaushalDatabase): void {
  migrate(database);
  const officials = (database.prepare("SELECT COUNT(*) count FROM officials").get() as { count: number }).count;
  if (officials === 0) seedFoundation(database);
  const courses = (database.prepare("SELECT COUNT(*) count FROM courses").get() as { count: number }).count;
  if (courses === 0) importCatalog(database);
}

export function getDatabase(): KaushalDatabase {
  if (!singleton) {
    const database = openDatabase();
    try {
      initializeDatabase(database);
      singleton = database;
    } catch (error) {
      database.close();
      throw error;
    }
  }
  return singleton;
}
