import { entryTypeForCategory } from "./catalog.js";

const authBase = (import.meta.env.VITE_AUTH_API_URL || "").replace(/\/+$/, "");
const libraryBase = (import.meta.env.VITE_LIBRARY_API_URL || "").replace(/\/+$/, "");

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
    throw new Error("Could not reach the service. Check that both backend services are running.");
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
};
