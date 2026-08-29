import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import type { KaushalDatabase } from "./client";

export function migrate(database: KaushalDatabase): void {
  database.exec("CREATE TABLE IF NOT EXISTS _migrations (name TEXT PRIMARY KEY, applied_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP)");
  const directory = resolve("src/db/migrations");
  const applied = database.prepare("SELECT 1 FROM _migrations WHERE name = ?");
  const record = database.prepare("INSERT INTO _migrations(name) VALUES (?)");
  for (const name of readdirSync(directory).filter((file) => file.endsWith(".sql")).sort()) {
    if (applied.get(name)) continue;
    database.transaction(() => {
      database.exec(readFileSync(resolve(directory, name), "utf8"));
      record.run(name);
    })();
  }
}
