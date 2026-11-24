import { pool, sql } from "../database.js";
import { LIBRARY_MODELS, findLibraryModel } from "../config/libraryModels.js";
import {
  ENTRY_TYPES,
  READING_SECTIONS,
  READING_SECTION_TYPES,
  READING_SPACE_TYPES,
} from "../config/entryTypes.js";

const LIBRARY_COLUMNS = `
  Id AS id,
  UserId AS userId,
  LibraryIndex AS libraryIndex,
  Name AS name,
  IsPublic AS isPublic,
  CreatedAt AS createdAt,
  UpdatedAt AS updatedAt`;

const ENTRY_COLUMNS = `
  e.Id AS id,
  e.LibraryId AS libraryId,
  e.ParentEntryId AS parentEntryId,
  e.EntryType AS entryType,
  e.Title AS title,
  e.Content AS content,
  e.Url AS url,
  e.CreatedAt AS createdAt,
  e.UpdatedAt AS updatedAt`;

const COMMUNITY_ENTRY_TYPES = new Set(
  Object.values(ENTRY_TYPES).filter((entryType) => !READING_SECTION_TYPES.includes(entryType)),
);

export class LibraryRepository {
  async listForUser(userId) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT ${LIBRARY_COLUMNS}
        FROM dbo.Libraries
        WHERE UserId = @userId
        ORDER BY LibraryIndex;`);

    return result.recordset;
  }

  async listPublic(userId) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .query(`
        SELECT l.Id AS id,
          l.Name AS name,
          l.IsPublic AS isPublic,
          l.CreatedAt AS createdAt,
          u.Id AS ownerId,
          u.Username AS ownerUsername,
          u.FullName AS ownerName,
          COUNT(DISTINCT lm.ModelKey) AS publicModelCount
        FROM dbo.Libraries AS l
        INNER JOIN dbo.Users AS u ON u.Id = l.UserId
        INNER JOIN dbo.LibraryModels AS lm ON lm.LibraryId = l.Id AND lm.IsPublic = 1
        WHERE l.IsPublic = 1
          AND l.UserId <> @userId
        GROUP BY l.Id, l.Name, l.IsPublic, l.CreatedAt, u.Id, u.Username, u.FullName
        ORDER BY l.Name, l.Id;`);

    return result.recordset;
  }

  async create(userId, name) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);

    try {
      const indexResult = await new sql.Request(transaction)
        .input("userId", sql.Int, userId)
        .query(`
          SELECT ISNULL(MAX(LibraryIndex), 0) + 1 AS libraryIndex
          FROM dbo.Libraries WITH (UPDLOCK, HOLDLOCK)
          WHERE UserId = @userId;`);

      const result = await new sql.Request(transaction)
        .input("userId", sql.Int, userId)
        .input("libraryIndex", sql.Int, indexResult.recordset[0].libraryIndex)
        .input("name", sql.NVarChar(100), name)
        .query(`
          INSERT INTO dbo.Libraries (UserId, LibraryIndex, Name)
          OUTPUT
            INSERTED.Id AS id,
            INSERTED.UserId AS userId,
            INSERTED.LibraryIndex AS libraryIndex,
            INSERTED.Name AS name,
            INSERTED.IsPublic AS isPublic,
            INSERTED.CreatedAt AS createdAt,
            INSERTED.UpdatedAt AS updatedAt
          VALUES (@userId, @libraryIndex, @name);`);

      const modelsRequest = new sql.Request(transaction).input("libraryId", sql.Int, result.recordset[0].id);
      LIBRARY_MODELS.forEach((model, index) => {
        modelsRequest.input(`modelKey${index}`, sql.NVarChar(32), model.key);
      });
      await modelsRequest.query(`
        INSERT INTO dbo.LibraryModels (LibraryId, ModelKey)
        VALUES ${LIBRARY_MODELS.map((_, index) => `(@libraryId, @modelKey${index})`).join(", ")};`);

      await transaction.commit();
      return result.recordset[0];
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async findForUser(userId, libraryId) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .query(`
        SELECT ${LIBRARY_COLUMNS}
        FROM dbo.Libraries
        WHERE UserId = @userId AND Id = @libraryId;`);

    return result.recordset[0] ?? null;
  }

  async update(userId, libraryId, { name, isPublic }) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .input("name", sql.NVarChar(100), name)
      .input("isPublic", sql.Bit, isPublic)
      .query(`
        UPDATE dbo.Libraries
        SET Name = COALESCE(@name, Name),
            IsPublic = COALESCE(@isPublic, IsPublic),
            UpdatedAt = SYSDATETIMEOFFSET()
        WHERE UserId = @userId AND Id = @libraryId;

