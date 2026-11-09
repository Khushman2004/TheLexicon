/*
    TheLexicon database setup
    Safe to execute repeatedly. Existing data is not dropped or truncated.
    Add future schema changes as guarded ALTER TABLE statements below the
    table definition so this entire script remains safe to rerun.
*/

USE [master];
GO

IF DB_ID(N'TheLexicon') IS NULL
BEGIN
    CREATE DATABASE [TheLexicon];
END;
GO

USE [TheLexicon];
GO

IF OBJECT_ID(N'dbo.Users', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Users
    (
        Id INT IDENTITY(1,1) NOT NULL,
        Username NVARCHAR(32) NOT NULL,
        Email NVARCHAR(254) NOT NULL,
        PasswordHash NVARCHAR(256) NOT NULL,
        FullName NVARCHAR(100) NULL,
        Bio NVARCHAR(500) NULL,
        AvatarUrl NVARCHAR(2048) NULL,
        IsPublic BIT NOT NULL
            CONSTRAINT DF_Users_IsPublic DEFAULT (1),
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        UpdatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_Users_UpdatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_Users PRIMARY KEY CLUSTERED (Id)
    );
END;
GO

/*
    Additive migrations for profile/timestamp fields. WITH VALUES gives
    existing rows a valid value when a non-nullable column is introduced.
*/
IF COL_LENGTH(N'dbo.Users', N'FullName') IS NULL
    ALTER TABLE dbo.Users ADD FullName NVARCHAR(100) NULL;
GO

IF COL_LENGTH(N'dbo.Users', N'Bio') IS NULL
    ALTER TABLE dbo.Users ADD Bio NVARCHAR(500) NULL;
GO

IF COL_LENGTH(N'dbo.Users', N'AvatarUrl') IS NULL
    ALTER TABLE dbo.Users ADD AvatarUrl NVARCHAR(2048) NULL;
GO

IF COL_LENGTH(N'dbo.Users', N'IsPublic') IS NULL
BEGIN
    ALTER TABLE dbo.Users
        ADD IsPublic BIT NOT NULL
            CONSTRAINT DF_Users_IsPublic DEFAULT (1) WITH VALUES;
END;
ELSE IF NOT EXISTS
(
    SELECT 1
    FROM sys.default_constraints AS dc
    INNER JOIN sys.columns AS c
        ON c.object_id = dc.parent_object_id
       AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.Users')
      AND c.name = N'IsPublic'
)
BEGIN
    ALTER TABLE dbo.Users
        ADD CONSTRAINT DF_Users_IsPublic DEFAULT (1) FOR IsPublic;
END;
GO

IF COL_LENGTH(N'dbo.Users', N'CreatedAt') IS NULL
BEGIN
    ALTER TABLE dbo.Users
        ADD CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSDATETIMEOFFSET()) WITH VALUES;
END;
ELSE IF NOT EXISTS
(
    SELECT 1
    FROM sys.default_constraints AS dc
    INNER JOIN sys.columns AS c
        ON c.object_id = dc.parent_object_id
       AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.Users')
      AND c.name = N'CreatedAt'
)
BEGIN
    ALTER TABLE dbo.Users
        ADD CONSTRAINT DF_Users_CreatedAt DEFAULT (SYSDATETIMEOFFSET()) FOR CreatedAt;
END;
GO

IF COL_LENGTH(N'dbo.Users', N'UpdatedAt') IS NULL
BEGIN
    ALTER TABLE dbo.Users
        ADD UpdatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_Users_UpdatedAt DEFAULT (SYSDATETIMEOFFSET()) WITH VALUES;
END;
ELSE IF NOT EXISTS
(
    SELECT 1
    FROM sys.default_constraints AS dc
    INNER JOIN sys.columns AS c
        ON c.object_id = dc.parent_object_id
       AND c.column_id = dc.parent_column_id
    WHERE dc.parent_object_id = OBJECT_ID(N'dbo.Users')
      AND c.name = N'UpdatedAt'
)
BEGIN
    ALTER TABLE dbo.Users
        ADD CONSTRAINT DF_Users_UpdatedAt DEFAULT (SYSDATETIMEOFFSET()) FOR UpdatedAt;
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Users')
      AND name = N'UX_Users_Username'
)
BEGIN
    CREATE UNIQUE INDEX UX_Users_Username ON dbo.Users (Username);
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Users')
      AND name = N'UX_Users_Email'
)
BEGIN
    CREATE UNIQUE INDEX UX_Users_Email ON dbo.Users (Email);
