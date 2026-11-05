import { AuthService } from "./services/authService.js";
import { UserRepository } from "./repositories/userRepository.js";
import { createApp } from "./app.js";
import { pool } from "./database.js";

const repository = new UserRepository();
await repository.initialize();

const app = createApp(new AuthService(repository));
const port = Number(process.env.PORT ?? 5000);

const server = app.listen(port, () => {
  console.log(`Authentication service listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.close();
    process.exit(0);
  });
}

process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
