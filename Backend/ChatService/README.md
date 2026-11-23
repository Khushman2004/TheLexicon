# Lexicon Chat Service

ChatService is a separate REST and Socket.IO microservice for persisted one-to-one conversations, live messages, and online presence. It shares SQL Server and hashed AuthService sessions with the other services.

## Run locally

Install LibraryService's dependencies and apply the latest database schema:

```powershell
cd ..\LibraryService
npm install
npm run db:setup
cd ..\ChatService
```

Then from this directory:

```powershell
npm install
npm start
```

ChatService reuses LibraryService's shared SQL connection adapter, so install LibraryService first. Configure the same `DB_SERVER`, `DB_NAME`, and `DB_ODBC_DRIVER` as the other services. The service listens on port `5003` by default; set `PORT` to override it. Set `CORS_ORIGINS` to exact deployed frontend origins when accessing it directly.

## Authorization

REST requests require `Authorization: Bearer <token>`. Socket.IO connects with `{ auth: { token } }`. The service revalidates the session before joining a conversation and before every message. Chat requests can be sent to another user; only the recipient can accept or decline. Accepted requests grant both users access to the conversation. Existing mutual-follower conversations remain available. Presence is only sent to mutual followers.

## REST endpoints

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Service health |
| GET | `/api/chat/conversations` | List conversations available through mutual following or accepted chat requests |
| POST | `/api/chat/conversations` | Find or create a conversation using `{ "recipientId": 2 }` |
| GET | `/api/chat/requests/status/:otherUserId` | Get your request status with another user |
| POST | `/api/chat/requests` | Send a chat request using `{ "recipientId": 2 }` |
| PATCH | `/api/chat/requests/:requestId` | Accept or decline using `{ "decision": "ACCEPTED" }` or `{ "decision": "DECLINED" }` |
| GET | `/api/chat/conversations/:conversationId/messages` | Read the latest 50 messages; optional `?before=<messageId>` |
| POST | `/api/chat/conversations/:conversationId/messages` | Send `{ "body": "Hello." }` |

## Socket.IO events

Connect to the service origin (or the same-origin Vite `/socket.io` proxy) using the bearer token:

```js
const socket = io("http://localhost:5003", { auth: { token } });
```

- `presenceSnapshot`: server sends the currently online mutual follower IDs at connection.
- `presenceUpdate`: `{ userId, isOnline }` for mutual followers.
- `joinConversation`: send `{ conversationId }`; the acknowledgement is `{ ok, error? }`. The server validates that the chat was accepted or is between mutual followers.
- `sendMessage`: send `{ conversationId, body }`; the acknowledgement returns `{ ok, message }` or `{ ok: false, error }`.
- `newMessage`: server broadcasts the persisted message to both participants.

Messages are limited to 4,000 characters, stored in `dbo.ChatMessages`, and history is paginated with 50 messages per request. Chat requests and message events create notifications for the recipient in `dbo.Notifications`. `Db/TheLexicon.sql` creates and updates the conversation, request, message, and notification tables idempotently.
