import { Router } from "express";
import { ENDPOINTS } from "../../config/endpoints.js";

export function createReadingSpaceRoutes(libraryService) {
  const router = Router({ mergeParams: true });

  router.get("/", async (request, response) => {
    const readingSpaces = await libraryService.listReadingSpaces(
      request.userId,
      request.params.libraryId,
    );
    response.json({ readingSpaces });
  });

  router.post("/", async (request, response) => {
    const result = await libraryService.createReadingSpace(
      request.userId,
      request.params.libraryId,
      request.body,
    );
    response.status(201).json(result);
  });

  router.get(ENDPOINTS.LIBRARIES.READING_SPACE_SECTIONS, async (request, response) => {
    const sections = await libraryService.listReadingSpaceSections(
      request.userId,
      request.params.libraryId,
      request.params.readingSpaceId,
    );
    response.json({ sections });
  });

  return router;
}
