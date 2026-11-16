# Lexicon Library Service

## Run locally

1. Install SQL Server Express and the Microsoft ODBC Driver 17 or 18 for SQL Server.
2. From this directory, run the schema setup through Node.js, then start the service:

```powershell
npm install
npm run db:setup
npm start
```

`npm run db:setup` executes `../../Db/TheLexicon.sql` in batches using Node.js. The setup connects to `master` to create `TheLexicon`, then applies the schema. It preserves data and is safe to rerun; SQL Server Management Studio is not required.

By default, the service uses the supplied SQL Express Windows-auth connection (`Server=localhost\SQLEXPRESS;Database=TheLexicon;Trusted_Connection=True;`). Configure another server/database with `DB_SERVER` and `DB_NAME`, or select an installed ODBC driver with `DB_ODBC_DRIVER`. Windows integrated authentication uses the npm-distributed prebuilt `msnodesqlv8` binary; Visual Studio and Docker are not required. SQL requests time out after 30 seconds by default; set `DB_REQUEST_TIMEOUT_MS` to another positive millisecond value if needed.

The service listens on `http://localhost:5001` by default. Set `PORT` to use a different port. Start AuthService on port 5000; NetworkService on 5002 and ChatService on 5003 can also use the shared database. All services must use the same database so they can validate AuthService bearer tokens. Local frontend development uses the Vite proxy. For direct browser access from a deployed frontend, set `CORS_ORIGINS` to a comma-separated allowlist of exact frontend origins.

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
| PATCH | `/api/libraries/:libraryId` | Rename a library and/or update its visibility |
| GET | `/api/libraries/:libraryId/models` | List the five model visibility settings (owner only) |
| PATCH | `/api/libraries/:libraryId/models/:modelKey` | Update a model visibility setting (owner only) |
| GET | `/api/libraries/public/libraries` | Discover other users' public libraries |
| GET | `/api/libraries/public/libraries/:libraryId` | Get a public library and its public models |
| GET | `/api/libraries/public/libraries/:libraryId/models/:modelKey/entries` | Read entries in a public model; reading-space children use `?parentId=<id>` |
| GET | `/api/libraries/shared/:libraryId` | Get a public or owner-approved private library |
| GET | `/api/libraries/shared/:libraryId/models/:modelKey/entries` | Read a public model or any model in a private library explicitly shared with you |
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

## Visibility and sharing

Libraries and each of the five models are private by default. Only the owner can change visibility or create, edit, and delete entries. A model is discoverable only when both its model and parent library are public. Public library/model reads still require an authenticated bearer token; discovery excludes the signed-in user's own libraries. Changing a library back to private immediately removes it and its models from public reads.

Update a library's visibility with:

```http
PATCH http://localhost:5001/api/libraries/1
```

```json
{ "isPublic": true }
```

The same endpoint accepts `name` and `isPublic` together. Get model keys and current visibility with `GET /api/libraries/1/models`; the keys are `words`, `phrases`, `reading-spaces`, `poetry`, and `research`. For example, share only the words model:

```http
PATCH http://localhost:5001/api/libraries/1/models/words
```

```json
{ "isPublic": true }
```

Signed-in readers can discover public libraries with `GET /api/libraries/public/libraries`, view a library's public models with `GET /api/libraries/public/libraries/1`, and read a model with `GET /api/libraries/public/libraries/1/models/words/entries`. For reading spaces, pass the returned reading-space or section ID as `?parentId=<id>` to browse its default subsections and shared notes. These public endpoints are read-only.

## Data model

Libraries are private by default and have an `IsPublic` flag. `TheLexicon.dbo.LibraryModels` stores one private-by-default visibility row for each of the five models in every library; public model reads also require a public parent library. NetworkService-managed grants allow invited users to read all models of a private library, but do not grant writes. The database assigns each library a per-user `LibraryIndex`, enforced by a unique index on `(UserId, LibraryIndex)`. Typed content is stored in `TheLexicon.dbo.LibraryEntries`; its `EntryType` distinguishes the five models' entry types, and `ParentEntryId` links reading spaces to default sections and sections to their content.

Run `npm run db:setup` after updating to apply the rerunnable schema changes and seed model visibility rows for existing libraries.

The frontend is in `../../Frontend`; see its README for setup.
