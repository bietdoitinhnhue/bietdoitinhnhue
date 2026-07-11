(() => {
  const $ = (id) => document.getElementById(id);
  const fmt = new Intl.NumberFormat("vi-VN");
  const money = (n) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(n || 0));
  const pct = (n) => `${Number(n || 0).toFixed(1).replace(".0", "")}%`;
  const normalize = (v) => String(v ?? "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").replace(/[^a-z0-9]+/g, "_").replace(/^_|_$/g, "");
  const cleanId = (v, fallback) => normalize(v || fallback).slice(0, 60) || fallback;
  const state = { report: [], filtered: [], linkPlan: JSON.parse(localStorage.getItem("dealhub_link_plan") || "[]"), isDemo: true };

  function dateISO(daysAgo = 0) { const d = new Date(); d.setHours(12,0,0,0); d.setDate(d.getDate() - daysAgo); return d.toISOString().slice(0,10); }
  function demoData() {
    const sources = [
      { channel:"facebook", contentId:"gao-ep01-a", format:"reel", campaign:"gao-series", productId:"gao-figure-red-01", productName:"Mô hình Gao Đỏ sưu tầm", icon:"⚡", weight:1.35 },
      { channel:"facebook", contentId:"gao-ep02-b", format:"reel", campaign:"gao-series", productId:"gao-robot-03", productName:"Robot lắp ghép Gaoking", icon:"◆", weight:1.12 },
      { channel:"tiktok", contentId:"gaoking-review-01", format:"short", campaign:"review", productId:"gao-robot-03", productName:"Robot lắp ghép Gaoking", icon:"◆", weight:1.28 },
      { channel:"youtube", contentId:"top-5-oruku", format:"video", campaign:"evergreen", productId:"display-case-05", productName:"Hộp mica trưng bày mô hình", icon:"□", weight:.82 },
      { channel:"threads", contentId:"goc-suu-tam-setup", format:"post", campaign:"setup-corner", productId:"led-shelf-06", productName:"Đèn LED thanh cho kệ trưng bày", icon:"✦", weight:.72 },
      { channel:"instagram", contentId:"retro-outfit-01", format:"reel", campaign:"retro", productId:"retro-shirt-04", productName:"Áo graphic phong cách tuổi thơ", icon:"◎", weight:.64 }
    ];
    const rows = [];
    for (let day = 0; day < 30; day++) {
      sources.forEach((s, idx) => {
        if ((day + idx) % 3 === 0 && idx > 3) return;
        const wave = 1 + Math.sin((day + idx) / 4) * .22;
        const clicks = Math.max(4, Math.round((18 + ((day * 7 + idx * 11) % 41)) * s.weight * wave));
        const orders = Math.max(0, Math.round(clicks * (.035 + idx * .005 + ((day + idx) % 4) * .004)));
        const aov = [189000,429000,429000,99000,79000,129000][idx];
        const commissionRate = [.09,.11,.12,.075,.08,.065][idx];
        rows.push({ date:dateISO(day), ...s, clicks, orders, revenue:orders*aov, commission:Math.round(orders*aov*commissionRate), status:"Hoàn thành" });
      });
    }
    return rows;
  }

  function localClicks() {
    try {
      return JSON.parse(localStorage.getItem("dealhub_clicks") || "[]").map(e => ({ date:String(e.timestamp || "").slice(0,10) || dateISO(), channel:e.channel||"website", contentId:e.contentId||"dealhub-store", format:e.format||"storefront", campaign:e.campaign||"evergreen", productId:e.productId||"unknown", productName:e.productName||"Chưa xác định", icon:"↗", clicks:1, orders:0, revenue:0, commission:0, status:"Click" }));
    } catch (_) { return []; }
  }

  function loadStored() {
    try {
      const stored = JSON.parse(localStorage.getItem("dealhub_report") || "null");
      if (Array.isArray(stored) && stored.length) { state.report = [...stored, ...localClicks()]; state.isDemo = false; }
      else { state.report = [...demoData(), ...localClicks()]; state.isDemo = true; }
    } catch (_) { state.report = demoData(); state.isDemo = true; }
  }

  function pick(row, candidates) {
    const entries = Object.entries(row);
    for (const candidate of candidates) {
      const exact = entries.find(([k]) => normalize(k) === candidate);
      if (exact && exact[1] !== "") return exact[1];
    }
    for (const candidate of candidates) {
      const partial = entries.find(([k]) => normalize(k).includes(candidate));
      if (partial && partial[1] !== "") return partial[1];
    }
    return "";
  }

  function numberValue(value) {
    if (typeof value === "number") return Number.isFinite(value) ? value : 0;
    let s = String(value || "").trim().replace(/\s/g, "").replace(/[₫đ$%]/gi, "");
    if (!s) return 0;
    if (/^\d{1,3}(\.\d{3})+(,\d+)?$/.test(s)) s = s.replace(/\./g, "").replace(",", ".");
    else if (/^\d{1,3}(,\d{3})+(\.\d+)?$/.test(s)) s = s.replace(/,/g, "");
    else if (s.includes(",") && !s.includes(".")) s = s.replace(",", ".");
    return Number(s.replace(/[^0-9.-]/g, "")) || 0;
  }

  function dateValue(value) {
    if (typeof value === "number" && window.XLSX?.SSF) {
      const p = XLSX.SSF.parse_date_code(value); if (p) return `${p.y}-${String(p.m).padStart(2,"0")}-${String(p.d).padStart(2,"0")}`;
    }
    const s = String(value || "").trim();
    const dmy = s.match(/^(\d{1,2})[\/-](\d{1,2})[\/-](\d{4})/);
    if (dmy) return `${dmy[3]}-${dmy[2].padStart(2,"0")}-${dmy[1].padStart(2,"0")}`;
    const d = new Date(s); return Number.isNaN(d.getTime()) ? dateISO() : d.toISOString().slice(0,10);
  }

  function mapRows(rows) {
    return rows.map((row, index) => {
      const commission = numberValue(pick(row,["hoa_hong_uoc_tinh","hoa_hong","estimated_commission","net_affiliate_commission","commission"]));
      const revenue = numberValue(pick(row,["gia_tri_don_hang","doanh_thu","order_amount","item_price","sales","gmv","revenue"]));
      const orderId = pick(row,["ma_don_hang","order_id","order_sn","conversion_id"]);
      const explicitOrders = numberValue(pick(row,["so_don_hang","orders","conversions","conversion"]));
      const channel = pick(row,["sub_id1","subid1","utm_source","channel","kenh"]);
      const contentId = pick(row,["sub_id2","subid2","utm_content","content_id","contentid","noi_dung"]);
      const format = pick(row,["sub_id3","subid3","format","content_format"]);
      const campaign = pick(row,["sub_id4","subid4","utm_campaign","campaign","chien_dich"]);
      const productName = pick(row,["ten_san_pham","item_name","product_name","productname","product","san_pham"]);
      const productId = pick(row,["ma_san_pham","item_id","product_id","productid","itemid","sku"]);
      return {
        date: dateValue(pick(row,["thoi_gian_dat_hang","ngay","date","order_time","conversion_time","purchase_time","time"])),
        channel: cleanId(channel,"unknown"), contentId: cleanId(contentId, orderId ? `order-${orderId}` : `row-${index+1}`),
        format: cleanId(format,"unknown"), campaign: cleanId(campaign,"evergreen"),
        productId: cleanId(productId, productName || `product-${index+1}`), productName: String(productName || "Sản phẩm chưa xác định"), icon:"◇",
        clicks: numberValue(pick(row,["luot_click","clicks","click_count","click"])),
        orders: explicitOrders || ((orderId || commission > 0 || revenue > 0) ? 1 : 0), revenue, commission,
        status: String(pick(row,["trang_thai","status","order_status","conversion_status"]) || "Đã ghi nhận")
      };
    }).filter(r => r.clicks || r.orders || r.revenue || r.commission);
  }

  async function readFile(file) {
    const ext = file.name.split(".").pop().toLowerCase();
    if (ext === "json") { const value = JSON.parse(await file.text()); return Array.isArray(value) ? value : (value.rows || []); }
    if ((ext === "xlsx" || ext === "xls") && window.XLSX) {
      const wb = XLSX.read(await file.arrayBuffer(), { type:"array", cellDates:false });
      return wb.SheetNames.flatMap(name => XLSX.utils.sheet_to_json(wb.Sheets[name], { defval:"" }));
    }
    const text = await file.text();
    if (window.XLSX) { const wb = XLSX.read(text,{type:"string"}); return XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]],{defval:""}); }
    const lines = text.split(/\r?\n/).filter(Boolean); const headers = lines.shift().split(",");
    return lines.map(line => Object.fromEntries(line.split(",").map((v,i)=>[headers[i],v])));
  }

  function aggregate(rows, keys) {
    const map = new Map();
    for (const row of rows) {
      const id = keys.map(k => row[k] || "unknown").join("||");
      if (!map.has(id)) map.set(id, { ...Object.fromEntries(keys.map(k=>[k,row[k]||"unknown"])), productName:row.productName, icon:row.icon||"◇", clicks:0, orders:0, revenue:0, commission:0 });
      const item = map.get(id); item.clicks += Number(row.clicks||0); item.orders += Number(row.orders||0); item.revenue += Number(row.revenue||0); item.commission += Number(row.commission||0);
    }
    return [...map.values()];
  }

  function applyFilters() {
    const period = $("periodFilter").value; const channel = $("channelFilter").value;
    const maxTime = Math.max(...state.report.map(r => new Date(r.date).getTime()).filter(Number.isFinite), Date.now());
    const cutoff = period === "all" ? 0 : maxTime - Number(period) * 86400000;
    state.filtered = state.report.filter(r => new Date(r.date).getTime() >= cutoff && (channel === "all" || r.channel === channel));
    renderAll();
  }

  function sum(rows,key){return rows.reduce((t,r)=>t+Number(r[key]||0),0)}
  function kpis(rows){const clicks=sum(rows,"clicks"),orders=sum(rows,"orders"),revenue=sum(rows,"revenue"),commission=sum(rows,"commission");return{clicks,orders,revenue,commission,cvr:clicks?orders/clicks*100:0,aov:orders?revenue/orders:0}}
  function comparisonDelta(key) {
    const period = $("periodFilter").value; if (period === "all") return "Toàn bộ dữ liệu";
    const days = Number(period); const maxTime = Math.max(...state.report.map(r=>new Date(r.date).getTime()).filter(Number.isFinite),Date.now());
    const channel = $("channelFilter").value;
    const inChannel = r => channel === "all" || r.channel === channel;
    const current = sum(state.report.filter(r=>{const t=new Date(r.date).getTime();return inChannel(r)&&t>=maxTime-days*86400000}),key);
    const previous = sum(state.report.filter(r=>{const t=new Date(r.date).getTime();return inChannel(r)&&t<maxTime-days*86400000&&t>=maxTime-days*2*86400000}),key);
    if (!previous) return current ? "Kỳ đầu có dữ liệu" : "Chưa có dữ liệu";
    const d=(current-previous)/previous*100; return `${d>=0?"↑":"↓"} ${Math.abs(d).toFixed(1)}% so với kỳ trước`;
  }

  function renderMetrics() {
    const m=kpis(state.filtered); $("metricClicks").textContent=fmt.format(m.clicks); $("metricOrders").textContent=fmt.format(m.orders); $("metricCommission").textContent=money(m.commission); $("metricCvr").textContent=pct(m.cvr); $("metricAov").textContent=`AOV ${money(m.aov)}`;
    $("deltaClicks").textContent=comparisonDelta("clicks"); $("deltaOrders").textContent=comparisonDelta("orders"); $("deltaCommission").textContent=comparisonDelta("commission");
  }

  function renderTrend() {
    const daily=aggregate(state.filtered,["date"]).sort((a,b)=>a.date.localeCompare(b.date)).slice(-14); const max=Math.max(...daily.map(d=>d.commission),1); const chart=$("trendChart"); chart.replaceChildren();
    daily.forEach(d=>{const col=document.createElement("div");col.className="trend-column";col.dataset.value=money(d.commission);const bar=document.createElement("i");bar.style.height=`${Math.max(2,d.commission/max*100)}%`;const label=document.createElement("span");label.textContent=d.date.slice(5).replace("-","/");col.append(bar,label);chart.append(col)});
  }

  function renderChannels() {
    const colors=["#f4511e","#ffb83d","#3ac59a","#6189ff","#b47cff","#e96798"]; const channels=aggregate(state.filtered,["channel"]).sort((a,b)=>b.commission-a.commission); const total=sum(channels,"commission")||1; const wrap=$("channelChart");wrap.replaceChildren();
    channels.slice(0,6).forEach((c,i)=>{const row=document.createElement("div");row.className="channel-row";const name=document.createElement("span");name.textContent=c.channel;const bar=document.createElement("div");bar.className="channel-bar";const fill=document.createElement("i");fill.style.width=`${c.commission/total*100}%`;fill.style.background=colors[i%colors.length];bar.append(fill);const value=document.createElement("b");value.textContent=money(c.commission);row.append(name,bar,value);wrap.append(row)});
  }

  function contentRows() { return aggregate(state.filtered,["contentId","channel","format","campaign"]).map(r=>({...r,cvr:r.clicks?r.orders/r.clicks*100:0})).sort((a,b)=>b.commission-a.commission); }
  function td(text,className=""){const cell=document.createElement("td");cell.textContent=text;if(className)cell.className=className;return cell}
  function renderTopContent() {
    const body=$("topContentBody");body.replaceChildren(); contentRows().slice(0,5).forEach((r,i)=>{const tr=document.createElement("tr");const rank=td(String(i+1),"rank");const content=document.createElement("td");const strong=document.createElement("strong");strong.textContent=r.contentId;const small=document.createElement("small");small.textContent=`${r.format} · ${r.campaign}`;content.append(strong,small);tr.append(rank,content,td(r.channel,"channel-tag"),td(fmt.format(r.clicks)),td(fmt.format(r.orders)),td(pct(r.cvr)),td(money(r.commission),"commission-cell"));body.append(tr)});
  }

  function renderInsights() {
    const rows=contentRows(); const channels=aggregate(state.filtered,["channel"]).sort((a,b)=>b.commission-a.commission); const products=aggregate(state.filtered,["productId"]).sort((a,b)=>b.commission-a.commission); const m=kpis(state.filtered); const insights=[];
    if(rows[0])insights.push(["↗","Content dẫn đầu",`${rows[0].contentId} tạo ${money(rows[0].commission)} hoa hồng, CVR ${pct(rows[0].cvr)}.`]);
    if(channels[0])insights.push(["◎","Kênh mạnh nhất",`${channels[0].channel} đóng góp ${pct(channels[0].commission/(m.commission||1)*100)} tổng hoa hồng.`]);
    if(products[0])insights.push(["◇","Sản phẩm chủ lực",`${products[0].productName||products[0].productId} đang tạo hoa hồng cao nhất.`]);
    const highCvr=rows.filter(r=>r.clicks>=20).sort((a,b)=>b.cvr-a.cvr)[0];if(highCvr)insights.push(["✦","Cơ hội scale",`${highCvr.contentId} có CVR ${pct(highCvr.cvr)}; nên thử thêm hook/phiên bản mới.`]);
    const list=$("insightList");list.replaceChildren();insights.slice(0,4).forEach(([icon,title,copy])=>{const item=document.createElement("div");item.className="insight-item";const i=document.createElement("span");i.textContent=icon;const div=document.createElement("div");const b=document.createElement("b");b.textContent=title;const p=document.createElement("p");p.textContent=copy;div.append(b,p);item.append(i,div);list.append(item)});
  }

  function renderContentTable() {
    const q=normalize($("contentSearch").value);const body=$("contentTableBody");body.replaceChildren();contentRows().filter(r=>normalize(`${r.contentId} ${r.channel} ${r.format} ${r.campaign}`).includes(q)).forEach((r,i)=>{const tr=document.createElement("tr");tr.append(td(String(i+1),"rank"),td(r.contentId),td(r.channel,"channel-tag"),td(r.format),td(r.campaign),td(fmt.format(r.clicks)),td(fmt.format(r.orders)),td(pct(r.cvr)),td(money(r.revenue)),td(money(r.commission),"commission-cell"));body.append(tr)});
  }

  function renderProducts() {
    const q=normalize($("productSearch").value);const rows=aggregate(state.filtered,["productId"]).filter(r=>normalize(`${r.productId} ${r.productName}`).includes(q)).sort((a,b)=>b.commission-a.commission);const grid=$("productPerformanceGrid");grid.replaceChildren();
    rows.forEach(r=>{const card=document.createElement("article");card.className="performance-card";const top=document.createElement("div");const meta=document.createElement("div");meta.style.display="flex";meta.style.gap="11px";const icon=document.createElement("span");icon.className="product-icon";icon.textContent=r.icon||"◇";const title=document.createElement("div");const h=document.createElement("h3");h.textContent=r.productName||r.productId;const id=document.createElement("div");id.className="product-id";id.textContent=r.productId;title.append(h,id);meta.append(icon,title);const commission=document.createElement("span");commission.className="product-commission";commission.textContent=money(r.commission);top.append(meta,commission);const stats=document.createElement("div");stats.className="product-stats";[["Click",fmt.format(r.clicks)],["Đơn",fmt.format(r.orders)],["CVR",pct(r.clicks?r.orders/r.clicks*100:0)]].forEach(([k,v])=>{const d=document.createElement("div");const s=document.createElement("span");s.textContent=k;const b=document.createElement("b");b.textContent=v;d.append(s,b);stats.append(d)});card.append(top,stats);grid.append(card)});
  }

  function renderLinkPlan() {
    const body=$("linkPlanBody");body.replaceChildren();state.linkPlan.forEach((r,i)=>{const tr=document.createElement("tr");tr.append(td(r.productUrl||"—"),td(r.subId1),td(r.subId2),td(r.subId3),td(r.subId4),td(r.subId5));const action=document.createElement("td");const del=document.createElement("button");del.className="text-button";del.textContent="Xóa";del.onclick=()=>{state.linkPlan.splice(i,1);saveLinkPlan()};action.append(del);tr.append(action);body.append(tr)});
  }
  function saveLinkPlan(){localStorage.setItem("dealhub_link_plan",JSON.stringify(state.linkPlan));renderLinkPlan()}
  function csvEscape(v){const s=String(v??"");return /[",\n]/.test(s)?`"${s.replace(/"/g,'""')}"`:s}
  function download(name,text,type="text/csv;charset=utf-8"){const blob=new Blob(["\ufeff"+text],{type});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=name;a.click();setTimeout(()=>URL.revokeObjectURL(a.href),500)}
  function exportCsv(rows,name){if(!rows.length)return toast("Chưa có dữ liệu để tải");const headers=Object.keys(rows[0]);download(name,[headers.join(","),...rows.map(r=>headers.map(h=>csvEscape(r[h])).join(","))].join("\n"))}
  function renderAll(){renderMetrics();renderTrend();renderChannels();renderTopContent();renderInsights();renderContentTable();renderProducts();renderLinkPlan()}

  function renderFilters(){const current=$("channelFilter").value;const channels=[...new Set(state.report.map(r=>r.channel).filter(Boolean))].sort();$("channelFilter").replaceChildren(new Option("Tất cả kênh","all"),...channels.map(c=>new Option(c,c)));$("channelFilter").value=channels.includes(current)?current:"all"}
  function toast(message){const t=$("toast");t.textContent=message;t.classList.add("show");clearTimeout(toast.timer);toast.timer=setTimeout(()=>t.classList.remove("show"),2800)}
  function setDataBanner(){const b=$("dataBanner");b.querySelector("b").textContent=state.isDemo?"Đang xem dữ liệu demo":"Đang xem dữ liệu đã nhập";b.querySelector("span").textContent=state.isDemo?"Nhập file Conversion/Click Report từ Shopee Affiliate để thay thế.":`${state.report.length} dòng dữ liệu · lưu cục bộ trên thiết bị này.`;b.querySelector("i").style.background=state.isDemo?"#ffc84a":"#38c995"}

  function bind() {
    document.querySelectorAll(".side-nav button").forEach(btn=>btn.addEventListener("click",()=>{document.querySelectorAll(".side-nav button").forEach(b=>b.classList.toggle("active",b===btn));document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.dataset.panel===btn.dataset.view))}));
    document.querySelectorAll("[data-jump]").forEach(btn=>btn.addEventListener("click",()=>document.querySelector(`.side-nav [data-view='${btn.dataset.jump}']`).click()));
    $("periodFilter").addEventListener("change",applyFilters);$("channelFilter").addEventListener("change",applyFilters);$("contentSearch").addEventListener("input",renderContentTable);$("productSearch").addEventListener("input",renderProducts);
    $("importButton").onclick=()=>$("fileInput").click();
    $("fileInput").addEventListener("change",async e=>{const file=e.target.files[0];if(!file)return;try{const raw=await readFile(file);const rows=mapRows(raw);if(!rows.length)throw new Error("Không tìm thấy cột click, đơn hàng, doanh thu hoặc hoa hồng");localStorage.setItem("dealhub_report",JSON.stringify(rows));state.report=[...rows,...localClicks()];state.isDemo=false;renderFilters();setDataBanner();applyFilters();toast(`Đã nhập ${rows.length} dòng từ ${file.name}`)}catch(err){console.error(err);toast(`Không thể nhập file: ${err.message}`)}e.target.value=""});
    $("clearData").onclick=()=>{localStorage.removeItem("dealhub_report");state.report=[...demoData(),...localClicks()];state.isDemo=true;renderFilters();setDataBanner();applyFilters();toast("Đã khôi phục dữ liệu demo")};
    $("downloadSample").onclick=()=>exportCsv(demoData().slice(0,18),"dealhub_shopee_report_mau.csv");
    $("addLinkPlan").onclick=()=>{state.linkPlan.push({productUrl:$("subProductUrl").value.trim(),subId1:cleanId($("subChannel").value,"unknown"),subId2:cleanId($("subContent").value,"content"),subId3:cleanId($("subFormat").value,"unknown"),subId4:cleanId($("subCampaign").value,"evergreen"),subId5:cleanId($("subVariant").value,"v1")});saveLinkPlan();toast("Đã thêm vào kế hoạch Sub ID")};
    $("clearLinkPlan").onclick=()=>{state.linkPlan=[];saveLinkPlan();toast("Đã xóa kế hoạch")};
    $("exportLinkPlan").onclick=()=>exportCsv(state.linkPlan,"dealhub_batch_custom_link_plan.csv");
  }

  loadStored(); renderFilters(); setDataBanner(); bind(); applyFilters();
})();
