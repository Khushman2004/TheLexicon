import { createApp } from "./app.js";
import { pool } from "./database.js";
import { AuthenticationRepository } from "./repositories/authenticationRepository.js";
import { NetworkRepository } from "./repositories/networkRepository.js";
import { AuthenticationService } from "./services/authenticationService.js";
import { NetworkService } from "./services/networkService.js";

const repository = new NetworkRepository();
const authenticationRepository = new AuthenticationRepository();
await pool.connect();
await pool.request().query("SELECT 1;");
const app = createApp(
  new AuthenticationService(authenticationRepository),
  new NetworkService(repository),
);
const port = Number(process.env.PORT ?? 5002);
const server = app.listen(port, () => {
  console.log(`Network service listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.close();
    process.exit(0);
  });
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
