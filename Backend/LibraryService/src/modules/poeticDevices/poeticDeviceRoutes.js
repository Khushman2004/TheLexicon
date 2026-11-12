import { createEntryRoutes } from "../entryRoutes.js";

export function createPoeticDeviceRoutes(libraryService) {
  return createEntryRoutes("POETIC_DEVICE", libraryService);
}
