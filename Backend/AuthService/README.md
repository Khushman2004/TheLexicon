# Lexicon Auth Service

## Run locally

1. Execute `../../Db/TheLexicon.sql` in SQL Server Management Studio. The script creates or updates the `TheLexicon` database schema, preserves existing data, and is safe to rerun.
2. Ensure the 64-bit Microsoft ODBC Driver 18 for SQL Server and SQL Server LocalDB are installed, or set `DB_SERVER` to your SQL Server instance.
3. From this directory, install dependencies and start the service:

```powershell
npm install
npm start
```

By default, the service connects to `(localdb)\MSSQLLocalDB` using Windows authentication and database `TheLexicon`. Configure another instance or database with `DB_SERVER` and `DB_NAME`. For SQL authentication, set `DB_TRUSTED_CONNECTION=false`, `DB_USER`, and `DB_PASSWORD`.

The service listens on `http://localhost:5000` by default. Set `PORT` to use a different port.

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

User records are stored in `TheLexicon.dbo.Users`. Passwords are stored as scrypt hashes. Session tokens expire after 24 hours; only token hashes are persisted in `TheLexicon.dbo.Sessions`, allowing the separate Library Service to validate bearer tokens. New user registration creates the account and its initial library in one transaction.

Start the separate Library Service from `../LibraryService`; see its README for its modules and API.
