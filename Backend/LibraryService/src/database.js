import sql from "mssql/msnodesqlv8.js";
import { createDatabaseConfig } from "../../databaseConfig.js";

export const pool = new sql.ConnectionPool(createDatabaseConfig());
export { sql };
