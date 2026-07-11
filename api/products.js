const crypto = require("crypto");
const { json, allow, body } = require("./_lib/http");
const { request } = require("./_lib/supabase");
const { requireAdmin, slug } = require("./_lib/security");

const editable = ["name","category","price","old_price","rating","badge","note","proof","image_url","product_url","featured","is_active"];
const pick = (source) => Object.fromEntries(editable.filter(k => source[k] !== undefined).map(k => [k, source[k]]));
const normalize = (p, context = {}) => {
  const links = Array.isArray(p.affiliate_links) ? p.affiliate_links : [];
  const exact = links.find(l => l.is_active && l.content_id === context.contentId && (!context.channel || l.channel === context.channel));
  const channel = links.find(l => l.is_active && context.channel && l.channel === context.channel && !l.content_id);
  const fallback = links.find(l => l.is_active && l.is_default) || links.find(l => l.is_active);
  const link = exact || channel || fallback;
  return { id:p.id, name:p.name, category:p.category, price:Number(p.price||0), oldPrice:Number(p.old_price||0), rating:Number(p.rating||0), badge:p.badge, note:p.note, proof:p.proof, image:p.image_url, productUrl:p.product_url, affiliateUrl:link?.affiliate_url || p.product_url, linkId:link?.id || null, featured:Number(p.featured||0), trackingReady:Boolean(link) };
};

module.exports = async function handler(req, res) {
  if (!allow(req, res, ["GET","POST","PATCH","DELETE","OPTIONS"])) return;
  try {
    const url = new URL(req.url, "https://local");
    const admin = requireAdmin(req);
    if (req.method === "GET") {
      const activeFilter = admin && url.searchParams.get("admin") === "1" ? "" : "&is_active=eq.true";
      const rows = await request(`products?select=*,affiliate_links(*)&order=featured.desc${activeFilter}`);
      const context = { channel:slug(url.searchParams.get("channel"),""), contentId:slug(url.searchParams.get("contentId"),"") };
      return json(res, 200, { products: rows.map(p => normalize(p, context)), admin });
    }
    if (!admin) return json(res, 401, { error:"UNAUTHORIZED" });
    const input = body(req);
    if (req.method === "POST") {
      const row = { id:input.id || crypto.randomUUID(), ...pick(input) };
      const data = await request("products", { method:"POST", body:row });
      return json(res, 201, { product:data?.[0] });
    }
    const id = String(input.id || url.searchParams.get("id") || "");
    if (!id) return json(res, 400, { error:"ID_REQUIRED" });
    if (req.method === "PATCH") {
      const data = await request(`products?id=eq.${encodeURIComponent(id)}`, { method:"PATCH", body:pick(input) });
      return json(res, 200, { product:data?.[0] });
    }
    await request(`products?id=eq.${encodeURIComponent(id)}`, { method:"DELETE" });
    json(res, 200, { ok:true });
  } catch (error) {
    console.error("products", error.message);
    json(res, error.status || 500, { error:"PRODUCTS_FAILED", message:error.message });
  }
};
