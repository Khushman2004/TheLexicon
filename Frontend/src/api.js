import { entryTypeForCategory } from "./catalog.js";

const authBase = (import.meta.env.VITE_AUTH_API_URL || "").replace(/\/+$/, "");
const libraryBase = (import.meta.env.VITE_LIBRARY_API_URL || "").replace(/\/+$/, "");
const networkBase = (import.meta.env.VITE_NETWORK_API_URL || "").replace(/\/+$/, "");
const chatBase = (import.meta.env.VITE_CHAT_API_URL || "").replace(/\/+$/, "");

export class ApiError extends Error {
  constructor(message, status) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

async function request(base, path, { token, ...options } = {}) {
  if (typeof path !== "string" || !path.startsWith("/")) {
    throw new Error("Cannot send API request: the endpoint path is not configured.");
  }

  let response;
  try {
    response = await fetch(`${base}${path}`, {
      ...options,
      headers: {
        ...(options.body ? { "Content-Type": "application/json" } : {}),
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
        ...options.headers,
      },
    });
  } catch {
    throw new Error("Could not reach the service. Check that the required backend service is running.");
  }

  if (response.status === 204) return null;

  const responseText = await response.text();
  let result = {};
  if (responseText) {
    try {
      result = JSON.parse(responseText);
    } catch {
      throw new ApiError(`The service returned an invalid response (${response.status}).`, response.status);
    }
  }
  if (!response.ok) {
    throw new ApiError(result.error || "Something went wrong. Please try again.", response.status);
  }
  return result;
}

function jsonBody(value) {
  return { body: JSON.stringify(value) };
}

export const authApi = {
  login: (credentials) => request(authBase, "/api/auth/login", { method: "POST", ...jsonBody(credentials) }),
  register: (details) => request(authBase, "/api/auth/register", { method: "POST", ...jsonBody(details) }),
  me: (token) => request(authBase, "/api/auth/me", { token }),
  logout: (token) => request(authBase, "/api/auth/logout", { method: "POST", token }),
};

function libraryPath(libraryId) {
  return `/api/libraries/${libraryId}`;
}

function entryPath(libraryId, category) {
  const entryType = entryTypeForCategory(category);
  if (!entryType) throw new Error(`Unknown library entry type: ${category}.`);
  return `${libraryPath(libraryId)}/${entryType.route}`;
}

export const libraryApi = {
  list: (token) => request(libraryBase, "/api/libraries", { token }),
  create: (token, name) => request(libraryBase, "/api/libraries", {
    method: "POST",
    token,
    ...jsonBody({ name }),
  }),
  rename: (token, libraryId, name) => request(libraryBase, libraryPath(libraryId), {
    method: "PATCH",
    token,
    ...jsonBody({ name }),
  }),
  updateLibrary: (token, libraryId, updates) => request(libraryBase, libraryPath(libraryId), {
    method: "PATCH",
    token,
    ...jsonBody(updates),
  }),
  listModels: async (token, libraryId) => {
    const result = await request(libraryBase, `${libraryPath(libraryId)}/models`, { token });
    return result.models;
  },
  updateModelVisibility: async (token, libraryId, modelKey, isPublic) => {
    const result = await request(
      libraryBase,
      `${libraryPath(libraryId)}/models/${encodeURIComponent(modelKey)}`,
      { method: "PATCH", token, ...jsonBody({ isPublic }) },
    );
    return result.model;
  },
  listPublic: async (token) => {
    const result = await request(libraryBase, "/api/libraries/public/libraries", { token });
    return result.libraries;
  },
  getPublic: (token, libraryId) => request(
    libraryBase,
    `/api/libraries/public/libraries/${libraryId}`,
    { token },
  ),
  async listPublicEntries(token, libraryId, modelKey, parentId) {
    const query = parentId ? `?parentId=${encodeURIComponent(parentId)}` : "";
    const result = await request(
      libraryBase,
      `/api/libraries/public/libraries/${libraryId}/models/${encodeURIComponent(modelKey)}/entries${query}`,
      { token },
    );
    return result.entries;
  },
  getAccessible: (token, libraryId) => request(
    libraryBase,
    `/api/libraries/shared/${libraryId}`,
    { token },
  ),
  async listAccessibleEntries(token, libraryId, modelKey, parentId) {
    const query = parentId ? `?parentId=${encodeURIComponent(parentId)}` : "";
    const result = await request(
      libraryBase,
      `/api/libraries/shared/${libraryId}/models/${encodeURIComponent(modelKey)}/entries${query}`,
      { token },
    );
    return result.entries;
  },
  async listEntries(token, libraryId, category, parentId) {
    const query = parentId ? `?parentId=${encodeURIComponent(parentId)}` : "";
    if (category === "all") {
      const result = await request(
        libraryBase,
        `${libraryPath(libraryId)}/entries${query}`,
        { token },
      );
      return result.entries;
    }

    const result = await request(
      libraryBase,
      `${entryPath(libraryId, category)}${query}`,
      { token },
    );
    return result.entries;
  },
  async listReadingSpaces(token, libraryId) {
    const result = await request(
      libraryBase,
      `${libraryPath(libraryId)}/reading-spaces`,
      { token },
    );
    return result.readingSpaces;
  },
  createEntry: (token, libraryId, category, body) => request(
    libraryBase,
    entryPath(libraryId, category),
    { method: "POST", token, ...jsonBody(body) },
  ),
  updateEntry: (token, libraryId, category, entryId, body) => request(
    libraryBase,
    `${entryPath(libraryId, category)}/${entryId}`,
    { method: "PATCH", token, ...jsonBody(body) },
  ),
  deleteEntry: (token, libraryId, category, entryId) => request(
    libraryBase,
    `${entryPath(libraryId, category)}/${entryId}`,
    { method: "DELETE", token },
  ),
  listCommunityLibraries: async (token, communityId) => {
    const result = await request(libraryBase, `/api/libraries/communities/${communityId}/libraries`, { token });
    return result.libraries;
  },
  createCommunityLibrary: async (token, communityId, details) => {
    const result = await request(libraryBase, `/api/libraries/communities/${communityId}/libraries`, {
      method: "POST", token, ...jsonBody(details),
    });
    return result.library;
  },
  updateCommunityLibrary: async (token, communityId, libraryId, updates) => {
    const result = await request(libraryBase, `/api/libraries/communities/${communityId}/libraries/${libraryId}`, {
      method: "PATCH", token, ...jsonBody(updates),
    });
    return result.library;
  },
  deleteCommunityLibrary: (token, communityId, libraryId) => request(
    libraryBase,
    `/api/libraries/communities/${communityId}/libraries/${libraryId}`,
    { method: "DELETE", token },
  ),
  listCommunityEntries: async (token, communityId, libraryId) => {
    const result = await request(
      libraryBase,
      `/api/libraries/communities/${communityId}/libraries/${libraryId}/entries`,
      { token },
    );
    return result.entries;
  },
  createCommunityEntry: async (token, communityId, libraryId, details) => {
    const result = await request(
      libraryBase,
      `/api/libraries/communities/${communityId}/libraries/${libraryId}/entries`,
      { method: "POST", token, ...jsonBody(details) },
    );
    return result.entry;
  },
  updateCommunityEntry: async (token, communityId, libraryId, entryId, updates) => {
    const result = await request(
      libraryBase,
      `/api/libraries/communities/${communityId}/libraries/${libraryId}/entries/${entryId}`,
      { method: "PATCH", token, ...jsonBody(updates) },
    );
    return result.entry;
  },
  deleteCommunityEntry: (token, communityId, libraryId, entryId) => request(
    libraryBase,
    `/api/libraries/communities/${communityId}/libraries/${libraryId}/entries/${entryId}`,
    { method: "DELETE", token },
  ),
};

export const networkApi = {
  getMyProfile: (token) => request(networkBase, "/api/network/profile", { token }),
  updateProfile: (token, updates) => request(networkBase, "/api/network/profile", {
    method: "PATCH",
    token,
    ...jsonBody(updates),
  }),
  searchUsers: async (token, search) => {
    const result = await request(
      networkBase,
      `/api/network/users?search=${encodeURIComponent(search)}`,
      { token },
    );
    return result.users;
  },
  getUser: (token, userId) => request(networkBase, `/api/network/users/${userId}`, { token }),
  follow: (token, userId) => request(networkBase, `/api/network/users/${userId}/follow`, {
    method: "POST",
    token,
  }),
  unfollow: (token, userId) => request(networkBase, `/api/network/users/${userId}/follow`, {
    method: "DELETE",
    token,
  }),
  connections: async (token, direction, userId) => {
    const query = userId ? `?userId=${encodeURIComponent(userId)}` : "";
    const result = await request(
      networkBase,
      `/api/network/connections/${direction}${query}`,
      { token },
    );
    return result.users;
  },
  getNotifications: (token) => request(networkBase, "/api/network/notifications", { token }),
  markNotificationRead: (token, notificationId) => request(
    networkBase,
    `/api/network/notifications/${notificationId}/read`,
    { method: "PATCH", token },
  ),
  markAllNotificationsRead: (token) => request(
    networkBase,
    "/api/network/notifications/read-all",
    { method: "PATCH", token },
  ),
  clearAllNotifications: (token) => request(
    networkBase,
    "/api/network/notifications/clear-all",
    { method: "DELETE", token },
  ),
  discoverLibraries: async (token, ownerId) => {
    const query = ownerId ? `?ownerId=${encodeURIComponent(ownerId)}` : "";
    const result = await request(networkBase, `/api/network/libraries/discover${query}`, { token });
    return result.libraries;
  },
  savedLibraries: async (token) => {
    const result = await request(networkBase, "/api/network/libraries/saved", { token });
    return result.libraries;
  },
  sharedLibraries: async (token) => {
    const result = await request(networkBase, "/api/network/libraries/shared", { token });
    return result.libraries;
  },
  saveLibrary: async (token, libraryId) => {
    const result = await request(networkBase, `/api/network/libraries/${libraryId}/save`, {
      method: "POST",
      token,
    });
    if (result === null) return true;
    if (result.saved !== true) throw new Error("The library was not saved. Please try again.");
    return true;
  },
  unsaveLibrary: (token, libraryId) => request(networkBase, `/api/network/libraries/${libraryId}/save`, {
    method: "DELETE",
    token,
  }),
  createInvite: (token, libraryId) => request(
    networkBase,
    `/api/network/libraries/${libraryId}/invites`,
    { method: "POST", token, ...jsonBody({ expiresInHours: 168 }) },
  ),
  listInvites: async (token, libraryId) => {
    const result = await request(networkBase, `/api/network/libraries/${libraryId}/invites`, { token });
    return result.invites;
  },
  revokeInvite: (token, libraryId, inviteId) => request(
    networkBase,
    `/api/network/libraries/${libraryId}/invites/${inviteId}`,
    { method: "DELETE", token },
  ),
  getInvitation: (token, shareToken) => request(
    networkBase,
    `/api/network/invitations/${encodeURIComponent(shareToken)}`,
    { token },
  ),
  requestLibraryAccess: (token, shareToken) => request(
    networkBase,
    `/api/network/invitations/${encodeURIComponent(shareToken)}/requests`,
    { method: "POST", token, ...jsonBody({}) },
  ),
  listAccessRequests: async (token, libraryId) => {
    const result = await request(networkBase, `/api/network/libraries/${libraryId}/access-requests`, { token });
    return result.requests;
  },
  resolveAccessRequest: (token, libraryId, requestId, decision) => request(
    networkBase,
    `/api/network/libraries/${libraryId}/access-requests/${requestId}`,
    { method: "PATCH", token, ...jsonBody({ decision }) },
  ),
  listAccessGrants: async (token, libraryId) => {
    const result = await request(networkBase, `/api/network/libraries/${libraryId}/access`, { token });
    return result.users;
  },
  revokeAccess: (token, libraryId, userId) => request(
    networkBase,
    `/api/network/libraries/${libraryId}/access/${userId}`,
    { method: "DELETE", token },
  ),
};

export const chatApi = {
  listConversations: async (token) => {
    const result = await request(chatBase, "/api/chat/conversations", { token });
    return result.conversations;
  },
  getRequestStatus: async (token, otherUserId) => {
    const result = await request(chatBase, `/api/chat/requests/status/${otherUserId}`, { token });
    return result.request;
  },
  sendRequest: async (token, recipientId) => {
    const result = await request(chatBase, "/api/chat/requests", {
      method: "POST",
      token,
      ...jsonBody({ recipientId }),
    });
    return result.request;
  },
  respondToRequest: async (token, requestId, decision) => {
    const result = await request(chatBase, `/api/chat/requests/${requestId}`, {
      method: "PATCH",
      token,
      ...jsonBody({ decision }),
    });
    return result.request;
  },
  openConversation: async (token, recipientId) => {
    const result = await request(chatBase, "/api/chat/conversations", {
      method: "POST",
      token,
      ...jsonBody({ recipientId }),
    });
    return result.conversation;
  },
  async listMessages(token, conversationId) {
    const result = await request(chatBase, `/api/chat/conversations/${conversationId}/messages`, { token });
    return result.messages;
  },
};

export const communityApi = {
  list: async (token) => (await request(chatBase, "/api/chat/communities", { token })).communities,
  listPublic: async (token) => (await request(chatBase, "/api/chat/communities/public", { token })).communities,
  get: async (token, communityId) => (await request(chatBase, `/api/chat/communities/${communityId}`, { token })).community,
  create: async (token, details) => (await request(chatBase, "/api/chat/communities", {
    method: "POST", token, ...jsonBody(details),
  })).community,
  join: async (token, communityId) => (await request(chatBase, `/api/chat/communities/${communityId}/join`, {
    method: "POST", token,
  })).community,
  joinByCode: async (token, code) => (await request(chatBase, "/api/chat/communities/join-by-code", {
    method: "POST", token, ...jsonBody({ code }),
  })).community,
  leave: (token, communityId) => request(chatBase, `/api/chat/communities/${communityId}/membership`, {
    method: "DELETE", token,
  }),
  delete: (token, communityId) => request(chatBase, `/api/chat/communities/${communityId}`, {
    method: "DELETE", token,
  }),
  getNotificationSettings: async (token, communityId) => (
    await request(chatBase, `/api/chat/communities/${communityId}/notification-settings`, { token })
  ).settings,
  updateNotificationSettings: async (token, communityId, isMuted) => (
    await request(chatBase, `/api/chat/communities/${communityId}/notification-settings`, {
      method: "PATCH", token, ...jsonBody({ isMuted }),
    })
  ).settings,
  listMembers: async (token, communityId) => (
    await request(chatBase, `/api/chat/communities/${communityId}/members`, { token })
  ).members,
  updateMemberRole: async (token, communityId, memberId, role) => (
    await request(chatBase, `/api/chat/communities/${communityId}/members/${memberId}`, {
      method: "PATCH", token, ...jsonBody({ role }),
    })
  ).member,
  removeMember: (token, communityId, memberId) => request(
    chatBase,
    `/api/chat/communities/${communityId}/members/${memberId}`,
    { method: "DELETE", token },
  ),
  listInvites: async (token, communityId) => (
    await request(chatBase, `/api/chat/communities/${communityId}/invites`, { token })
  ).invites,
  createInvite: (token, communityId) => request(
    chatBase,
    `/api/chat/communities/${communityId}/invites`,
    { method: "POST", token },
  ),
  revokeInvite: async (token, communityId, inviteId) => (
    await request(chatBase, `/api/chat/communities/${communityId}/invites/${inviteId}`, {
      method: "DELETE", token,
    })
  ).invite,
  listAnnouncements: async (token, communityId) => (
    await request(chatBase, `/api/chat/communities/${communityId}/announcements`, { token })
  ).announcements,
  createAnnouncement: async (token, communityId, details) => (
    await request(chatBase, `/api/chat/communities/${communityId}/announcements`, {
      method: "POST", token, ...jsonBody(details),
    })
  ).announcement,
  updateAnnouncement: async (token, communityId, announcementId, details) => (
    await request(chatBase, `/api/chat/communities/${communityId}/announcements/${announcementId}`, {
      method: "PATCH", token, ...jsonBody(details),
    })
  ).announcement,
  deleteAnnouncement: (token, communityId, announcementId) => request(
    chatBase,
    `/api/chat/communities/${communityId}/announcements/${announcementId}`,
    { method: "DELETE", token },
  ),
  listMessages: async (token, communityId) => (
    await request(chatBase, `/api/chat/communities/${communityId}/messages`, { token })
  ).messages,
  sendMessage: async (token, communityId, body) => (
    await request(chatBase, `/api/chat/communities/${communityId}/messages`, {
      method: "POST", token, ...jsonBody({ body }),
    })
  ).message,
};

export function getChatSocketUrl() {
  return chatBase || window.location.origin;
}
