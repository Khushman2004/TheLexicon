import { createHash } from "node:crypto";
import { pool, sql } from "../database.js";

export class AuthenticationRepository {
  async findUserIdForToken(token) {
    const tokenHash = createHash("sha256").update(token).digest("hex");
    const result = await pool
      .request()
      .input("tokenHash", sql.Char(64), tokenHash)
      .query(`
        SELECT UserId AS userId
        FROM dbo.Sessions
        WHERE TokenHash = @tokenHash
          AND ExpiresAt > SYSDATETIMEOFFSET();`);

    return result.recordset[0]?.userId ?? null;
  }
}
