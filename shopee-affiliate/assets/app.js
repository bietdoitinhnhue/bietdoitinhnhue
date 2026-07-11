(() => {
  const state = { products: [], query: "", category: "Tất cả", sort: "featured", config: {} };
  const el = (id) => document.getElementById(id);
  const money = (value) => new Intl.NumberFormat("vi-VN", { style: "currency", currency: "VND", maximumFractionDigits: 0 }).format(Number(value || 0));
  const normalize = (value) => String(value || "").trim().toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "");
  const safeText = (value) => String(value ?? "");

  function clientId() {
    let id = localStorage.getItem("dealhub_client_id");
    if (!id) { id = (crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`); localStorage.setItem("dealhub_client_id", id); }
    return id;
  }

  function getAttribution() {
    const p = new URLSearchParams(location.search);
    return {
      channel: p.get("utm_source") || p.get("src") || p.get("sub_id1") || "website",
      contentId: p.get("utm_content") || p.get("content") || p.get("sub_id2") || "dealhub-store",
      format: p.get("utm_medium") || p.get("format") || p.get("sub_id3") || "storefront",
      campaign: p.get("utm_campaign") || p.get("campaign") || p.get("sub_id4") || "evergreen",
      variant: p.get("variant") || p.get("sub_id5") || "v1"
    };
  }

  function parseSimpleCsv(text) {
    const rows = text.trim().split(/\r?\n/).map(line => {
      const out = []; let cell = ""; let quoted = false;
      for (let i = 0; i < line.length; i++) {
        const c = line[i];
        if (c === '"' && line[i + 1] === '"') { cell += '"'; i++; }
        else if (c === '"') quoted = !quoted;
        else if (c === ',' && !quoted) { out.push(cell); cell = ""; }
        else cell += c;
      }
      out.push(cell); return out;
    });
    const headers = rows.shift().map(h => h.trim());
    return rows.filter(r => r.some(Boolean)).map(row => Object.fromEntries(headers.map((h, i) => [h, row[i] || ""])));
  }

  async function loadData() {
    const configRes = await fetch("data/site-config.json", { cache: "no-store" });
    state.config = configRes.ok ? await configRes.json() : {};
    const a = getAttribution();
    try {
      const api = await fetch(`/api/products?channel=${encodeURIComponent(a.channel)}&contentId=${encodeURIComponent(a.contentId)}`, { cache:"no-store" });
      if (api.ok) {
        const payload = await api.json();
        if (Array.isArray(payload.products) && payload.products.length) { state.products = payload.products; return; }
      }
    } catch (_) {}
    const source = state.config.productFeedUrl || "data/products.json";
    try {
      const response = await fetch(source, { cache: "no-store" });
      if (!response.ok) throw new Error("Không tải được dữ liệu sản phẩm");
      const type = response.headers.get("content-type") || "";
      state.products = type.includes("json") || source.endsWith(".json") ? await response.json() : parseSimpleCsv(await response.text());
    } catch (error) {
      console.error(error);
      state.products = [];
    }
  }

  function resolveUrl(product) {
    const a = getAttribution();
    const exact = product.trackingLinks && (product.trackingLinks[a.contentId] || product.trackingLinks[`${a.channel}:${a.contentId}`]);
    return exact || product.affiliateUrl || product.url || "#";
  }

  async function trackClick(product) {
    const a = getAttribution();
    const event = { type: "affiliate_click", timestamp: new Date().toISOString(), productId: product.id, linkId:product.linkId || null, productName: product.name, value: Number(product.price || 0), clientId:clientId(), referrer:document.referrer, ...a };
    const events = JSON.parse(localStorage.getItem("dealhub_clicks") || "[]");
    events.push(event);
    localStorage.setItem("dealhub_clicks", JSON.stringify(events.slice(-5000)));
    const endpoint = state.config.trackingEndpoint || "/api/track";
    try { fetch(endpoint, { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify(event), keepalive:true }).catch(()=>{}); } catch (_) {}
    if (typeof window.gtag === "function") window.gtag("event", "affiliate_click", { item_id: product.id, item_name: product.name, content_id: a.contentId, campaign: a.campaign, channel: a.channel });
  }

  function renderFilters() {
    const categories = ["Tất cả", ...new Set(state.products.map(p => p.category).filter(Boolean))];
    el("categoryCount").textContent = String(categories.length - 1).padStart(2, "0");
    el("categoryFilters").replaceChildren(...categories.map(category => {
      const button = document.createElement("button");
      button.type = "button"; button.textContent = category; button.className = state.category === category ? "active" : "";
      button.addEventListener("click", () => { state.category = category; renderFilters(); renderProducts(); });
      return button;
    }));
  }

  function renderProducts() {
    let items = state.products.filter(p => {
      const inCategory = state.category === "Tất cả" || p.category === state.category;
      const haystack = normalize(`${p.name} ${p.category} ${p.note}`);
      return inCategory && haystack.includes(normalize(state.query));
    });
    const sorters = { featured: (a,b) => Number(b.featured||0)-Number(a.featured||0), "price-asc": (a,b) => Number(a.price)-Number(b.price), "price-desc": (a,b) => Number(b.price)-Number(a.price), rating: (a,b) => Number(b.rating)-Number(a.rating) };
    items.sort(sorters[state.sort]);
    const grid = el("productGrid"); grid.replaceChildren();
    const saved = new Set(JSON.parse(localStorage.getItem("dealhub_saved") || "[]"));
    for (const product of items) {
      const node = el("productTemplate").content.cloneNode(true);
      const card = node.querySelector(".product-card");
      const image = node.querySelector("img"); image.src = product.image; image.alt = safeText(product.name); image.referrerPolicy = "no-referrer";
      node.querySelector(".product-badge").textContent = safeText(product.badge || "ĐỀ XUẤT");
      node.querySelector(".product-category").textContent = safeText(product.category);
      node.querySelector(".product-rating").textContent = Number(product.rating) > 0 ? `★ ${Number(product.rating).toFixed(1)}` : "Đang hiển thị";
      node.querySelector("h3").textContent = safeText(product.name);
      node.querySelector(".product-note").textContent = safeText(product.note);
      node.querySelector(".product-proof").textContent = safeText(product.proof || `${product.sold || 0} lượt bán`);
      node.querySelector(".old-price").textContent = product.oldPrice ? money(product.oldPrice) : "";
      node.querySelector(".product-price").textContent = money(product.price);
      const buy = node.querySelector(".buy-button"); buy.href = resolveUrl(product); buy.dataset.productId = product.id;
      buy.addEventListener("click", () => trackClick(product));
      const save = node.querySelector(".save-button");
      if (saved.has(product.id)) { save.classList.add("saved"); save.textContent = "♥"; }
      save.addEventListener("click", () => { if (saved.has(product.id)) saved.delete(product.id); else saved.add(product.id); localStorage.setItem("dealhub_saved", JSON.stringify([...saved])); renderProducts(); });
      card.dataset.id = product.id; grid.appendChild(node);
    }
    el("productCount").textContent = String(state.products.length).padStart(2, "0");
    el("emptyState").hidden = items.length > 0;
  }

  function bind() {
    const search = el("heroSearch");
    const runSearch = () => { state.query = search.value.trim(); document.querySelector("#products").scrollIntoView({ behavior: "smooth" }); renderProducts(); };
    el("searchButton").addEventListener("click", runSearch);
    search.addEventListener("keydown", e => { if (e.key === "Enter") runSearch(); });
    search.addEventListener("input", () => { state.query = search.value.trim(); renderProducts(); });
    el("sortSelect").addEventListener("change", e => { state.sort = e.target.value; renderProducts(); });
    const a = getAttribution();
    if (a.contentId !== "dealhub-store" || a.channel !== "website") { const note = el("activeContext"); note.hidden = false; note.textContent = `Nguồn truy cập đang được ghi nhận: ${a.channel} / ${a.contentId} / ${a.campaign}`; }
  }

  loadData().then(() => { renderFilters(); renderProducts(); bind(); });
})();
