import { createApp } from "./app.js";
import { pool } from "./database.js";
import { AuthenticationRepository } from "./repositories/authenticationRepository.js";
import { LibraryRepository } from "./repositories/libraryRepository.js";
import { AuthenticationService } from "./services/authenticationService.js";
import { LibraryService } from "./services/libraryService.js";

await pool.connect();

const authenticationService = new AuthenticationService(new AuthenticationRepository());
const libraryService = new LibraryService(new LibraryRepository());
const app = createApp(authenticationService, libraryService);
const port = Number(process.env.PORT ?? 5001);

const server = app.listen(port, () => {
  console.log(`Library service listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.close();
    process.exit(0);
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
