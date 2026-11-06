import { createEntryRoutes } from "../entryRoutes.js";

export function createPhraseRoutes(libraryService) {
  return createEntryRoutes("PHRASE", libraryService);
}
