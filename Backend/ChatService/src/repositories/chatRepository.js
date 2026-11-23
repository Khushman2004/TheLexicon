import { pool, sql } from "../database.js";

const MESSAGE_COLUMNS = `
  m.Id AS id,
  m.ConversationId AS conversationId,
  m.SenderUserId AS senderId,
  u.Username AS senderUsername,
  u.FullName AS senderName,
  m.Body AS body,
  m.CreatedAt AS createdAt`;

export class ChatRepository {
  async listMutualUserIds(userId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT followed.FollowedUserId AS userId
        FROM dbo.UserFollows AS followed
        WHERE followed.FollowerUserId = @userId
          AND EXISTS (
            SELECT 1 FROM dbo.UserFollows AS reciprocal
            WHERE reciprocal.FollowerUserId = followed.FollowedUserId
              AND reciprocal.FollowedUserId = @userId
          );`);
    return result.recordset.map((row) => row.userId);
  }

  async findOrCreateConversation(userId, recipientId) {
    const userOneId = Math.min(userId, recipientId);
    const userTwoId = Math.max(userId, recipientId);
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const request = new sql.Request(transaction)
        .input("userOneId", sql.Int, userOneId)
        .input("userTwoId", sql.Int, userTwoId);
      const mutual = await request.query(`
        SELECT CAST(CASE WHEN EXISTS (
          SELECT 1 FROM dbo.UserFollows
          WHERE FollowerUserId = @userOneId AND FollowedUserId = @userTwoId
        ) AND EXISTS (
          SELECT 1 FROM dbo.UserFollows
          WHERE FollowerUserId = @userTwoId AND FollowedUserId = @userOneId
        ) THEN 1 ELSE 0 END AS bit) AS isMutual;`);
      if (!mutual.recordset[0].isMutual) {
        await transaction.rollback();
        return null;
      }

      const existing = await new sql.Request(transaction)
        .input("userOneId", sql.Int, userOneId)
        .input("userTwoId", sql.Int, userTwoId)
        .query(`
          SELECT Id AS id, UserOneId AS userOneId, UserTwoId AS userTwoId,
            CreatedAt AS createdAt
          FROM dbo.ChatConversations WITH (UPDLOCK, HOLDLOCK)
          WHERE UserOneId = @userOneId AND UserTwoId = @userTwoId;`);
      if (existing.recordset[0]) {
        await transaction.commit();
        return (await this.listConversations(userId)).find(
          (conversation) => conversation.id === existing.recordset[0].id,
        ) ?? existing.recordset[0];
      }

      const created = await new sql.Request(transaction)
        .input("userOneId", sql.Int, userOneId)
        .input("userTwoId", sql.Int, userTwoId)
        .query(`
          INSERT INTO dbo.ChatConversations (UserOneId, UserTwoId)
          OUTPUT INSERTED.Id AS id, INSERTED.UserOneId AS userOneId,
            INSERTED.UserTwoId AS userTwoId, INSERTED.CreatedAt AS createdAt
          VALUES (@userOneId, @userTwoId);`);
      await transaction.commit();
      return (await this.listConversations(userId)).find(
        (conversation) => conversation.id === created.recordset[0].id,
      ) ?? created.recordset[0];
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async listConversations(userId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT c.Id AS id,
          other.Id AS otherUserId,
          other.Username AS otherUsername,
          other.FullName AS otherName,
          other.AvatarUrl AS otherAvatarUrl,
          c.CreatedAt AS createdAt,
          latest.Body AS lastMessage,
          latest.CreatedAt AS lastMessageAt,
          latest.SenderUserId AS lastSenderId
        FROM dbo.ChatConversations AS c
        INNER JOIN dbo.Users AS other ON other.Id =
          CASE WHEN c.UserOneId = @userId THEN c.UserTwoId ELSE c.UserOneId END
        OUTER APPLY (
          SELECT TOP (1) m.Body, m.CreatedAt, m.SenderUserId
          FROM dbo.ChatMessages AS m
          WHERE m.ConversationId = c.Id
          ORDER BY m.Id DESC
        ) AS latest
        WHERE (c.UserOneId = @userId OR c.UserTwoId = @userId)
          AND EXISTS (
            SELECT 1 FROM dbo.UserFollows
            WHERE FollowerUserId = c.UserOneId AND FollowedUserId = c.UserTwoId
          )
          AND EXISTS (
            SELECT 1 FROM dbo.UserFollows
            WHERE FollowerUserId = c.UserTwoId AND FollowedUserId = c.UserOneId
          )
        ORDER BY COALESCE(latest.CreatedAt, c.CreatedAt) DESC;`);
    return result.recordset;
  }

  async findConversation(userId, conversationId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("conversationId", sql.Int, conversationId)
      .query(`
        SELECT c.Id AS id, c.UserOneId AS userOneId, c.UserTwoId AS userTwoId,
          other.Id AS otherUserId, other.Username AS otherUsername,
          other.FullName AS otherName, other.AvatarUrl AS otherAvatarUrl
        FROM dbo.ChatConversations AS c
        INNER JOIN dbo.Users AS other ON other.Id =
          CASE WHEN c.UserOneId = @userId THEN c.UserTwoId ELSE c.UserOneId END
        WHERE c.Id = @conversationId
          AND (c.UserOneId = @userId OR c.UserTwoId = @userId)
          AND EXISTS (
            SELECT 1 FROM dbo.UserFollows
            WHERE FollowerUserId = c.UserOneId AND FollowedUserId = c.UserTwoId
          )
          AND EXISTS (
            SELECT 1 FROM dbo.UserFollows
            WHERE FollowerUserId = c.UserTwoId AND FollowedUserId = c.UserOneId
          );`);
    return result.recordset[0] ?? null;
  }

  async listMessages(conversationId, beforeId) {
    const request = pool.request()
      .input("conversationId", sql.Int, conversationId)
      .input("beforeId", sql.BigInt, beforeId);
    const result = await request.query(`
      SELECT TOP (50) ${MESSAGE_COLUMNS}
      FROM dbo.ChatMessages AS m
      INNER JOIN dbo.Users AS u ON u.Id = m.SenderUserId
      WHERE m.ConversationId = @conversationId
        AND (@beforeId IS NULL OR m.Id < @beforeId)
      ORDER BY m.Id DESC;`);
    return result.recordset.reverse();
  }

  async createMessage(userId, conversationId, body) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const allowed = await new sql.Request(transaction)
        .input("userId", sql.Int, userId)
        .input("conversationId", sql.Int, conversationId)
        .query(`
          SELECT c.UserOneId AS userOneId, c.UserTwoId AS userTwoId
          FROM dbo.ChatConversations AS c
          WHERE c.Id = @conversationId
            AND (c.UserOneId = @userId OR c.UserTwoId = @userId)
            AND EXISTS (
              SELECT 1 FROM dbo.UserFollows
              WHERE FollowerUserId = c.UserOneId AND FollowedUserId = c.UserTwoId
            )
            AND EXISTS (
              SELECT 1 FROM dbo.UserFollows
              WHERE FollowerUserId = c.UserTwoId AND FollowedUserId = c.UserOneId
            );`);
      const conversation = allowed.recordset[0];
      if (!conversation) {
        await transaction.rollback();
        return null;
      }
      const inserted = await new sql.Request(transaction)
        .input("userId", sql.Int, userId)
        .input("conversationId", sql.Int, conversationId)
        .input("body", sql.NVarChar(4000), body)
        .query(`
          INSERT INTO dbo.ChatMessages (ConversationId, SenderUserId, Body)
          OUTPUT INSERTED.Id AS id, INSERTED.ConversationId AS conversationId,
            INSERTED.SenderUserId AS senderId, INSERTED.Body AS body,
            INSERTED.CreatedAt AS createdAt
          VALUES (@conversationId, @userId, @body);`);
      await new sql.Request(transaction)
        .input("conversationId", sql.Int, conversationId)
        .query("UPDATE dbo.ChatConversations SET LastMessageAt = SYSDATETIMEOFFSET() WHERE Id = @conversationId;");
      const recipientId = conversation.userOneId === userId
        ? conversation.userTwoId
        : conversation.userOneId;
      await new sql.Request(transaction)
        .input("recipientId", sql.Int, recipientId)
        .input("senderId", sql.Int, userId)
        .input("conversationId", sql.Int, conversationId)
        .query(`
          INSERT INTO dbo.Notifications
            (RecipientUserId, ActorUserId, Type, ConversationId)
          VALUES
            (@recipientId, @senderId, N'CHAT_MESSAGE', @conversationId);`);
      await transaction.commit();
      return {
        ...inserted.recordset[0],
        userOneId: conversation.userOneId,
        userTwoId: conversation.userTwoId,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
