# Lexicon Network Service

The NetworkService owns social profiles, public discovery, follows, saved public libraries, and private-library sharing approvals. It uses the same SQL Server database and hashed sessions as AuthService and LibraryService.

## Run locally

Install LibraryService's dependencies and apply the current schema before starting:

```powershell
cd ..\LibraryService
npm install
npm run db:setup
cd ..\NetworkService
```

In this directory:

```powershell
npm install
npm start
```

The NetworkService reuses LibraryService's shared SQL connection adapter, so install LibraryService first. Configure `DB_SERVER`, `DB_NAME`, and `DB_ODBC_DRIVER` as for the other services. The service listens on port `5002` by default; `PORT` overrides it. Authenticated browser deployments must set `CORS_ORIGINS` to a comma-separated list of exact frontend origins.

## Permissions

Every endpoint requires `Authorization: Bearer <token>` issued by AuthService. Profile and public-library discovery respects profile visibility. Following is available for public profiles; a user cannot follow themself. Chat access is allowed only when the relationship is mutual. Private library links are random, hashed, expire in at most seven days, and can be revoked. Opening an invite only creates an access request; only the library owner can approve it. A grant exposes the private library read-only. Its owner can later revoke the grant.

## Endpoints

All paths are prefixed with `/api/network`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET, PATCH | `/profile` | Get or update your profile |
| GET | `/notifications` | List the latest 100 notifications and unread count |
| PATCH | `/notifications/:notificationId/read` | Mark one notification as read |
| PATCH | `/notifications/read-all` | Mark all notifications as read |
| GET | `/users?search=<term>` | Search public profiles |
| GET | `/users/:userId` | View a profile and its public libraries |
| POST, DELETE | `/users/:userId/follow` | Follow or unfollow a public profile |
| GET | `/connections/followers` or `/connections/following` | List your connections; optional `?userId=<id>` lists a visible profile's connections |
| GET | `/libraries/discover` | Discover public libraries |
| GET | `/libraries/saved` | List saved public libraries |
| GET | `/libraries/shared` | List private libraries shared with you |
| POST, DELETE | `/libraries/:libraryId/save` | Save or unsave a visible library; POST responds with `{ "saved": true }` |
| GET, POST | `/libraries/:libraryId/invites` | List or create private library invites (owner) |
| DELETE | `/libraries/:libraryId/invites/:inviteId` | Revoke an invite (owner) |
| GET | `/invitations/:token` | View a valid invite |
| POST | `/invitations/:token/requests` | Request access; owner approval required |
| GET | `/libraries/:libraryId/access-requests` | List requests (owner) |
| PATCH | `/libraries/:libraryId/access-requests/:requestId` | Approve or decline a request (owner) |
| GET | `/libraries/:libraryId/access` | List access grants (owner) |
| DELETE | `/libraries/:libraryId/access/:userId` | Revoke a grant (owner) |

Profile updates accept any combination of `fullName` (100 characters), `bio` (500 characters), `avatarUrl` (HTTP(S), 2048 characters), and `isPublic` (boolean). Private library invite creation accepts `{ "expiresInHours": 168 }`; values from 1 through 168 are supported. The create response returns a one-time raw token; save or share the returned URL because the database stores only its hash.

To approve or decline:

```http
PATCH /api/network/libraries/7/access-requests/12
Content-Type: application/json

{ "decision": "APPROVED" }
```

## Data

Notifications are recorded for new followers, private-library access requests and decisions, and incoming chat messages. The rerunnable `Db/TheLexicon.sql` script creates `Notifications` alongside `UserFollows`, `SavedLibraries`, `LibraryInvites`, `LibraryAccessRequests`, and `LibraryAccessGrants`. It preserves existing data. The service does not store raw session tokens or invite tokens.
