const { json, allow } = require("./_lib/http");
const { request } = require("./_lib/supabase");
const { requireAdmin } = require("./_lib/security");

const sum=(rows,key)=>rows.reduce((t,r)=>t+Number(r[key]||0),0);
const group=(rows,key)=>{
  const map=new Map();
  for(const row of rows){const id=row[key]||"unknown";if(!map.has(id))map.set(id,{key:id,clicks:0,orders:0,revenue:0,commission:0});const x=map.get(id);x.clicks+=Number(row.clicks||0);x.orders+=Number(row.orders||0);x.revenue+=Number(row.revenue||0);x.commission+=Number(row.commission||0);}
  return [...map.values()].sort((a,b)=>b.commission-a.commission);
};

module.exports=async function handler(req,res){
  if(!allow(req,res,["GET","OPTIONS"]))return;
  if(!requireAdmin(req))return json(res,401,{error:"UNAUTHORIZED"});
  try{
    const url=new URL(req.url,"https://local");const days=Math.min(365,Math.max(1,Number(url.searchParams.get("days")||30)));
    const since=new Date(Date.now()-days*86400000).toISOString();
    const [clicks,conversions,products]=await Promise.all([
      request(`click_events?select=id,product_id,link_id,channel,content_id,content_format,campaign,variant,created_at&created_at=gte.${encodeURIComponent(since)}&order=created_at.asc&limit=20000`),
      request(`conversions?select=order_id,product_id,link_id,channel,content_id,content_format,campaign,variant,order_value,commission,status,occurred_at&occurred_at=gte.${encodeURIComponent(since)}&order=occurred_at.asc&limit=20000`),
      request("products?select=id,name")
    ]);
    const names=Object.fromEntries(products.map(p=>[p.id,p.name]));
    const rows=[
      ...clicks.map(c=>({date:c.created_at.slice(0,10),productId:c.product_id,productName:names[c.product_id]||c.product_id,linkId:c.link_id,channel:c.channel,contentId:c.content_id,format:c.content_format,campaign:c.campaign,variant:c.variant,clicks:1,orders:0,revenue:0,commission:0})),
      ...conversions.map(c=>({date:c.occurred_at.slice(0,10),productId:c.product_id,productName:names[c.product_id]||c.product_id,linkId:c.link_id,channel:c.channel,contentId:c.content_id,format:c.content_format,campaign:c.campaign,variant:c.variant,clicks:0,orders:1,revenue:Number(c.order_value||0),commission:Number(c.commission||0),status:c.status}))
    ];
    const summary={clicks:clicks.length,orders:conversions.length,revenue:sum(conversions,"order_value"),commission:sum(conversions,"commission")};
    summary.cvr=summary.clicks?summary.orders/summary.clicks*100:0;summary.aov=summary.orders?summary.revenue/summary.orders:0;
    json(res,200,{summary,rows,byChannel:group(rows,"channel"),byContent:group(rows,"contentId"),byProduct:group(rows,"productId"),days});
  }catch(error){console.error("analytics",error.message);json(res,error.status||500,{error:"ANALYTICS_FAILED",message:error.message});}
};
