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

  const result = await response.json().catch(() => ({}));
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

const categoryRoutes = {
  word: "words",
  phrase: "phrases",
  idiom: "idioms",
  book: "books",
  article: "articles",
  collection: "collections",
};

function libraryPath(libraryId) {
  return `/api/libraries/${libraryId}`;
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
      `${libraryPath(libraryId)}/${categoryRoutes[category]}${query}`,
      { token },
    );
    return result.entries;
  },
  createEntry: (token, libraryId, category, body) => request(
    libraryBase,
    `${libraryPath(libraryId)}/${categoryRoutes[category]}`,
    { method: "POST", token, ...jsonBody(body) },
  ),
  updateEntry: (token, libraryId, category, entryId, body) => request(
    libraryBase,
    `${libraryPath(libraryId)}/${categoryRoutes[category]}/${entryId}`,
    { method: "PATCH", token, ...jsonBody(body) },
  ),
  deleteEntry: (token, libraryId, category, entryId) => request(
    libraryBase,
    `${libraryPath(libraryId)}/${categoryRoutes[category]}/${entryId}`,
    { method: "DELETE", token },
  ),
};
