# Lexicon Chat Service

ChatService is a separate REST and Socket.IO microservice for persisted one-to-one conversations, live community chat, community membership, announcements, and online presence. It shares SQL Server and hashed AuthService sessions with the other services.

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

REST requests require `Authorization: Bearer <token>`. Socket.IO connects with `{ auth: { token } }`. The service revalidates the session before joining a conversation or community and before every message. Chat requests can be sent to another user; only the recipient can accept or decline. Accepted requests grant both users access to the conversation. Existing mutual-follower conversations remain available. Presence is only sent to mutual followers.

Communities can be public or private. Only members can read community content or join its chat. Public communities can be joined directly; private communities require a valid invitation code. The community owner can change member roles, remove members, and delete the community. Owners and admins can manage invitations and announcements.

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
| GET | `/api/chat/communities` | List communities you belong to |
| GET | `/api/chat/communities/public` | Discover public communities |
| POST | `/api/chat/communities` | Create a community |
| GET | `/api/chat/communities/:communityId` | Read community details |
| POST | `/api/chat/communities/:communityId/join` | Join a public community |
| POST | `/api/chat/communities/join-by-code` | Join with `{ "code": "..." }` |
| DELETE | `/api/chat/communities/:communityId/membership` | Leave a community; the owner must delete it instead |
| DELETE | `/api/chat/communities/:communityId` | Delete a community (owner only) |
| GET, PATCH | `/api/chat/communities/:communityId/notification-settings` | Read or update `{ "isMuted": true }` for your community activity notifications |
| GET | `/api/chat/communities/:communityId/members` | List members |
| PATCH, DELETE | `/api/chat/communities/:communityId/members/:memberId` | Change a role or remove a member (owner only) |
| GET, POST | `/api/chat/communities/:communityId/invites` | List or create invitations (owners and admins) |
| DELETE | `/api/chat/communities/:communityId/invites/:inviteId` | Revoke an invitation (owners and admins) |
| GET, POST | `/api/chat/communities/:communityId/announcements` | List or publish announcements (owners and admins can publish) |
| PATCH, DELETE | `/api/chat/communities/:communityId/announcements/:announcementId` | Update or remove an announcement (owners and admins) |
| GET, POST | `/api/chat/communities/:communityId/messages` | Read or send community chat messages |

Community creation accepts a JSON body with `name`, `genre`, optional `description`, and `privacy` (`PUBLIC` or `PRIVATE`). Invitation creation returns a code to share; codes can be revoked after creation.

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
- `joinCommunity`: send `{ communityId }`; only current members can join that community's Socket.IO room.
- `sendCommunityMessage`: send `{ communityId, body }`; the acknowledgement returns `{ ok, message }` or `{ ok: false, error }`.
- `newCommunityMessage`: server broadcasts the persisted message to members in that community room.

Direct and community messages are limited to 4,000 characters and history is paginated with 50 messages per request. Chat requests, incoming messages, and community activity create notifications in `dbo.Notifications`; recipients can mute community activity individually. `Db/TheLexicon.sql` creates and updates the conversation, request, community, message, and notification tables idempotently.
