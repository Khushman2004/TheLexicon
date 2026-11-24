import { createEntryRoutes } from "../entryRoutes.js";

export function createCustomModelRoutes(libraryService) {
  return createEntryRoutes("CUSTOM_MODEL", libraryService);
}
