# The Lexicon Frontend

A responsive React app for the AuthService and LibraryService. It follows the user's path from creating an account or signing in, to choosing a library, then collecting and organizing words, phrases, idioms, books, articles, and custom collections.

## Run locally

Start AuthService and LibraryService in separate terminals first. Both must use the same `TheLexicon` database and the updated `Db/TheLexicon.sql` schema. AuthService listens on port `5000`; LibraryService listens on port `5001`.

From this directory:

```powershell
npm install
npm run dev
```

Vite serves the frontend at `http://localhost:5173`. Its development proxy forwards `/api/auth` to AuthService and `/api/libraries` to LibraryService, so the browser uses one origin locally.

Copy `.env.example` to `.env.local` to override proxy targets. For example, set `AUTH_SERVICE_TARGET` and `LIBRARY_SERVICE_TARGET` if either service listens on a different host or port.

## Deployment

Set `VITE_AUTH_API_URL` and `VITE_LIBRARY_API_URL` to the origin of each deployed service before building. For example:

```text
VITE_AUTH_API_URL=https://auth.example.com
VITE_LIBRARY_API_URL=https://library.example.com
```

Configure `CORS_ORIGINS` on **both** backend services to include the exact frontend origin (comma-separated for multiple origins), such as `https://lexicon.example.com`. Do not use `*` for the origin when sending authorization headers. Rebuild the frontend after changing its `VITE_` variables.

## Using the app

- Create an account or sign in. The bearer token is kept in browser local storage and cleared on sign out or when the API reports an expired session.
- Choose or create a library from the left navigation. New accounts receive a default library from AuthService.
- Use the type filters or search to browse your entries. Add and edit entries with an optional note and source URL.
- Open a book or custom collection to view its contents. Add words, phrases, or idioms within books; collections can contain words, phrases, idioms, books, and articles.

All library access is authenticated and scoped to the signed-in user by LibraryService.
