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
