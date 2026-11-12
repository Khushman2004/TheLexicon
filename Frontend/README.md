# The Lexicon Frontend

A responsive, route-based React app for AuthService and LibraryService. After signing in, each library has its own overview and separate pages for the five models: Words, Phrases & Idioms, Reading Spaces, Poetry & Drama, and Custom Models & Research.

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
- Choose or create a library from the left navigation. The `/libraries` route lists all your libraries; each `/libraries/:libraryId` route has its own model overview.
- Open one of the five model pages from the sidebar. Each model and content type has a bookmarkable URL, and browser back/forward navigation works.
- Add, edit, and delete entries from the model pages. These actions send authenticated `POST`, `PATCH`, and `DELETE` requests to LibraryService; request failures appear in the form or as a notification.
- Reading spaces are books, papers, or articles. Open a reading space to reach its Words, Phrases, and Custom theories subsections, then add notes within the appropriate section.
- Sign out from the clearly labeled control in the sidebar or top bar.

All library access is authenticated and scoped to the signed-in user by LibraryService.
