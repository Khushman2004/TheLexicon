# Lexicon Auth Service

## Run locally

1. Install SQL Server Express and the Microsoft ODBC Driver 17 or 18 for SQL Server.
2. From `../LibraryService`, run `npm run db:setup` once. This executes `../../Db/TheLexicon.sql` through Node.js, creates or updates the `TheLexicon` database, preserves existing data, and is safe to rerun. SQL Server Management Studio is not required.
3. From this directory, install dependencies and start the service:

```powershell
npm install
npm start
```

By default, the service uses the supplied SQL Express Windows-auth connection (`Server=localhost\SQLEXPRESS;Database=TheLexicon;Trusted_Connection=True;`). The setup command connects to `master` to create the database; the service connects to `TheLexicon`. Configure another server or database with `DB_SERVER` and `DB_NAME`, and choose an installed ODBC driver with `DB_ODBC_DRIVER`. Windows integrated authentication uses `msnodesqlv8`. If npm falls back to compiling its native driver, install Visual Studio C++ Build Tools with the **Desktop development with C++** workload; the service pins `node-gyp` for newer Visual Studio versions. Docker is not required.

The service listens on `http://localhost:5000` by default. Set `PORT` to use a different port. For direct browser access from a deployed frontend, set `CORS_ORIGINS` to a comma-separated allowlist of exact frontend origins. Local frontend development uses the Vite proxy.

## Endpoints

Endpoint paths are centralized in `src/config/endpoints.js`.

| Method | Path | Purpose |
| --- | --- | --- |
| GET | `/health` | Check whether the service is running |
| POST | `/api/auth/register` | Create an account and return a bearer token |
| POST | `/api/auth/login` | Sign in and return a bearer token |
| GET | `/api/auth/me` | Return the current user; requires a bearer token |
| POST | `/api/auth/logout` | Revoke the current bearer token |

Register with JSON containing `username`, `email`, and `password`. Optional profile properties are `fullName`, `bio`, and `avatarUrl`. Passwords must be 8–128 characters; usernames must be 3–32 letters, numbers, or underscores.

User records are stored in `TheLexicon.dbo.Users`. Passwords are stored as scrypt hashes. Session tokens expire after 24 hours; only token hashes are persisted in `TheLexicon.dbo.Sessions`, allowing LibraryService, NetworkService, and ChatService to validate bearer tokens. New user registration creates the account and its initial library in one transaction.

Start the separate LibraryService, NetworkService, and ChatService from their respective directories; see their READMEs for API details and setup.
The frontend is in `../../Frontend`; see its README for local setup and deployment.
