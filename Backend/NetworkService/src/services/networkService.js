import { createHash, randomBytes } from "node:crypto";
import { HttpError } from "../utils/httpError.js";

const INVITE_TTL_HOURS = 168;

export class NetworkService {
  constructor(repository) {
    this.repository = repository;
  }

  async getProfile(userId) {
    return this.repository.getProfile(userId, readId(userId, "userId"));
  }

  async updateProfile(userId, body) {
    if (!isObject(body)) throw new HttpError(400, "Request body must be a JSON object.");
    const updates = {};
    for (const field of ["fullName", "bio", "avatarUrl", "isPublic"]) {
      if (!Object.hasOwn(body, field)) continue;
      if (field === "isPublic") {
        if (typeof body[field] !== "boolean") throw new HttpError(400, "isPublic must be a boolean.");
        updates[field] = body[field];
      } else if (field === "fullName") {
        updates[field] = readOptionalText(body[field], "fullName", 100, true);
      } else if (field === "bio") {
        updates[field] = readOptionalText(body[field], "bio", 500);
      } else {
        updates[field] = readAvatarUrl(body[field]);
      }
    }
    if (!Object.keys(updates).length) throw new HttpError(400, "Provide at least one profile field to update.");
    return this.repository.updateProfile(readId(userId, "userId"), updates);
  }

  async searchUsers(userId, query) {
    if (typeof query !== "string" || !query.trim()) throw new HttpError(400, "Provide a search term.");
    if (query.trim().length > 32) throw new HttpError(400, "Search terms must be at most 32 characters.");
    return this.repository.searchUsers(userId, query.trim());
  }

  async getUserProfile(viewerId, targetId) {
    const profile = await this.repository.getProfile(viewerId, readId(targetId, "userId"));
    if (!profile) throw new HttpError(404, "Profile not found.");
    const libraries = profile.id === viewerId
      ? []
      : await this.repository.listPublicLibraries(viewerId, profile.id);
    return { profile, libraries };
  }

  async listConnections(userId, direction) {
    if (!["followers", "following"].includes(direction)) {
      throw new HttpError(400, "Connection type must be followers or following.");
    }
    return this.repository.listConnections(userId, direction);
  }

  async follow(userId, targetId) {
    const target = readId(targetId, "userId");
    if (target === userId) throw new HttpError(400, "You cannot follow yourself.");
    const profile = await this.repository.userExists(target);
    if (!profile || !profile.isPublic) throw new HttpError(404, "Public profile not found.");
    return this.repository.follow(userId, target);
  }

  async unfollow(userId, targetId) {
    const target = readId(targetId, "userId");
    if (target === userId) throw new HttpError(400, "You cannot unfollow yourself.");
    await this.repository.unfollow(userId, target);
  }

  async listPublicLibraries(userId, ownerId) {
    return this.repository.listPublicLibraries(
      userId,
      ownerId === undefined ? null : readId(ownerId, "ownerId"),
    );
  }

  async listSavedLibraries(userId) {
    return this.repository.listSavedLibraries(userId);
  }

  async saveLibrary(userId, libraryId) {
    const id = readId(libraryId, "libraryId");
    if (!(await this.repository.saveLibrary(userId, id))) {
      throw new HttpError(404, "Library is not public or shared with you.");
    }
  }

  async unsaveLibrary(userId, libraryId) {
    await this.repository.unsaveLibrary(userId, readId(libraryId, "libraryId"));
  }

  async createInvite(userId, libraryId, body) {
    const id = readId(libraryId, "libraryId");
    if (body !== undefined && !isObject(body)) throw new HttpError(400, "Request body must be a JSON object.");
    const ttl = body?.expiresInHours ?? INVITE_TTL_HOURS;
    if (!Number.isSafeInteger(ttl) || ttl < 1 || ttl > INVITE_TTL_HOURS) {
      throw new HttpError(400, `expiresInHours must be an integer from 1 to ${INVITE_TTL_HOURS}.`);
    }
    const token = randomBytes(32).toString("base64url");
    const expiresAt = new Date(Date.now() + ttl * 60 * 60 * 1000);
    const invite = await this.repository.createInvite(
      userId,
      id,
      hashToken(token),
      expiresAt,
    );
    if (!invite) throw new HttpError(404, "Private library not found.");
    return { ...invite, token };
  }

