const crypto = require("crypto");
const { json, allow, body } = require("./_lib/http");
const { request } = require("./_lib/supabase");
const { requireAdmin, slug } = require("./_lib/security");

module.exports = async function handler(req, res) {
  if (!allow(req, res, ["GET","POST","PATCH","DELETE","OPTIONS"])) return;
  if (!requireAdmin(req)) return json(res, 401, { error:"UNAUTHORIZED" });
  try {
    const url = new URL(req.url, "https://local");
    if (req.method === "GET") {
      const productId = url.searchParams.get("productId");
      const filter = productId ? `&product_id=eq.${encodeURIComponent(productId)}` : "";
      const rows = await request(`affiliate_links?select=*&order=created_at.desc${filter}`);
      return json(res, 200, { links:rows });
    }
    const input = body(req);
    const editable = {
      product_id:input.product_id,
      affiliate_url:String(input.affiliate_url || "").slice(0,2000),
      channel:slug(input.channel,"all"), content_id:input.content_id ? slug(input.content_id,"") : null,
      content_format:input.content_format ? slug(input.content_format,"") : null,
      campaign:input.campaign ? slug(input.campaign,"") : null,
      variant:input.variant ? slug(input.variant,"v1") : "v1",
      sub_id1:input.sub_id1 || null, sub_id2:input.sub_id2 || null, sub_id3:input.sub_id3 || null, sub_id4:input.sub_id4 || null, sub_id5:input.sub_id5 || null,
      is_default:Boolean(input.is_default), is_active:input.is_active !== false
    };
    if (req.method === "POST") {
      if (!editable.product_id || !editable.affiliate_url) return json(res,400,{error:"PRODUCT_AND_URL_REQUIRED"});
      const data = await request("affiliate_links", { method:"POST", body:{ id:crypto.randomUUID(), ...editable } });
      return json(res,201,{link:data?.[0]});
    }
    const id = String(input.id || url.searchParams.get("id") || "");
    if (!id) return json(res,400,{error:"ID_REQUIRED"});
    if (req.method === "PATCH") {
      const data = await request(`affiliate_links?id=eq.${encodeURIComponent(id)}`, {method:"PATCH",body:editable});
      return json(res,200,{link:data?.[0]});
    }
    await request(`affiliate_links?id=eq.${encodeURIComponent(id)}`, {method:"DELETE"});
    json(res,200,{ok:true});
  } catch (error) {
    console.error("links",error.message);
    json(res,error.status||500,{error:"LINKS_FAILED",message:error.message});
  }
};
