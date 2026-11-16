# The Lexicon

The Lexicon is a personal library for collecting words, phrases, reading notes, poetry, and research. It consists of a React frontend, two Node.js/Express backend services, and a Microsoft SQL Server database.

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
- **Backend:** Node.js ES modules, Express 5
- **Database:** Microsoft SQL Server, accessed via `mssql`, `msnodesqlv8`, and Microsoft ODBC Driver 18

## Requirements

Install the following before starting:

- Node.js and npm
- Microsoft SQL Server LocalDB, or another SQL Server instance (for example, SQL Server Express)
- The **64-bit Microsoft ODBC Driver 18 for SQL Server**
- SQL Server Management Studio (SSMS) to run the database script, or `sqlcmd`

The backend defaults to LocalDB at `(localdb)\MSSQLLocalDB`, uses Windows authentication, and connects to the `TheLexicon` database.

## Run from scratch on Windows

### 1. Create or update the database

Run [`Db/TheLexicon.sql`](Db/TheLexicon.sql) in SSMS. It creates the `TheLexicon` database and its schema, preserves existing data, and is safe to run again.

Alternatively, for a SQL Server Express instance named `SQLEXPRESS`, run this in PowerShell:

```powershell
sqlcmd -S ".\SQLEXPRESS" -E -C -i "D:\Lexicon\TheLexicon\Db\TheLexicon.sql"
```

Change the script path if you cloned the repository somewhere else. `-C` allows `sqlcmd` to trust the SQL Server certificate for this local connection.

### 2. Start AuthService

Open a PowerShell terminal:

```powershell
cd D:\Lexicon\TheLexicon\Backend\AuthService
npm install
npm start
```

It listens at `http://localhost:5000` by default. Keep this terminal open.

### 3. Start LibraryService

Open a **second** PowerShell terminal:

```powershell
cd D:\Lexicon\TheLexicon\Backend\LibraryService
npm install
npm start
```

It listens at `http://localhost:5001` by default. Keep this terminal open too.

If you are using SQL Server Express instead of LocalDB, set the instance in **both** backend terminals before starting the service:

```powershell
$env:DB_SERVER = ".\SQLEXPRESS"
npm start
```

The environment variable applies only to that terminal session. AuthService and LibraryService must point to the **same database**.

### 4. Start the frontend

Open a **third** PowerShell terminal:

```powershell
cd D:\Lexicon\TheLexicon\Frontend
npm install
npm run dev
```

Open the Vite URL shown in the terminal (normally `http://localhost:5173`). The Vite development proxy sends `/api/auth` to AuthService and `/api/libraries` to LibraryService.

### 5. Create an account and sign in

Choose **Create account** in the app and enter a username, email, and password. Usernames must be 3–32 letters, numbers, or underscores; passwords must be 8–128 characters. Then sign in with that email and password. There is no preconfigured default account.

## Configuration

Both backend services read these environment variables:

| Variable | Default | Description |
| --- | --- | --- |
| `DB_SERVER` | `(localdb)\MSSQLLocalDB` | SQL Server instance |
| `DB_NAME` | `TheLexicon` | Database name |
| `DB_TRUSTED_CONNECTION` | `true` | Use Windows authentication unless set to `false` |
| `DB_USER` | — | SQL login when `DB_TRUSTED_CONNECTION=false` |
| `DB_PASSWORD` | — | SQL password when `DB_TRUSTED_CONNECTION=false` |
| `PORT` | `5000` for AuthService; `5001` for LibraryService | Service port |

LibraryService also supports `DB_REQUEST_TIMEOUT_MS` (default `30000`). For SQL authentication, set `DB_TRUSTED_CONNECTION=false` and provide `DB_USER` and `DB_PASSWORD`.

The frontend's [`Frontend/.env.example`](Frontend/.env.example) documents optional settings:

- `AUTH_SERVICE_TARGET` and `LIBRARY_SERVICE_TARGET` override the Vite development proxy targets.
- `VITE_AUTH_API_URL` and `VITE_LIBRARY_API_URL` set the API origins used by a built/deployed frontend. Leave them blank for local development through the proxy.

For deployment, configure `CORS_ORIGINS` on **both** backend services to the exact frontend origin(s), comma-separated. Do not use `*` when making authenticated browser requests. Build the frontend after changing its `VITE_` variables.

## Project layout

```text
.
├── Backend/
│   ├── AuthService/       # Registration, login, sessions, user data
│   └── LibraryService/    # Libraries, entry types, ownership and authorization
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

The main frontend routes are:

| URL | Page |
| --- | --- |
| `/libraries` | List or create libraries |
| `/libraries/:libraryId` | Library home and model chooser |
| `/libraries/:libraryId/:modelId/:typeRoute?` | Model and entry-type pages |
| `/libraries/:libraryId/reading-spaces/:spaceId/details` | Reading-space sections |
| `/libraries/:libraryId/reading-spaces/:spaceId/sections/:sectionId` | Entries in a reading-space section |

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

Except for `/health`, LibraryService endpoints require `Authorization: Bearer <token>`. See the service READMEs for endpoint details and example payloads:

- [`Backend/AuthService/README.md`](Backend/AuthService/README.md)
- [`Backend/LibraryService/README.md`](Backend/LibraryService/README.md)
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
```

## Troubleshooting

- **“Server is not found or not accessible” for `(localdb)\MSSQLLocalDB`:** Install/start LocalDB, or use an available SQL Server instance by setting `DB_SERVER` in both backend terminals.
- **Database not found:** Run `Db/TheLexicon.sql` against the same SQL Server instance configured by `DB_SERVER`.
- **Library API returns `500`:** Check the LibraryService terminal for the underlying error. Verify that it is running and uses the same server/database as AuthService.
- **Frontend API request fails:** Keep both backend services running, check the Vite proxy targets, and confirm the backend ports.
- **Sign-in or registration fails:** Confirm the database script was applied and check the AuthService terminal.
