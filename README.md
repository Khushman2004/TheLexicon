# The Lexicon

The Lexicon is a personal library for collecting words, phrases, reading notes, poetry, and research. It consists of a React frontend, four Node.js/Express backend services, and a Microsoft SQL Server database.

## Features

- Register, sign in, and sign out with email and password.
- Create multiple private libraries and rename them.
- Organize entries into five models:
  - **Words**
  - **Phrases & idioms**
  - **Reading spaces** for books, papers, and articles
  - **Poetry & drama** for poems, poetic devices, and plays
  - **Custom models & research** for custom models, theories, and research notes
- Search and sort entries; add, edit, and delete entries.
- Open a reading space's **Words**, **Phrases**, and **Custom theories** sections to keep notes with the book, paper, or article.
- Navigate using bookmarkable URLs and browser back/forward controls.

## Technology

- **Frontend:** React 18, React Router, Vite, and Lucide icons
- **Backend:** Node.js ES modules, Express 5, Socket.IO
- **Database:** Microsoft SQL Server, accessed via `mssql`, `msnodesqlv8`, and Microsoft ODBC Driver 17 or 18

## Requirements

Install the following before starting:

- Node.js 22 or newer and npm
- Microsoft SQL Server Express (or another SQL Server instance)
- Microsoft ODBC Driver 17 or 18 for SQL Server
- Visual Studio C++ Build Tools if the native SQL driver needs to build from source

The backend defaults to SQL Server Express at `localhost\SQLEXPRESS`, uses Windows authentication, and connects to the `TheLexicon` database.

## Run from scratch on Windows

### 1. Create or update the database

For a SQL Server Express instance named `SQLEXPRESS`, apply the database script through Node.js. From PowerShell:

```powershell
cd D:\Lexicon\TheLexicon\Backend\LibraryService
npm install
npm run db:setup
```

The setup uses the current `DB_SERVER` and `DB_NAME` settings, creates or updates the database, preserves existing data, and is safe to rerun. SQL Server Management Studio is not required.

### 2. Start all backend services

After installing dependencies in each service folder, start all four services from PowerShell:

```powershell
cd D:\Lexicon\TheLexicon
.\Backend\start-all.ps1
```

The script opens a separate terminal for AuthService, LibraryService, NetworkService, and ChatService so each service's output remains visible. Close each terminal window to stop its service. To set a non-default SQL Server instance, set `$env:DB_SERVER` in the same PowerShell window before running the script.

To start services individually instead, use the commands below.

### 3. Start AuthService

Open a PowerShell terminal:

```powershell
cd D:\Lexicon\TheLexicon\Backend\AuthService
npm install
npm start
```

It listens at `http://localhost:5000` by default. Keep this terminal open.

### 4. Start LibraryService

Open a **second** PowerShell terminal:

```powershell
cd D:\Lexicon\TheLexicon\Backend\LibraryService
npm install
npm start
```

It listens at `http://localhost:5001` by default. Keep this terminal open too.

### 5. Start NetworkService

Open another PowerShell terminal:

```powershell
cd D:\Lexicon\TheLexicon\Backend\NetworkService
npm install
npm start
```

It listens at `http://localhost:5002` by default. It provides profiles, follows, saved public libraries, private-library access requests, and owner approvals.

### 6. Start ChatService

Open another PowerShell terminal:

```powershell
cd D:\Lexicon\TheLexicon\Backend\ChatService
npm install
npm start
```

It listens at `http://localhost:5003` by default. It provides persistent, live one-to-one chat and online presence for mutual followers.

All four services must use the **same database**. If needed, set the SQL Server Express instance in each backend terminal:

```powershell
$env:DB_SERVER = ".\SQLEXPRESS"
npm start
```

The environment variable applies only to that terminal session. NetworkService and ChatService reuse LibraryService's shared SQL adapter and do not install duplicate native SQL drivers.

### 7. Start the frontend

Open another PowerShell terminal:

