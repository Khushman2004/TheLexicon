import { User } from "../models/userModel.js";
import { pool, sql } from "../database.js";

const USER_COLUMNS = `
  Id AS id,
  Username AS username,
  Email AS email,
  PasswordHash AS passwordHash,
  FullName AS fullName,
  Bio AS bio,
  AvatarUrl AS avatarUrl,
  IsPublic AS isPublic,
  CreatedAt AS createdAt,
  UpdatedAt AS updatedAt`;

const SESSION_USER_COLUMNS = `
  u.Id AS id,
  u.Username AS username,
  u.Email AS email,
  u.PasswordHash AS passwordHash,
  u.FullName AS fullName,
  u.Bio AS bio,
  u.AvatarUrl AS avatarUrl,
  u.IsPublic AS isPublic,
  u.CreatedAt AS createdAt,
  u.UpdatedAt AS updatedAt`;

const INSERTED_USER_COLUMNS = `
  INSERTED.Id AS id,
  INSERTED.Username AS username,
  INSERTED.Email AS email,
  INSERTED.PasswordHash AS passwordHash,
  INSERTED.FullName AS fullName,
  INSERTED.Bio AS bio,
  INSERTED.AvatarUrl AS avatarUrl,
  INSERTED.IsPublic AS isPublic,
  INSERTED.CreatedAt AS createdAt,
  INSERTED.UpdatedAt AS updatedAt`;

export class UserRepository {
  async initialize() {
    await pool.connect();
    await pool.request().query("SELECT 1;");
  }

  async findById(id) {
    const result = await pool
      .request()
      .input("id", sql.Int, id)
      .query(`SELECT ${USER_COLUMNS} FROM dbo.Users WHERE Id = @id;`);

    return result.recordset[0] ? new User(result.recordset[0]) : null;
  }

  async findBySessionTokenHash(tokenHash) {
    const result = await pool
      .request()
      .input("tokenHash", sql.Char(64), tokenHash)
      .query(`
        SELECT ${SESSION_USER_COLUMNS}
        FROM dbo.Users AS u
        INNER JOIN dbo.Sessions AS s ON s.UserId = u.Id
        WHERE s.TokenHash = @tokenHash
          AND s.ExpiresAt > SYSDATETIMEOFFSET();`);

    return result.recordset[0] ? new User(result.recordset[0]) : null;
  }

  async createSession(userId, tokenHash, ttlSeconds) {
    await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("tokenHash", sql.Char(64), tokenHash)
      .input("ttlSeconds", sql.Int, ttlSeconds)
      .query(`
        INSERT INTO dbo.Sessions (TokenHash, UserId, ExpiresAt)
        VALUES (@tokenHash, @userId, DATEADD(SECOND, @ttlSeconds, SYSDATETIMEOFFSET()));`);
  }

  async deleteSessionByTokenHash(tokenHash) {
    const result = await pool
      .request()
      .input("tokenHash", sql.Char(64), tokenHash)
      .query(`
        DELETE FROM dbo.Sessions
        WHERE TokenHash = @tokenHash;
        SELECT @@ROWCOUNT AS deleted;`);

    return result.recordset[0].deleted === 1;
  }

  async findByEmail(email) {
    const result = await pool
      .request()
      .input("email", sql.NVarChar(254), email.trim().toLowerCase())
      .query(`SELECT TOP (1) ${USER_COLUMNS} FROM dbo.Users WHERE Email = @email;`);

    return result.recordset[0] ? new User(result.recordset[0]) : null;
  }

  async findByUsername(username) {
    const result = await pool
      .request()
      .input("username", sql.NVarChar(32), username.trim())
      .query(`SELECT TOP (1) ${USER_COLUMNS} FROM dbo.Users WHERE Username = @username;`);

    return result.recordset[0] ? new User(result.recordset[0]) : null;
  }

  async create(user) {
    const transaction = new sql.Transaction(pool);
    let transactionStarted = false;

    try {
      await transaction.begin();
      transactionStarted = true;

      const result = await new sql.Request(transaction)
        .input("username", sql.NVarChar(32), user.username)
        .input("email", sql.NVarChar(254), user.email)
        .input("passwordHash", sql.NVarChar(256), user.passwordHash)
        .input("fullName", sql.NVarChar(100), user.fullName)
        .input("bio", sql.NVarChar(500), user.bio)
        .input("avatarUrl", sql.NVarChar(2048), user.avatarUrl)
        .query(`
          INSERT INTO dbo.Users (Username, Email, PasswordHash, FullName, Bio, AvatarUrl)
          OUTPUT ${INSERTED_USER_COLUMNS}
          VALUES (@username, @email, @passwordHash, @fullName, @bio, @avatarUrl);`);

      const createdUser = result.recordset[0];
      await new sql.Request(transaction)
        .input("userId", sql.Int, createdUser.id)
        .query(`
          INSERT INTO dbo.Libraries (UserId, LibraryIndex, Name)
          VALUES (@userId, 1, N'My Library');`);

      await transaction.commit();
      transactionStarted = false;

      Object.assign(user, createdUser);
      return true;
    } catch (error) {
      if (transactionStarted) await transaction.rollback();
      if (error.number === 2601 || error.number === 2627) {
        return false;
      }

      throw error;
    }
  }
}
