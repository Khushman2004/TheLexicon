import { createEntryRoutes } from "../entryRoutes.js";

export function createIdiomRoutes(libraryService) {
  return createEntryRoutes("IDIOM", libraryService);
}