```powershell
cd D:\Lexicon\TheLexicon\Frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). Vite proxies REST requests to all four services and `/socket.io` to ChatService.

### 8. Create an account and sign in

Choose **Create account** in the app and enter a username, email, and password. Usernames must be 3–32 letters, numbers, or underscores; passwords must be 8–128 characters. Then sign in with that email and password. There is no preconfigured default account.

## Configuration

All backend services read these environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `DB_SERVER` | `localhost\SQLEXPRESS` | SQL Server instance |
| `DB_NAME` | `TheLexicon` | Database name |
| `DB_ODBC_DRIVER` | `ODBC Driver 17 for SQL Server` | Installed SQL Server ODBC driver |
| `PORT` | `5000` Auth; `5001` Library; `5002` Network; `5003` Chat | Service port |

LibraryService also supports `DB_REQUEST_TIMEOUT_MS` (default `30000`). All services use Windows trusted authentication and must use the same SQL Express instance and database.

The frontend's [`Frontend/.env.example`](Frontend/.env.example) documents optional settings:

- `AUTH_SERVICE_TARGET`, `LIBRARY_SERVICE_TARGET`, `NETWORK_SERVICE_TARGET`, and `CHAT_SERVICE_TARGET` override Vite proxy targets.
- `VITE_AUTH_API_URL`, `VITE_LIBRARY_API_URL`, `VITE_NETWORK_API_URL`, and `VITE_CHAT_API_URL` set API origins for deployed builds. Leave them blank for local proxy development.

For deployment, configure `CORS_ORIGINS` on all backend services to the exact frontend origin(s), comma-separated. ChatService must allow the frontend origin for Socket.IO. Do not use `*` for authenticated browser requests. Build the frontend after changing its `VITE_` variables.

## Project layout

```text
.
├── Backend/
│   ├── AuthService/       # Registration, login, sessions, user data
│   ├── LibraryService/    # Libraries, entry types, ownership and authorization
│   ├── NetworkService/    # Profiles, follows, discovery, private-library sharing
│   └── ChatService/       # Persisted live chat and mutual-follower presence
├── Db/
│   └── TheLexicon.sql     # Idempotent database/schema setup and updates
├── Frontend/
│   ├── src/
│   │   ├── components/    # Authentication and create/edit dialogs
│   │   ├── pages/         # Library, model, and reading-space screens
│   │   ├── App.jsx        # Shared app state, shell, and client-side routes
│   │   ├── api.js         # Frontend API helpers
│   │   └── catalog.js     # Entry types and model metadata
│   └── README.md          # Frontend-specific setup and deployment notes
└── README.md
```

## How the application works

1. The frontend authenticates through AuthService. It stores the returned bearer token in browser local storage.
2. AuthService verifies credentials and persists users and hashed session tokens. Tokens expire after 24 hours; only token hashes are stored.
3. The frontend sends authenticated library requests to LibraryService. LibraryService checks the token against the shared database and scopes libraries and entries to the signed-in user.
4. LibraryService stores typed content in `dbo.LibraryEntries`; parent-entry links represent reading-space sections and their contents.
5. NetworkService manages profiles and follow relationships. Private-library invitations are hashed, expire, and require owner approval before granting read-only access.
6. ChatService validates shared sessions and mutual follows for every conversation and message. Socket.IO pushes persisted messages and mutual-follower presence.

The main frontend routes are:

| URL | Page |
| --- | --- |
| `/libraries` | List or create libraries |
| `/libraries/:libraryId` | Library home and model chooser |
| `/libraries/:libraryId/:modelId/:typeRoute?` | Model and entry-type pages |
| `/libraries/:libraryId/reading-spaces/:spaceId/details` | Reading-space sections |
| `/libraries/:libraryId/reading-spaces/:spaceId/sections/:sectionId` | Entries in a reading-space section |
| `/network` | Search readers, follow them, discover public libraries |
| `/profiles/:userId` | View a reader profile and public shelves |
| `/connections/:userId/followers` | View a profile's followers |
| `/connections/:userId/following` | View who a profile follows |
| `/notifications` | Review follows, private-library access requests/decisions, and incoming messages |
| `/saved` | View saved public libraries and approved private shares |
| `/share/:token` | Request owner-approved access to a private library |
| `/messages` | Live conversations with mutual followers |

## API overview

AuthService (`http://localhost:5000`):

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `POST` | `/api/auth/register` | Create an account and initial library |
| `POST` | `/api/auth/login` | Sign in and receive a bearer token |
| `GET` | `/api/auth/me` | Get the current user |
| `POST` | `/api/auth/logout` | Revoke the current session |

