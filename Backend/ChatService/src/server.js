import { createApp } from "./app.js";
import { pool } from "./database.js";
import { AuthenticationRepository } from "./repositories/authenticationRepository.js";
import { ChatRepository } from "./repositories/chatRepository.js";
import { AuthenticationService } from "./services/authenticationService.js";
import { ChatService } from "./services/chatService.js";

await pool.connect();
await pool.request().query("SELECT 1;");
const authenticationService = new AuthenticationService(new AuthenticationRepository());
const chatService = new ChatService(new ChatRepository());
const { server } = createApp(authenticationService, chatService);
const port = Number(process.env.PORT ?? 5003);
server.listen(port, () => {
  console.log(`Chat service listening on http://localhost:${port}`);
});

async function shutdown() {
  server.close(async () => {
    await pool.close();
    process.exit(0);
  });
}
process.once("SIGINT", shutdown);
process.once("SIGTERM", shutdown);
