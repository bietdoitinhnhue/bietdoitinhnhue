function json(res, status, data) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.setHeader("Cache-Control", "no-store");
  res.end(JSON.stringify(data));
}

function allow(req, res, methods) {
  res.setHeader("Allow", methods.join(", "));
  if (req.method === "OPTIONS") {
    res.statusCode = 204;
    res.end();
    return false;
  }
  if (!methods.includes(req.method)) {
    json(res, 405, { error: "METHOD_NOT_ALLOWED" });
    return false;
  }
  return true;
}

function body(req) {
  if (typeof req.body === "object" && req.body !== null) return req.body;
  if (!req.body) return {};
  try { return JSON.parse(req.body); } catch (_) { return {}; }
}

module.exports = { json, allow, body };