        SELECT ${LIBRARY_COLUMNS}
        FROM dbo.Libraries
        WHERE UserId = @userId AND Id = @libraryId;`);

    return result.recordset[0] ?? null;
  }

  async listModels(userId, libraryId) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .query(`
        SELECT lm.ModelKey AS modelKey,
          lm.IsPublic AS isPublic,
          lm.UpdatedAt AS updatedAt
        FROM dbo.LibraryModels AS lm
        INNER JOIN dbo.Libraries AS l ON l.Id = lm.LibraryId
        WHERE l.UserId = @userId
          AND l.Id = @libraryId
        ORDER BY CASE lm.ModelKey
          WHEN N'words' THEN 1
          WHEN N'phrases' THEN 2
          WHEN N'reading-spaces' THEN 3
          WHEN N'poetry' THEN 4
          WHEN N'research' THEN 5
        END;`);

    return result.recordset;
  }

  async updateModelVisibility(userId, libraryId, modelKey, isPublic) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .input("modelKey", sql.NVarChar(32), modelKey)
      .input("isPublic", sql.Bit, isPublic)
      .query(`
        UPDATE lm
        SET IsPublic = @isPublic,
            UpdatedAt = SYSDATETIMEOFFSET()
        OUTPUT INSERTED.ModelKey AS modelKey,
          INSERTED.IsPublic AS isPublic,
          INSERTED.UpdatedAt AS updatedAt
        FROM dbo.LibraryModels AS lm
        INNER JOIN dbo.Libraries AS l ON l.Id = lm.LibraryId
        WHERE l.UserId = @userId
          AND l.Id = @libraryId
          AND lm.ModelKey = @modelKey;`);

    return result.recordset[0] ?? null;
  }

  async findPublicLibrary(libraryId) {
    const result = await pool
      .request()
      .input("libraryId", sql.Int, libraryId)
      .query(`
        SELECT l.Id AS id,
          l.Name AS name,
          l.IsPublic AS isPublic,
          u.Id AS ownerId,
          u.Username AS ownerUsername,
          u.FullName AS ownerName,
          l.CreatedAt AS createdAt
        FROM dbo.Libraries AS l
        INNER JOIN dbo.Users AS u ON u.Id = l.UserId
        WHERE l.Id = @libraryId
          AND l.IsPublic = 1;`);

    return result.recordset[0] ?? null;
  }

  async listPublicModels(libraryId) {
    const result = await pool
      .request()
      .input("libraryId", sql.Int, libraryId)
      .query(`
        SELECT lm.ModelKey AS modelKey,
          lm.IsPublic AS isPublic,
          lm.UpdatedAt AS updatedAt
        FROM dbo.LibraryModels AS lm
        INNER JOIN dbo.Libraries AS l ON l.Id = lm.LibraryId
        WHERE l.Id = @libraryId
          AND l.IsPublic = 1
          AND lm.IsPublic = 1
        ORDER BY CASE lm.ModelKey
          WHEN N'words' THEN 1
          WHEN N'phrases' THEN 2
          WHEN N'reading-spaces' THEN 3
          WHEN N'poetry' THEN 4
          WHEN N'research' THEN 5
        END;`);

    return result.recordset;
  }

  async listPublicEntries(libraryId, modelKey, parentEntryId) {
    const model = findLibraryModel(modelKey);
    if (!model) return [];

    const request = pool
      .request()
      .input("libraryId", sql.Int, libraryId)
      .input("modelKey", sql.NVarChar(32), modelKey)
      .input("parentEntryId", sql.Int, parentEntryId);
    const entryTypeParameters = model.entryTypes.map((entryType, index) => {
      request.input(`entryType${index}`, sql.NVarChar(32), entryType);
      return `@entryType${index}`;
    }).join(", ");
    const readingSpaceFilter = modelKey === "reading-spaces"
      ? `(
          (@parentEntryId IS NULL
            AND e.ParentEntryId IS NULL
            AND e.EntryType IN (${entryTypeParameters}))
          OR (@parentEntryId IS NOT NULL
            AND e.ParentEntryId = @parentEntryId
            AND EXISTS (
              SELECT 1
              FROM dbo.LibraryEntries AS parent
              WHERE parent.Id = @parentEntryId
                AND parent.LibraryId = e.LibraryId
                AND (
                  (parent.ParentEntryId IS NULL AND parent.EntryType IN (N'BOOK', N'PAPER', N'ARTICLE'))
                  OR (parent.EntryType IN (N'WORDS_SECTION', N'PHRASES_SECTION', N'THEORIES_SECTION')
                    AND EXISTS (
                      SELECT 1 FROM dbo.LibraryEntries AS readingSpace
                      WHERE readingSpace.Id = parent.ParentEntryId
                        AND readingSpace.LibraryId = parent.LibraryId
                        AND readingSpace.EntryType IN (N'BOOK', N'PAPER', N'ARTICLE')
                    ))
                )
            ))
        )`
      : `e.ParentEntryId IS NULL AND e.EntryType IN (${entryTypeParameters})`;
    const result = await request.query(`
      SELECT ${ENTRY_COLUMNS}
      FROM dbo.LibraryEntries AS e
      INNER JOIN dbo.Libraries AS l ON l.Id = e.LibraryId
      INNER JOIN dbo.LibraryModels AS lm ON lm.LibraryId = l.Id
      WHERE l.Id = @libraryId
        AND l.IsPublic = 1
        AND lm.ModelKey = @modelKey
        AND lm.IsPublic = 1
        AND ${readingSpaceFilter}
      ORDER BY e.Title, e.Id;`);

    return result.recordset;
  }

  async findAccessibleLibrary(userId, libraryId) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .query(`
        SELECT l.Id AS id, l.Name AS name, l.IsPublic AS isPublic,
          l.CreatedAt AS createdAt, u.Id AS ownerId,
          u.Username AS ownerUsername, u.FullName AS ownerName
        FROM dbo.Libraries AS l
        INNER JOIN dbo.Users AS u ON u.Id = l.UserId
        WHERE l.Id = @libraryId
          AND (l.IsPublic = 1 OR EXISTS (
            SELECT 1 FROM dbo.LibraryAccessGrants AS g
            WHERE g.LibraryId = l.Id AND g.UserId = @userId
          ));`);
    return result.recordset[0] ?? null;
  }

  async listAccessibleModels(userId, libraryId) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .query(`
        SELECT lm.ModelKey AS modelKey, lm.IsPublic AS isPublic,
          lm.UpdatedAt AS updatedAt
        FROM dbo.LibraryModels AS lm
        INNER JOIN dbo.Libraries AS l ON l.Id = lm.LibraryId
        WHERE l.Id = @libraryId
          AND (
            (l.IsPublic = 1 AND lm.IsPublic = 1)
            OR EXISTS (
              SELECT 1 FROM dbo.LibraryAccessGrants AS g
              WHERE g.LibraryId = l.Id AND g.UserId = @userId
            )
          )
        ORDER BY CASE lm.ModelKey
          WHEN N'words' THEN 1
          WHEN N'phrases' THEN 2
          WHEN N'reading-spaces' THEN 3
          WHEN N'poetry' THEN 4
          WHEN N'research' THEN 5
        END;`);
    return result.recordset;
  }

  async listAccessibleEntries(userId, libraryId, modelKey, parentEntryId) {
    const model = findLibraryModel(modelKey);
    if (!model) return [];
    const request = pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .input("modelKey", sql.NVarChar(32), modelKey)
      .input("parentEntryId", sql.Int, parentEntryId);
    const entryTypeParameters = model.entryTypes.map((entryType, index) => {
      request.input(`entryType${index}`, sql.NVarChar(32), entryType);
      return `@entryType${index}`;
    }).join(", ");
    const entryFilter = modelKey === "reading-spaces"
      ? `(
          (@parentEntryId IS NULL
            AND e.ParentEntryId IS NULL
            AND e.EntryType IN (${entryTypeParameters}))
          OR (@parentEntryId IS NOT NULL
            AND e.ParentEntryId = @parentEntryId
            AND EXISTS (
              SELECT 1
              FROM dbo.LibraryEntries AS parent
              WHERE parent.Id = @parentEntryId
                AND parent.LibraryId = e.LibraryId
                AND (
                  (parent.ParentEntryId IS NULL AND parent.EntryType IN (N'BOOK', N'PAPER', N'ARTICLE'))
                  OR (parent.EntryType IN (N'WORDS_SECTION', N'PHRASES_SECTION', N'THEORIES_SECTION')
                    AND EXISTS (
                      SELECT 1 FROM dbo.LibraryEntries AS readingSpace
                      WHERE readingSpace.Id = parent.ParentEntryId
                        AND readingSpace.LibraryId = parent.LibraryId
                        AND readingSpace.EntryType IN (N'BOOK', N'PAPER', N'ARTICLE')
                    ))
                )
            ))
        )`
      : `e.ParentEntryId IS NULL AND e.EntryType IN (${entryTypeParameters})`;
    const result = await request.query(`
      SELECT ${ENTRY_COLUMNS}
      FROM dbo.LibraryEntries AS e
      INNER JOIN dbo.Libraries AS l ON l.Id = e.LibraryId
      INNER JOIN dbo.LibraryModels AS lm ON lm.LibraryId = l.Id
      WHERE l.Id = @libraryId
        AND lm.ModelKey = @modelKey
        AND (
          (l.IsPublic = 1 AND lm.IsPublic = 1)
          OR EXISTS (
            SELECT 1 FROM dbo.LibraryAccessGrants AS g
            WHERE g.LibraryId = l.Id AND g.UserId = @userId
          )
        )
        AND ${entryFilter}
      ORDER BY e.Title, e.Id;`);
    return result.recordset;
  }

  async listEntries(userId, libraryId, entryType, parentEntryId) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .input("entryType", sql.NVarChar(32), entryType)
      .input("parentEntryId", sql.Int, parentEntryId)
      .query(`
        SELECT ${ENTRY_COLUMNS}
        FROM dbo.LibraryEntries AS e
        INNER JOIN dbo.Libraries AS l ON l.Id = e.LibraryId
        WHERE l.UserId = @userId
          AND e.LibraryId = @libraryId
          AND e.EntryType = @entryType
          AND (
            (@parentEntryId IS NULL AND e.ParentEntryId IS NULL)
            OR e.ParentEntryId = @parentEntryId
          )
        ORDER BY e.Title, e.Id;`);

    return result.recordset;
  }

  async listAllEntries(userId, libraryId, parentEntryId) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .input("parentEntryId", sql.Int, parentEntryId)
      .query(`
        SELECT ${ENTRY_COLUMNS}
        FROM dbo.LibraryEntries AS e
        INNER JOIN dbo.Libraries AS l ON l.Id = e.LibraryId
        WHERE l.UserId = @userId
          AND e.LibraryId = @libraryId
          AND (
            (@parentEntryId IS NULL AND e.ParentEntryId IS NULL)
            OR e.ParentEntryId = @parentEntryId
          )
        ORDER BY e.Title, e.Id;`);

    return result.recordset;
  }

  async listReadingSpaces(userId, libraryId) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .query(`
        SELECT ${ENTRY_COLUMNS}
        FROM dbo.LibraryEntries AS e
        INNER JOIN dbo.Libraries AS l ON l.Id = e.LibraryId
        WHERE l.UserId = @userId
          AND e.LibraryId = @libraryId
          AND e.ParentEntryId IS NULL
          AND e.EntryType IN (N'BOOK', N'PAPER', N'ARTICLE')
        ORDER BY e.Title, e.Id;`);

    return result.recordset;
  }

  async findEntryForUser(userId, libraryId, entryId, entryType) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .input("entryId", sql.Int, entryId)
      .input("entryType", sql.NVarChar(32), entryType)
      .query(`
        SELECT ${ENTRY_COLUMNS}
        FROM dbo.LibraryEntries AS e
        INNER JOIN dbo.Libraries AS l ON l.Id = e.LibraryId
        WHERE l.UserId = @userId
          AND e.LibraryId = @libraryId
          AND e.Id = @entryId
          AND e.EntryType = @entryType;`);

    return result.recordset[0] ?? null;
  }

  async findAnyEntryForUser(userId, libraryId, entryId) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .input("entryId", sql.Int, entryId)
      .query(`
        SELECT ${ENTRY_COLUMNS}
        FROM dbo.LibraryEntries AS e
        INNER JOIN dbo.Libraries AS l ON l.Id = e.LibraryId
        WHERE l.UserId = @userId
          AND e.LibraryId = @libraryId
          AND e.Id = @entryId;`);

    return result.recordset[0] ?? null;
  }

  async createEntry(userId, libraryId, entry) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin();

    try {
      const result = await new sql.Request(transaction)
        .input("userId", sql.Int, userId)
        .input("libraryId", sql.Int, libraryId)
        .input("parentEntryId", sql.Int, entry.parentEntryId)
        .input("entryType", sql.NVarChar(32), entry.entryType)
        .input("title", sql.NVarChar(255), entry.title)
        .input("content", sql.NVarChar(sql.MAX), entry.content)
        .input("url", sql.NVarChar(2048), entry.url)
        .query(`
          INSERT INTO dbo.LibraryEntries
            (LibraryId, ParentEntryId, EntryType, Title, Content, Url)
          OUTPUT
            INSERTED.Id AS id,
            INSERTED.LibraryId AS libraryId,
            INSERTED.ParentEntryId AS parentEntryId,
            INSERTED.EntryType AS entryType,
            INSERTED.Title AS title,
            INSERTED.Content AS content,
            INSERTED.Url AS url,
            INSERTED.CreatedAt AS createdAt,
            INSERTED.UpdatedAt AS updatedAt
          SELECT @libraryId, @parentEntryId, @entryType, @title, @content, @url
          WHERE EXISTS (
            SELECT 1
            FROM dbo.Libraries
            WHERE Id = @libraryId AND UserId = @userId
          );`);
      const created = result.recordset[0] ?? null;

      if (created && READING_SPACE_TYPES.includes(entry.entryType)) {
        const request = new sql.Request(transaction)
          .input("libraryId", sql.Int, libraryId)
          .input("readingSpaceId", sql.Int, created.id);
        READING_SECTIONS.forEach(({ type, title }, index) => {
          request.input(`sectionType${index}`, sql.NVarChar(32), type);
          request.input(`sectionTitle${index}`, sql.NVarChar(255), title);
        });
        await request.query(`
          INSERT INTO dbo.LibraryEntries
            (LibraryId, ParentEntryId, EntryType, Title)
          VALUES
            (@libraryId, @readingSpaceId, @sectionType0, @sectionTitle0),
            (@libraryId, @readingSpaceId, @sectionType1, @sectionTitle1),
            (@libraryId, @readingSpaceId, @sectionType2, @sectionTitle2);`);
      }

      await transaction.commit();
      return created;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async updateEntry(userId, libraryId, entryId, entryType, entry) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .input("entryId", sql.Int, entryId)
      .input("entryType", sql.NVarChar(32), entryType)
      .input("title", sql.NVarChar(255), entry.title)
      .input("content", sql.NVarChar(sql.MAX), entry.content)
      .input("url", sql.NVarChar(2048), entry.url)
      .query(`
        UPDATE e
        SET Title = @title,
            Content = @content,
            Url = @url,
            UpdatedAt = SYSDATETIMEOFFSET()
        OUTPUT
          INSERTED.Id AS id,
          INSERTED.LibraryId AS libraryId,
          INSERTED.ParentEntryId AS parentEntryId,
          INSERTED.EntryType AS entryType,
          INSERTED.Title AS title,
          INSERTED.Content AS content,
          INSERTED.Url AS url,
          INSERTED.CreatedAt AS createdAt,
          INSERTED.UpdatedAt AS updatedAt
        FROM dbo.LibraryEntries AS e
        INNER JOIN dbo.Libraries AS l ON l.Id = e.LibraryId
        WHERE l.UserId = @userId
          AND e.LibraryId = @libraryId
          AND e.Id = @entryId
          AND e.EntryType = @entryType;`);

    return result.recordset[0] ?? null;
  }

  async hasChildEntries(userId, libraryId, entryId) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .input("entryId", sql.Int, entryId)
      .query(`
        SELECT CAST(CASE WHEN EXISTS (
          SELECT 1
          FROM dbo.LibraryEntries AS child
          INNER JOIN dbo.Libraries AS l ON l.Id = child.LibraryId
          WHERE l.UserId = @userId
            AND child.LibraryId = @libraryId
            AND child.ParentEntryId = @entryId
        ) THEN 1 ELSE 0 END AS bit) AS hasChildren;`);

    return result.recordset[0].hasChildren;
  }

  async deleteEntry(userId, libraryId, entryId, entryType) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .input("entryId", sql.Int, entryId)
      .input("entryType", sql.NVarChar(32), entryType)
      .query(`
        DELETE e
        FROM dbo.LibraryEntries AS e
        INNER JOIN dbo.Libraries AS l ON l.Id = e.LibraryId
        WHERE l.UserId = @userId
          AND e.LibraryId = @libraryId
          AND e.Id = @entryId
          AND e.EntryType = @entryType
          AND NOT EXISTS (
            SELECT 1
            FROM dbo.LibraryEntries AS child
            WHERE child.ParentEntryId = e.Id
          );
        SELECT @@ROWCOUNT AS deleted;`);

    return result.recordset[0].deleted === 1;
  }

  async getCommunityMembership(userId, communityId) {
    const result = await pool.request()
      .input("userId", sql.Int, userId)
      .input("communityId", sql.Int, communityId)
      .query(`
        SELECT Role AS role
        FROM dbo.CommunityMemberships
        WHERE UserId = @userId AND CommunityId = @communityId;`);
    return result.recordset[0] ?? null;
  }

  async listCommunityLibraries(userId, communityId) {
    const transaction = new sql.Transaction(pool);
    await transaction.begin(sql.ISOLATION_LEVEL.SERIALIZABLE);
    try {
      const result = await new sql.Request(transaction)
        .input("communityId", sql.Int, communityId)
        .input("userId", sql.Int, userId)
        .query(`
          IF EXISTS (
            SELECT 1 FROM dbo.CommunityMemberships WITH (UPDLOCK, HOLDLOCK)
            WHERE CommunityId = @communityId AND UserId = @userId
          )
          BEGIN
            INSERT INTO dbo.CommunitySharedLibraries
              (CommunityId, Name, Description, ModelKey, CreatedByUserId)
            SELECT @communityId, model.Name, model.Description, model.ModelKey, c.OwnerUserId
            FROM dbo.Communities AS c
            CROSS JOIN (VALUES
              (N'words', N'Words', N'Shared words and definitions.'),
              (N'phrases', N'Phrases & idioms', N'Shared expressions and turns of phrase.'),
              (N'reading-spaces', N'Reading spaces', N'Shared books, papers, and articles.'),
              (N'poetry', N'Poetry & drama', N'Shared poems, poetic devices, and plays.'),
              (N'research', N'Custom models & research', N'Shared theories, models, and research.')
            ) AS model(ModelKey, Name, Description)
            WHERE c.Id = @communityId
              AND NOT EXISTS (
                SELECT 1
                FROM dbo.CommunitySharedLibraries AS existing WITH (UPDLOCK, HOLDLOCK)
                WHERE existing.CommunityId = @communityId
                  AND existing.ModelKey = model.ModelKey
              );
          END;

