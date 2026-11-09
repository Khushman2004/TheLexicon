import { Router } from "express";
import { ENDPOINTS } from "../config/endpoints.js";

export function createEntryRoutes(entryType, libraryService) {
  const router = Router({ mergeParams: true });

  router.get(ENDPOINTS.LIBRARIES.ENTRY_ROOT, async (request, response) => {
    const entries = await libraryService.listEntries(
      request.userId,
      request.params.libraryId,
      entryType,
      request.query.parentId,
    );
    response.json({ entries });
  });

  router.post(ENDPOINTS.LIBRARIES.ENTRY_ROOT, async (request, response) => {
    const entry = await libraryService.createEntry(
      request.userId,
      request.params.libraryId,
      entryType,
      request.body,
    );
    response.status(201).json({ entry });
  });

  router.patch(ENDPOINTS.LIBRARIES.ENTRY_BY_ID, async (request, response) => {
    const entry = await libraryService.updateEntry(
      request.userId,
      request.params.libraryId,
      request.params.entryId,
      entryType,
      request.body,
    );
    response.json({ entry });
  });

  router.delete(ENDPOINTS.LIBRARIES.ENTRY_BY_ID, async (request, response) => {
    await libraryService.deleteEntry(
      request.userId,
      request.params.libraryId,
      request.params.entryId,
      entryType,
    );
    response.status(204).end();
  });

  return router;
}
