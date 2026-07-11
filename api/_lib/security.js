const crypto = require("crypto");

function safeEqual(a, b) {
  const left = Buffer.from(String(a || ""));
  const right = Buffer.from(String(b || ""));
  return left.length === right.length && crypto.timingSafeEqual(left, right);
}

function adminToken(req) {
  const auth = String(req.headers.authorization || "");
  if (auth.startsWith("Bearer ")) return auth.slice(7).trim();
  return String(req.headers["x-admin-token"] || "");
}

function requireAdmin(req) {
  const expected = process.env.DASHBOARD_ADMIN_TOKEN;
  return Boolean(expected && safeEqual(adminToken(req), expected));
}

function hash(value) {
  return crypto.createHash("sha256").update(String(value || "")).digest("hex");
}

function clientIp(req) {
  return String(req.headers["x-forwarded-for"] || req.socket?.remoteAddress || "").split(",")[0].trim();
}

function slug(value, fallback = "unknown") {
  const out = String(value || "").trim().toLowerCase().normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9_-]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 100);
  return out || fallback;
}

module.exports = { requireAdmin, hash, clientIp, slug };
