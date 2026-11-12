# Lexicon Library Service

## Run locally

1. Execute `../../Db/TheLexicon.sql` in SQL Server Management Studio. It creates or updates the shared schema, preserves existing data, and is safe to rerun.
2. Ensure the 64-bit Microsoft ODBC Driver 18 for SQL Server and SQL Server LocalDB are installed, or set `DB_SERVER` to your SQL Server instance.
3. From this directory, install dependencies and start the service:

```powershell
npm install
npm start
```

By default, the service connects to `(localdb)\MSSQLLocalDB` using Windows authentication and database `TheLexicon`. Configure another instance or database with `DB_SERVER` and `DB_NAME`. For SQL authentication, set `DB_TRUSTED_CONNECTION=false`, `DB_USER`, and `DB_PASSWORD`. SQL requests time out after 30 seconds by default; set `DB_REQUEST_TIMEOUT_MS` to a different positive millisecond value if your database needs longer.

The service listens on `http://localhost:5001` by default. Set `PORT` to use a different port. Start AuthService separately on port 5000. Both services must use the same database so LibraryService can validate AuthService bearer tokens. For direct browser access from a deployed frontend, set `CORS_ORIGINS` to a comma-separated allowlist of exact frontend origins. Local frontend development uses the Vite proxy.

## Modules and endpoints

All paths are centralized in `src/config/endpoints.js`. Each module has its own route file under `src/modules/`.

All library endpoints below require `Authorization: Bearer <token>`. `/health` is public.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Check whether the service is running |
| GET | `/api/libraries` | List the signed-in user's libraries |
| POST | `/api/libraries` | Create a library (`{"name":"Reading list"}`) |
| GET | `/api/libraries/:libraryId` | Get a library owned by the signed-in user |
| PATCH | `/api/libraries/:libraryId` | Rename a library |
| GET | `/api/libraries/:libraryId/entries` | List all entry types in a library or inside a book/collection |
| GET, POST | `/api/libraries/:libraryId/words` | List or add words |
| GET, POST | `/api/libraries/:libraryId/phrases` | List or add phrases |
| GET, POST | `/api/libraries/:libraryId/idioms` | List or add idioms |
| GET, POST | `/api/libraries/:libraryId/books` | List or add books |
| GET, POST | `/api/libraries/:libraryId/articles` | List or add articles |
| GET, POST | `/api/libraries/:libraryId/collections` | List or add custom collections |
| PATCH, DELETE | `.../:entryId` | Update or delete an entry of that module's type |

Entries accept a required `title`, optional `content`, and optional HTTP(S) `url`. Add a word, phrase, or idiom inside a book or collection by passing its ID as `parentEntryId` in the create request. Filter a module's list to a container with `?parentId=<id>`. Books can contain words, phrases, and idioms; custom collections can contain words, phrases, idioms, books, and articles. Containers with child entries cannot be deleted until their contents are removed.

The combined entries endpoint returns all entry types in a single request; use it for an unfiltered library view. Type-specific routes remain available when only one module is needed.

Example:

```http
POST http://localhost:5001/api/libraries/1/books
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "The Lexicon",
  "url": "https://example.com/book"
}
```

```http
POST http://localhost:5001/api/libraries/1/words
Authorization: Bearer <token>
Content-Type: application/json

{
  "title": "example",
  "content": "A representative instance.",
  "parentEntryId": 10
}
```

Libraries are private to their owner. The database assigns each library a per-user `LibraryIndex`, enforced by a unique index on `(UserId, LibraryIndex)`. The schema stores entries in `TheLexicon.dbo.LibraryEntries`, with a type for each module and parent links for book and collection contents.

The frontend is in `../../Frontend`; see its README for the full sign-in-to-library flow.
