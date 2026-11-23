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

  router.use((_request, _response, next) => next(new HttpError(404, "Endpoint not found.")));
  return router;
}