  async listInvites(userId, libraryId) {
    return this.repository.listInvites(userId, readId(libraryId, "libraryId"));
  }

  async revokeInvite(userId, libraryId, inviteId) {
    if (!(await this.repository.revokeInvite(
      userId,
      readId(libraryId, "libraryId"),
      readId(inviteId, "inviteId"),
    ))) throw new HttpError(404, "Active share invite not found.");
  }

  async getInvite(userId, token) {
    const invite = await this.repository.findInvite(hashToken(readToken(token)));
    if (!invite || invite.ownerId === userId) throw new HttpError(404, "Share invite not found or expired.");
    return {
      libraryId: invite.libraryId,
      libraryName: invite.libraryName,
      ownerUsername: invite.ownerUsername,
      expiresAt: invite.expiresAt,
    };
  }

  async requestInviteAccess(userId, token) {
    const invite = await this.repository.findInvite(hashToken(readToken(token)));
    if (!invite || invite.ownerId === userId) throw new HttpError(404, "Share invite not found or expired.");
    if (await this.repository.hasAccess(userId, invite.libraryId)) {
      return {
        id: null,
        status: "APPROVED",
        alreadyRequested: true,
        alreadyHasAccess: true,
        libraryName: invite.libraryName,
        ownerUsername: invite.ownerUsername,
      };
    }
    const request = await this.repository.requestAccess(userId, invite, hashToken(readToken(token)));
    if (!request) throw new HttpError(404, "Share invite not found or expired.");
    return { ...request, libraryName: invite.libraryName, ownerUsername: invite.ownerUsername };
  }

  async listAccessRequests(userId, libraryId) {
    return this.repository.listAccessRequests(userId, readId(libraryId, "libraryId"));
  }

  async resolveAccessRequest(userId, libraryId, requestId, body) {
    if (!isObject(body) || !["APPROVED", "DECLINED"].includes(body.decision)) {
      throw new HttpError(400, "decision must be APPROVED or DECLINED.");
    }
    const result = await this.repository.resolveAccessRequest(
      userId,
      readId(libraryId, "libraryId"),
      readId(requestId, "requestId"),
      body.decision,
    );
    if (!result) throw new HttpError(404, "Pending access request not found.");
    return result;
  }

  async listAccessGrants(userId, libraryId) {
    return this.repository.listAccessGrants(userId, readId(libraryId, "libraryId"));
  }

  async revokeAccess(userId, libraryId, recipientId) {
    if (!(await this.repository.revokeAccess(
      userId,
      readId(libraryId, "libraryId"),
      readId(recipientId, "userId"),
    ))) throw new HttpError(404, "Library access grant not found.");
  }

  async listSharedLibraries(userId) {
    return this.repository.listSharedLibraries(userId);
  }
}

function hashToken(token) {
  return createHash("sha256").update(token).digest("hex");
}

function readToken(value) {
  if (typeof value !== "string" || !/^[A-Za-z0-9_-]{40,64}$/.test(value)) {
    throw new HttpError(404, "Share invite not found or expired.");
  }
  return value;
}

function readId(value, label) {
  const id = typeof value === "number" ? value : Number(value);
  if (!Number.isSafeInteger(id) || id < 1) throw new HttpError(400, `${label} must be a positive integer.`);
  return id;
}

function isObject(value) {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readOptionalText(value, label, maxLength, trim = false) {
  if (value === null || value === "") return null;
  if (typeof value !== "string" || value.length > maxLength) {
    throw new HttpError(400, `${label} must be a string of at most ${maxLength} characters.`);
  }
  const normalized = trim ? value.trim() : value;
  return normalized || null;
}

function readAvatarUrl(value) {
  const url = readOptionalText(value, "avatarUrl", 2048);
  if (url === null) return null;
  try {
    const parsed = new URL(url);
    if (parsed.protocol === "https:" || parsed.protocol === "http:") return url;
  } catch {
    // Report one stable validation message for invalid URL values.
  }
  throw new HttpError(400, "avatarUrl must be a valid HTTP(S) URL.");
}