END;
GO

/*
    Persist only hashes of bearer tokens so AuthService and LibraryService
    can validate and revoke the same sessions without storing raw tokens.
*/
IF OBJECT_ID(N'dbo.Sessions', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Sessions
    (
        TokenHash CHAR(64) NOT NULL,
        UserId INT NOT NULL,
        ExpiresAt DATETIMEOFFSET(7) NOT NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_Sessions_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_Sessions PRIMARY KEY CLUSTERED (TokenHash),
        CONSTRAINT FK_Sessions_Users FOREIGN KEY (UserId)
            REFERENCES dbo.Users (Id) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Sessions')
      AND name = N'IX_Sessions_UserId_ExpiresAt'
)
BEGIN
    CREATE INDEX IX_Sessions_UserId_ExpiresAt
        ON dbo.Sessions (UserId, ExpiresAt);
END;
GO

/*
    A user can own multiple libraries. LibraryIndex is sequential per user
    and uniquely identifies a user's library position.
*/
IF OBJECT_ID(N'dbo.Libraries', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Libraries
    (
        Id INT IDENTITY(1,1) NOT NULL,
        UserId INT NOT NULL,
        LibraryIndex INT NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_Libraries_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        UpdatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_Libraries_UpdatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_Libraries PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Libraries_Users FOREIGN KEY (UserId)
            REFERENCES dbo.Users (Id) ON DELETE CASCADE,
        CONSTRAINT CK_Libraries_LibraryIndex CHECK (LibraryIndex > 0)
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Libraries')
      AND name = N'UX_Libraries_UserId_LibraryIndex'
)
BEGIN
    CREATE UNIQUE INDEX UX_Libraries_UserId_LibraryIndex
        ON dbo.Libraries (UserId, LibraryIndex);
END;
GO

/*
    Entries represent words, phrases, idioms, books, articles, and custom
    collections. Book and collection entries can contain child entries.
*/
IF OBJECT_ID(N'dbo.LibraryEntries', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LibraryEntries
    (
        Id INT IDENTITY(1,1) NOT NULL,
        LibraryId INT NOT NULL,
        ParentEntryId INT NULL,
        EntryType NVARCHAR(16) NOT NULL,
        Title NVARCHAR(255) NOT NULL,
        Content NVARCHAR(MAX) NULL,
        Url NVARCHAR(2048) NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_LibraryEntries_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        UpdatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_LibraryEntries_UpdatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_LibraryEntries PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_LibraryEntries_Libraries FOREIGN KEY (LibraryId)
            REFERENCES dbo.Libraries (Id) ON DELETE CASCADE,
        CONSTRAINT UQ_LibraryEntries_Id_LibraryId UNIQUE (Id, LibraryId),
        CONSTRAINT FK_LibraryEntries_Parent FOREIGN KEY (ParentEntryId, LibraryId)
            REFERENCES dbo.LibraryEntries (Id, LibraryId),
        CONSTRAINT CK_LibraryEntries_EntryType CHECK
            (EntryType IN (N'WORD', N'PHRASE', N'IDIOM', N'BOOK', N'ARTICLE', N'COLLECTION'))
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1
    FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.LibraryEntries')
      AND name = N'IX_LibraryEntries_LibraryId_ParentEntryId'
)
BEGIN
    CREATE INDEX IX_LibraryEntries_LibraryId_ParentEntryId
        ON dbo.LibraryEntries (LibraryId, ParentEntryId, EntryType);
END;
GO

/*
    Give existing users their initial library. New registrations create this
    library in the same transaction as the user row in the AuthService.
*/
INSERT INTO dbo.Libraries (UserId, LibraryIndex, Name)
SELECT u.Id, 1, N'My Library'
FROM dbo.Users AS u
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.Libraries AS l
    WHERE l.UserId = u.Id
);
GO
