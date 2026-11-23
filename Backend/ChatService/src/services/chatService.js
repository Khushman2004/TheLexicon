import { HttpError } from "../utils/httpError.js";

export class ChatService {
  constructor(repository) {
    this.repository = repository;
  }

  async listConversations(userId) {
    return this.repository.listConversations(userId);
  }

  async openConversation(userId, recipientId) {
    const target = readId(recipientId, "recipientId");
    if (target === userId) throw new HttpError(400, "You cannot start a conversation with yourself.");
    const conversation = await this.repository.findOrCreateConversation(userId, target);
    if (!conversation) throw new HttpError(403, "Chat is available between mutual followers only.");
    return conversation;
  }

  async getChatRequestStatus(userId, otherUserId) {
    const target = readId(otherUserId, "otherUserId");
    if (target === userId) throw new HttpError(400, "You cannot request a chat with yourself.");
    return this.repository.getChatRequestStatus(userId, target);
  }

  async sendChatRequest(userId, recipientId) {
    const target = readId(recipientId, "recipientId");
    if (target === userId) throw new HttpError(400, "You cannot request a chat with yourself.");
    const request = await this.repository.sendChatRequest(userId, target);
    if (!request) throw new HttpError(404, "User not found.");
    return request;
  }

  async respondToChatRequest(userId, requestId, decision) {
    const id = readId(requestId, "requestId");
    if (!["ACCEPTED", "DECLINED"].includes(decision)) {
      throw new HttpError(400, "decision must be ACCEPTED or DECLINED.");
    }
    const result = await this.repository.respondToChatRequest(userId, id, decision);
    if (!result) throw new HttpError(404, "Chat request not found or already resolved.");
    return result;
  }

  async listMessages(userId, conversationId, before) {
    const id = readId(conversationId, "conversationId");
    if (before !== undefined && !/^\d+$/.test(String(before))) {
      throw new HttpError(400, "before must be a positive message ID.");
    }
    const beforeId = before === undefined ? null : readId(before, "before");
    if (!(await this.repository.findConversation(userId, id))) {
      throw new HttpError(404, "Conversation not found or no longer available.");
    }
    return this.repository.listMessages(id, beforeId);
  }

  async authorizeConversation(userId, conversationId) {
    const id = readId(conversationId, "conversationId");
    const conversation = await this.repository.findConversation(userId, id);
    if (!conversation) throw new HttpError(404, "Conversation not found or no longer available.");
    return conversation;
  }

  async sendMessage(userId, conversationId, body) {
    const id = readId(conversationId, "conversationId");
    if (typeof body !== "string" || !body.trim() || body.trim().length > 4000) {
      throw new HttpError(400, "Message must contain 1 to 4000 characters.");
    }
    const message = await this.repository.createMessage(userId, id, body.trim());
    if (!message) throw new HttpError(403, "Conversation is not available.");
    return message;
  }
}

function readId(value, label) {
  const id = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, `${label} must be a positive integer.`);
  return id;
}
