import { createEntryRoutes } from "../entryRoutes.js";

export function createPlayRoutes(libraryService) {
  return createEntryRoutes("PLAY", libraryService);
}
