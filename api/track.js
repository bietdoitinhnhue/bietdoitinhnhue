const crypto = require("crypto");
const { json, allow, body } = require("./_lib/http");
const { request } = require("./_lib/supabase");
const { hash, clientIp, slug } = require("./_lib/security");

module.exports = async function handler(req, res) {
  if (!allow(req, res, ["POST", "OPTIONS"])) return;
  try {
    const input = body(req);
    const salt = process.env.TRACKING_SALT;
    if (!salt) return json(res, 503, { error: "TRACKING_NOT_CONFIGURED" });
    const productId = String(input.productId || "").slice(0, 120);
    if (!productId) return json(res, 400, { error: "PRODUCT_ID_REQUIRED" });
    const clientId = String(input.clientId || "anonymous").slice(0, 120);
    const minute = new Date().toISOString().slice(0, 16);
    const event = {
      id: crypto.randomUUID(),
      product_id: productId,
      link_id: input.linkId || null,
      channel: slug(input.channel, "direct"),
      content_id: slug(input.contentId, "storefront"),
      content_format: slug(input.format, "unknown"),
      campaign: slug(input.campaign, "evergreen"),
      variant: slug(input.variant, "v1"),
      client_hash: hash(`${salt}:${clientId}`),
      ip_hash: hash(`${salt}:${clientIp(req)}`),
      user_agent: String(req.headers["user-agent"] || "").slice(0, 300),
      referrer: String(input.referrer || req.headers.referer || "").slice(0, 500),
      dedupe_key: hash(`${salt}:${clientId}:${productId}:${minute}`)
    };
    const rows = await request("click_events?on_conflict=dedupe_key", { method: "POST", body: event, prefer: "resolution=ignore-duplicates,return=representation" });
    json(res, 200, { ok: true, clickId: rows?.[0]?.id || null });
  } catch (error) {
    console.error("track", error.message);
    json(res, error.status || 500, { error: "TRACKING_FAILED" });
  }
};
