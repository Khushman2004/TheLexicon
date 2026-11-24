import express from "express";
import { createServer } from "node:http";
import { Server } from "socket.io";
import { cors } from "./middleware/cors.js";
import { createChatRoutes } from "./routes/chatRoutes.js";
import { HttpError } from "./utils/httpError.js";

const DEFAULT_ORIGINS = ["http://localhost:5173", "http://127.0.0.1:5173"];

export function createApp(authenticationService, chatService) {
  const app = express();
  const server = createServer(app);
  const origins = (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean);
  const io = new Server(server, {
    cors: { origin: origins.length ? origins : DEFAULT_ORIGINS },
  });
  const onlineCounts = new Map();

  app.use(cors);
  app.use(express.json({ limit: "10kb" }));
  app.get("/health", (_request, response) => {
    response.json({ service: "chat", status: "ok" });
  });
  app.use("/api/chat", createChatRoutes(authenticationService, chatService));
  app.use((_request, _response, next) => next(new HttpError(404, "Endpoint not found.")));
  app.use((error, request, response, _next) => {
    if (error instanceof HttpError) {
      response.status(error.status).json({ error: error.message });
      return;
    }
    if (error instanceof SyntaxError && "body" in error) {
      response.status(400).json({ error: "Request body must be valid JSON." });
      return;
    }
    if (error.type === "entity.too.large") {
      response.status(413).json({ error: "Request body is too large." });
      return;
    }
    console.error(`Chat service request failed [${request.method} ${request.originalUrl}]:`, error);
    response.status(500).json({ error: "Internal server error." });
  });

  io.use(async (socket, next) => {
    try {
      const user = await authenticationService.getUserForSocket(socket.handshake.auth?.token);
      socket.data.userId = user.id;
      socket.data.token = socket.handshake.auth.token;
      next();
    } catch {
      next(new Error("Authentication required."));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.data.userId;
    socket.join(`user:${userId}`);
    const previousCount = onlineCounts.get(userId) ?? 0;
    onlineCounts.set(userId, previousCount + 1);
    void broadcastPresence(userId, true, socket, previousCount);

    socket.on("joinConversation", async (payload, acknowledge = () => {}) => {
      try {
        await assertSession(authenticationService, socket);
        const conversation = await chatService.authorizeConversation(userId, payload?.conversationId);
        await socket.join(`conversation:${conversation.id}`);
        if (typeof acknowledge === "function") acknowledge({ ok: true });
      } catch (error) {
        if (typeof acknowledge === "function") acknowledge({ ok: false, error: error.message });
      }
    });
    socket.on("sendMessage", async (payload, acknowledge = () => {}) => {
      try {
        await assertSession(authenticationService, socket);
        const message = await chatService.sendMessage(
          userId,
          payload?.conversationId,
          payload?.body,
        );
        const recipient = message.senderId === message.userOneId ? message.userTwoId : message.userOneId;
        const event = {
          id: message.id,
          conversationId: message.conversationId,
          senderId: message.senderId,
          body: message.body,
          createdAt: message.createdAt,
        };
        io.to(`user:${message.senderId}`)
          .to(`user:${recipient}`)
          .to(`conversation:${message.conversationId}`)
          .emit("newMessage", event);
        if (typeof acknowledge === "function") acknowledge({ ok: true, message: event });
      } catch (error) {
        if (typeof acknowledge === "function") acknowledge({ ok: false, error: error.message });
      }
    });
    socket.on("joinCommunity", async (payload, acknowledge = () => {}) => {
      try {
        await assertSession(authenticationService, socket);
        await chatService.getCommunity(userId, payload?.communityId);
        await socket.join(`community:${payload.communityId}`);
        if (typeof acknowledge === "function") acknowledge({ ok: true });
      } catch (error) {
        if (typeof acknowledge === "function") acknowledge({ ok: false, error: error.message });
      }
    });
    socket.on("sendCommunityMessage", async (payload, acknowledge = () => {}) => {
      try {
        await assertSession(authenticationService, socket);
        const message = await chatService.sendCommunityMessage(
          userId,
          payload?.communityId,
          payload?.body,
        );
        io.to(`community:${payload.communityId}`).emit("newCommunityMessage", message);
        if (typeof acknowledge === "function") acknowledge({ ok: true, message });
      } catch (error) {
        if (typeof acknowledge === "function") acknowledge({ ok: false, error: error.message });
      }
    });
    socket.on("disconnect", () => {
      const count = (onlineCounts.get(userId) ?? 1) - 1;
      if (count > 0) {
        onlineCounts.set(userId, count);
      } else {
        onlineCounts.delete(userId);
        void broadcastPresence(userId, false, null, 0);
      }
    });
  });

  async function broadcastPresence(userId, isOnline, socket, previousCount) {
    try {
      const mutualIds = await chatService.repository.listMutualUserIds(userId);
      if (socket) socket.emit("presenceSnapshot", mutualIds.filter((id) => onlineCounts.has(id)));
      if (previousCount === 0 || !isOnline) {
        const event = { userId, isOnline };
        mutualIds.forEach((id) => io.to(`user:${id}`).emit("presenceUpdate", event));
        io.to(`user:${userId}`).emit("presenceUpdate", event);
      }
    } catch (error) {
      console.error("Could not update chat presence:", error);
    }
  }

  return { app, server, io };
}

async function assertSession(authenticationService, socket) {
  const user = await authenticationService.getUserForSocket(socket.data.token);
  if (user.id !== socket.data.userId) throw new HttpError(401, "Session expired.");
}
