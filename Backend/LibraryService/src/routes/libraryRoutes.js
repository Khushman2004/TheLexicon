import { Router } from "express";
import { ENDPOINTS } from "../config/endpoints.js";
import { createArticleRoutes } from "../modules/articles/articleRoutes.js";
import { createBookRoutes } from "../modules/books/bookRoutes.js";
import { createCollectionRoutes } from "../modules/collections/collectionRoutes.js";
import { createIdiomRoutes } from "../modules/idioms/idiomRoutes.js";
import { createCustomModelRoutes } from "../modules/customModels/customModelRoutes.js";
import { createPaperRoutes } from "../modules/papers/paperRoutes.js";
import { createPhraseRoutes } from "../modules/phrases/phraseRoutes.js";
import { createPlayRoutes } from "../modules/plays/playRoutes.js";
import { createPoemRoutes } from "../modules/poems/poemRoutes.js";
import { createPoeticDeviceRoutes } from "../modules/poeticDevices/poeticDeviceRoutes.js";
import { createReadingSpaceRoutes } from "../modules/readingSpaces/readingSpaceRoutes.js";
import { createResearchRoutes } from "../modules/research/researchRoutes.js";
import { createTheoryRoutes } from "../modules/theories/theoryRoutes.js";
import { createWordRoutes } from "../modules/words/wordRoutes.js";

export function createLibraryRoutes(authenticationService, libraryService) {
  const router = Router();

  router.use(async (request, _response, next) => {
    const user = await authenticationService.getUserForRequest(request);
    request.userId = user.id;
    next();
  });

  router.get(ENDPOINTS.LIBRARIES.ROOT, async (request, response) => {
    const libraries = await libraryService.listLibraries(request.userId);
    response.json({ libraries });
  });

  router.post(ENDPOINTS.LIBRARIES.ROOT, async (request, response) => {
    const library = await libraryService.createLibrary(request.userId, request.body);
    response.status(201).json({ library });
  });

  router.get(ENDPOINTS.LIBRARIES.PUBLIC_LIBRARIES, async (request, response) => {
    const libraries = await libraryService.listPublicLibraries(request.userId);
    response.json({ libraries });
  });

  router.get("/communities/:communityId/libraries", async (request, response) => {
    response.json({
      libraries: await libraryService.listCommunityLibraries(request.userId, request.params.communityId),
    });
  });
  router.post("/communities/:communityId/libraries", async (request, response) => {
    response.status(201).json({
      library: await libraryService.createCommunityLibrary(
        request.userId,
        request.params.communityId,
        request.body,
      ),
    });
  });
  router.patch("/communities/:communityId/libraries/:libraryId", async (request, response) => {
    response.json({
      library: await libraryService.updateCommunityLibrary(
        request.userId,
        request.params.communityId,
        request.params.libraryId,
        request.body,
      ),
    });
  });
  router.delete("/communities/:communityId/libraries/:libraryId", async (request, response) => {
    await libraryService.deleteCommunityLibrary(
      request.userId,
      request.params.communityId,
      request.params.libraryId,
    );
    response.status(204).send();
  });
  router.get("/communities/:communityId/libraries/:libraryId/entries", async (request, response) => {
    response.json({
      entries: await libraryService.listCommunityEntries(
        request.userId,
        request.params.communityId,
        request.params.libraryId,
      ),
    });
  });
  router.post("/communities/:communityId/libraries/:libraryId/entries", async (request, response) => {
    response.status(201).json({
      entry: await libraryService.createCommunityEntry(
        request.userId,
        request.params.communityId,
        request.params.libraryId,
        request.body,
      ),
    });
  });
  router.patch("/communities/:communityId/libraries/:libraryId/entries/:entryId", async (request, response) => {
    response.json({
      entry: await libraryService.updateCommunityEntry(
        request.userId,
        request.params.communityId,
        request.params.libraryId,
        request.params.entryId,
        request.body,
      ),
    });
  });
  router.delete("/communities/:communityId/libraries/:libraryId/entries/:entryId", async (request, response) => {
    await libraryService.deleteCommunityEntry(
      request.userId,
      request.params.communityId,
      request.params.libraryId,
      request.params.entryId,
    );
    response.status(204).send();
  });

  router.get(ENDPOINTS.LIBRARIES.PUBLIC_LIBRARY, async (request, response) => {
    const result = await libraryService.getPublicLibrary(request.params.libraryId);
    response.json(result);
  });

  router.get(ENDPOINTS.LIBRARIES.PUBLIC_MODEL_ENTRIES, async (request, response) => {
    const entries = await libraryService.listPublicModelEntries(
      request.params.libraryId,
      request.params.modelKey,
      request.query.parentId,
    );
    response.json({ entries });
  });

  router.get(ENDPOINTS.LIBRARIES.ACCESSIBLE_LIBRARY, async (request, response) => {
    response.json(await libraryService.getAccessibleLibrary(
      request.userId,
      request.params.libraryId,
    ));
  });

  router.get(ENDPOINTS.LIBRARIES.ACCESSIBLE_MODEL_ENTRIES, async (request, response) => {
    const entries = await libraryService.listAccessibleModelEntries(
      request.userId,
      request.params.libraryId,
      request.params.modelKey,
      request.query.parentId,
    );
    response.json({ entries });
  });

  router.get(ENDPOINTS.LIBRARIES.ENTRIES, async (request, response) => {
    const entries = await libraryService.listAllEntries(
      request.userId,
      request.params.libraryId,
      request.query.parentId,
    );
    response.json({ entries });
  });

  router.get(ENDPOINTS.LIBRARIES.BY_ID, async (request, response) => {
    const library = await libraryService.getLibrary(request.userId, request.params.libraryId);
    response.json({ library });
  });

  router.patch(ENDPOINTS.LIBRARIES.BY_ID, async (request, response) => {
    const library = await libraryService.updateLibrary(
      request.userId,
      request.params.libraryId,
      request.body,
    );
    response.json({ library });
  });

  router.get(ENDPOINTS.LIBRARIES.MODELS, async (request, response) => {
    const models = await libraryService.listModels(request.userId, request.params.libraryId);
    response.json({ models });
  });

  router.patch(`${ENDPOINTS.LIBRARIES.MODELS}${ENDPOINTS.LIBRARIES.MODEL_BY_ID}`, async (request, response) => {
    const model = await libraryService.updateModelVisibility(
      request.userId,
      request.params.libraryId,
      request.params.modelKey,
      request.body,
    );
    response.json({ model });
  });

  router.use(ENDPOINTS.LIBRARIES.WORDS, createWordRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.PHRASES, createPhraseRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.IDIOMS, createIdiomRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.BOOKS, createBookRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.PAPERS, createPaperRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.ARTICLES, createArticleRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.COLLECTIONS, createCollectionRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.READING_SPACES, createReadingSpaceRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.POEMS, createPoemRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.POETIC_DEVICES, createPoeticDeviceRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.PLAYS, createPlayRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.CUSTOM_MODELS, createCustomModelRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.THEORIES, createTheoryRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.RESEARCH, createResearchRoutes(libraryService));

  return router;
}
