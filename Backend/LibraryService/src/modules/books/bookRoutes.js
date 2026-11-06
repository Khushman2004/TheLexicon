import { createEntryRoutes } from "../entryRoutes.js";

export function createBookRoutes(libraryService) {
  return createEntryRoutes("BOOK", libraryService);
}
