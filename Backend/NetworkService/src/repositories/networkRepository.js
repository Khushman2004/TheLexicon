import { pool, sql } from "../database.js";

const PROFILE_COLUMNS = `
  u.Id AS id,
  u.Username AS username,
  u.FullName AS fullName,
  u.Bio AS bio,
  u.AvatarUrl AS avatarUrl,
  u.IsPublic AS isPublic,
  u.CreatedAt AS joinedAt,
  (SELECT COUNT(*) FROM dbo.UserFollows AS f WHERE f.FollowedUserId = u.Id) AS followerCount,
  (SELECT COUNT(*) FROM dbo.UserFollows AS f WHERE f.FollowerUserId = u.Id) AS followingCount`;

export class NetworkRepository {
  async getProfile(viewerId, userId) {
    const result = await pool.request()
      .input("viewerId", sql.Int, viewerId)
      .input("userId", sql.Int, userId)
      .query(`
        SELECT ${PROFILE_COLUMNS},
          CAST(CASE WHEN EXISTS (
            SELECT 1 FROM dbo.UserFollows
            WHERE FollowerUserId = @viewerId AND FollowedUserId = u.Id
          ) THEN 1 ELSE 0 END AS bit) AS isFollowing,
          CAST(CASE WHEN EXISTS (
            SELECT 1 FROM dbo.UserFollows
            WHERE FollowerUserId = u.Id AND FollowedUserId = @viewerId
          ) THEN 1 ELSE 0 END AS bit) AS followsViewer,
          CAST(CASE WHEN EXISTS (
            SELECT 1 FROM dbo.UserFollows AS a
            WHERE a.FollowerUserId = @viewerId AND a.FollowedUserId = u.Id
          ) AND EXISTS (
            SELECT 1 FROM dbo.UserFollows AS b
            WHERE b.FollowerUserId = u.Id AND b.FollowedUserId = @viewerId
          ) THEN 1 ELSE 0 END AS bit) AS isMutual
        FROM dbo.Users AS u
        WHERE u.Id = @userId
          AND (u.Id = @viewerId OR u.IsPublic = 1 OR EXISTS (
            SELECT 1 FROM dbo.UserFollows
            WHERE FollowerUserId = @viewerId AND FollowedUserId = u.Id
          ));`);
    return result.recordset[0] ?? null;
  }

  async updateProfile(userId, updates) {
    const request = pool.request().input("userId", sql.Int, userId);
    const sets = ["UpdatedAt = SYSDATETIMEOFFSET()"];
    if (Object.hasOwn(updates, "fullName")) {
      request.input("fullName", sql.NVarChar(100), updates.fullName);
      sets.push("FullName = @fullName");
    }
    if (Object.hasOwn(updates, "bio")) {
      request.input("bio", sql.NVarChar(500), updates.bio);
      sets.push("Bio = @bio");
    }
    if (Object.hasOwn(updates, "avatarUrl")) {
      request.input("avatarUrl", sql.NVarChar(2048), updates.avatarUrl);
      sets.push("AvatarUrl = @avatarUrl");
    }
    if (Object.hasOwn(updates, "isPublic")) {
      request.input("isPublic", sql.Bit, updates.isPublic);
      sets.push("IsPublic = @isPublic");
    }
    await request.query(`UPDATE dbo.Users SET ${sets.join(", ")} WHERE Id = @userId;`);
    return this.getProfile(userId, userId);
  }

  async searchUsers(viewerId, search) {
    const result = await pool.request()
      .input("viewerId", sql.Int, viewerId)
      .input("search", sql.NVarChar(64), `%${search}%`)
      .query(`
        SELECT TOP (40) ${PROFILE_COLUMNS},
          CAST(CASE WHEN EXISTS (
            SELECT 1 FROM dbo.UserFollows
            WHERE FollowerUserId = @viewerId AND FollowedUserId = u.Id
          ) THEN 1 ELSE 0 END AS bit) AS isFollowing,
          CAST(CASE WHEN EXISTS (
            SELECT 1 FROM dbo.UserFollows
            WHERE FollowerUserId = u.Id AND FollowedUserId = @viewerId
          ) THEN 1 ELSE 0 END AS bit) AS followsViewer
        FROM dbo.Users AS u
        WHERE u.Id <> @viewerId
          AND (u.Id = @viewerId OR u.IsPublic = 1 OR EXISTS (
            SELECT 1 FROM dbo.UserFollows
            WHERE FollowerUserId = @viewerId AND FollowedUserId = u.Id
          ))
          AND (u.Username LIKE @search OR u.FullName LIKE @search)
        ORDER BY u.Username;`);
    return result.recordset;
  }

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