          SELECT l.Id AS id, l.CommunityId AS communityId, l.Name AS name,
            l.Description AS description, l.ModelKey AS modelKey,
            l.CreatedByUserId AS createdByUserId,
            u.Username AS createdByUsername, u.FullName AS createdByName,
            l.CreatedAt AS createdAt, l.UpdatedAt AS updatedAt,
            (SELECT COUNT(*) FROM dbo.CommunitySharedLibraryEntries
             WHERE LibraryId = l.Id) AS entryCount
          FROM dbo.CommunitySharedLibraries AS l
          INNER JOIN dbo.Users AS u ON u.Id = l.CreatedByUserId
          WHERE l.CommunityId = @communityId
            AND EXISTS (
              SELECT 1 FROM dbo.CommunityMemberships
              WHERE CommunityId = @communityId AND UserId = @userId
            )
          ORDER BY CASE l.ModelKey
            WHEN N'words' THEN 1 WHEN N'phrases' THEN 2
            WHEN N'reading-spaces' THEN 3 WHEN N'poetry' THEN 4
            WHEN N'research' THEN 5 ELSE 6 END, l.Name, l.Id;`);
      await transaction.commit();
      return result.recordset.length ? result.recordset : null;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async createCommunityLibrary(userId, communityId, name, description) {
    const membership = await this.getCommunityMembership(userId, communityId);
    if (!membership) return null;
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .input("userId", sql.Int, userId)
      .input("name", sql.NVarChar(100), name)
      .input("description", sql.NVarChar(500), description)
      .query(`
        INSERT INTO dbo.CommunitySharedLibraries
          (CommunityId, Name, Description, CreatedByUserId)
        OUTPUT INSERTED.Id AS id, INSERTED.CommunityId AS communityId,
          INSERTED.Name AS name, INSERTED.Description AS description,
          INSERTED.CreatedByUserId AS createdByUserId,
          INSERTED.CreatedAt AS createdAt, INSERTED.UpdatedAt AS updatedAt
        VALUES (@communityId, @name, @description, @userId);`);
    await this.notifyCommunityMembers(userId, communityId, "created a shared library");
    return result.recordset[0];
  }

  async findCommunityLibrary(userId, communityId, libraryId) {
    const membership = await this.getCommunityMembership(userId, communityId);
    if (!membership) return null;
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .input("libraryId", sql.Int, libraryId)
      .query(`
        SELECT l.Id AS id, l.CommunityId AS communityId, l.Name AS name,
          l.Description AS description, l.CreatedByUserId AS createdByUserId,
          l.ModelKey AS modelKey,
          l.CreatedAt AS createdAt, l.UpdatedAt AS updatedAt
        FROM dbo.CommunitySharedLibraries AS l
        WHERE l.Id = @libraryId AND l.CommunityId = @communityId;`);
    return result.recordset[0] ?? null;
  }

  async updateCommunityLibrary(userId, communityId, libraryId, name, description) {
    const membership = await this.getCommunityMembership(userId, communityId);
    if (!membership || !["OWNER", "ADMIN"].includes(membership.role)) return null;
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .input("libraryId", sql.Int, libraryId)
      .input("name", sql.NVarChar(100), name)
      .input("description", sql.NVarChar(500), description)
      .query(`
        UPDATE l
        SET Name = COALESCE(@name, Name),
            Description = COALESCE(@description, Description),
            UpdatedAt = SYSDATETIMEOFFSET()
        FROM dbo.CommunitySharedLibraries AS l
        WHERE l.Id = @libraryId AND l.CommunityId = @communityId;
        SELECT l.Id AS id, l.CommunityId AS communityId, l.Name AS name,
          l.Description AS description, l.CreatedByUserId AS createdByUserId,
          l.CreatedAt AS createdAt, l.UpdatedAt AS updatedAt
        FROM dbo.CommunitySharedLibraries AS l
        WHERE l.Id = @libraryId AND l.CommunityId = @communityId;`);
    return result.recordset[0] ?? null;
  }

  async deleteCommunityLibrary(userId, communityId, libraryId) {
    const membership = await this.getCommunityMembership(userId, communityId);
    if (!membership || membership.role !== "OWNER") return null;
    const result = await pool.request()
      .input("communityId", sql.Int, communityId)
      .input("libraryId", sql.Int, libraryId)
      .query(`
        DELETE FROM dbo.CommunitySharedLibraries
        WHERE Id = @libraryId AND CommunityId = @communityId AND ModelKey IS NULL;
        SELECT @@ROWCOUNT AS deleted;`);
    const deleted = result.recordset[0].deleted === 1;
    if (deleted) await this.notifyCommunityManagers(userId, communityId, "deleted a shared library");
    return deleted;
  }

  async listCommunityEntries(userId, communityId, libraryId) {
    const library = await this.findCommunityLibrary(userId, communityId, libraryId);
    if (!library) return null;
    const result = await pool.request()
      .input("libraryId", sql.Int, libraryId)
      .query(`
        SELECT e.Id AS id, e.LibraryId AS libraryId, e.Title AS title,
        e.EntryType AS entryType, e.Content AS content, e.Url AS url,
        e.ContributorUserId AS contributorId,
          u.Username AS contributorUsername, u.FullName AS contributorName,
          e.CreatedAt AS createdAt, e.UpdatedAt AS updatedAt
        FROM dbo.CommunitySharedLibraryEntries AS e
        INNER JOIN dbo.Users AS u ON u.Id = e.ContributorUserId
        WHERE e.LibraryId = @libraryId
        ORDER BY e.CreatedAt DESC, e.Id DESC;`);
    return result.recordset;
  }

  async createCommunityEntry(userId, communityId, libraryId, entryType, title, content, url) {
    const library = await this.findCommunityLibrary(userId, communityId, libraryId);
    if (!library) return null;
    const allowedTypes = library.modelKey
      ? findLibraryModel(library.modelKey)?.entryTypes ?? []
      : [...COMMUNITY_ENTRY_TYPES];
    if (!allowedTypes.includes(entryType)) return null;
    const result = await pool.request()
      .input("libraryId", sql.Int, libraryId)
      .input("userId", sql.Int, userId)
      .input("entryType", sql.NVarChar(32), entryType)
      .input("title", sql.NVarChar(255), title)
      .input("content", sql.NVarChar(sql.MAX), content)
      .input("url", sql.NVarChar(2048), url)
      .query(`
        INSERT INTO dbo.CommunitySharedLibraryEntries
          (LibraryId, ContributorUserId, EntryType, Title, Content, Url)
        OUTPUT INSERTED.Id AS id, INSERTED.LibraryId AS libraryId,
          INSERTED.ContributorUserId AS contributorId,
          INSERTED.EntryType AS entryType,
          INSERTED.Title AS title, INSERTED.Content AS content, INSERTED.Url AS url,
          INSERTED.CreatedAt AS createdAt, INSERTED.UpdatedAt AS updatedAt
        VALUES (@libraryId, @userId, @entryType, @title, @content, @url);`);
    await this.notifyCommunityManagers(userId, communityId, "added an entry to a shared library");
    return result.recordset[0];
  }

  async updateCommunityEntry(userId, communityId, libraryId, entryId, title, content, url) {
    const membership = await this.getCommunityMembership(userId, communityId);
    if (!membership) return null;
    const result = await pool.request()
      .input("libraryId", sql.Int, libraryId)
      .input("communityId", sql.Int, communityId)
      .input("entryId", sql.Int, entryId)
      .input("userId", sql.Int, userId)
      .input("title", sql.NVarChar(255), title)
      .input("content", sql.NVarChar(sql.MAX), content)
      .input("url", sql.NVarChar(2048), url)
      .query(`
        UPDATE e
        SET Title = COALESCE(@title, Title),
            Content = COALESCE(@content, Content),
            Url = COALESCE(@url, Url),
            UpdatedAt = SYSDATETIMEOFFSET()
        OUTPUT INSERTED.Id AS id, INSERTED.LibraryId AS libraryId,
          INSERTED.ContributorUserId AS contributorId,
          INSERTED.EntryType AS entryType,
          INSERTED.Title AS title, INSERTED.Content AS content, INSERTED.Url AS url,
          INSERTED.CreatedAt AS createdAt, INSERTED.UpdatedAt AS updatedAt
        FROM dbo.CommunitySharedLibraryEntries AS e
        INNER JOIN dbo.CommunitySharedLibraries AS l ON l.Id = e.LibraryId
        WHERE e.Id = @entryId
          AND e.LibraryId = @libraryId
          AND l.CommunityId = @communityId
          AND (
            e.ContributorUserId = @userId
            OR EXISTS (
              SELECT 1 FROM dbo.CommunityMemberships
              WHERE CommunityId = @communityId AND UserId = @userId
                AND Role IN (N'OWNER', N'ADMIN')
            )
          );
      `);
    if (result.recordset[0]) {
      await this.notifyCommunityManagers(userId, communityId, "updated an entry in a shared library");
    }
    return result.recordset[0] ?? null;
  }

  async deleteCommunityEntry(userId, communityId, libraryId, entryId) {
    const membership = await this.getCommunityMembership(userId, communityId);
    if (!membership) return null;
    const result = await pool.request()
      .input("libraryId", sql.Int, libraryId)
      .input("communityId", sql.Int, communityId)
      .input("entryId", sql.Int, entryId)
      .input("userId", sql.Int, userId)
      .query(`
        DELETE e
        FROM dbo.CommunitySharedLibraryEntries AS e
        INNER JOIN dbo.CommunitySharedLibraries AS l ON l.Id = e.LibraryId
        WHERE e.Id = @entryId
          AND e.LibraryId = @libraryId
          AND l.CommunityId = @communityId
          AND (
            e.ContributorUserId = @userId
            OR EXISTS (
              SELECT 1 FROM dbo.CommunityMemberships
              WHERE CommunityId = @communityId AND UserId = @userId
                AND Role = N'OWNER'
            )
          );
        SELECT @@ROWCOUNT AS deleted;`);
    const deleted = result.recordset[0].deleted === 1;
    if (deleted) await this.notifyCommunityManagers(userId, communityId, "removed an entry from a shared library");
    return deleted;
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
}
