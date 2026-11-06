import { createEntryRoutes } from "../entryRoutes.js";

export function createWordRoutes(libraryService) {
  return createEntryRoutes("WORD", libraryService);
}
