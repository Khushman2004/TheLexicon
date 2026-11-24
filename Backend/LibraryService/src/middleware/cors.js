const allowedOrigins = new Set(
  (process.env.CORS_ORIGINS ?? "")
    .split(",")
    .map((origin) => origin.trim())
    .filter(Boolean),
);

export function cors(request, response, next) {
  const origin = request.headers.origin;

  if (origin && allowedOrigins.has(origin)) {
    response.setHeader("Access-Control-Allow-Origin", origin);
    response.setHeader("Vary", "Origin");
    response.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type");
    response.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  }

  if (request.method === "OPTIONS") {
    response.sendStatus(origin && !allowedOrigins.has(origin) ? 403 : 204);
    return;
  }

  next();
}