  async listConnections(viewerId, profileId, direction) {
    const followed = direction === "following";
    const join = followed
      ? "f.FollowedUserId = u.Id AND f.FollowerUserId = @profileId"
      : "f.FollowerUserId = u.Id AND f.FollowedUserId = @profileId";
    const result = await pool.request()
      .input("viewerId", sql.Int, viewerId)
      .input("profileId", sql.Int, profileId)
      .query(`
        SELECT ${PROFILE_COLUMNS},
          CAST(CASE WHEN EXISTS (
            SELECT 1 FROM dbo.UserFollows
            WHERE FollowerUserId = @viewerId AND FollowedUserId = u.Id
          ) THEN 1 ELSE 0 END AS bit) AS isFollowing,
          CAST(CASE WHEN EXISTS (
            SELECT 1 FROM dbo.UserFollows
            WHERE FollowerUserId = u.Id AND FollowedUserId = @viewerId
          ) THEN 1 ELSE 0 END AS bit) AS followsViewer
        FROM dbo.Users AS u
        INNER JOIN dbo.UserFollows AS f ON ${join}
        WHERE u.Id = @viewerId OR u.IsPublic = 1 OR EXISTS (
          SELECT 1 FROM dbo.UserFollows
          WHERE FollowerUserId = @viewerId AND FollowedUserId = u.Id
        )
        ORDER BY u.Username;`);
    return result.recordset;
  }

  async userExists(userId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query("SELECT Id AS id, IsPublic AS isPublic FROM dbo.Users WHERE Id = @userId;");
    return result.recordset[0] ?? null;
  }

  async follow(followerId, followedId) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const request = new sql.Request(transaction)
        .input("followerId", sql.Int, followerId)
        .input("followedId", sql.Int, followedId);
      const existing = await request.query(`
        SELECT FollowerUserId
        FROM dbo.UserFollows WITH (UPDLOCK, HOLDLOCK)
        WHERE FollowerUserId = @followerId AND FollowedUserId = @followedId;`);
      if (!existing.recordset.length) {
        await new sql.Request(transaction)
          .input("followerId", sql.Int, followerId)
          .input("followedId", sql.Int, followedId)
          .query(`
            INSERT INTO dbo.UserFollows (FollowerUserId, FollowedUserId)
            VALUES (@followerId, @followedId);
            INSERT INTO dbo.Notifications (RecipientUserId, ActorUserId, Type)
            VALUES (@followedId, @followerId, N'FOLLOW');`);
      }
      await transaction.commit();
      return { isFollowing: true };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async unfollow(followerId, followedId) {
    await pool.request()
      .input("followerId", sql.Int, followerId)
      .input("followedId", sql.Int, followedId)
      .query("DELETE FROM dbo.UserFollows WHERE FollowerUserId = @followerId AND FollowedUserId = @followedId;");
  }

