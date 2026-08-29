import { openDatabase } from "../src/db/client";
import { migrate } from "../src/db/migrate";
import { importCatalog } from "../src/data/catalog-import";
import { seedFoundation } from "../src/data/seeds";

const database = openDatabase();
try {
  migrate(database);
  seedFoundation(database);
  const catalog = importCatalog(database);
  const officials = (database.prepare("SELECT COUNT(*) count FROM officials").get() as { count: number }).count;
  console.log(`Kaushal AI database ready: ${officials} officials, ${catalog.imported} courses, ${catalog.detailed} detailed records.`);
} finally { database.close(); }
