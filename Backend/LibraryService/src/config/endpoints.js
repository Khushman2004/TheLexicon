export const ENDPOINTS = Object.freeze({
  HEALTH: "/health",
  LIBRARIES: Object.freeze({
    BASE: "/api/libraries",
    ROOT: "/",
    BY_ID: "/:libraryId",
    ENTRY_ROOT: "/",
    ENTRY_BY_ID: "/:entryId",
    WORDS: "/:libraryId/words",
    PHRASES: "/:libraryId/phrases",
    IDIOMS: "/:libraryId/idioms",
    BOOKS: "/:libraryId/books",
    ARTICLES: "/:libraryId/articles",
    COLLECTIONS: "/:libraryId/collections",
  }),
});
