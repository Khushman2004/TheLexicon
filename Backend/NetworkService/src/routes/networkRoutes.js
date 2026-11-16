import { Router } from "express";
import { HttpError } from "../utils/httpError.js";

export function createNetworkRoutes(authenticationService, networkService) {
  const router = Router();

  router.use(async (request, _response, next) => {
    request.userId = (await authenticationService.getUserForRequest(request)).id;
    next();
  });

  router.get("/profile", async (request, response) => {
    response.json({ profile: await networkService.getProfile(request.userId) });
  });
  router.patch("/profile", async (request, response) => {
    response.json({ profile: await networkService.updateProfile(request.userId, request.body) });
  });
  router.get("/users", async (request, response) => {
    response.json({ users: await networkService.searchUsers(request.userId, request.query.search) });
  });
  router.get("/users/:userId", async (request, response) => {
    response.json(await networkService.getUserProfile(request.userId, request.params.userId));
  });
  router.post("/users/:userId/follow", async (request, response) => {
    response.json({ follow: await networkService.follow(request.userId, request.params.userId) });
  });
  router.delete("/users/:userId/follow", async (request, response) => {
    await networkService.unfollow(request.userId, request.params.userId);
    response.status(204).end();
  });
  router.get("/connections/:direction", async (request, response) => {
    response.json({ users: await networkService.listConnections(request.userId, request.params.direction) });
  });

  router.get("/libraries/discover", async (request, response) => {
    response.json({ libraries: await networkService.listPublicLibraries(request.userId, request.query.ownerId) });
  });
  router.get("/libraries/saved", async (request, response) => {
    response.json({ libraries: await networkService.listSavedLibraries(request.userId) });
  });
  router.get("/libraries/shared", async (request, response) => {
    response.json({ libraries: await networkService.listSharedLibraries(request.userId) });
  });
  router.post("/libraries/:libraryId/save", async (request, response) => {
    await networkService.saveLibrary(request.userId, request.params.libraryId);
    response.status(204).end();
  });
  router.delete("/libraries/:libraryId/save", async (request, response) => {
    await networkService.unsaveLibrary(request.userId, request.params.libraryId);
    response.status(204).end();
  });
  router.get("/libraries/:libraryId/invites", async (request, response) => {
    response.json({ invites: await networkService.listInvites(request.userId, request.params.libraryId) });
  });
  router.post("/libraries/:libraryId/invites", async (request, response) => {
    const invite = await networkService.createInvite(request.userId, request.params.libraryId, request.body);
    response.status(201).json({ invite });
  });
  router.delete("/libraries/:libraryId/invites/:inviteId", async (request, response) => {
    await networkService.revokeInvite(request.userId, request.params.libraryId, request.params.inviteId);
    response.status(204).end();
  });
  router.get("/invitations/:token", async (request, response) => {
    response.json({ invitation: await networkService.getInvite(request.userId, request.params.token) });
  });
  router.post("/invitations/:token/requests", async (request, response) => {
    response.status(201).json({
      request: await networkService.requestInviteAccess(request.userId, request.params.token),
    });
  });
  router.get("/libraries/:libraryId/access-requests", async (request, response) => {
    response.json({ requests: await networkService.listAccessRequests(request.userId, request.params.libraryId) });
  });
  router.patch("/libraries/:libraryId/access-requests/:requestId", async (request, response) => {
    response.json({
      request: await networkService.resolveAccessRequest(
        request.userId,
        request.params.libraryId,
        request.params.requestId,
        request.body,
      ),
    });
  });
  router.get("/libraries/:libraryId/access", async (request, response) => {
    response.json({ users: await networkService.listAccessGrants(request.userId, request.params.libraryId) });
  });
  router.delete("/libraries/:libraryId/access/:userId", async (request, response) => {
    await networkService.revokeAccess(request.userId, request.params.libraryId, request.params.userId);
    response.status(204).end();
  });

  router.use((_request, _response, next) => next(new HttpError(404, "Endpoint not found.")));
  return router;
}
