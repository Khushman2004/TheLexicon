import { Router } from "express";
import { HttpError } from "../utils/httpError.js";

export function createChatRoutes(authenticationService, chatService) {
  const router = Router();
  router.use(async (request, _response, next) => {
    request.userId = (await authenticationService.getUserForRequest(request)).id;
    next();
  });

  router.get("/conversations", async (request, response) => {
    response.json({ conversations: await chatService.listConversations(request.userId) });
  });
  router.post("/conversations", async (request, response) => {
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
      throw new HttpError(400, "Request body must be a JSON object.");
    }
    response.status(201).json({
      conversation: await chatService.openConversation(request.userId, request.body.recipientId),
    });
  });
  router.get("/requests/status/:otherUserId", async (request, response) => {
    response.json({
      request: await chatService.getChatRequestStatus(request.userId, request.params.otherUserId),
    });
  });
  router.post("/requests", async (request, response) => {
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
      throw new HttpError(400, "Request body must be a JSON object.");
    }
    response.status(201).json({
      request: await chatService.sendChatRequest(request.userId, request.body.recipientId),
    });
  });
  router.patch("/requests/:requestId", async (request, response) => {
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
      throw new HttpError(400, "Request body must be a JSON object.");
    }
    response.json({
      request: await chatService.respondToChatRequest(
        request.userId,
        request.params.requestId,
        request.body.decision,
      ),
    });
  });
  router.get("/conversations/:conversationId/messages", async (request, response) => {
    const messages = await chatService.listMessages(
      request.userId,
      request.params.conversationId,
      request.query.before,
    );
    response.json({ messages });
  });
  router.post("/conversations/:conversationId/messages", async (request, response) => {
    if (!request.body || typeof request.body !== "object" || Array.isArray(request.body)) {
      throw new HttpError(400, "Request body must be a JSON object.");
    }
    const message = await chatService.sendMessage(
      request.userId,
      request.params.conversationId,
      request.body.body,
    );
    response.status(201).json({ message });
  });

  router.get("/communities", async (request, response) => {
    response.json({ communities: await chatService.listCommunities(request.userId) });
  });
  router.get("/communities/public", async (request, response) => {
    response.json({ communities: await chatService.listPublicCommunities(request.userId) });
  });
  router.post("/communities", async (request, response) => {
    response.status(201).json({ community: await chatService.createCommunity(request.userId, request.body) });
  });
  router.post("/communities/join-by-code", async (request, response) => {
    response.json({ community: await chatService.joinByInvite(request.userId, request.body?.code) });
  });
  router.get("/communities/:communityId", async (request, response) => {
    response.json({ community: await chatService.getCommunity(request.userId, request.params.communityId) });
  });
  router.post("/communities/:communityId/join", async (request, response) => {
    response.json({ community: await chatService.joinCommunity(request.userId, request.params.communityId) });
  });
  router.delete("/communities/:communityId/membership", async (request, response) => {
    await chatService.leaveCommunity(request.userId, request.params.communityId);
    response.status(204).send();
  });
  router.delete("/communities/:communityId", async (request, response) => {
    await chatService.deleteCommunity(request.userId, request.params.communityId);
    response.status(204).send();
  });
  router.get("/communities/:communityId/notification-settings", async (request, response) => {
    response.json({
      settings: await chatService.getCommunityNotificationSettings(
        request.userId,
        request.params.communityId,
      ),
    });
  });
  router.patch("/communities/:communityId/notification-settings", async (request, response) => {
    response.json({
      settings: await chatService.updateCommunityNotificationSettings(
        request.userId,
        request.params.communityId,
        request.body,
      ),
    });
  });
  router.get("/communities/:communityId/members", async (request, response) => {
    response.json({ members: await chatService.listMembers(request.userId, request.params.communityId) });
  });
  router.patch("/communities/:communityId/members/:memberId", async (request, response) => {
    response.json({ member: await chatService.updateMemberRole(
      request.userId,
      request.params.communityId,
      request.params.memberId,
      request.body?.role,
    ) });
  });
  router.delete("/communities/:communityId/members/:memberId", async (request, response) => {
    await chatService.removeMember(request.userId, request.params.communityId, request.params.memberId);
    response.status(204).send();
  });
  router.get("/communities/:communityId/invites", async (request, response) => {
    response.json({ invites: await chatService.listInvites(request.userId, request.params.communityId) });
  });
  router.post("/communities/:communityId/invites", async (request, response) => {
    response.status(201).json(await chatService.createInvite(request.userId, request.params.communityId));
  });
  router.delete("/communities/:communityId/invites/:inviteId", async (request, response) => {
    response.json({ invite: await chatService.revokeInvite(
      request.userId,
      request.params.communityId,
      request.params.inviteId,
    ) });
  });
  router.get("/communities/:communityId/announcements", async (request, response) => {
    response.json({ announcements: await chatService.listAnnouncements(request.userId, request.params.communityId) });
  });
  router.post("/communities/:communityId/announcements", async (request, response) => {
    response.status(201).json({
      announcement: await chatService.createAnnouncement(request.userId, request.params.communityId, request.body),
    });
  });
  router.patch("/communities/:communityId/announcements/:announcementId", async (request, response) => {
    response.json({
      announcement: await chatService.updateAnnouncement(
        request.userId,
        request.params.communityId,
        request.params.announcementId,
        request.body,
      ),
    });
  });
  router.delete("/communities/:communityId/announcements/:announcementId", async (request, response) => {
    await chatService.deleteAnnouncement(request.userId, request.params.communityId, request.params.announcementId);
    response.status(204).send();
  });
  router.get("/communities/:communityId/messages", async (request, response) => {
    response.json({
      messages: await chatService.listCommunityMessages(request.userId, request.params.communityId, request.query.before),
    });
  });
  router.post("/communities/:communityId/messages", async (request, response) => {
    response.status(201).json({
      message: await chatService.sendCommunityMessage(request.userId, request.params.communityId, request.body?.body),
    });
  });

  router.use((_request, _response, next) => next(new HttpError(404, "Endpoint not found.")));
  return router;
}
