import sql from "mssql/msnodesqlv8.js";

const trustedConnection = process.env.DB_TRUSTED_CONNECTION !== "false";
const requestTimeout = Number(process.env.DB_REQUEST_TIMEOUT_MS ?? 30000);

if (!Number.isSafeInteger(requestTimeout) || requestTimeout < 1) {
  throw new Error("DB_REQUEST_TIMEOUT_MS must be a positive integer.");
}

const config = {
  server: process.env.DB_SERVER ?? "(localdb)\\MSSQLLocalDB",
  database: process.env.DB_NAME ?? "TheLexicon",
  requestTimeout,
  driver: "ODBC Driver 18 for SQL Server",
  options: {
    trustedConnection,
    trustServerCertificate: true,
  },
};

if (!trustedConnection) {
  if (!process.env.DB_USER || !process.env.DB_PASSWORD) {
    throw new Error("Set DB_USER and DB_PASSWORD when DB_TRUSTED_CONNECTION=false.");
  }
  config.user = process.env.DB_USER;
  config.password = process.env.DB_PASSWORD;
}

export const pool = new sql.ConnectionPool(config);
export { sql };
