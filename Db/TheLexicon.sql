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

IF COL_LENGTH(N'dbo.Libraries', N'IsPublic') IS NULL
BEGIN
    ALTER TABLE dbo.Libraries
        ADD IsPublic BIT NOT NULL
            CONSTRAINT DF_Libraries_IsPublic DEFAULT (0) WITH VALUES;
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
    Visibility is configured independently for each library model. A public
    model is visible to authenticated users only when its library is public.
*/
IF OBJECT_ID(N'dbo.LibraryModels', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LibraryModels
    (
        LibraryId INT NOT NULL,
        ModelKey NVARCHAR(32) NOT NULL,
        IsPublic BIT NOT NULL
            CONSTRAINT DF_LibraryModels_IsPublic DEFAULT (0),
        UpdatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_LibraryModels_UpdatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_LibraryModels PRIMARY KEY CLUSTERED (LibraryId, ModelKey),
        CONSTRAINT FK_LibraryModels_Libraries FOREIGN KEY (LibraryId)
            REFERENCES dbo.Libraries (Id) ON DELETE CASCADE,
        CONSTRAINT CK_LibraryModels_ModelKey CHECK
            (ModelKey IN (N'words', N'phrases', N'reading-spaces', N'poetry', N'research'))
    );
END;
GO

INSERT INTO dbo.LibraryModels (LibraryId, ModelKey)
SELECT l.Id, model.ModelKey
FROM dbo.Libraries AS l
CROSS JOIN
(
    VALUES (N'words'), (N'phrases'), (N'reading-spaces'), (N'poetry'), (N'research')
) AS model (ModelKey)
WHERE NOT EXISTS
(
    SELECT 1
    FROM dbo.LibraryModels AS existingModel
    WHERE existingModel.LibraryId = l.Id
      AND existingModel.ModelKey = model.ModelKey
);
GO

/*
    Social graph, library bookmarks, and owner-approved private access.
    Invitation tokens are stored as hashes; only the share URL contains the
    raw token. Requests require explicit approval by the library owner.
*/
IF OBJECT_ID(N'dbo.UserFollows', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.UserFollows
    (
        FollowerUserId INT NOT NULL,
        FollowedUserId INT NOT NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_UserFollows_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_UserFollows PRIMARY KEY CLUSTERED (FollowerUserId, FollowedUserId),
        CONSTRAINT FK_UserFollows_Follower FOREIGN KEY (FollowerUserId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT FK_UserFollows_Followed FOREIGN KEY (FollowedUserId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT CK_UserFollows_NoSelfFollow CHECK (FollowerUserId <> FollowedUserId)
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.UserFollows')
      AND name = N'IX_UserFollows_FollowedUserId'
)
BEGIN
    CREATE INDEX IX_UserFollows_FollowedUserId
        ON dbo.UserFollows (FollowedUserId, FollowerUserId);
END;
GO

IF OBJECT_ID(N'dbo.SavedLibraries', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.SavedLibraries
    (
        UserId INT NOT NULL,
        LibraryId INT NOT NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_SavedLibraries_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_SavedLibraries PRIMARY KEY CLUSTERED (UserId, LibraryId),
        CONSTRAINT FK_SavedLibraries_Users FOREIGN KEY (UserId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT FK_SavedLibraries_Libraries FOREIGN KEY (LibraryId)
            REFERENCES dbo.Libraries (Id) ON DELETE CASCADE
    );
END;
GO

IF OBJECT_ID(N'dbo.LibraryInvites', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LibraryInvites
    (
        Id INT IDENTITY(1,1) NOT NULL,
        LibraryId INT NOT NULL,
        CreatedByUserId INT NOT NULL,
        TokenHash CHAR(64) NOT NULL,
        ExpiresAt DATETIMEOFFSET(7) NOT NULL,
        RevokedAt DATETIMEOFFSET(7) NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_LibraryInvites_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_LibraryInvites PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_LibraryInvites_TokenHash UNIQUE (TokenHash),
        CONSTRAINT FK_LibraryInvites_Libraries FOREIGN KEY (LibraryId)
            REFERENCES dbo.Libraries (Id) ON DELETE CASCADE,
        CONSTRAINT FK_LibraryInvites_Creator FOREIGN KEY (CreatedByUserId)
            REFERENCES dbo.Users (Id)
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.LibraryInvites')
      AND name = N'IX_LibraryInvites_LibraryId'
)
BEGIN
    CREATE INDEX IX_LibraryInvites_LibraryId
        ON dbo.LibraryInvites (LibraryId, CreatedAt DESC);
END;
GO

IF OBJECT_ID(N'dbo.LibraryAccessRequests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LibraryAccessRequests
    (
        Id INT IDENTITY(1,1) NOT NULL,
        InviteId INT NOT NULL,
        RequesterUserId INT NOT NULL,
        Status NVARCHAR(16) NOT NULL
            CONSTRAINT DF_LibraryAccessRequests_Status DEFAULT (N'PENDING'),
        RequestedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_LibraryAccessRequests_RequestedAt DEFAULT (SYSDATETIMEOFFSET()),
        ResolvedAt DATETIMEOFFSET(7) NULL,
        CONSTRAINT PK_LibraryAccessRequests PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_LibraryAccessRequests_Invite_Requester UNIQUE (InviteId, RequesterUserId),
        CONSTRAINT FK_LibraryAccessRequests_Invites FOREIGN KEY (InviteId)
            REFERENCES dbo.LibraryInvites (Id) ON DELETE CASCADE,
        CONSTRAINT FK_LibraryAccessRequests_Requester FOREIGN KEY (RequesterUserId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT CK_LibraryAccessRequests_Status
            CHECK (Status IN (N'PENDING', N'APPROVED', N'DECLINED'))
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.LibraryAccessRequests')
      AND name = N'IX_LibraryAccessRequests_RequesterUserId'
)
BEGIN
    CREATE INDEX IX_LibraryAccessRequests_RequesterUserId
        ON dbo.LibraryAccessRequests (RequesterUserId, Status);
END;
GO

IF OBJECT_ID(N'dbo.LibraryAccessGrants', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LibraryAccessGrants
    (
        LibraryId INT NOT NULL,
        UserId INT NOT NULL,
        GrantedByUserId INT NOT NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_LibraryAccessGrants_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_LibraryAccessGrants PRIMARY KEY CLUSTERED (LibraryId, UserId),
        CONSTRAINT FK_LibraryAccessGrants_Libraries FOREIGN KEY (LibraryId)
            REFERENCES dbo.Libraries (Id) ON DELETE CASCADE,
        CONSTRAINT FK_LibraryAccessGrants_User FOREIGN KEY (UserId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT FK_LibraryAccessGrants_Grantor FOREIGN KEY (GrantedByUserId)
            REFERENCES dbo.Users (Id)
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.LibraryAccessGrants')
      AND name = N'IX_LibraryAccessGrants_UserId'
)
BEGIN
    CREATE INDEX IX_LibraryAccessGrants_UserId
        ON dbo.LibraryAccessGrants (UserId, LibraryId);
END;
GO

IF OBJECT_ID(N'dbo.ChatConversations', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ChatConversations
    (
        Id INT IDENTITY(1,1) NOT NULL,
        UserOneId INT NOT NULL,
        UserTwoId INT NOT NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_ChatConversations_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        LastMessageAt DATETIMEOFFSET(7) NULL,
        CONSTRAINT PK_ChatConversations PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_ChatConversations_UserPair UNIQUE (UserOneId, UserTwoId),
        CONSTRAINT FK_ChatConversations_UserOne FOREIGN KEY (UserOneId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT FK_ChatConversations_UserTwo FOREIGN KEY (UserTwoId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT CK_ChatConversations_UserOrder CHECK (UserOneId < UserTwoId)
    );
END;
GO

IF OBJECT_ID(N'dbo.ChatMessages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ChatMessages
    (
        Id BIGINT IDENTITY(1,1) NOT NULL,
        ConversationId INT NOT NULL,
        SenderUserId INT NOT NULL,
        Body NVARCHAR(4000) NOT NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_ChatMessages_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_ChatMessages PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_ChatMessages_Conversation FOREIGN KEY (ConversationId)
            REFERENCES dbo.ChatConversations (Id) ON DELETE CASCADE,
        CONSTRAINT FK_ChatMessages_Sender FOREIGN KEY (SenderUserId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT CK_ChatMessages_Body CHECK (LEN(LTRIM(RTRIM(Body))) > 0)
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.ChatMessages')
      AND name = N'IX_ChatMessages_ConversationId_Id'
)
BEGIN
    CREATE INDEX IX_ChatMessages_ConversationId_Id
        ON dbo.ChatMessages (ConversationId, Id DESC);
END;
GO

IF OBJECT_ID(N'dbo.ChatRequests', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.ChatRequests
    (
        Id INT IDENTITY(1,1) NOT NULL,
        RequesterUserId INT NOT NULL,
        RecipientUserId INT NOT NULL,
        Status NVARCHAR(16) NOT NULL
            CONSTRAINT DF_ChatRequests_Status DEFAULT (N'PENDING'),
        ConversationId INT NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_ChatRequests_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        ResolvedAt DATETIMEOFFSET(7) NULL,
        CONSTRAINT PK_ChatRequests PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_ChatRequests_Requester FOREIGN KEY (RequesterUserId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT FK_ChatRequests_Recipient FOREIGN KEY (RecipientUserId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT FK_ChatRequests_Conversation FOREIGN KEY (ConversationId)
            REFERENCES dbo.ChatConversations (Id),
        CONSTRAINT CK_ChatRequests_DifferentUsers CHECK (RequesterUserId <> RecipientUserId),
        CONSTRAINT CK_ChatRequests_Status CHECK
            (Status IN (N'PENDING', N'ACCEPTED', N'DECLINED'))
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.ChatRequests')
      AND name = N'IX_ChatRequests_Recipient_Status_Created'
)
BEGIN
    CREATE INDEX IX_ChatRequests_Recipient_Status_Created
        ON dbo.ChatRequests (RecipientUserId, Status, CreatedAt DESC);
END;
GO

IF OBJECT_ID(N'dbo.Notifications', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Notifications
    (
        Id INT IDENTITY(1,1) NOT NULL,
        RecipientUserId INT NOT NULL,
        ActorUserId INT NOT NULL,
        Type NVARCHAR(32) NOT NULL,
        LibraryId INT NULL,
        AccessRequestId INT NULL,
        ConversationId INT NULL,
        ChatRequestId INT NULL,
        CommunityId INT NULL,
        Details NVARCHAR(256) NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_Notifications_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        ReadAt DATETIMEOFFSET(7) NULL,
        CONSTRAINT PK_Notifications PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Notifications_Recipient FOREIGN KEY (RecipientUserId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT FK_Notifications_Actor FOREIGN KEY (ActorUserId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT FK_Notifications_ChatRequest FOREIGN KEY (ChatRequestId)
            REFERENCES dbo.ChatRequests (Id)
    );
END;
GO

IF COL_LENGTH(N'dbo.Notifications', N'ChatRequestId') IS NULL
BEGIN
    ALTER TABLE dbo.Notifications ADD ChatRequestId INT NULL;
END;
GO

IF COL_LENGTH(N'dbo.Notifications', N'CommunityId') IS NULL
BEGIN
    ALTER TABLE dbo.Notifications ADD CommunityId INT NULL;
END;
GO

IF COL_LENGTH(N'dbo.Notifications', N'Details') IS NULL
BEGIN
    ALTER TABLE dbo.Notifications ADD Details NVARCHAR(256) NULL;
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'dbo.Notifications')
      AND name = N'FK_Notifications_ChatRequest'
)
BEGIN
    ALTER TABLE dbo.Notifications
        ADD CONSTRAINT FK_Notifications_ChatRequest FOREIGN KEY (ChatRequestId)
            REFERENCES dbo.ChatRequests (Id);
END;
GO

IF EXISTS
(
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.Notifications')
      AND name = N'CK_Notifications_Type'
)
BEGIN
    ALTER TABLE dbo.Notifications DROP CONSTRAINT CK_Notifications_Type;
END;
GO

ALTER TABLE dbo.Notifications
    ADD CONSTRAINT CK_Notifications_Type CHECK
        (Type IN (N'FOLLOW', N'LIBRARY_ACCESS_REQUEST', N'LIBRARY_ACCESS_APPROVED',
                  N'LIBRARY_ACCESS_DECLINED', N'LIBRARY_SAVED', N'CHAT_MESSAGE', N'CHAT_REQUEST',
                  N'CHAT_REQUEST_ACCEPTED', N'CHAT_REQUEST_DECLINED', N'COMMUNITY_ACTIVITY'));
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.Notifications')
      AND name = N'IX_Notifications_Recipient_Read_Created'
)
BEGIN
    CREATE INDEX IX_Notifications_Recipient_Read_Created
        ON dbo.Notifications (RecipientUserId, ReadAt, CreatedAt DESC);
END;
GO

/*
    Entries cover the five library models: words; phrases/idioms; reading
    spaces; poetry; and research. Reading spaces have default section entries.
*/
IF OBJECT_ID(N'dbo.LibraryEntries', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.LibraryEntries
    (
        Id INT IDENTITY(1,1) NOT NULL,
        LibraryId INT NOT NULL,
        ParentEntryId INT NULL,
        EntryType NVARCHAR(32) NOT NULL,
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
            (EntryType IN (N'WORD', N'PHRASE', N'IDIOM', N'BOOK', N'PAPER', N'ARTICLE',
                           N'COLLECTION', N'POEM', N'POETIC_DEVICE', N'PLAY',
                           N'CUSTOM_MODEL', N'THEORY', N'RESEARCH', N'WORDS_SECTION',
                           N'PHRASES_SECTION', N'THEORIES_SECTION'))
    );
END;
GO

IF EXISTS
(
    SELECT 1
    FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.LibraryEntries')
      AND name = N'CK_LibraryEntries_EntryType'
)
BEGIN
    ALTER TABLE dbo.LibraryEntries DROP CONSTRAINT CK_LibraryEntries_EntryType;
END;
GO

IF EXISTS
(
    SELECT 1
    FROM sys.columns
    WHERE object_id = OBJECT_ID(N'dbo.LibraryEntries')
      AND name = N'EntryType'
      AND max_length < 64
)
BEGIN
    IF EXISTS
    (
        SELECT 1
        FROM sys.indexes
        WHERE object_id = OBJECT_ID(N'dbo.LibraryEntries')
          AND name = N'IX_LibraryEntries_LibraryId_ParentEntryId'
    )
    BEGIN
        DROP INDEX IX_LibraryEntries_LibraryId_ParentEntryId
            ON dbo.LibraryEntries;
    END;

    ALTER TABLE dbo.LibraryEntries ALTER COLUMN EntryType NVARCHAR(32) NOT NULL;
END;
GO

ALTER TABLE dbo.LibraryEntries
    ADD CONSTRAINT CK_LibraryEntries_EntryType CHECK
        (EntryType IN (N'WORD', N'PHRASE', N'IDIOM', N'BOOK', N'PAPER', N'ARTICLE',
                       N'COLLECTION', N'POEM', N'POETIC_DEVICE', N'PLAY',
                       N'CUSTOM_MODEL', N'THEORY', N'RESEARCH', N'WORDS_SECTION',
                       N'PHRASES_SECTION', N'THEORIES_SECTION'));
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
    Add the default subsections to existing books, papers, and articles.
    The NOT EXISTS checks make this migration safe to rerun.
*/
INSERT INTO dbo.LibraryEntries (LibraryId, ParentEntryId, EntryType, Title)
SELECT readingSpace.LibraryId, readingSpace.Id, section.EntryType, section.Title
FROM dbo.LibraryEntries AS readingSpace
CROSS JOIN
(
    VALUES
        (N'WORDS_SECTION', N'Words'),
        (N'PHRASES_SECTION', N'Phrases'),
        (N'THEORIES_SECTION', N'Custom theories')
) AS section (EntryType, Title)
WHERE readingSpace.EntryType IN (N'BOOK', N'PAPER', N'ARTICLE')
  AND NOT EXISTS
  (
      SELECT 1
      FROM dbo.LibraryEntries AS existingSection
      WHERE existingSection.LibraryId = readingSpace.LibraryId
        AND existingSection.ParentEntryId = readingSpace.Id
        AND existingSection.EntryType = section.EntryType
  );
GO

/*
    Preserve older direct book contents while moving them into their matching
    default subsection.
*/
UPDATE content
SET ParentEntryId = section.Id
FROM dbo.LibraryEntries AS content
INNER JOIN dbo.LibraryEntries AS readingSpace
    ON readingSpace.Id = content.ParentEntryId
   AND readingSpace.LibraryId = content.LibraryId
INNER JOIN dbo.LibraryEntries AS section
    ON section.ParentEntryId = readingSpace.Id
   AND section.LibraryId = readingSpace.LibraryId
   AND section.EntryType =
       CASE content.EntryType
           WHEN N'WORD' THEN N'WORDS_SECTION'
           WHEN N'PHRASE' THEN N'PHRASES_SECTION'
           WHEN N'IDIOM' THEN N'PHRASES_SECTION'
           WHEN N'THEORY' THEN N'THEORIES_SECTION'
       END
WHERE readingSpace.EntryType IN (N'BOOK', N'PAPER', N'ARTICLE')
  AND content.EntryType IN (N'WORD', N'PHRASE', N'IDIOM', N'THEORY');
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

/*
    Community data is kept separate from personal libraries and direct
    conversations. Membership and role checks are performed on every request.
*/
IF OBJECT_ID(N'dbo.Communities', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.Communities
    (
        Id INT IDENTITY(1,1) NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        Genre NVARCHAR(100) NOT NULL,
        Description NVARCHAR(1000) NULL,
        Privacy NVARCHAR(16) NOT NULL
            CONSTRAINT DF_Communities_Privacy DEFAULT (N'PUBLIC'),
        OwnerUserId INT NOT NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_Communities_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        UpdatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_Communities_UpdatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_Communities PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_Communities_Owner FOREIGN KEY (OwnerUserId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT CK_Communities_Privacy CHECK (Privacy IN (N'PUBLIC', N'PRIVATE'))
    );
END;
GO

IF OBJECT_ID(N'dbo.CommunityMemberships', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CommunityMemberships
    (
        CommunityId INT NOT NULL,
        UserId INT NOT NULL,
        Role NVARCHAR(16) NOT NULL
            CONSTRAINT DF_CommunityMemberships_Role DEFAULT (N'MEMBER'),
        JoinedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_CommunityMemberships_JoinedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_CommunityMemberships PRIMARY KEY (CommunityId, UserId),
        CONSTRAINT FK_CommunityMemberships_Community FOREIGN KEY (CommunityId)
            REFERENCES dbo.Communities (Id) ON DELETE CASCADE,
        CONSTRAINT FK_CommunityMemberships_User FOREIGN KEY (UserId)
            REFERENCES dbo.Users (Id) ON DELETE CASCADE,
        CONSTRAINT CK_CommunityMemberships_Role CHECK (Role IN (N'OWNER', N'ADMIN', N'MEMBER'))
    );
END;
GO

IF OBJECT_ID(N'dbo.CommunityInvites', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CommunityInvites
    (
        Id INT IDENTITY(1,1) NOT NULL,
        CommunityId INT NOT NULL,
        CreatedByUserId INT NOT NULL,
        CodeHash CHAR(64) NOT NULL,
        CodePrefix NVARCHAR(16) NULL,
        ExpiresAt DATETIMEOFFSET(7) NULL,
        RevokedAt DATETIMEOFFSET(7) NULL,
        UsedAt DATETIMEOFFSET(7) NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_CommunityInvites_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_CommunityInvites PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT UQ_CommunityInvites_CodeHash UNIQUE (CodeHash),
        CONSTRAINT FK_CommunityInvites_Community FOREIGN KEY (CommunityId)
            REFERENCES dbo.Communities (Id) ON DELETE CASCADE,
        CONSTRAINT FK_CommunityInvites_Creator FOREIGN KEY (CreatedByUserId)
            REFERENCES dbo.Users (Id)
    );
END;
GO

IF OBJECT_ID(N'dbo.CommunityAnnouncements', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CommunityAnnouncements
    (
        Id INT IDENTITY(1,1) NOT NULL,
        CommunityId INT NOT NULL,
        AuthorUserId INT NOT NULL,
        Title NVARCHAR(200) NOT NULL,
        Body NVARCHAR(MAX) NOT NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_CommunityAnnouncements_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        UpdatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_CommunityAnnouncements_UpdatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_CommunityAnnouncements PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_CommunityAnnouncements_Community FOREIGN KEY (CommunityId)
            REFERENCES dbo.Communities (Id) ON DELETE CASCADE,
        CONSTRAINT FK_CommunityAnnouncements_Author FOREIGN KEY (AuthorUserId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT CK_CommunityAnnouncements_Title CHECK (LEN(LTRIM(RTRIM(Title))) > 0),
        CONSTRAINT CK_CommunityAnnouncements_Body CHECK (LEN(LTRIM(RTRIM(Body))) > 0)
    );
END;
GO

IF OBJECT_ID(N'dbo.CommunityChatMessages', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CommunityChatMessages
    (
        Id BIGINT IDENTITY(1,1) NOT NULL,
        CommunityId INT NOT NULL,
        SenderUserId INT NOT NULL,
        Body NVARCHAR(4000) NOT NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_CommunityChatMessages_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_CommunityChatMessages PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_CommunityChatMessages_Community FOREIGN KEY (CommunityId)
            REFERENCES dbo.Communities (Id) ON DELETE CASCADE,
        CONSTRAINT FK_CommunityChatMessages_Sender FOREIGN KEY (SenderUserId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT CK_CommunityChatMessages_Body CHECK (LEN(LTRIM(RTRIM(Body))) > 0)
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.CommunityChatMessages')
      AND name = N'IX_CommunityChatMessages_CommunityId_Id'
)
BEGIN
    CREATE INDEX IX_CommunityChatMessages_CommunityId_Id
        ON dbo.CommunityChatMessages (CommunityId, Id DESC);
END;
GO

IF OBJECT_ID(N'dbo.CommunitySharedLibraries', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CommunitySharedLibraries
    (
        Id INT IDENTITY(1,1) NOT NULL,
        CommunityId INT NOT NULL,
        Name NVARCHAR(100) NOT NULL,
        Description NVARCHAR(500) NULL,
        ModelKey NVARCHAR(32) NULL,
        CreatedByUserId INT NOT NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_CommunitySharedLibraries_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        UpdatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_CommunitySharedLibraries_UpdatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_CommunitySharedLibraries PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_CommunitySharedLibraries_Community FOREIGN KEY (CommunityId)
            REFERENCES dbo.Communities (Id) ON DELETE CASCADE,
        CONSTRAINT FK_CommunitySharedLibraries_Creator FOREIGN KEY (CreatedByUserId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT CK_CommunitySharedLibraries_Name CHECK (LEN(LTRIM(RTRIM(Name))) > 0),
        CONSTRAINT CK_CommunitySharedLibraries_ModelKey CHECK
            (ModelKey IS NULL OR ModelKey IN (N'words', N'phrases', N'reading-spaces', N'poetry', N'research'))
    );
END;
GO

IF COL_LENGTH(N'dbo.CommunitySharedLibraries', N'ModelKey') IS NULL
BEGIN
    ALTER TABLE dbo.CommunitySharedLibraries ADD ModelKey NVARCHAR(32) NULL;
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.CommunitySharedLibraries')
      AND name = N'CK_CommunitySharedLibraries_ModelKey'
)
BEGIN
    ALTER TABLE dbo.CommunitySharedLibraries
        ADD CONSTRAINT CK_CommunitySharedLibraries_ModelKey CHECK
            (ModelKey IS NULL OR ModelKey IN (N'words', N'phrases', N'reading-spaces', N'poetry', N'research'));
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.indexes
    WHERE object_id = OBJECT_ID(N'dbo.CommunitySharedLibraries')
      AND name = N'UX_CommunitySharedLibraries_Community_ModelKey'
)
BEGIN
    CREATE UNIQUE INDEX UX_CommunitySharedLibraries_Community_ModelKey
        ON dbo.CommunitySharedLibraries (CommunityId, ModelKey)
        WHERE ModelKey IS NOT NULL;
END;
GO

IF OBJECT_ID(N'dbo.CommunitySharedLibraryEntries', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CommunitySharedLibraryEntries
    (
        Id INT IDENTITY(1,1) NOT NULL,
        LibraryId INT NOT NULL,
        ContributorUserId INT NOT NULL,
        EntryType NVARCHAR(32) NOT NULL
            CONSTRAINT DF_CommunitySharedLibraryEntries_EntryType DEFAULT (N'WORD'),
        Title NVARCHAR(255) NOT NULL,
        Content NVARCHAR(MAX) NULL,
        Url NVARCHAR(2048) NULL,
        CreatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_CommunitySharedLibraryEntries_CreatedAt DEFAULT (SYSDATETIMEOFFSET()),
        UpdatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_CommunitySharedLibraryEntries_UpdatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_CommunitySharedLibraryEntries PRIMARY KEY CLUSTERED (Id),
        CONSTRAINT FK_CommunitySharedLibraryEntries_Library FOREIGN KEY (LibraryId)
            REFERENCES dbo.CommunitySharedLibraries (Id) ON DELETE CASCADE,
        CONSTRAINT FK_CommunitySharedLibraryEntries_Contributor FOREIGN KEY (ContributorUserId)
            REFERENCES dbo.Users (Id),
        CONSTRAINT CK_CommunitySharedLibraryEntries_Title CHECK (LEN(LTRIM(RTRIM(Title))) > 0),
        CONSTRAINT CK_CommunitySharedLibraryEntries_EntryType CHECK
            (EntryType IN (N'WORD', N'PHRASE', N'IDIOM', N'BOOK', N'PAPER', N'ARTICLE',
                N'COLLECTION', N'POEM', N'POETIC_DEVICE', N'PLAY', N'CUSTOM_MODEL', N'THEORY', N'RESEARCH'))
    );
END;
GO

IF COL_LENGTH(N'dbo.CommunitySharedLibraryEntries', N'EntryType') IS NULL
BEGIN
    ALTER TABLE dbo.CommunitySharedLibraryEntries
        ADD EntryType NVARCHAR(32) NOT NULL
            CONSTRAINT DF_CommunitySharedLibraryEntries_EntryType DEFAULT (N'WORD') WITH VALUES;
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.check_constraints
    WHERE parent_object_id = OBJECT_ID(N'dbo.CommunitySharedLibraryEntries')
      AND name = N'CK_CommunitySharedLibraryEntries_EntryType'
)
BEGIN
    ALTER TABLE dbo.CommunitySharedLibraryEntries
        ADD CONSTRAINT CK_CommunitySharedLibraryEntries_EntryType CHECK
            (EntryType IN (N'WORD', N'PHRASE', N'IDIOM', N'BOOK', N'PAPER', N'ARTICLE',
                N'COLLECTION', N'POEM', N'POETIC_DEVICE', N'PLAY', N'CUSTOM_MODEL', N'THEORY', N'RESEARCH'));
END;
GO

IF OBJECT_ID(N'dbo.CommunityNotificationSettings', N'U') IS NULL
BEGIN
    CREATE TABLE dbo.CommunityNotificationSettings
    (
        CommunityId INT NOT NULL,
        UserId INT NOT NULL,
        IsMuted BIT NOT NULL
            CONSTRAINT DF_CommunityNotificationSettings_IsMuted DEFAULT (0),
        UpdatedAt DATETIMEOFFSET(7) NOT NULL
            CONSTRAINT DF_CommunityNotificationSettings_UpdatedAt DEFAULT (SYSDATETIMEOFFSET()),
        CONSTRAINT PK_CommunityNotificationSettings PRIMARY KEY (CommunityId, UserId),
        CONSTRAINT FK_CommunityNotificationSettings_Community FOREIGN KEY (CommunityId)
            REFERENCES dbo.Communities (Id) ON DELETE CASCADE,
        CONSTRAINT FK_CommunityNotificationSettings_User FOREIGN KEY (UserId)
            REFERENCES dbo.Users (Id) ON DELETE CASCADE
    );
END;
GO

IF NOT EXISTS
(
    SELECT 1 FROM sys.foreign_keys
    WHERE parent_object_id = OBJECT_ID(N'dbo.Notifications')
      AND name = N'FK_Notifications_Community'
)
BEGIN
    ALTER TABLE dbo.Notifications
        ADD CONSTRAINT FK_Notifications_Community FOREIGN KEY (CommunityId)
            REFERENCES dbo.Communities (Id) ON DELETE CASCADE;
END;
GO
