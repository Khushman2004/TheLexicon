import { createEntryRoutes } from "../entryRoutes.js";

export function createPaperRoutes(libraryService) {
  return createEntryRoutes("PAPER", libraryService);
}
