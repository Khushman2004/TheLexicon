# The Lexicon Frontend

A responsive, route-based React app for AuthService and the Library, Network, and Chat services. After signing in, each personal library has its own overview and separate pages for the five models: Words, Phrases & Idioms, Reading Spaces, Poetry & Drama, and Custom Models & Research. Community shared libraries use the same five models.

## Run locally

Start AuthService, LibraryService, NetworkService, and ChatService in separate terminals. They must use the same `TheLexicon` database and the updated `Db/TheLexicon.sql` schema. Their default ports are `5000`, `5001`, `5002`, and `5003`.

From this directory:

```powershell
npm install
npm run dev
```

Vite serves the frontend at `http://localhost:5173`. Its development proxy forwards requests to all four services and the `/socket.io` WebSocket to ChatService, so the browser uses one origin locally.

Copy `.env.example` to `.env.local` to override proxy targets. Set `AUTH_SERVICE_TARGET`, `LIBRARY_SERVICE_TARGET`, `NETWORK_SERVICE_TARGET`, or `CHAT_SERVICE_TARGET` when a service uses another host or port.

## Deployment

Set `VITE_AUTH_API_URL` and `VITE_LIBRARY_API_URL` to the origin of each deployed service before building. For example:

```text
VITE_AUTH_API_URL=https://auth.example.com
VITE_LIBRARY_API_URL=https://library.example.com
VITE_NETWORK_API_URL=https://network.example.com
VITE_CHAT_API_URL=https://chat.example.com
```

Configure `CORS_ORIGINS` on all backend services to include the exact frontend origin (comma-separated for multiple origins), such as `https://lexicon.example.com`. ChatService must allow the frontend origin for Socket.IO/WebSocket connections too. Do not use `*` for the origin when sending authorization headers. Rebuild the frontend after changing its `VITE_` variables.

## Using the app

- Create an account or sign in. The bearer token is kept in browser local storage and cleared on sign out or when the API reports an expired session.
- Choose or create a library from the left navigation. The `/libraries` route lists all your libraries; each `/libraries/:libraryId` route has its own model overview.
- Open one of the five model pages from the sidebar. Each model and content type has a bookmarkable URL, and browser back/forward navigation works.
- Add, edit, and delete entries from the model pages. These actions send authenticated `POST`, `PATCH`, and `DELETE` requests to LibraryService; request failures appear in the form or as a notification.
- Reading spaces are books, papers, or articles. Open a reading space to reach its Words, Phrases, and Custom theories subsections, then add notes within the appropriate section.
- From a library overview, make the library and each model public or private independently. A public model is viewable only while its library is public.
- Use **Discover public** in the sidebar to browse other signed-in users' shared libraries and read their public models. Shared content is read-only.
- Open **People & libraries** to search and follow readers, view profiles, browse public libraries, and save a library to **Saved shelves**.
- Open **Community** to discover or create communities, join public communities or use an invitation code, read announcements, and participate in member-only general chat.
- Community members can add typed entries to shared model libraries. Contributors can manage their own entries; the community owner can manage all entries and members. Community activity notifications can be muted individually.
- Edit your profile at **Your profile**. Profile visibility controls whether the profile appears in people search.
- On a private library overview, create a time-limited invite URL. A signed-in recipient requests access; the owner approves or declines requests and can revoke access later. Approved private libraries are read-only and appear in **Saved shelves**.
- **Messages** are live between mutual followers only. Chat history is persisted; online presence is shown only to mutual followers.
- Sign out from the clearly labeled control in the sidebar or top bar.

All library writes are authenticated and scoped to the owner by LibraryService. Public and approved private library reads, network features, and chat require authentication.