  async listNotifications(userId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT TOP (100) n.Id AS id, n.Type AS type, n.LibraryId AS libraryId,
          n.CommunityId AS communityId, n.Details AS details,
          community.Name AS communityName,
          n.AccessRequestId AS accessRequestId,
          COALESCE(n.ConversationId, chatRequest.ConversationId) AS conversationId,
          n.ChatRequestId AS chatRequestId, chatRequest.Status AS chatRequestStatus,
          n.CreatedAt AS createdAt, n.ReadAt AS readAt,
          u.Id AS actorId, u.Username AS actorUsername, u.FullName AS actorName,
          l.Name AS libraryName
        FROM dbo.Notifications AS n
        INNER JOIN dbo.Users AS u ON u.Id = n.ActorUserId
        LEFT JOIN dbo.Libraries AS l ON l.Id = n.LibraryId
        LEFT JOIN dbo.Communities AS community ON community.Id = n.CommunityId
        LEFT JOIN dbo.ChatRequests AS chatRequest ON chatRequest.Id = n.ChatRequestId
        WHERE n.RecipientUserId = @userId
        ORDER BY n.CreatedAt DESC, n.Id DESC;

        SELECT COUNT(*) AS unreadCount
        FROM dbo.Notifications
        WHERE RecipientUserId = @userId AND ReadAt IS NULL;`);
    return {
      notifications: result.recordsets[0],
      unreadCount: result.recordsets[1][0].unreadCount,
    };
  }

  async markNotificationRead(userId, notificationId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("notificationId", sql.Int, notificationId)
      .query(`
        UPDATE dbo.Notifications
        SET ReadAt = COALESCE(ReadAt, SYSDATETIMEOFFSET())
        WHERE Id = @notificationId AND RecipientUserId = @userId;
        SELECT CAST(CASE WHEN EXISTS (
          SELECT 1 FROM dbo.Notifications
          WHERE Id = @notificationId AND RecipientUserId = @userId
        ) THEN 1 ELSE 0 END AS bit) AS existsForUser;`);
    return result.recordset[0].existsForUser;
  }

  async markAllNotificationsRead(userId) {
    await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        UPDATE dbo.Notifications
        SET ReadAt = SYSDATETIMEOFFSET()
        WHERE RecipientUserId = @userId AND ReadAt IS NULL;`);
  }

  async clearNotifications(userId) {
    await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        DELETE FROM dbo.Notifications
        WHERE RecipientUserId = @userId;`);
  }

  async listPublicLibraries(viewerId, ownerId = null) {
    const result = await pool.request()
      .input("viewerId", sql.Int, viewerId)
      .input("ownerId", sql.Int, ownerId)
      .query(`
        SELECT l.Id AS id, l.Name AS name, l.IsPublic AS isPublic,
          l.CreatedAt AS createdAt, u.Id AS ownerId, u.Username AS ownerUsername,
          u.FullName AS ownerName,
          CAST(CASE WHEN EXISTS (
            SELECT 1 FROM dbo.SavedLibraries AS s
            WHERE s.UserId = @viewerId AND s.LibraryId = l.Id
          ) THEN 1 ELSE 0 END AS bit) AS isSaved,
          COUNT(DISTINCT lm.ModelKey) AS publicModelCount
        FROM dbo.Libraries AS l
        INNER JOIN dbo.Users AS u ON u.Id = l.UserId
        INNER JOIN dbo.LibraryModels AS lm ON lm.LibraryId = l.Id AND lm.IsPublic = 1
        WHERE l.IsPublic = 1
          AND (l.UserId <> @viewerId OR @ownerId = @viewerId)
          AND (@ownerId IS NULL OR l.UserId = @ownerId)
          AND (u.IsPublic = 1 OR EXISTS (
            SELECT 1 FROM dbo.UserFollows
            WHERE FollowerUserId = @viewerId AND FollowedUserId = u.Id
          ))
        GROUP BY l.Id, l.Name, l.IsPublic, l.CreatedAt, u.Id, u.Username, u.FullName
        ORDER BY l.Name, l.Id;`);
    return result.recordset;
  }

  async listSavedLibraries(userId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT l.Id AS id, l.Name AS name, l.IsPublic AS isPublic,
          u.Id AS ownerId, u.Username AS ownerUsername, u.FullName AS ownerName,
          s.CreatedAt AS savedAt,
          CAST(CASE WHEN EXISTS (
            SELECT 1 FROM dbo.LibraryAccessGrants AS g
            WHERE g.LibraryId = l.Id AND g.UserId = @userId
          ) THEN 1 ELSE 0 END AS bit) AS hasPrivateAccess
        FROM dbo.SavedLibraries AS s
        INNER JOIN dbo.Libraries AS l ON l.Id = s.LibraryId
        INNER JOIN dbo.Users AS u ON u.Id = l.UserId
        WHERE s.UserId = @userId
          AND (l.IsPublic = 1 OR EXISTS (
            SELECT 1 FROM dbo.LibraryAccessGrants AS g
            WHERE g.LibraryId = l.Id AND g.UserId = @userId
          ))
        ORDER BY s.CreatedAt DESC;`);
    return result.recordset;
  }

  async canViewLibrary(userId, libraryId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .query(`
        SELECT l.Id AS id
        FROM dbo.Libraries AS l
        WHERE l.Id = @libraryId
          AND (l.IsPublic = 1 OR EXISTS (
            SELECT 1 FROM dbo.LibraryAccessGrants
            WHERE LibraryId = l.Id AND UserId = @userId
          ));`);
    return Boolean(result.recordset[0]);
  }

  async saveLibrary(userId, libraryId) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const accessible = await new sql.Request(transaction)
        .input("userId", sql.Int, userId)
        .input("libraryId", sql.Int, libraryId)
        .query(`
          SELECT l.Id AS id, l.UserId AS ownerId
          FROM dbo.Libraries AS l WITH (UPDLOCK, HOLDLOCK)
          WHERE l.Id = @libraryId
            AND (l.IsPublic = 1 OR EXISTS (
              SELECT 1 FROM dbo.LibraryAccessGrants WITH (UPDLOCK, HOLDLOCK)
              WHERE LibraryId = l.Id AND UserId = @userId
            ));`);
      if (!accessible.recordset.length) {
        await transaction.rollback();
        return false;
      }

      const existing = await new sql.Request(transaction)
        .input("userId", sql.Int, userId)
        .input("libraryId", sql.Int, libraryId)
        .query(`
          SELECT UserId
          FROM dbo.SavedLibraries WITH (UPDLOCK, HOLDLOCK)
          WHERE UserId = @userId AND LibraryId = @libraryId;`);
      if (!existing.recordset.length) {
        await new sql.Request(transaction)
          .input("userId", sql.Int, userId)
          .input("libraryId", sql.Int, libraryId)
          .query(`
            INSERT INTO dbo.SavedLibraries (UserId, LibraryId)
            VALUES (@userId, @libraryId);`);
        const ownerId = accessible.recordset[0].ownerId;
        if (ownerId !== userId) {
          await new sql.Request(transaction)
            .input("ownerId", sql.Int, ownerId)
            .input("userId", sql.Int, userId)
            .input("libraryId", sql.Int, libraryId)
            .query(`
              INSERT INTO dbo.Notifications
                (RecipientUserId, ActorUserId, Type, LibraryId)
              VALUES (@ownerId, @userId, N'LIBRARY_SAVED', @libraryId);`);
        }
      }

      await transaction.commit();
      return true;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async unsaveLibrary(userId, libraryId) {
    await pool.request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .query("DELETE FROM dbo.SavedLibraries WHERE UserId = @userId AND LibraryId = @libraryId;");
  }

  async createInvite(userId, libraryId, tokenHash, expiresAt) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .input("tokenHash", sql.Char(64), tokenHash)
      .input("expiresAt", sql.DateTimeOffset, expiresAt)
      .query(`
        INSERT INTO dbo.LibraryInvites (LibraryId, CreatedByUserId, TokenHash, ExpiresAt)
        OUTPUT INSERTED.Id AS id, INSERTED.ExpiresAt AS expiresAt, INSERTED.CreatedAt AS createdAt
        SELECT @libraryId, @userId, @tokenHash, @expiresAt
        WHERE EXISTS (
          SELECT 1 FROM dbo.Libraries
          WHERE Id = @libraryId AND UserId = @userId AND IsPublic = 0
        );`);
    return result.recordset[0] ?? null;
  }

  async listInvites(userId, libraryId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .query(`
        SELECT i.Id AS id, i.CreatedAt AS createdAt, i.ExpiresAt AS expiresAt,
          i.RevokedAt AS revokedAt,
          CAST(CASE WHEN i.RevokedAt IS NULL AND i.ExpiresAt > SYSDATETIMEOFFSET()
            AND l.IsPublic = 0
            THEN 1 ELSE 0 END AS bit) AS isActive
        FROM dbo.LibraryInvites AS i
        INNER JOIN dbo.Libraries AS l ON l.Id = i.LibraryId
        WHERE i.LibraryId = @libraryId AND l.UserId = @userId
        ORDER BY i.CreatedAt DESC;`);
    return result.recordset;
  }

  async revokeInvite(userId, libraryId, inviteId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .input("inviteId", sql.Int, inviteId)
      .query(`
        UPDATE i SET RevokedAt = SYSDATETIMEOFFSET()
        FROM dbo.LibraryInvites AS i
        INNER JOIN dbo.Libraries AS l ON l.Id = i.LibraryId
        WHERE i.Id = @inviteId AND i.LibraryId = @libraryId
          AND l.UserId = @userId AND i.RevokedAt IS NULL;
        SELECT @@ROWCOUNT AS updated;`);
    return result.recordset[0].updated === 1;
  }

  async findInvite(tokenHash) {
    const result = await pool.request()
      .input("tokenHash", sql.Char(64), tokenHash)
      .query(`
        SELECT i.Id AS id, i.LibraryId AS libraryId, i.CreatedByUserId AS ownerId,
          l.Name AS libraryName, u.Username AS ownerUsername,
          i.ExpiresAt AS expiresAt
        FROM dbo.LibraryInvites AS i
        INNER JOIN dbo.Libraries AS l ON l.Id = i.LibraryId
        INNER JOIN dbo.Users AS u ON u.Id = i.CreatedByUserId
        WHERE i.TokenHash = @tokenHash AND i.RevokedAt IS NULL
          AND i.ExpiresAt > SYSDATETIMEOFFSET() AND l.IsPublic = 0;`);
    return result.recordset[0] ?? null;
  }

  async requestAccess(userId, invite, tokenHash) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const validInvite = await new sql.Request(transaction)
        .input("inviteId", sql.Int, invite.id)
        .input("tokenHash", sql.Char(64), tokenHash)
        .query(`
          SELECT Id AS id
          FROM dbo.LibraryInvites WITH (UPDLOCK, HOLDLOCK)
          WHERE Id = @inviteId AND TokenHash = @tokenHash
            AND RevokedAt IS NULL AND ExpiresAt > SYSDATETIMEOFFSET();`);
      if (!validInvite.recordset[0]) {
        await transaction.rollback();
        return null;
      }

      const request = new sql.Request(transaction)
        .input("inviteId", sql.Int, invite.id)
        .input("requesterId", sql.Int, userId);
      const existing = await request.query(`
        SELECT TOP (1) Id AS id, Status AS status
        FROM dbo.LibraryAccessRequests WITH (UPDLOCK, HOLDLOCK)
        WHERE InviteId = @inviteId AND RequesterUserId = @requesterId;`);
      if (existing.recordset[0]) {
        await transaction.commit();
        return { ...existing.recordset[0], alreadyRequested: true };
      }

      const inserted = await new sql.Request(transaction)
        .input("inviteId", sql.Int, invite.id)
        .input("requesterId", sql.Int, userId)
        .query(`
          INSERT INTO dbo.LibraryAccessRequests (InviteId, RequesterUserId)
          OUTPUT INSERTED.Id AS id, INSERTED.Status AS status
          VALUES (@inviteId, @requesterId);`);
      await new sql.Request(transaction)
        .input("ownerId", sql.Int, invite.ownerId)
        .input("requesterId", sql.Int, userId)
        .input("libraryId", sql.Int, invite.libraryId)
        .input("requestId", sql.Int, inserted.recordset[0].id)
        .query(`
          INSERT INTO dbo.Notifications
            (RecipientUserId, ActorUserId, Type, LibraryId, AccessRequestId)
          VALUES
            (@ownerId, @requesterId, N'LIBRARY_ACCESS_REQUEST', @libraryId, @requestId);`);
      await transaction.commit();
      return { ...inserted.recordset[0], alreadyRequested: false };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async listAccessRequests(userId, libraryId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .query(`
        SELECT r.Id AS id, r.Status AS status, r.RequestedAt AS requestedAt,
          u.Id AS requesterId, u.Username AS requesterUsername,
          u.FullName AS requesterName, i.Id AS inviteId
        FROM dbo.LibraryAccessRequests AS r
        INNER JOIN dbo.LibraryInvites AS i ON i.Id = r.InviteId
        INNER JOIN dbo.Libraries AS l ON l.Id = i.LibraryId
        INNER JOIN dbo.Users AS u ON u.Id = r.RequesterUserId
        WHERE i.LibraryId = @libraryId AND l.UserId = @userId
        ORDER BY CASE r.Status WHEN N'PENDING' THEN 0 ELSE 1 END, r.RequestedAt DESC;`);
    return result.recordset;
  }

  async resolveAccessRequest(userId, libraryId, requestId, status) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const request = new sql.Request(transaction)
        .input("userId", sql.Int, userId)
        .input("libraryId", sql.Int, libraryId)
        .input("requestId", sql.Int, requestId)
        .input("status", sql.NVarChar(16), status);
      const updated = await request.query(`
        UPDATE r SET Status = @status, ResolvedAt = SYSDATETIMEOFFSET()
        OUTPUT INSERTED.RequesterUserId AS requesterId, i.LibraryId AS libraryId
        FROM dbo.LibraryAccessRequests AS r
        INNER JOIN dbo.LibraryInvites AS i ON i.Id = r.InviteId
        INNER JOIN dbo.Libraries AS l ON l.Id = i.LibraryId
        WHERE r.Id = @requestId AND i.LibraryId = @libraryId
          AND l.UserId = @userId AND r.Status = N'PENDING'
          AND i.RevokedAt IS NULL AND i.ExpiresAt > SYSDATETIMEOFFSET();`);
      const resolved = updated.recordset[0];
      if (!resolved) {
        await transaction.rollback();
        return null;
      }
      if (status === "APPROVED") {
        await new sql.Request(transaction)
          .input("libraryId", sql.Int, resolved.libraryId)
          .input("requesterId", sql.Int, resolved.requesterId)
          .input("userId", sql.Int, userId)
          .input("requestId", sql.Int, requestId)
          .query(`
            IF NOT EXISTS (
              SELECT 1 FROM dbo.LibraryAccessGrants WITH (UPDLOCK, HOLDLOCK)
              WHERE LibraryId = @libraryId AND UserId = @requesterId
            )
              INSERT INTO dbo.LibraryAccessGrants (LibraryId, UserId, GrantedByUserId)
              VALUES (@libraryId, @requesterId, @userId);`);
      }
      await new sql.Request(transaction)
        .input("requesterId", sql.Int, resolved.requesterId)
        .input("userId", sql.Int, userId)
        .input("libraryId", sql.Int, resolved.libraryId)
        .input("requestId", sql.Int, requestId)
        .input("type", sql.NVarChar(32), status === "APPROVED"
          ? "LIBRARY_ACCESS_APPROVED"
          : "LIBRARY_ACCESS_DECLINED")
        .query(`
          INSERT INTO dbo.Notifications
            (RecipientUserId, ActorUserId, Type, LibraryId, AccessRequestId)
          VALUES
            (@requesterId, @userId, @type, @libraryId, @requestId);`);
      await transaction.commit();
      return { ...resolved, status };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async listAccessGrants(userId, libraryId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .query(`
        SELECT g.UserId AS userId, u.Username AS username, u.FullName AS fullName,
          g.CreatedAt AS grantedAt
        FROM dbo.LibraryAccessGrants AS g
        INNER JOIN dbo.Libraries AS l ON l.Id = g.LibraryId
        INNER JOIN dbo.Users AS u ON u.Id = g.UserId
        WHERE g.LibraryId = @libraryId AND l.UserId = @userId
        ORDER BY u.Username;`);
    return result.recordset;
  }

  async revokeAccess(userId, libraryId, recipientId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .input("recipientId", sql.Int, recipientId)
      .query(`
        DELETE g
        FROM dbo.LibraryAccessGrants AS g
        INNER JOIN dbo.Libraries AS l ON l.Id = g.LibraryId
        WHERE g.LibraryId = @libraryId AND g.UserId = @recipientId AND l.UserId = @userId;
        SELECT @@ROWCOUNT AS deleted;`);
    return result.recordset[0].deleted === 1;
  }

  async listSharedLibraries(userId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT l.Id AS id, l.Name AS name, l.IsPublic AS isPublic,
          u.Id AS ownerId, u.Username AS ownerUsername, u.FullName AS ownerName,
          g.CreatedAt AS grantedAt,
          CAST(CASE WHEN EXISTS (
            SELECT 1 FROM dbo.SavedLibraries AS s
            WHERE s.UserId = @userId AND s.LibraryId = l.Id
          ) THEN 1 ELSE 0 END AS bit) AS isSaved
        FROM dbo.LibraryAccessGrants AS g
        INNER JOIN dbo.Libraries AS l ON l.Id = g.LibraryId
        INNER JOIN dbo.Users AS u ON u.Id = l.UserId
        WHERE g.UserId = @userId
        ORDER BY g.CreatedAt DESC;`);
    return result.recordset;
  }

  async hasAccess(userId, libraryId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .query(`
        SELECT CAST(CASE WHEN EXISTS (
          SELECT 1 FROM dbo.LibraryAccessGrants
          WHERE UserId = @userId AND LibraryId = @libraryId
        ) THEN 1 ELSE 0 END AS bit) AS hasAccess;`);
    return result.recordset[0].hasAccess;
  }
}
