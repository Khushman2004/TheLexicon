import { createEntryRoutes } from "../entryRoutes.js";

export function createResearchRoutes(libraryService) {
  return createEntryRoutes("RESEARCH", libraryService);
}
