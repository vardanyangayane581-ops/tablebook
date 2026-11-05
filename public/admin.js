// Ադմին վահանակ։ Բոլոր հարցումները սերվերում ստուգվում են (միայն մուտք գործած աշխատողի համար)

document.addEventListener("DOMContentLoaded", function () {
  const Cart = window.TablebookCart;
  const money = Cart.money;

  const STATUS_TEXT = {
    pending: "Սպասում է",
    confirmed: "Հաստատված",
    rejected: "Մերժված",
    cancelled: "Չեղարկված"
  };
  const IMAGE_NAMES = {
    "cafe-bar.jpg": "Բար",
    "cafe-interior.jpg": "Ինտերիեր",
    "cafe-table.jpg": "Սեղան",
    "coffee-friends.jpg": "Ընկերներ"
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  // Եթե սեսիան ավարտվել է, վերադառնում ենք մուտքի էջ
  async function api(url, options) {
    const res = await fetch(url, options);
    const data = await res.json().catch(function () { return {}; });
    if (res.status === 403) {
      window.location.href = "/admin-login";
      throw new Error("denied");
    }
    return { ok: res.ok, data: data };
  }

  function send(method, url, payload) {
    return api(url, {
      method: method,
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined
    });
  }

  // ---------- Բաժիններ ----------

  const navButtons = document.querySelectorAll(".admin-nav button");
  function openTab(name) {
    for (const b of navButtons) {
      if (b.dataset.tab === name) b.setAttribute("aria-current", "page");
      else b.removeAttribute("aria-current");
    }
    for (const section of document.querySelectorAll(".admin-tab")) {
      section.hidden = section.id !== "tab-" + name;
    }
    if (name === "overview") loadOverview();
    if (name === "orders") loadOrders();
    if (name === "restaurants") loadRestaurants();
    if (name === "settings") loadSettings();
    try { sessionStorage.setItem("admin-tab", name); } catch (e) {}
  }
  for (const b of navButtons) b.addEventListener("click", function () { openTab(b.dataset.tab); });

  // ---------- Աշխատող ----------

  api("/api/admin/me").then(function (res) {
    if (!res.data.admin) {
      window.location.href = "/admin-login";
      return;
    }
    document.getElementById("admin-name").textContent = res.data.admin.name;
    document.getElementById("admin-first").textContent = res.data.admin.name.split(" ")[0];
  }).catch(function () {});

  document.getElementById("admin-logout").addEventListener("click", async function () {
    await send("POST", "/api/admin/logout").catch(function () {});
    window.location.href = "/admin-login";
  });

  // ---------- Ընդհանուր ----------

  async function loadOverview() {
    const res = await api("/api/admin/overview");
    const c = res.data.counts;
    document.getElementById("st-restaurants").textContent = c.restaurants;
    document.getElementById("st-items").textContent = c.items;
    document.getElementById("st-users").textContent = c.users;
    document.getElementById("st-pending").textContent = c.pending;
    const pill = document.getElementById("pending-pill");
    pill.textContent = c.pending;
    pill.hidden = c.pending === 0;
  }

  document.getElementById("quick-add-restaurant").addEventListener("click", function () {
    openTab("restaurants");
    openRestaurantDialog(null);
  });

  // ---------- Պատվերներ ----------

  const orderFilter = document.getElementById("order-filter");
  orderFilter.addEventListener("change", loadOrders);

  async function loadOrders() {
    const res = await api("/api/admin/evening-menus");
    const list = document.getElementById("admin-orders");
    const menus = (res.data.menus || []).filter(function (m) { return !orderFilter.value || m.status === orderFilter.value; });
    document.getElementById("orders-empty").hidden = menus.length > 0;
    list.replaceChildren();
    for (const m of menus) {
      const li = el("li", "order-card");
      const head = el("div", "order-head");
      const when = el("div", "order-when");
      when.append(el("strong", "", m.time), el("span", "", m.date));
      const info = el("div", "order-info");
      info.append(
        el("h3", "", m.restaurant_name),
        el("span", "", "👤 " + m.customer.name + " · 📞 " + m.customer.telephone),
        el("span", "", m.guests + " հյուր · " + money(m.total))
      );
      head.append(when, info, el("span", "status res-" + m.status, STATUS_TEXT[m.status]));
      const dishes = el("ul", "order-dishes");
      for (const i of m.items) {
        const d = el("li");
        d.append(el("span", "", i.qty + " × " + i.name), el("span", "", money(i.price * i.qty)));
        dishes.append(d);
      }
      li.append(head, dishes);
      if (m.note) li.append(el("p", "res-note", "📝 " + m.note));

      if (m.status === "pending") {
        const actions = el("div", "row-actions");
        const ok = el("button", "btn-pill primary small", "✓ Հաստատել");
        const no = el("button", "btn-pill ghost small danger", "✕ Մերժել");
        ok.type = no.type = "button";
        ok.addEventListener("click", function () { setStatus(m.id, "confirmed"); });
        no.addEventListener("click", function () { setStatus(m.id, "rejected"); });
        actions.append(ok, no);
        li.append(actions);
      }
      list.append(li);
    }
  }

  async function setStatus(id, status) {
    const res = await send("POST", "/api/admin/evening-menus/" + id + "/status", { status: status });
    Cart.toast(res.ok ? (status === "confirmed" ? "Պատվերը հաստատվեց" : "Պատվերը մերժվեց") : "Չհաջողվեց");
    loadOrders();
    loadOverview();
  }

  // ---------- Ռեստորաններ ----------

  let restaurants = [];
  let images = [];
  let selected = null;

  async function loadRestaurants() {
    const res = await api("/api/admin/restaurants");
    restaurants = res.data.restaurants || [];
    images = res.data.images || [];
    const rows = document.getElementById("restaurant-rows");
    rows.replaceChildren();
    for (const r of restaurants) {
      const tr = el("tr");
      if (selected && selected.id === r.id) tr.className = "selected";
      const name = el("td");
      const thumb = el("span", "thumb");
      thumb.style.backgroundImage = "url('/img/" + r.image + "')";
      name.append(thumb, el("strong", "", r.name));
      const status = el("td");
      status.append(el("span", "status " + (r.is_active ? "res-confirmed" : "res-cancelled"), r.is_active ? "Ակտիվ" : "Թաքնված"));
      const actions = el("td", "cell-actions");
      const menuBtn = el("button", "link-btn", "Մենյու");
      const editBtn = el("button", "link-btn", "Խմբագրել");
      const delBtn = el("button", "link-btn danger", "Ջնջել");
      menuBtn.type = editBtn.type = delBtn.type = "button";
      menuBtn.addEventListener("click", function () { selectRestaurant(r); });
      editBtn.addEventListener("click", function () { openRestaurantDialog(r); });
      delBtn.addEventListener("click", async function () {
        if (!window.confirm("Ջնջե՞լ «" + r.name + "»-ը և նրա ամբողջ մենյուն։ Այս գործողությունը հնարավոր չէ հետ շրջել։")) return;
        const del = await send("DELETE", "/api/admin/restaurants/" + r.id);
        Cart.toast(del.ok ? "Ռեստորանը ջնջվեց" : "Չհաջողվեց ջնջել");
        if (selected && selected.id === r.id) {
          selected = null;
          document.getElementById("menu-admin").hidden = true;
        }
        loadRestaurants();
      });
      actions.append(menuBtn, editBtn, delBtn);
      tr.append(name, el("td", "", r.cuisine), el("td", "", String(r.item_count)), el("td", "", "⭐ " + r.rating.toFixed(1)), status, actions);
      rows.append(tr);
    }
    if (selected) {
      const fresh = restaurants.find(function (r) { return r.id === selected.id; });
      if (fresh) selectRestaurant(fresh, true);
    }
  }

  // Ռեստորանի ձև
  const rDialog = document.getElementById("restaurant-dialog");
  const rForm = document.getElementById("restaurant-form");
  let editingRestaurant = null;

  function openRestaurantDialog(r) {
    editingRestaurant = r;
    rForm.reset();
    clearErrors(rForm);
    const select = rForm.elements.image;
    select.replaceChildren.apply(select, (images.length ? images : Object.keys(IMAGE_NAMES)).map(function (img) {
      const o = el("option", "", IMAGE_NAMES[img] || img);
      o.value = img;
      return o;
    }));
    document.getElementById("rd-title").textContent = r ? "Խմբագրել ռեստորանը" : "Նոր ռեստորան";
    if (r) {
      for (const key of ["name", "cuisine", "description", "address", "phone", "hours", "image", "rating"]) {
        rForm.elements[key].value = r[key];
      }
      rForm.elements.is_active.checked = r.is_active;
    }
    rDialog.showModal();
  }

  document.getElementById("add-restaurant").addEventListener("click", function () { openRestaurantDialog(null); });

  rForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(rForm));
    payload.is_active = rForm.elements.is_active.checked;
    if (!payload.name.trim()) return showErrors(rForm, "r-", { name: "Գրեք ռեստորանի անունը" });
    const res = editingRestaurant
      ? await send("PUT", "/api/admin/restaurants/" + editingRestaurant.id, payload)
      : await send("POST", "/api/admin/restaurants", payload);
    if (!res.ok) return showErrors(rForm, "r-", res.data.errors || { form: "Չհաջողվեց պահպանել" });
    rDialog.close();
    Cart.toast(editingRestaurant ? "Փոփոխությունները պահպանվեցին" : "Ռեստորանը ավելացվեց 🎉");
    if (!editingRestaurant) selected = res.data.restaurant;
    loadRestaurants();
  });

  // ---------- Մենյու ----------

  async function selectRestaurant(r, silent) {
    selected = r;
    for (const tr of document.querySelectorAll("#restaurant-rows tr")) tr.classList.remove("selected");
    const index = restaurants.findIndex(function (x) { return x.id === r.id; });
    const row = document.querySelectorAll("#restaurant-rows tr")[index];
    if (row) row.classList.add("selected");

    const res = await api("/api/admin/restaurants/" + r.id + "/items");
    const box = document.getElementById("menu-admin");
    box.hidden = false;
    document.getElementById("menu-admin-name").textContent = r.name;
    const rows = document.getElementById("item-rows");
    rows.replaceChildren();
    const items = (res.data.items || []).slice().sort(function (a, b) {
      return Cart.CATEGORY_ORDER.indexOf(a.category) - Cart.CATEGORY_ORDER.indexOf(b.category);
    });
    if (items.length === 0) {
      const tr = el("tr");
      const td = el("td", "muted", "Մենյուն դեռ դատարկ է։ Ավելացրեք առաջին ուտեստը։");
      td.colSpan = 5;
      tr.append(td);
      rows.append(tr);
    }
    for (const item of items) {
      const tr = el("tr");
      if (!item.is_available) tr.className = "dim";
      const name = el("td");
      name.append(el("span", "row-emoji", item.emoji), el("strong", "", item.name));
      const toggle = el("td");
      const sw = el("input");
      sw.type = "checkbox";
      sw.className = "switch-input";
      sw.checked = item.is_available;
      sw.setAttribute("aria-label", "Հասանելի է՝ " + item.name);
      sw.addEventListener("change", async function () {
        const upd = await send("PUT", "/api/admin/items/" + item.id, Object.assign({}, item, { is_available: sw.checked }));
        Cart.toast(upd.ok ? (sw.checked ? "Ուտեստը հասանելի է" : "Ուտեստը թաքցվեց") : "Չհաջողվեց");
        selectRestaurant(selected, true);
      });
      toggle.append(sw);
      const actions = el("td", "cell-actions");
      const edit = el("button", "link-btn", "Խմբագրել");
      const del = el("button", "link-btn danger", "Ջնջել");
      edit.type = del.type = "button";
      edit.addEventListener("click", function () { openItemDialog(item); });
      del.addEventListener("click", async function () {
        if (!window.confirm("Ջնջե՞լ «" + item.name + "»-ը մենյուից")) return;
        const d = await send("DELETE", "/api/admin/items/" + item.id);
        Cart.toast(d.ok ? "Ուտեստը ջնջվեց" : "Չհաջողվեց");
        loadRestaurants();
      });
      actions.append(edit, del);
      tr.append(name, el("td", "", Cart.CATEGORY_NAMES[item.category]), el("td", "", money(item.price)), toggle, actions);
      rows.append(tr);
    }
    if (!silent) box.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  const iDialog = document.getElementById("item-dialog");
  const iForm = document.getElementById("item-form");
  let editingItem = null;
  iForm.elements.category.replaceChildren.apply(iForm.elements.category, Cart.CATEGORY_ORDER.map(function (c) {
    const o = el("option", "", Cart.CATEGORY_NAMES[c]);
    o.value = c;
    return o;
  }));

  function openItemDialog(item) {
    editingItem = item;
    iForm.reset();
    clearErrors(iForm);
    document.getElementById("id-title").textContent = item ? "Խմբագրել ուտեստը" : "Նոր ուտեստ · " + selected.name;
    if (item) {
      for (const key of ["name", "emoji", "category", "price", "description"]) iForm.elements[key].value = item[key];
      iForm.elements.is_available.checked = item.is_available;
    }
    iDialog.showModal();
  }

  document.getElementById("add-item").addEventListener("click", function () { openItemDialog(null); });

  iForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(iForm));
    payload.price = Number(payload.price);
    payload.is_available = iForm.elements.is_available.checked;
    const res = editingItem
      ? await send("PUT", "/api/admin/items/" + editingItem.id, payload)
      : await send("POST", "/api/admin/restaurants/" + selected.id + "/items", payload);
    if (!res.ok) return showErrors(iForm, "i-", res.data.errors || { form: "Չհաջողվեց պահպանել" });
    iDialog.close();
    Cart.toast(editingItem ? "Ուտեստը թարմացվեց" : "Ուտեստը ավելացվեց մենյուում");
    loadRestaurants();
  });

  // Ձևերի սխալներ
  function clearErrors(form) {
    for (const box of form.querySelectorAll(".field-error")) box.textContent = "";
  }
  function showErrors(form, prefix, errors) {
    clearErrors(form);
    for (const key in errors) {
      const box = document.getElementById(prefix + key + "-error");
      if (box) box.textContent = errors[key];
    }
  }

  for (const btn of document.querySelectorAll("[data-close]")) {
    btn.addEventListener("click", function () { btn.closest("dialog").close(); });
  }

  // ---------- Կայքի տեքստեր ----------

  const sForm = document.getElementById("settings-form");

  async function loadSettings() {
    const res = await api("/api/admin/settings");
    for (const [key, value] of Object.entries(res.data.settings || {})) {
      if (sForm.elements[key]) sForm.elements[key].value = value;
    }
  }

  sForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    for (const box of sForm.querySelectorAll(".field-error")) box.textContent = "";
    const res = await send("PUT", "/api/admin/settings", Object.fromEntries(new FormData(sForm)));
    if (!res.ok) {
      const errors = res.data.errors || { form: "Չհաջողվեց պահպանել" };
      for (const key in errors) {
        const box = document.getElementById((key === "form" ? "settings-form" : key) + "-error");
        if (box) box.textContent = errors[key];
      }
      return;
    }
    Cart.toast("Կայքի տեքստերը պահպանվեցին ✓");
  });

  // ---------- Սկիզբ ----------

  let start = "overview";
  try { start = sessionStorage.getItem("admin-tab") || "overview"; } catch (e) {}
  openTab(start);
  if (start !== "overview") loadOverview();
});
