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

  async getMembership(userId, communityId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("communityId", sql.Int, communityId)
      .query(`
        SELECT CommunityId AS communityId, UserId AS userId, Role AS role, JoinedAt AS joinedAt
        FROM dbo.CommunityMemberships
        WHERE CommunityId = @communityId AND UserId = @userId;`);
    return result.recordset[0] ?? null;
  }

  async listCommunities(userId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT c.Id AS id, c.Name AS name, c.Genre AS genre,
          c.Description AS description, c.Privacy AS privacy,
          c.OwnerUserId AS ownerUserId, c.CreatedAt AS createdAt,
          cm.Role AS membershipRole,
          CAST(ISNULL(settings.IsMuted, 0) AS bit) AS notificationsMuted,
          (SELECT COUNT(*) FROM dbo.CommunityMemberships WHERE CommunityId = c.Id) AS memberCount
        FROM dbo.Communities AS c
        INNER JOIN dbo.CommunityMemberships AS cm ON cm.CommunityId = c.Id
        LEFT JOIN dbo.CommunityNotificationSettings AS settings
          ON settings.CommunityId = c.Id AND settings.UserId = @userId
        WHERE cm.UserId = @userId
        ORDER BY c.Name, c.Id;`);
    return result.recordset;
  }

  async listPublicCommunities(userId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT c.Id AS id, c.Name AS name, c.Genre AS genre,
          c.Description AS description, c.Privacy AS privacy,
          c.OwnerUserId AS ownerUserId, c.CreatedAt AS createdAt,
          (SELECT COUNT(*) FROM dbo.CommunityMemberships WHERE CommunityId = c.Id) AS memberCount,
          CAST(CASE WHEN EXISTS (
            SELECT 1 FROM dbo.CommunityMemberships
            WHERE CommunityId = c.Id AND UserId = @userId
          ) THEN 1 ELSE 0 END AS bit) AS isMember
        FROM dbo.Communities AS c
        WHERE c.Privacy = N'PUBLIC'
        ORDER BY c.Name, c.Id;`);
    return result.recordset;
  }

  async getCommunity(userId, communityId) {
    const membership = await this.getMembership(userId, communityId);
    if (!membership) return null;
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .query(`
        SELECT c.Id AS id, c.Name AS name, c.Genre AS genre,
          c.Description AS description, c.Privacy AS privacy,
          c.OwnerUserId AS ownerUserId, c.CreatedAt AS createdAt,
          (SELECT COUNT(*) FROM dbo.CommunityMemberships WHERE CommunityId = c.Id) AS memberCount
        FROM dbo.Communities AS c WHERE c.Id = @communityId;`);
    return result.recordset[0] ? { ...result.recordset[0], membershipRole: membership.role } : null;
  }

  async createCommunity(userId, name, genre, description, privacy) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const created = await new sql.Request(transaction)
        .input("ownerUserId", sql.Int, userId)
        .input("name", sql.NVarChar(100), name)
        .input("genre", sql.NVarChar(100), genre)
        .input("description", sql.NVarChar(1000), description)
        .input("privacy", sql.NVarChar(16), privacy)
        .query(`
          INSERT INTO dbo.Communities (Name, Genre, Description, Privacy, OwnerUserId)
          OUTPUT INSERTED.Id AS id, INSERTED.Name AS name, INSERTED.Genre AS genre,
            INSERTED.Description AS description, INSERTED.Privacy AS privacy,
            INSERTED.OwnerUserId AS ownerUserId, INSERTED.CreatedAt AS createdAt
          VALUES (@name, @genre, @description, @privacy, @ownerUserId);`);
      const community = created.recordset[0];
      await new sql.Request(transaction)
        .input("communityId", sql.Int, community.id)
        .input("userId", sql.Int, userId)
        .query(`
          INSERT INTO dbo.CommunityMemberships (CommunityId, UserId, Role)
          VALUES (@communityId, @userId, N'OWNER');`);
      await transaction.commit();
      return { ...community, membershipRole: "OWNER", memberCount: 1 };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async joinCommunity(userId, communityId) {
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .input("userId", sql.Int, userId)
      .query(`
        IF EXISTS (SELECT 1 FROM dbo.Communities WHERE Id = @communityId AND Privacy = N'PUBLIC')
        BEGIN
          DECLARE @added BIT = 0;
          IF NOT EXISTS (
            SELECT 1 FROM dbo.CommunityMemberships WHERE CommunityId = @communityId AND UserId = @userId
          )
          BEGIN
            INSERT INTO dbo.CommunityMemberships (CommunityId, UserId, Role)
            VALUES (@communityId, @userId, N'MEMBER');
            SET @added = 1;
          END;
          SELECT 1 AS joined, @added AS added;
        END
        ELSE
          SELECT 0 AS joined, 0 AS added;`);
    const membership = result.recordset[0];
    if (membership?.added === true || membership?.added === 1) {
      await this.notifyCommunityManagers(userId, communityId, "joined the community");
    }
    return membership?.joined === 1;
  }

  async joinByInvite(userId, codeHash) {
    const result = await pool.request()
      .input("codeHash", sql.Char(64), codeHash)
      .input("userId", sql.Int, userId)
      .query(`
        SELECT TOP (1) i.Id AS inviteId, i.CommunityId AS communityId,
          i.ExpiresAt AS expiresAt, i.RevokedAt AS revokedAt, i.UsedAt AS usedAt
        FROM dbo.CommunityInvites AS i
        WHERE i.CodeHash = @codeHash;`);
    const invite = result.recordset[0];
    if (!invite) return { status: "INVALID", communityId: null };
    if (invite.revokedAt) return { status: "REVOKED", communityId: null };
    if (invite.usedAt) return { status: "USED", communityId: null };
    if (invite.expiresAt && new Date(invite.expiresAt).getTime() <= Date.now()) {
      return { status: "EXPIRED", communityId: null };
    }
    const membership = await this.getMembership(userId, invite.communityId);
    if (membership) return { status: "ALREADY_MEMBER", communityId: invite.communityId };
    const joined = await pool.request()
      .input("communityId", sql.Int, invite.communityId)
      .input("userId", sql.Int, userId)
      .input("inviteId", sql.Int, invite.inviteId)
      .query(`
        IF NOT EXISTS (
          SELECT 1 FROM dbo.CommunityMemberships
          WHERE CommunityId = @communityId AND UserId = @userId
        )
        BEGIN
          INSERT INTO dbo.CommunityMemberships (CommunityId, UserId, Role)
          VALUES (@communityId, @userId, N'MEMBER');
          UPDATE dbo.CommunityInvites
          SET UsedAt = SYSDATETIMEOFFSET()
          WHERE Id = @inviteId AND UsedAt IS NULL AND RevokedAt IS NULL;
          SELECT 1 AS joined;
        END
        ELSE
          SELECT 0 AS joined;`);
    if (joined.recordset[0]?.joined === 1) {
      await this.notifyCommunityManagers(userId, invite.communityId, "joined the community");
    } else {
      return { status: "ALREADY_MEMBER", communityId: invite.communityId };
    }
    return { status: "JOINED", communityId: invite.communityId };
  }

  async createInvite(userId, communityId) {
    const membership = await this.getMembership(userId, communityId);
    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) return null;
    const code = [...Array(24)].map(() => "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789"[Math.floor(Math.random() * 36)]).join("");
    const crypto = await import("node:crypto");
    const codeHash = crypto.createHash("sha256").update(code).digest("hex");
    const inserted = await pool.request()
      .input("communityId", sql.Int, communityId)
      .input("userId", sql.Int, userId)
      .input("codeHash", sql.Char(64), codeHash)
      .input("codePrefix", sql.NVarChar(16), code.slice(0, 8))
      .query(`
        UPDATE dbo.CommunityInvites
        SET RevokedAt = SYSDATETIMEOFFSET()
        WHERE CommunityId = @communityId
          AND RevokedAt IS NULL
          AND UsedAt IS NULL;
        INSERT INTO dbo.CommunityInvites
          (CommunityId, CreatedByUserId, CodeHash, CodePrefix)
        OUTPUT INSERTED.Id AS id, INSERTED.CodePrefix AS codePrefix,
          INSERTED.CreatedAt AS createdAt, INSERTED.ExpiresAt AS expiresAt,
          INSERTED.RevokedAt AS revokedAt
        VALUES (@communityId, @userId, @codeHash, @codePrefix);`);
    await this.notifyCommunityManagers(userId, communityId, "updated community invitations");
    return { invite: inserted.recordset[0], code };
  }

  async listInvites(userId, communityId) {
    if (!await this.isManager(userId, communityId)) return null;
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .query(`
        SELECT Id AS id, CodePrefix AS codePrefix, ExpiresAt AS expiresAt,
          RevokedAt AS revokedAt, UsedAt AS usedAt, CreatedAt AS createdAt
        FROM dbo.CommunityInvites
        WHERE CommunityId = @communityId
        ORDER BY Id DESC;`);
    return result.recordset;
  }

  async revokeInvite(userId, communityId, inviteId) {
    if (!await this.isManager(userId, communityId)) return null;
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .input("inviteId", sql.Int, inviteId)
      .query(`
        UPDATE dbo.CommunityInvites
        SET RevokedAt = SYSDATETIMEOFFSET()
        WHERE Id = @inviteId AND CommunityId = @communityId AND RevokedAt IS NULL;
        SELECT Id AS id, RevokedAt AS revokedAt
        FROM dbo.CommunityInvites
        WHERE Id = @inviteId AND CommunityId = @communityId;`);
    if (result.recordset[0]) {
      await this.notifyCommunityManagers(userId, communityId, "revoked a community invitation");
    }
    return result.recordset[0] ?? null;
  }

  async listMembers(userId, communityId) {
    if (!await this.getMembership(userId, communityId)) return null;
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .query(`
        SELECT cm.UserId AS id, cm.Role AS role, cm.JoinedAt AS joinedAt,
          u.Username AS username, u.FullName AS fullName, u.AvatarUrl AS avatarUrl
        FROM dbo.CommunityMemberships AS cm
        INNER JOIN dbo.Users AS u ON u.Id = cm.UserId
        WHERE cm.CommunityId = @communityId
        ORDER BY CASE cm.Role WHEN N'OWNER' THEN 1 WHEN N'ADMIN' THEN 2 ELSE 3 END,
          u.FullName, u.Username;`);
    return result.recordset;
  }

  async updateMemberRole(userId, communityId, memberId, role) {
    const membership = await this.getMembership(userId, communityId);
    if (!membership || membership.role !== "OWNER") return null;
    const target = await this.getMembership(memberId, communityId);
    if (!target || target.role === "OWNER") return null;
    if (!["ADMIN", "MEMBER"].includes(role)) return null;
    await pool.request()
      .input("communityId", sql.Int, communityId)
      .input("memberId", sql.Int, memberId)
      .input("role", sql.NVarChar(16), role)
      .query(`
        UPDATE dbo.CommunityMemberships SET Role = @role
        WHERE CommunityId = @communityId AND UserId = @memberId;`);
    await this.notifyCommunityManagers(userId, communityId, `changed a member's role to ${role.toLowerCase()}`);
    return { id: memberId, role };
  }

  async removeMember(userId, communityId, memberId) {
    const membership = await this.getMembership(userId, communityId);
    if (!membership || membership.role !== "OWNER") return null;
    if (memberId === userId) return null;
    const target = await this.getMembership(memberId, communityId);
    if (!target || target.role === "OWNER") return null;
    await pool.request()
      .input("communityId", sql.Int, communityId)
      .input("memberId", sql.Int, memberId)
      .query(`DELETE FROM dbo.CommunityMemberships
        WHERE CommunityId = @communityId AND UserId = @memberId;`);
    await this.notifyCommunityManagers(userId, communityId, "removed a community member");
    return true;
  }

  async isManager(userId, communityId) {
    const membership = await this.getMembership(userId, communityId);
    return Boolean(membership && ["OWNER", "ADMIN"].includes(membership.role));
  }

  async listAnnouncements(userId, communityId) {
    if (!await this.getMembership(userId, communityId)) return null;
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .query(`
        SELECT a.Id AS id, a.Title AS title, a.Body AS body,
          a.CreatedAt AS createdAt, a.UpdatedAt AS updatedAt,
          a.AuthorUserId AS authorId, u.Username AS authorUsername,
          u.FullName AS authorName
        FROM dbo.CommunityAnnouncements AS a
        INNER JOIN dbo.Users AS u ON u.Id = a.AuthorUserId
        WHERE a.CommunityId = @communityId
        ORDER BY a.Id DESC;`);
    return result.recordset;
  }

  async createAnnouncement(userId, communityId, title, body) {
    if (!await this.isManager(userId, communityId)) return null;
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .input("authorId", sql.Int, userId)
      .input("title", sql.NVarChar(200), title)
      .input("body", sql.NVarChar(sql.MAX), body)
      .query(`
        INSERT INTO dbo.CommunityAnnouncements (CommunityId, AuthorUserId, Title, Body)
        OUTPUT INSERTED.Id AS id, INSERTED.Title AS title, INSERTED.Body AS body,
          INSERTED.AuthorUserId AS authorId, INSERTED.CreatedAt AS createdAt,
          INSERTED.UpdatedAt AS updatedAt
        VALUES (@communityId, @authorId, @title, @body);`);
    await this.notifyCommunityMembers(userId, communityId, "posted a community announcement");
    return result.recordset[0];
  }

  async updateAnnouncement(userId, communityId, announcementId, title, body) {
    if (!await this.isManager(userId, communityId)) return null;
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .input("announcementId", sql.Int, announcementId)
      .input("title", sql.NVarChar(200), title)
      .input("body", sql.NVarChar(sql.MAX), body)
      .query(`
        UPDATE dbo.CommunityAnnouncements
        SET Title = @title, Body = @body, UpdatedAt = SYSDATETIMEOFFSET()
        WHERE Id = @announcementId AND CommunityId = @communityId;
        SELECT Id AS id, Title AS title, Body AS body,
          AuthorUserId AS authorId, CreatedAt AS createdAt, UpdatedAt AS updatedAt
        FROM dbo.CommunityAnnouncements
        WHERE Id = @announcementId AND CommunityId = @communityId;`);
    if (result.recordset[0]) {
      await this.notifyCommunityMembers(userId, communityId, "updated a community announcement");
    }
    return result.recordset[0] ?? null;
  }

  async deleteAnnouncement(userId, communityId, announcementId) {
    if (!await this.isManager(userId, communityId)) return null;
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .input("announcementId", sql.Int, announcementId)
      .query(`
        DELETE FROM dbo.CommunityAnnouncements
        WHERE Id = @announcementId AND CommunityId = @communityId;`);
    if (result.rowsAffected[0] > 0) {
      await this.notifyCommunityMembers(userId, communityId, "deleted a community announcement");
    }
    return result.rowsAffected[0] > 0;
  }

  async listCommunityMessages(userId, communityId, beforeId) {
    if (!await this.getMembership(userId, communityId)) return null;
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .input("beforeId", sql.BigInt, beforeId)
      .query(`
        SELECT TOP (50) m.Id AS id, m.CommunityId AS communityId,
          m.SenderUserId AS senderId, u.Username AS senderUsername,
          u.FullName AS senderName, u.AvatarUrl AS senderAvatarUrl,
          m.Body AS body, m.CreatedAt AS createdAt
        FROM dbo.CommunityChatMessages AS m
        INNER JOIN dbo.Users AS u ON u.Id = m.SenderUserId
        WHERE m.CommunityId = @communityId
          AND (@beforeId IS NULL OR m.Id < @beforeId)
        ORDER BY m.Id DESC;`);
    return result.recordset.reverse();
  }

  async createCommunityMessage(userId, communityId, body) {
    if (!await this.getMembership(userId, communityId)) return null;
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .input("userId", sql.Int, userId)
      .input("body", sql.NVarChar(4000), body)
      .query(`
        INSERT INTO dbo.CommunityChatMessages (CommunityId, SenderUserId, Body)
        OUTPUT INSERTED.Id AS id, INSERTED.CommunityId AS communityId,
          INSERTED.SenderUserId AS senderId, INSERTED.Body AS body,
          INSERTED.CreatedAt AS createdAt
        VALUES (@communityId, @userId, @body);`);
    const message = result.recordset[0];
    const user = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`SELECT Username AS senderUsername, FullName AS senderName,
        AvatarUrl AS senderAvatarUrl FROM dbo.Users WHERE Id = @userId;`);
    await this.notifyCommunityMembers(userId, communityId, "sent a message in general chat");
    return { ...message, ...user.recordset[0] };
  }

  async notifyCommunityManagers(actorId, communityId, details) {
    await pool.request()
      .input("actorId", sql.Int, actorId)
      .input("communityId", sql.Int, communityId)
      .input("details", sql.NVarChar(256), details)
      .query(`
        INSERT INTO dbo.Notifications
          (RecipientUserId, ActorUserId, Type, CommunityId, Details)
        SELECT membership.UserId, @actorId, N'COMMUNITY_ACTIVITY', @communityId, @details
        FROM dbo.CommunityMemberships AS membership
        LEFT JOIN dbo.CommunityNotificationSettings AS settings
          ON settings.CommunityId = membership.CommunityId
          AND settings.UserId = membership.UserId
        WHERE membership.CommunityId = @communityId
          AND membership.Role IN (N'OWNER', N'ADMIN')
          AND membership.UserId <> @actorId
          AND ISNULL(settings.IsMuted, 0) = 0;`);
  }

  async notifyCommunityMembers(actorId, communityId, details) {
    await pool.request()
      .input("actorId", sql.Int, actorId)
      .input("communityId", sql.Int, communityId)
      .input("details", sql.NVarChar(256), details)
      .query(`
        INSERT INTO dbo.Notifications
          (RecipientUserId, ActorUserId, Type, CommunityId, Details)
        SELECT membership.UserId, @actorId, N'COMMUNITY_ACTIVITY', @communityId, @details
        FROM dbo.CommunityMemberships AS membership
        LEFT JOIN dbo.CommunityNotificationSettings AS settings
          ON settings.CommunityId = membership.CommunityId
          AND settings.UserId = membership.UserId
        WHERE membership.CommunityId = @communityId
          AND membership.UserId <> @actorId
          AND ISNULL(settings.IsMuted, 0) = 0;`);
  }

  async leaveCommunity(userId, communityId) {
    const membership = await this.getMembership(userId, communityId);
    if (!membership) return "NOT_MEMBER";
    if (membership.role === "OWNER") return "OWNER";
    await pool.request()
      .input("userId", sql.Int, userId)
      .input("communityId", sql.Int, communityId)
      .query(`
        DELETE FROM dbo.CommunityMemberships
        WHERE UserId = @userId AND CommunityId = @communityId;`);
    await this.notifyCommunityManagers(userId, communityId, "left the community");
    return "LEFT";
  }

  async deleteCommunity(userId, communityId) {
    const membership = await this.getMembership(userId, communityId);
    if (!membership || membership.role !== "OWNER") return false;
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .query(`
        DELETE FROM dbo.Communities WHERE Id = @communityId;
        SELECT @@ROWCOUNT AS deleted;`);
    return result.recordset[0]?.deleted === 1;
  }

  async getCommunityNotificationSettings(userId, communityId) {
    if (!await this.getMembership(userId, communityId)) return null;
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("communityId", sql.Int, communityId)
      .query(`
        SELECT ISNULL(settings.IsMuted, 0) AS isMuted
        FROM dbo.Communities AS community
        LEFT JOIN dbo.CommunityNotificationSettings AS settings
          ON settings.CommunityId = community.Id AND settings.UserId = @userId
        WHERE community.Id = @communityId;`);
    return result.recordset[0] ?? null;
  }

  async updateCommunityNotificationSettings(userId, communityId, isMuted) {
    if (!await this.getMembership(userId, communityId)) return null;
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("communityId", sql.Int, communityId)
      .input("isMuted", sql.Bit, isMuted)
      .query(`
        UPDATE dbo.CommunityNotificationSettings
        SET IsMuted = @isMuted, UpdatedAt = SYSDATETIMEOFFSET()
        WHERE UserId = @userId AND CommunityId = @communityId;
        IF @@ROWCOUNT = 0
          INSERT INTO dbo.CommunityNotificationSettings (CommunityId, UserId, IsMuted)
          VALUES (@communityId, @userId, @isMuted);
        SELECT @isMuted AS isMuted;`);
    return result.recordset[0];
  }
}
