# Lexicon Library Service

## Run locally

1. Execute `../../Db/TheLexicon.sql` in SQL Server Management Studio. It creates or updates the shared schema, preserves existing data, and is safe to rerun.
2. Ensure the 64-bit Microsoft ODBC Driver 18 for SQL Server and SQL Server LocalDB are installed, or set `DB_SERVER` to your SQL Server instance.
3. From this directory, install dependencies and start the service:

```powershell
npm install
npm start
```

By default, the service connects to `(localdb)\MSSQLLocalDB` using Windows authentication and database `TheLexicon`. Configure another instance or database with `DB_SERVER` and `DB_NAME`. For SQL authentication, set `DB_TRUSTED_CONNECTION=false`, `DB_USER`, and `DB_PASSWORD`. SQL requests time out after 30 seconds by default; set `DB_REQUEST_TIMEOUT_MS` to another positive millisecond value if needed.

The service listens on `http://localhost:5001` by default. Set `PORT` to use a different port. Start AuthService separately on port 5000. Both services must use the same database so LibraryService can validate AuthService bearer tokens. Local frontend development uses the Vite proxy. For direct browser access from a deployed frontend, set `CORS_ORIGINS` to a comma-separated allowlist of exact frontend origins.

## Library models

After selecting a library, its contents are organized into five models:

1. **Words** — words.
2. **Phrases and idioms** — phrases and idioms.
3. **Reading spaces** — books, papers, and articles. Every reading space is created with `Words`, `Phrases`, and `Custom theories` subsections.
4. **Poetry and drama** — poems, poetic devices, and plays.
5. **Custom research** — custom models, theories, and research.

The existing custom collections endpoint remains available for compatibility.

## Endpoints

All library endpoints require `Authorization: Bearer <token>`. `/health` is public. Paths are centralized in `src/config/endpoints.js`; typed modules have route files under `src/modules/`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Service health |
| GET | `/api/libraries` | List the signed-in user's libraries |
| POST | `/api/libraries` | Create a library |
| GET | `/api/libraries/:libraryId` | Get a library |
| PATCH | `/api/libraries/:libraryId` | Rename a library |
| GET | `/api/libraries/:libraryId/entries` | List all root entries or entries under `?parentId=<id>` |
| GET, POST | `/api/libraries/:libraryId/words` | List or add words |
| GET, POST | `/api/libraries/:libraryId/phrases` | List or add phrases |
| GET, POST | `/api/libraries/:libraryId/idioms` | List or add idioms |
| GET, POST | `/api/libraries/:libraryId/reading-spaces` | List reading spaces or create a book, paper, or article |
| GET | `/api/libraries/:libraryId/reading-spaces/:readingSpaceId/sections` | List the three default subsections |
| GET, POST | `/api/libraries/:libraryId/books` | List or add books |
| GET, POST | `/api/libraries/:libraryId/papers` | List or add papers |
| GET, POST | `/api/libraries/:libraryId/articles` | List or add articles |
| GET, POST | `/api/libraries/:libraryId/poems` | List or add poems |
| GET, POST | `/api/libraries/:libraryId/poetic-devices` | List or add poetic devices |
| GET, POST | `/api/libraries/:libraryId/plays` | List or add plays |
| GET, POST | `/api/libraries/:libraryId/custom-models` | List or add custom models |
| GET, POST | `/api/libraries/:libraryId/theories` | List or add theories |
| GET, POST | `/api/libraries/:libraryId/research` | List or add research notes |
| GET, POST | `/api/libraries/:libraryId/collections` | List or add legacy custom collections |
| PATCH, DELETE | `.../:entryId` on a typed endpoint | Update or delete an entry of that type |

Typed list endpoints accept `?parentId=<id>` to list items inside a reading-space subsection or custom collection. Creating a child entry uses `parentEntryId`. The service checks that the parent belongs to the same user's library and allows only the matching child types in default reading-space sections: words in `Words`, phrases/idioms in `Phrases`, and theories in `Custom theories`.

Reading spaces create their three subsections in the same database transaction. The schema migration also adds missing subsections to existing books, papers, and articles and moves legacy direct word/phrase/idiom/theory entries into the matching subsection. The database script can be rerun safely.

## Payload examples

Use the token returned by AuthService in the header:

```http
Authorization: Bearer <token>
Content-Type: application/json
```

Create a library:

```http
POST http://localhost:5001/api/libraries
```

```json
{ "name": "My language notebook" }
```

Create reading spaces; `readingSpaceType` must be `BOOK`, `PAPER`, or `ARTICLE`. The response contains the created `readingSpace` and its `sections`, including IDs to use as `parentEntryId`:

```http
POST http://localhost:5001/api/libraries/1/reading-spaces
```

```json
{
  "readingSpaceType": "BOOK",
  "title": "The Left Hand of Darkness",
  "url": "https://example.com/book",
  "content": "Notes about this book."
}
```

Add words, phrases, idioms, or theories to their corresponding reading-space subsection:

```http
POST http://localhost:5001/api/libraries/1/words
```

```json
{
  "title": "serendipity",
  "content": "The occurrence of a fortunate discovery.",
  "parentEntryId": 12
}
```

Create any other typed entry using the same body shape; `content`, `url`, and `parentEntryId` are optional:

```json
{ "title": "A useful title", "content": "Notes or definition.", "url": "https://example.com/source" }
```

For books, papers, and articles created through their typed routes, the three default subsections are also created automatically.

The following typed endpoints accept that common payload:

| POST path | Entry created |
| --- | --- |
| `/api/libraries/1/words` | Word |
| `/api/libraries/1/phrases` | Phrase |
| `/api/libraries/1/idioms` | Idiom |
| `/api/libraries/1/books` | Book with default subsections |
| `/api/libraries/1/papers` | Paper with default subsections |
| `/api/libraries/1/articles` | Article with default subsections |
| `/api/libraries/1/poems` | Poem |
| `/api/libraries/1/poetic-devices` | Poetic device |
| `/api/libraries/1/plays` | Play |
| `/api/libraries/1/custom-models` | Custom model |
| `/api/libraries/1/theories` | Theory |
| `/api/libraries/1/research` | Research note |
| `/api/libraries/1/collections` | Custom collection |

Update a typed entry by sending only the fields to change:

```http
PATCH http://localhost:5001/api/libraries/1/words/12
```

```json
{ "content": "Updated definition or notes." }
```

Delete an entry with `DELETE` to the same typed URL. A reading space or collection with child entries must be emptied before it can be deleted.

## Data model

Libraries are private to their owner. The database assigns each library a per-user `LibraryIndex`, enforced by a unique index on `(UserId, LibraryIndex)`. Typed content is stored in `TheLexicon.dbo.LibraryEntries`; its `EntryType` distinguishes the five models' entry types, and `ParentEntryId` links reading spaces to default sections and sections to their content.

The frontend is in `../../Frontend`; see its README for setup.
