import { pool, sql } from "../database.js";
import { READING_SECTIONS, READING_SECTION_TYPES, READING_SPACE_TYPES } from "../config/entryTypes.js";

const LIBRARY_COLUMNS = `
  Id AS id,
  UserId AS userId,
  LibraryIndex AS libraryIndex,
  Name AS name,
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
            INSERTED.CreatedAt AS createdAt,
            INSERTED.UpdatedAt AS updatedAt
          VALUES (@userId, @libraryIndex, @name);`);

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

  async updateName(userId, libraryId, name) {
    const result = await pool
      .request()
      .input("userId", sql.Int, userId)
      .input("libraryId", sql.Int, libraryId)
      .input("name", sql.NVarChar(100), name)
      .query(`
        UPDATE dbo.Libraries
        SET Name = @name, UpdatedAt = SYSDATETIMEOFFSET()
        WHERE UserId = @userId AND Id = @libraryId;

        SELECT ${LIBRARY_COLUMNS}
        FROM dbo.Libraries
        WHERE UserId = @userId AND Id = @libraryId;`);

    return result.recordset[0] ?? null;
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
