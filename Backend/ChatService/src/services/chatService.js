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

  async listCommunities(userId) {
    return this.repository.listCommunities(userId);
  }

  async listPublicCommunities(userId) {
    return this.repository.listPublicCommunities(userId);
  }

  async getCommunity(userId, communityId) {
    const community = await this.repository.getCommunity(userId, readId(communityId, "communityId"));
    if (!community) throw new HttpError(404, "Community not found or you are not a member.");
    return community;
  }

  async leaveCommunity(userId, communityId) {
    const result = await this.repository.leaveCommunity(userId, readId(communityId, "communityId"));
    if (result === "OWNER") {
      throw new HttpError(409, "The community owner cannot leave. Delete the community or transfer ownership first.");
    }
    if (result !== "LEFT") throw new HttpError(404, "Community membership not found.");
  }

  async deleteCommunity(userId, communityId) {
    const deleted = await this.repository.deleteCommunity(userId, readId(communityId, "communityId"));
    if (!deleted) throw new HttpError(403, "Only the community owner can delete this community.");
  }

  async getCommunityNotificationSettings(userId, communityId) {
    const result = await this.repository.getCommunityNotificationSettings(
      userId,
      readId(communityId, "communityId"),
    );
    if (!result) throw new HttpError(404, "Community not found or you are not a member.");
    return result;
  }

  async updateCommunityNotificationSettings(userId, communityId, body) {
    if (!body || typeof body !== "object" || Array.isArray(body)
      || typeof body.isMuted !== "boolean") {
      throw new HttpError(400, "isMuted must be a boolean.");
    }
    const result = await this.repository.updateCommunityNotificationSettings(
      userId,
      readId(communityId, "communityId"),
      body.isMuted,
    );
    if (!result) throw new HttpError(404, "Community not found or you are not a member.");
    return result;
  }

  async createCommunity(userId, body) {
    const name = readText(body?.name, "Community name", 100);
    const genre = readText(body?.genre, "Genre", 100);
    const description = typeof body?.description === "string" ? body.description.trim().slice(0, 1000) : "";
    const privacy = body?.privacy === "PRIVATE" ? "PRIVATE" : "PUBLIC";
    return this.repository.createCommunity(userId, name, genre, description, privacy);
  }

  async joinCommunity(userId, communityId) {
    const joined = await this.repository.joinCommunity(userId, readId(communityId, "communityId"));
    if (!joined) throw new HttpError(404, "Public community not found.");
    return this.repository.getCommunity(userId, readId(communityId, "communityId"));
  }

  async joinByInvite(userId, code) {
    if (typeof code !== "string" || !code.trim()) throw new HttpError(400, "Invitation code is required.");
    const crypto = await import("node:crypto");
    const normalized = code.trim().toUpperCase();
    const codeHash = crypto.createHash("sha256").update(normalized).digest("hex");
    const result = await this.repository.joinByInvite(userId, codeHash);
    const messages = {
      INVALID: "Invitation code is invalid.",
      REVOKED: "Invitation code has been revoked.",
      USED: "Invitation code has already been used.",
      EXPIRED: "Invitation code has expired.",
      ALREADY_MEMBER: "You are already a member of this community.",
    };
    if (result.status !== "JOINED") throw new HttpError(result.status === "ALREADY_MEMBER" ? 409 : 400, messages[result.status]);
    return this.repository.getCommunity(userId, result.communityId);
  }

  async createInvite(userId, communityId) {
    const result = await this.repository.createInvite(userId, readId(communityId, "communityId"));
    if (!result) throw new HttpError(403, "Only owners and admins can manage invitations.");
    return result;
  }

  async listInvites(userId, communityId) {
    const result = await this.repository.listInvites(userId, readId(communityId, "communityId"));
    if (result === null) throw new HttpError(403, "Only owners and admins can view invitations.");
    return result;
  }

  async revokeInvite(userId, communityId, inviteId) {
    const result = await this.repository.revokeInvite(
      userId,
      readId(communityId, "communityId"),
      readId(inviteId, "inviteId"),
    );
    if (!result) throw new HttpError(403, "Only owners and admins can revoke invitations.");
    return result;
  }

  async listMembers(userId, communityId) {
    const result = await this.repository.listMembers(userId, readId(communityId, "communityId"));
    if (result === null) throw new HttpError(404, "Community not found or you are not a member.");
    return result;
  }

  async updateMemberRole(userId, communityId, memberId, role) {
    const result = await this.repository.updateMemberRole(
      userId,
      readId(communityId, "communityId"),
      readId(memberId, "memberId"),
      role,
    );
    if (!result) throw new HttpError(403, "Only the owner can change member roles.");
    return result;
  }

  async removeMember(userId, communityId, memberId) {
    const removed = await this.repository.removeMember(
      userId,
      readId(communityId, "communityId"),
      readId(memberId, "memberId"),
    );
    if (!removed) throw new HttpError(403, "Only the community owner can remove members.");
  }

  async listAnnouncements(userId, communityId) {
    const result = await this.repository.listAnnouncements(userId, readId(communityId, "communityId"));
    if (result === null) throw new HttpError(404, "Community not found or you are not a member.");
    return result;
  }

  async createAnnouncement(userId, communityId, body) {
    const title = readText(body?.title, "Announcement title", 200);
    const text = readText(body?.body, "Announcement body", 100000);
    const result = await this.repository.createAnnouncement(userId, readId(communityId, "communityId"), title, text);
    if (!result) throw new HttpError(403, "Only owners and admins can create announcements.");
    return result;
  }

  async updateAnnouncement(userId, communityId, announcementId, body) {
    const title = readText(body?.title, "Announcement title", 200);
    const text = readText(body?.body, "Announcement body", 100000);
    const result = await this.repository.updateAnnouncement(
      userId,
      readId(communityId, "communityId"),
      readId(announcementId, "announcementId"),
      title,
      text,
    );
    if (!result) throw new HttpError(403, "Announcement not found or you do not have permission.");
    return result;
  }

  async deleteAnnouncement(userId, communityId, announcementId) {
    const deleted = await this.repository.deleteAnnouncement(
      userId,
      readId(communityId, "communityId"),
      readId(announcementId, "announcementId"),
    );
    if (!deleted) throw new HttpError(403, "Announcement not found or you do not have permission.");
  }

  async listCommunityMessages(userId, communityId, before) {
    const beforeId = before === undefined ? null : readId(before, "before");
    const result = await this.repository.listCommunityMessages(
      userId,
      readId(communityId, "communityId"),
      beforeId,
    );
    if (result === null) throw new HttpError(404, "Community not found or you are not a member.");
    return result;
  }

  async sendCommunityMessage(userId, communityId, body) {
    if (typeof body !== "string" || !body.trim() || body.trim().length > 4000) {
      throw new HttpError(400, "Message must contain 1 to 4000 characters.");
    }
    const message = await this.repository.createCommunityMessage(
      userId,
      readId(communityId, "communityId"),
      body.trim(),
    );
    if (!message) throw new HttpError(403, "Community chat is not available.");
    return message;
  }
}

function readId(value, label) {
  const id = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, `${label} must be a positive integer.`);
  return id;
}

function readText(value, label, maxLength) {
  if (typeof value !== "string" || !value.trim()) throw new HttpError(400, `${label} is required.`);
  const text = value.trim();
  if (text.length > maxLength) throw new HttpError(400, `${label} must be at most ${maxLength} characters.`);
  return text;
}
