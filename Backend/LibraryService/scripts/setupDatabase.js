import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import sql from "mssql/msnodesqlv8.js";
import { createDatabaseConfig } from "../../databaseConfig.js";

const scriptPath = fileURLToPath(new URL("../../../Db/TheLexicon.sql", import.meta.url));
const script = await readFile(scriptPath, "utf8");
const pools = new Map();
let activeDatabase = "master";
let appliedBatches = 0;

async function getPool(database) {
  if (!pools.has(database)) {
    const pool = new sql.ConnectionPool(createDatabaseConfig(database));
    await pool.connect();
    pools.set(database, pool);
  }
  return pools.get(database);
}

try {
  for (const rawBatch of script.split(/^\s*GO\s*$/gim)) {
    const useDatabase = rawBatch.match(/^\s*USE\s+\[([^\]]+)\]\s*;?\s*$/im);
    if (useDatabase) activeDatabase = useDatabase[1];

    const batch = rawBatch
      .replace(/^\s*USE\s+\[[^\]]+\]\s*;?\s*$/im, "")
      .trim();
    if (!batch.replace(/--.*$/gm, "").trim()) continue;

    await (await getPool(activeDatabase)).request().batch(batch);
    appliedBatches += 1;
  }

  console.log(`Database setup completed: ${appliedBatches} batches applied on ${process.env.DB_SERVER ?? "localhost\\SQLEXPRESS"}.`);
} catch (error) {
  console.error("Database setup failed:", error);
  process.exitCode = 1;
} finally {
  await Promise.all([...pools.values()].map((pool) => pool.close()));
}
