import { createEntryRoutes } from "../entryRoutes.js";

export function createCollectionRoutes(libraryService) {
  return createEntryRoutes("COLLECTION", libraryService);
}
