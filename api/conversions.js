const crypto = require("crypto");
const { json, allow, body } = require("./_lib/http");
const { request } = require("./_lib/supabase");
const { requireAdmin, slug } = require("./_lib/security");

module.exports = async function handler(req,res) {
  if (!allow(req,res,["POST","OPTIONS"])) return;
  if (!requireAdmin(req)) return json(res,401,{error:"UNAUTHORIZED"});
  try {
    const input=body(req); const source=Array.isArray(input.rows)?input.rows:[];
    if (!source.length || source.length>1000) return json(res,400,{error:"ROWS_REQUIRED",limit:1000});
    const rows=source.map((r,i)=>({
      id:crypto.randomUUID(), order_id:String(r.orderId||r.order_id||`manual-${Date.now()}-${i}`).slice(0,150),
      product_id:String(r.productId||r.product_id||"").slice(0,120)||null,
      link_id:r.linkId||r.link_id||null, click_id:r.clickId||r.click_id||null,
      channel:slug(r.channel,"unknown"), content_id:slug(r.contentId||r.content_id,"unknown"),
      content_format:slug(r.format||r.content_format,"unknown"), campaign:slug(r.campaign,"evergreen"), variant:slug(r.variant,"v1"),
      order_value:Number(r.revenue||r.order_value||0), commission:Number(r.commission||0), currency:"VND",
      status:String(r.status||"pending").slice(0,60), occurred_at:new Date(r.date||r.occurred_at||Date.now()).toISOString(), raw_data:r
    }));
    const data=await request("conversions?on_conflict=order_id",{method:"POST",body:rows,prefer:"resolution=merge-duplicates,return=representation"});
    json(res,200,{ok:true,upserted:data?.length||0});
  } catch(error){console.error("conversions",error.message);json(res,error.status||500,{error:"CONVERSIONS_FAILED",message:error.message});}
};
