import sql from "mssql/msnodesqlv8.js";

const trustedConnection = process.env.DB_TRUSTED_CONNECTION !== "false";

const config = {
  server: process.env.DB_SERVER ?? "(localdb)\\MSSQLLocalDB",
  database: process.env.DB_NAME ?? "TheLexicon",
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
