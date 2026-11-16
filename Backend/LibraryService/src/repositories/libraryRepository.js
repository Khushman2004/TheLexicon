import { pool, sql } from "../database.js";
import { LIBRARY_MODELS, findLibraryModel } from "../config/libraryModels.js";
import { READING_SECTIONS, READING_SECTION_TYPES, READING_SPACE_TYPES } from "../config/entryTypes.js";

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
}
