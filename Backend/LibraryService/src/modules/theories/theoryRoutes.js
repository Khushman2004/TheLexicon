import { createEntryRoutes } from "../entryRoutes.js";

export function createTheoryRoutes(libraryService) {
  return createEntryRoutes("THEORY", libraryService);
}
