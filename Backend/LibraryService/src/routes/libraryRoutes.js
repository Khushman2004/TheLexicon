import { Router } from "express";
import { ENDPOINTS } from "../config/endpoints.js";
import { createArticleRoutes } from "../modules/articles/articleRoutes.js";
import { createBookRoutes } from "../modules/books/bookRoutes.js";
import { createCollectionRoutes } from "../modules/collections/collectionRoutes.js";
import { createIdiomRoutes } from "../modules/idioms/idiomRoutes.js";
import { createPhraseRoutes } from "../modules/phrases/phraseRoutes.js";
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

  router.use(ENDPOINTS.LIBRARIES.WORDS, createWordRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.PHRASES, createPhraseRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.IDIOMS, createIdiomRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.BOOKS, createBookRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.ARTICLES, createArticleRoutes(libraryService));
  router.use(ENDPOINTS.LIBRARIES.COLLECTIONS, createCollectionRoutes(libraryService));

  return router;
}
