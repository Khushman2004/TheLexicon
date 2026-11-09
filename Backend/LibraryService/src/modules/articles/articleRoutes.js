import { createEntryRoutes } from "../entryRoutes.js";

export function createArticleRoutes(libraryService) {
  return createEntryRoutes("ARTICLE", libraryService);
}
