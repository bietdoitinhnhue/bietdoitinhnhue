const { json, allow } = require("./_lib/http");
const { request } = require("./_lib/supabase");
const { requireAdmin } = require("./_lib/security");
const products = require("../shopee-affiliate/data/products.json");

module.exports = async function handler(req,res) {
  if(!allow(req,res,["POST","OPTIONS"]))return;
  if(!requireAdmin(req))return json(res,401,{error:"UNAUTHORIZED"});
  try{
    const rows=products.map(p=>({id:p.id,name:p.name,category:p.category,price:Number(p.price||0),old_price:Number(p.oldPrice||0),rating:Number(p.rating||0),badge:p.badge,note:p.note,proof:p.proof,image_url:p.image,product_url:p.productUrl||p.affiliateUrl,featured:Number(p.featured||0),is_active:true}));
    const data=await request("products?on_conflict=id",{method:"POST",body:rows,prefer:"resolution=merge-duplicates,return=representation"});
    json(res,200,{ok:true,seeded:data?.length||0});
  }catch(error){console.error("seed",error.message);json(res,error.status||500,{error:"SEED_FAILED",message:error.message});}
};
