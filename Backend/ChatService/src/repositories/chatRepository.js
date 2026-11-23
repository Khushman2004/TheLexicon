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
          AND (
            (EXISTS (
              SELECT 1 FROM dbo.UserFollows
              WHERE FollowerUserId = c.UserOneId AND FollowedUserId = c.UserTwoId
            )
            AND EXISTS (
              SELECT 1 FROM dbo.UserFollows
              WHERE FollowerUserId = c.UserTwoId AND FollowedUserId = c.UserOneId
            ))
            OR EXISTS (
              SELECT 1 FROM dbo.ChatRequests AS acceptedRequest
              WHERE acceptedRequest.ConversationId = c.Id
                AND acceptedRequest.Status = N'ACCEPTED'
                AND (
                  (acceptedRequest.RequesterUserId = c.UserOneId
                    AND acceptedRequest.RecipientUserId = c.UserTwoId)
                  OR (acceptedRequest.RequesterUserId = c.UserTwoId
                    AND acceptedRequest.RecipientUserId = c.UserOneId)
                )
            )
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
          AND (
            (EXISTS (
              SELECT 1 FROM dbo.UserFollows
              WHERE FollowerUserId = c.UserOneId AND FollowedUserId = c.UserTwoId
            )
            AND EXISTS (
              SELECT 1 FROM dbo.UserFollows
              WHERE FollowerUserId = c.UserTwoId AND FollowedUserId = c.UserOneId
            ))
            OR EXISTS (
              SELECT 1 FROM dbo.ChatRequests AS acceptedRequest
              WHERE acceptedRequest.ConversationId = c.Id
                AND acceptedRequest.Status = N'ACCEPTED'
                AND (
                  (acceptedRequest.RequesterUserId = c.UserOneId
                    AND acceptedRequest.RecipientUserId = c.UserTwoId)
                  OR (acceptedRequest.RequesterUserId = c.UserTwoId
                    AND acceptedRequest.RecipientUserId = c.UserOneId)
                )
            )
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
            AND (
              (EXISTS (
                SELECT 1 FROM dbo.UserFollows
                WHERE FollowerUserId = c.UserOneId AND FollowedUserId = c.UserTwoId
              )
              AND EXISTS (
                SELECT 1 FROM dbo.UserFollows
                WHERE FollowerUserId = c.UserTwoId AND FollowedUserId = c.UserOneId
              ))
              OR EXISTS (
                SELECT 1 FROM dbo.ChatRequests AS acceptedRequest
                WHERE acceptedRequest.ConversationId = c.Id
                  AND acceptedRequest.Status = N'ACCEPTED'
                  AND (
                    (acceptedRequest.RequesterUserId = c.UserOneId
                      AND acceptedRequest.RecipientUserId = c.UserTwoId)
                    OR (acceptedRequest.RequesterUserId = c.UserTwoId
                      AND acceptedRequest.RecipientUserId = c.UserOneId)
                  )
              )
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

  async getChatRequestStatus(userId, otherUserId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("otherUserId", sql.Int, otherUserId)
      .query(`
        SELECT TOP (1) Id AS requestId, RequesterUserId AS requesterId,
          RecipientUserId AS recipientId, Status AS requestStatus,
          ConversationId AS conversationId
        FROM dbo.ChatRequests
        WHERE (RequesterUserId = @userId AND RecipientUserId = @otherUserId)
          OR (RequesterUserId = @otherUserId AND RecipientUserId = @userId)
        ORDER BY CASE WHEN Status = N'ACCEPTED' THEN 0 ELSE 1 END, Id DESC;`);
    const request = result.recordset[0];
    if (request) {
      return {
        status: request.requestStatus === "PENDING"
          ? (request.requesterId === userId ? "SENT" : "RECEIVED")
          : request.requestStatus,
        requestId: request.requestId,
        conversationId: request.conversationId,
      };
    }

    const conversation = await pool.request()
      .input("userId", sql.Int, userId)
      .input("otherUserId", sql.Int, otherUserId)
      .query(`
        SELECT TOP (1) c.Id AS conversationId
        FROM dbo.ChatConversations AS c
        WHERE c.UserOneId = CASE WHEN @userId < @otherUserId THEN @userId ELSE @otherUserId END
          AND c.UserTwoId = CASE WHEN @userId < @otherUserId THEN @otherUserId ELSE @userId END
          AND EXISTS (
            SELECT 1 FROM dbo.UserFollows
            WHERE FollowerUserId = @userId AND FollowedUserId = @otherUserId
          )
          AND EXISTS (
            SELECT 1 FROM dbo.UserFollows
            WHERE FollowerUserId = @otherUserId AND FollowedUserId = @userId
          );`);
    return conversation.recordset[0]
      ? { status: "ACCEPTED", conversationId: conversation.recordset[0].conversationId }
      : { status: "NONE", conversationId: null };
  }

  async sendChatRequest(userId, recipientId) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const request = new sql.Request(transaction)
        .input("userId", sql.Int, userId)
        .input("recipientId", sql.Int, recipientId);
      const recipient = await request.query(`
        SELECT Id FROM dbo.Users WHERE Id = @recipientId;`);
      if (!recipient.recordset[0]) {
        await transaction.rollback();
        return null;
      }

      const existing = await new sql.Request(transaction)
        .input("userId", sql.Int, userId)
        .input("recipientId", sql.Int, recipientId)
        .query(`
          SELECT TOP (1) Id AS requestId, RequesterUserId AS requesterId,
            RecipientUserId AS recipientId, Status AS requestStatus,
            ConversationId AS conversationId
          FROM dbo.ChatRequests WITH (UPDLOCK, HOLDLOCK)
          WHERE (RequesterUserId = @userId AND RecipientUserId = @recipientId)
            OR (RequesterUserId = @recipientId AND RecipientUserId = @userId)
          ORDER BY CASE WHEN Status = N'ACCEPTED' THEN 0 ELSE 1 END, Id DESC;`);
      const latest = existing.recordset[0];
      if (latest?.requestStatus === "PENDING" || latest?.requestStatus === "ACCEPTED") {
        await transaction.commit();
        return {
          status: latest.requestStatus === "PENDING"
            ? (latest.requesterId === userId ? "SENT" : "RECEIVED")
            : "ACCEPTED",
          requestId: latest.requestId,
          conversationId: latest.conversationId,
        };
      }

      const created = await new sql.Request(transaction)
        .input("userId", sql.Int, userId)
        .input("recipientId", sql.Int, recipientId)
        .query(`
          INSERT INTO dbo.ChatRequests (RequesterUserId, RecipientUserId)
          OUTPUT INSERTED.Id AS requestId
          VALUES (@userId, @recipientId);`);
      const requestId = created.recordset[0].requestId;
      await new sql.Request(transaction)
        .input("recipientId", sql.Int, recipientId)
        .input("userId", sql.Int, userId)
        .input("requestId", sql.Int, requestId)
        .query(`
          INSERT INTO dbo.Notifications
            (RecipientUserId, ActorUserId, Type, ChatRequestId)
          VALUES (@recipientId, @userId, N'CHAT_REQUEST', @requestId);`);
      await transaction.commit();
      return { status: "SENT", requestId, conversationId: null };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async respondToChatRequest(userId, requestId, decision) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const found = await new sql.Request(transaction)
        .input("userId", sql.Int, userId)
        .input("requestId", sql.Int, requestId)
        .query(`
          SELECT Id AS requestId, RequesterUserId AS requesterId,
            RecipientUserId AS recipientId, Status AS requestStatus,
            ConversationId AS conversationId
          FROM dbo.ChatRequests WITH (UPDLOCK, HOLDLOCK)
          WHERE Id = @requestId AND RecipientUserId = @userId;`);
      const chatRequest = found.recordset[0];
      if (!chatRequest || chatRequest.requestStatus !== "PENDING") {
        await transaction.rollback();
        return null;
      }

      let conversationId = null;
      if (decision === "ACCEPTED") {
        const userOneId = Math.min(chatRequest.requesterId, userId);
        const userTwoId = Math.max(chatRequest.requesterId, userId);
        const existing = await new sql.Request(transaction)
          .input("userOneId", sql.Int, userOneId)
          .input("userTwoId", sql.Int, userTwoId)
          .query(`
            SELECT Id AS conversationId
            FROM dbo.ChatConversations WITH (UPDLOCK, HOLDLOCK)
            WHERE UserOneId = @userOneId AND UserTwoId = @userTwoId;`);
        conversationId = existing.recordset[0]?.conversationId;
        if (!conversationId) {
          const created = await new sql.Request(transaction)
            .input("userOneId", sql.Int, userOneId)
            .input("userTwoId", sql.Int, userTwoId)
            .query(`
              INSERT INTO dbo.ChatConversations (UserOneId, UserTwoId)
              OUTPUT INSERTED.Id AS conversationId
              VALUES (@userOneId, @userTwoId);`);
          conversationId = created.recordset[0].conversationId;
        }
      }

      await new sql.Request(transaction)
        .input("requestId", sql.Int, requestId)
        .input("recipientId", sql.Int, userId)
        .input("decision", sql.NVarChar(16), decision)
        .input("conversationId", sql.Int, conversationId)
        .query(`
          UPDATE dbo.ChatRequests
          SET Status = @decision, ConversationId = @conversationId,
            ResolvedAt = SYSDATETIMEOFFSET()
          WHERE Id = @requestId;
          UPDATE dbo.Notifications
          SET ReadAt = COALESCE(ReadAt, SYSDATETIMEOFFSET())
          WHERE ChatRequestId = @requestId AND RecipientUserId = @recipientId;`);

      await new sql.Request(transaction)
        .input("requestId", sql.Int, requestId)
        .input("recipientId", sql.Int, chatRequest.requesterId)
        .input("actorId", sql.Int, userId)
        .input("decision", sql.NVarChar(32), `CHAT_REQUEST_${decision}`)
        .query(`
          INSERT INTO dbo.Notifications
            (RecipientUserId, ActorUserId, Type, ChatRequestId)
          VALUES (@recipientId, @actorId, @decision, @requestId);`);

      await transaction.commit();
      return { status: decision, conversationId };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}
