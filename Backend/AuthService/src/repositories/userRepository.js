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
    try {
      const result = await pool
        .request()
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

      Object.assign(user, result.recordset[0]);
      return true;
    } catch (error) {
      if (error.number === 2601 || error.number === 2627) {
        return false;
      }

      throw error;
    }
  }
}
