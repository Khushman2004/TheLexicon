import { createEntryRoutes } from "../entryRoutes.js";

export function createPoemRoutes(libraryService) {
  return createEntryRoutes("POEM", libraryService);
}