LibraryService (`http://localhost:5001`):

| Method | Endpoint | Purpose |
| --- | --- | --- |
| `GET` | `/health` | Health check |
| `GET`, `POST` | `/api/libraries` | List or create libraries |
| `GET`, `PATCH` | `/api/libraries/:libraryId` | Get or rename a library |
| `GET` | `/api/libraries/:libraryId/entries` | List root entries or entries under a numeric `parentId` |
| `GET`, `POST` | `/api/libraries/:libraryId/{words,phrases,idioms,books,papers,articles,poems,poetic-devices,plays,custom-models,theories,research,collections}` | List or create typed entries |
| `GET`, `POST` | `/api/libraries/:libraryId/reading-spaces` | List or create books, papers, and articles as reading spaces |
| `PATCH`, `DELETE` | `/api/libraries/:libraryId/:entryType/:entryId` | Update or delete a typed entry |
| `GET` | `/api/libraries/:libraryId/models` | List model visibility settings |
| `PATCH` | `/api/libraries/:libraryId/models/:modelKey` | Update model visibility |
| `GET` | `/api/libraries/public/libraries/:libraryId` | Read a public library |
| `GET` | `/api/libraries/public/libraries/:libraryId/models/:modelKey/entries` | Read a public model |
| `GET` | `/api/libraries/shared/:libraryId` | Read a public or owner-approved shared library |
| `GET` | `/api/libraries/shared/:libraryId/models/:modelKey/entries` | Read a public or explicitly shared model |

NetworkService (`http://localhost:5002`) provides authenticated profile editing/search, follows, public library discovery and saving, owner-approved private-library invitations, and notifications. ChatService (`http://localhost:5003`) provides authenticated conversation history and mutual-follower-only Socket.IO messages and online presence; incoming messages create notifications. Their complete endpoint and event contracts are in the linked service READMEs below.

Except for `/health`, authenticated endpoints across LibraryService, NetworkService, and ChatService require `Authorization: Bearer <token>`; Socket.IO uses the same token in its handshake auth object. See the service READMEs for endpoint details and example payloads:

- [`Backend/AuthService/README.md`](Backend/AuthService/README.md)
- [`Backend/LibraryService/README.md`](Backend/LibraryService/README.md)
- [`Backend/NetworkService/README.md`](Backend/NetworkService/README.md)
- [`Backend/ChatService/README.md`](Backend/ChatService/README.md)
- [`Frontend/README.md`](Frontend/README.md)

## Build and health checks

Build the frontend:

```powershell
cd D:\Lexicon\TheLexicon\Frontend
npm run build
```

With the services running, check their health endpoints in a browser or with `curl`:

```text
http://localhost:5000/health
http://localhost:5001/health
http://localhost:5002/health
http://localhost:5003/health
```

## Troubleshooting

- **SQL Server unavailable:** Verify that the SQL Server service for `SQLEXPRESS` is running. If needed, start it from an elevated PowerShell terminal with `Start-Service -Name 'MSSQL$SQLEXPRESS'`. The default connection targets this instance; other SQL Server instances have separate databases and data.
- **Native SQL driver install fails:** Use Node.js 22 or newer and install the Visual Studio C++ Build Tools workload if npm falls back to compiling the driver.
- **Database not found or social tables missing:** Run `npm run db:setup` from `Backend\LibraryService` against the same SQL Server instance configured by `DB_SERVER`.
- **Library API returns `500`:** Check the LibraryService terminal for the underlying error. Verify that it is running and uses the same server/database as AuthService.
- **Frontend API request or chat connection fails:** Keep all four backend services running, check the Vite proxy targets, and confirm the backend ports.
- **Sign-in or registration fails:** Confirm the database script was applied and check the AuthService terminal.
