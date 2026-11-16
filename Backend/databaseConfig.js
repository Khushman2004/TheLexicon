export function createDatabaseConfig(database = "TheLexicon") {
  const requestTimeout = Number(process.env.DB_REQUEST_TIMEOUT_MS ?? 30000);
  if (!Number.isSafeInteger(requestTimeout) || requestTimeout < 1) {
    throw new Error("DB_REQUEST_TIMEOUT_MS must be a positive integer.");
  }

  return {
    server: process.env.DB_SERVER ?? "localhost\\SQLEXPRESS",
    database: process.env.DB_NAME ?? database,
    requestTimeout,
    driver: process.env.DB_ODBC_DRIVER ?? "ODBC Driver 17 for SQL Server",
    options: {
      trustedConnection: true,
      trustServerCertificate: true,
    },
  };
}
