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
  const Regions = window.TablebookRegions;
  for (const r of Regions.REGIONS) IMAGE_NAMES[Regions.regionImage(r.id)] = "🗺️ " + r.name + " (նկարազարդում)";

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
    if (name === "tables") loadTables();
    if (name === "events") loadEvents();
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

  // ---------- Ամրագրումներ (սեղան առանց մենյուի + մենյուով) ----------

  const orderFilter = document.getElementById("order-filter");
  const kindFilter = document.getElementById("kind-filter");
  const payFilter = document.getElementById("pay-filter");
  orderFilter.addEventListener("change", loadOrders);
  kindFilter.addEventListener("change", loadOrders);
  payFilter.addEventListener("change", loadOrders);

  // Ինչպես է կատարվելու (կամ կատարվել) վճարումը
  function paymentPanel(e) {
    const p = e.payment || { method: "cash", status: "unpaid", cashback: 0 };
    const isCard = p.method === "card";
    const box = el("div", "admin-pay " + (isCard ? "card" : "cash") + " st-" + p.status);
    const icon = el("span", "ap-icon", isCard ? "💳" : "💵");
    icon.setAttribute("aria-hidden", "true");
    const text = el("div", "ap-text");
    text.append(el("strong", "", isCard
      ? "Քարտով · " + (p.card_brand || "Քարտ") + " •••• " + (p.card_last4 || "")
      : "Կանխիկ՝ ռեստորանում"));
    let sub;
    if (isCard && p.status === "refunded") sub = "Գումարը վերադարձվել է հաճախորդին";
    else if (isCard) sub = money(e.total) + " վճարված է առցանց" + (p.cashback ? " · հաճախորդի հետվճարը՝ " + money(p.cashback) : "");
    else if (p.status === "paid") sub = money(e.total) + " ստացվել է կանխիկ";
    else sub = money(e.total) + " ստանալ հաճախորդից տեղում";
    text.append(el("span", "", sub));
    const STATUS = { paid: "✓ Վճարված", unpaid: "⏳ Չվճարված", refunded: "↩ Վերադարձված" };
    box.append(icon, text, el("span", "ap-status", STATUS[p.status] || p.status));
    return box;
  }

  async function markPaid(entry) {
    if (!window.confirm("Նշե՞լ, որ " + money(entry.total) + " կանխիկ ստացվել է")) return;
    const res = await send("POST", "/api/admin/evening-menus/" + entry.id + "/paid", {});
    Cart.toast(res.ok ? "Վճարումը նշվեց" : ((res.data.errors && res.data.errors.form) || "Չհաջողվեց"));
    loadOrders();
  }

  // Ամեն տեսակի իր API հասցեն
  function baseUrl(entry) {
    return entry.kind === "menu" ? "/api/admin/evening-menus/" : "/api/admin/reservations/";
  }

  async function loadOrders() {
    const [menusRes, tablesRes] = await Promise.all([api("/api/admin/evening-menus"), api("/api/admin/reservations")]);
    const all = (menusRes.data.menus || []).map(function (m) { return Object.assign({ kind: "menu" }, m); })
      .concat(tablesRes.data.reservations || []);

    // Սպասողները՝ վերևում, հետո՝ ըստ օրվա և ժամի
    const today = window.TablebookValidation.localDate(new Date());
    const entries = all
      .filter(function (e) { return !orderFilter.value || e.status === orderFilter.value; })
      .filter(function (e) { return !kindFilter.value || e.kind === kindFilter.value; })
      .filter(function (e) { return !payFilter.value || (e.kind === "menu" && e.payment && e.payment.method === payFilter.value); })
      .sort(function (a, b) {
        const pa = a.status === "pending" ? 0 : 1;
        const pb = b.status === "pending" ? 0 : 1;
        if (pa !== pb) return pa - pb;
        return (a.date + a.time) < (b.date + b.time) ? -1 : 1;
      });

    const list = document.getElementById("admin-orders");
    document.getElementById("orders-empty").hidden = entries.length > 0;
    list.replaceChildren();
    for (const e of entries) {
      const li = el("li", "order-card kind-" + e.kind + (e.date < today ? " past" : ""));
      const head = el("div", "order-head");
      const when = el("div", "order-when");
      when.append(el("strong", "", e.time), el("span", "", e.date));
      const info = el("div", "order-info");
      const title = el("h3");
      title.append(
        el("span", "kind-badge " + e.kind, e.kind === "menu" ? "🍽️ Մենյուով" : "🪑 Միայն սեղան"),
        document.createTextNode(" " + (e.kind === "menu"
          ? e.restaurant_name
          : (e.restaurant_name ? e.restaurant_name + " · " : "") + (e.table_name || "Սեղանը նշված չէ")))
      );
      info.append(
        title,
        el("span", "", "👤 " + e.customer.name + " · 📞 " + e.customer.telephone),
        el("span", "", e.guests + " հյուր" + (e.kind === "menu" ? " · " + money(e.total) : ""))
      );
      head.append(when, info, el("span", "status res-" + e.status, STATUS_TEXT[e.status]));
      li.append(head);

      if (e.kind === "menu") {
        const dishes = el("ul", "order-dishes");
        for (const i of e.items) {
          const d = el("li");
          d.append(el("span", "", i.qty + " × " + i.name), el("span", "", money(i.price * i.qty)));
          dishes.append(d);
        }
        li.append(dishes, paymentPanel(e));
      }
      if (e.note) li.append(el("p", "res-note", "📝 " + e.note));

      const paidByCard = e.kind === "menu" && e.payment && e.payment.method === "card" && e.payment.status === "paid";
      const actions = el("div", "row-actions");
      if (e.status === "pending") {
        const ok = el("button", "btn-pill primary small", "✓ Հաստատել");
        const no = el("button", "btn-pill ghost small danger", "✕ Մերժել");
        ok.type = no.type = "button";
        ok.addEventListener("click", function () { setStatus(e, "confirmed"); });
        no.addEventListener("click", function () {
          if (paidByCard && !window.confirm("Պատվերը վճարված է քարտով։ Մերժելիս " + money(e.total) + " կվերադարձվի հաճախորդին։ Շարունակե՞լ")) return;
          setStatus(e, "rejected");
        });
        actions.append(ok, no);
      }
      if (e.kind === "menu" && e.payment && e.payment.method === "cash" && e.payment.status === "unpaid" &&
          (e.status === "pending" || e.status === "confirmed")) {
        const paid = el("button", "btn-pill ghost small", "💵 Կանխիկը ստացվել է");
        paid.type = "button";
        paid.addEventListener("click", function () { markPaid(e); });
        actions.append(paid);
      }
      if ((e.status === "pending" || e.status === "confirmed") && e.date >= today) {
        const move = el("button", "btn-pill ghost small", "🕒 Փոխել ժամը");
        move.type = "button";
        move.addEventListener("click", function () { openMove(e); });
        actions.append(move);
      }
      if (actions.children.length) li.append(actions);
      list.append(li);
    }
  }

  async function setStatus(entry, status) {
    const res = await send("POST", baseUrl(entry) + entry.id + "/status", { status: status });
    Cart.toast(res.ok ? (status === "confirmed" ? "Ամրագրումը հաստատվեց" : "Ամրագրումը մերժվեց") : "Չհաջողվեց");
    loadOrders();
    loadOverview();
  }

  // Ժամի փոփոխություն. անցած ժամերը չեն երևում, սեղանի զբաղված ժամերը անջատված են
  const mDialog = document.getElementById("move-dialog");
  const mForm = document.getElementById("move-form");
  let movingEntry = null;
  let picker = null;

  function openMove(entry) {
    movingEntry = entry;
    clearErrors(mForm);
    const isTable = entry.kind === "table";
    document.getElementById("mv-table-field").hidden = !isTable;
    document.getElementById("mv-who").textContent = "👤 " + entry.customer.name + " · " + entry.guests + " հյուր · հիմա՝ " + entry.date + ", " + entry.time;
    // Մենյուով պատվերը սեղան չունի, դրա համար սեղանի զբաղվածությունը չենք ստուգում
    const values = {
      date: entry.date,
      time: entry.time,
      guests: entry.guests,
      tableId: entry.table_id,
      exclude: isTable ? entry.id : null,
      noTable: !isTable
    };
    if (!picker) {
      picker = window.TablebookTimePicker.connect(Object.assign({
        dateInput: mForm.elements.date,
        tableSelect: mForm.elements.table_id,
        grid: document.getElementById("mv-time")
      }, values));
    } else {
      picker.set(values);
    }
    mDialog.showModal();
  }

  mForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(mForm));
    if (!payload.time) return showErrors(mForm, "mv-", { time: "Ընտրեք ժամը" });
    const res = await send("POST", baseUrl(movingEntry) + movingEntry.id + "/move", payload);
    if (!res.ok) return showErrors(mForm, "mv-", res.data.errors || { form: "Չհաջողվեց պահպանել" });
    mDialog.close();
    Cart.toast("Ժամը փոխվեց՝ " + payload.date + ", " + payload.time);
    loadOrders();
  });

  // ---------- Սեղաններ ----------

  const tDialog = document.getElementById("table-dialog");
  const tForm = document.getElementById("table-form");
  let editingTable = null;

  const tableRestaurant = document.getElementById("table-restaurant");
  let restaurantOptionsReady = false;

  // Ռեստորանների ցանկը՝ խմբավորված ըստ մարզի (զտիչի և սեղանի ձևի համար)
  async function restaurantOptions(select, withAll) {
    if (!restaurants.length) {
      const res = await api("/api/admin/restaurants");
      restaurants = res.data.restaurants || [];
      images = res.data.images || [];
    }
    const keep = select.value;
    select.replaceChildren();
    if (withAll) {
      const all = el("option", "", "Բոլոր ռեստորանները");
      all.value = "";
      select.append(all);
    }
    for (const region of Regions.REGIONS) {
      const list = restaurants.filter(function (r) { return r.region === region.id; });
      if (!list.length) continue;
      const group = el("optgroup");
      group.label = Regions.regionTitle(region);
      for (const r of list) {
        const o = el("option", "", r.name + " · " + r.city);
        o.value = String(r.id);
        group.append(o);
      }
      select.append(group);
    }
    select.value = keep;
  }

  tableRestaurant.addEventListener("change", function () {
    plan.reset();
    loadTables();
  });

  // ---------- Սրահի քարտեզ ----------

  const planSave = document.getElementById("plan-save");
  let planTables = [];
  const plan = window.TablebookFloorPlan.create(document.getElementById("plan-editor"), {
    editable: true,
    onMove: function () { planSave.disabled = false; }
  });

  function showPlan(tables) {
    const one = Boolean(tableRestaurant.value);
    document.getElementById("plan-hint").hidden = one;
    document.getElementById("plan-help").hidden = !one;
    document.getElementById("plan-editor").hidden = !one;
    document.getElementById("plan-actions").hidden = !one;
    planSave.disabled = true;
    planTables = one ? tables : [];
    if (!one) return;
    plan.update(planTables, function (t) { return t.is_active ? "free" : "hidden"; },
      "Այս ռեստորանը դեռ սեղաններ չունի։ Ավելացրեք դրանք «+ Նոր սեղան» կոճակով։");
  }

  document.getElementById("plan-arrange").addEventListener("click", function () {
    plan.arrange(planTables);
    planSave.disabled = false;
  });

  planSave.addEventListener("click", async function () {
    planSave.disabled = true;
    const res = await send("PUT", "/api/admin/tables/layout", {
      restaurant_id: Number(tableRestaurant.value),
      positions: plan.getPositions()
    });
    if (!res.ok) {
      planSave.disabled = false;
      return Cart.toast((res.data.errors && res.data.errors.form) || "Չհաջողվեց պահպանել");
    }
    Cart.toast("Սրահի դասավորությունը պահպանվեց 🗺️");
  });

  async function loadTables() {
    if (!restaurantOptionsReady) {
      await restaurantOptions(tableRestaurant, true);
      restaurantOptionsReady = true;
    }
    const res = await api("/api/admin/tables" + (tableRestaurant.value ? "?restaurant=" + tableRestaurant.value : ""));
    const rows = document.getElementById("table-rows");
    rows.replaceChildren();
    const tables = res.data.tables || [];
    showPlan(tables);
    if (tables.length === 0) {
      const tr = el("tr");
      const td = el("td", "muted", "Սեղաններ դեռ չկան։ Ավելացրեք առաջինը։");
      td.colSpan = 4;
      tr.append(td);
      rows.append(tr);
    }
    for (const t of tables) {
      const tr = el("tr");
      if (!t.is_active) tr.className = "dim";
      const name = el("td");
      name.append(el("span", "row-emoji", "🪑"), el("strong", "", t.name));
      if (!tableRestaurant.value && t.restaurant_name) {
        name.append(el("small", "row-sub", t.restaurant_name + (t.restaurant_city ? " · " + t.restaurant_city : "")));
      }
      const toggle = el("td");
      const sw = el("input");
      sw.type = "checkbox";
      sw.className = "switch-input";
      sw.checked = t.is_active;
      sw.setAttribute("aria-label", "Ցուցադրել՝ " + t.name);
      sw.addEventListener("change", async function () {
        const upd = await send("PUT", "/api/admin/tables/" + t.id, Object.assign({}, t, { is_active: sw.checked }));
        Cart.toast(upd.ok ? (sw.checked ? "Սեղանը ցուցադրվում է" : "Սեղանը թաքցվեց") : "Չհաջողվեց");
        loadTables();
      });
      toggle.append(sw);
      const actions = el("td", "cell-actions");
      const edit = el("button", "link-btn", "Խմբագրել");
      const del = el("button", "link-btn danger", "Ջնջել");
      edit.type = del.type = "button";
      edit.addEventListener("click", function () { openTableDialog(t); });
      del.addEventListener("click", async function () {
        if (!window.confirm("Ջնջե՞լ «" + t.name + "»-ը")) return;
        const d = await send("DELETE", "/api/admin/tables/" + t.id);
        Cart.toast(d.ok ? "Սեղանը ջնջվեց" : ((d.data.errors && d.data.errors.form) || "Չհաջողվեց"));
        loadTables();
      });
      actions.append(edit, del);
      tr.append(name, el("td", "", t.seats + " տեղ"), toggle, actions);
      rows.append(tr);
    }
  }

  async function openTableDialog(t) {
    editingTable = t;
    tForm.reset();
    clearErrors(tForm);
    await restaurantOptions(tForm.elements.restaurant_id, false);
    tForm.elements.restaurant_id.value = t ? String(t.restaurant_id || "") : tableRestaurant.value || tForm.elements.restaurant_id.value;
    document.getElementById("td-title").textContent = t ? "Խմբագրել սեղանը" : "Նոր սեղան";
    if (t) {
      tForm.elements.name.value = t.name;
      tForm.elements.seats.value = t.seats;
      tForm.elements.is_active.checked = t.is_active;
    }
    tDialog.showModal();
  }

  document.getElementById("add-table").addEventListener("click", function () { openTableDialog(null); });

  tForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(tForm));
    payload.seats = Number(payload.seats);
    payload.is_active = tForm.elements.is_active.checked;
    const res = editingTable
      ? await send("PUT", "/api/admin/tables/" + editingTable.id, payload)
      : await send("POST", "/api/admin/tables", payload);
    if (!res.ok) return showErrors(tForm, "t-", res.data.errors || { form: "Չհաջողվեց պահպանել" });
    tDialog.close();
    Cart.toast(editingTable ? "Սեղանը թարմացվեց" : "Սեղանը ավելացվեց 🎉");
    loadTables();
  });

  // ---------- Միջոցառումներ ----------

  const Kinds = window.TablebookEventKinds;
  const eDialog = document.getElementById("event-dialog");
  const eForm = document.getElementById("event-form");
  let editingEvent = null;

  for (const k of Kinds.KINDS) {
    const o = el("option", "", k.emoji + " " + k.name);
    o.value = k.id;
    eForm.elements.kind.append(o);
  }

  function shortDate(iso) {
    const d = new Date(iso + "T00:00");
    return d.getDate() + "." + String(d.getMonth() + 1).padStart(2, "0") + "." + d.getFullYear();
  }

  async function loadEvents() {
    const res = await api("/api/admin/events");
    const rows = document.getElementById("event-rows");
    rows.replaceChildren();
    const events = res.data.events || [];
    const today = window.TablebookValidation.localDate(new Date());
    if (events.length === 0) {
      const tr = el("tr");
      const td = el("td", "muted", "Միջոցառումներ դեռ չկան։ Ավելացրեք առաջինը։");
      td.colSpan = 6;
      tr.append(td);
      rows.append(tr);
    }
    for (const e of events) {
      const past = e.date < today;
      const tr = el("tr");
      if (!e.is_active || past) tr.className = "dim";

      const name = el("td");
      name.append(el("span", "row-emoji", Kinds.kindById(e.kind).emoji), el("strong", "", e.title));
      name.append(el("small", "row-sub", e.restaurant_name + " · " + e.restaurant_city + (past ? " · անցած" : "")));

      const seats = el("td");
      const guests = el("button", "link-btn", e.booked + " / " + e.capacity);
      guests.type = "button";
      guests.title = "Տեսնել հյուրերին";
      guests.addEventListener("click", function () { openGuests(e); });
      seats.append(guests);

      const toggle = el("td");
      const sw = el("input");
      sw.type = "checkbox";
      sw.className = "switch-input";
      sw.checked = e.is_active;
      sw.setAttribute("aria-label", "Ցուցադրել՝ " + e.title);
      sw.addEventListener("change", async function () {
        const upd = await send("PUT", "/api/admin/events/" + e.id, Object.assign({}, e, { is_active: sw.checked }));
        Cart.toast(upd.ok
          ? (sw.checked ? "Միջոցառումը ցուցադրվում է" : "Միջոցառումը թաքցվեց")
          : ((upd.data.errors && Object.values(upd.data.errors)[0]) || "Չհաջողվեց"));
        loadEvents();
      });
      toggle.append(sw);

      const actions = el("td", "cell-actions");
      const edit = el("button", "link-btn", "Խմբագրել");
      const del = el("button", "link-btn danger", "Ջնջել");
      edit.type = del.type = "button";
      edit.addEventListener("click", function () { openEventDialog(e); });
      del.addEventListener("click", async function () {
        if (!window.confirm("Ջնջե՞լ «" + e.title + "»-ը")) return;
        const d = await send("DELETE", "/api/admin/events/" + e.id);
        Cart.toast(d.ok ? "Միջոցառումը ջնջվեց" : ((d.data.errors && d.data.errors.form) || "Չհաջողվեց"));
        loadEvents();
      });
      actions.append(edit, del);

      tr.append(
        name,
        el("td", "", shortDate(e.date) + ", " + e.time),
        el("td", "", e.price > 0 ? money(e.price) : "Անվճար"),
        seats, toggle, actions
      );
      rows.append(tr);
    }
  }

  async function openEventDialog(e) {
    editingEvent = e;
    eForm.reset();
    clearErrors(eForm);
    await restaurantOptions(eForm.elements.restaurant_id, false);
    document.getElementById("ed-title").textContent = e ? "Խմբագրել միջոցառումը" : "Նոր միջոցառում";
    const today = window.TablebookValidation.localDate(new Date());
    eForm.elements.date.min = e && e.date < today ? e.date : today;
    if (e) {
      eForm.elements.restaurant_id.value = String(e.restaurant_id);
      eForm.elements.kind.value = e.kind;
      eForm.elements.title.value = e.title;
      eForm.elements.description.value = e.description;
      eForm.elements.date.value = e.date;
      eForm.elements.time.value = e.time;
      eForm.elements.price.value = String(e.price);
      eForm.elements.capacity.value = String(e.capacity);
      eForm.elements.is_active.checked = e.is_active;
    } else {
      eForm.elements.date.value = window.TablebookValidation.localDate(window.TablebookValidation.addDays(new Date(), 7));
      // Ցանկում դատարկ տարբերակ չկա, այնպես որ նախապես ընտրում ենք առաջին ռեստորանը
      if (!eForm.elements.restaurant_id.value) eForm.elements.restaurant_id.selectedIndex = 0;
    }
    eDialog.showModal();
  }

  document.getElementById("add-event").addEventListener("click", function () { openEventDialog(null); });

  eForm.addEventListener("submit", async function (event) {
    event.preventDefault();
    const payload = Object.fromEntries(new FormData(eForm));
    payload.price = Number(payload.price || 0);
    payload.capacity = Number(payload.capacity);
    payload.is_active = eForm.elements.is_active.checked;
    const res = editingEvent
      ? await send("PUT", "/api/admin/events/" + editingEvent.id, payload)
      : await send("POST", "/api/admin/events", payload);
    if (!res.ok) return showErrors(eForm, "e-", res.data.errors || { form: "Չհաջողվեց պահպանել" });
    eDialog.close();
    Cart.toast(editingEvent ? "Միջոցառումը թարմացվեց" : "Միջոցառումը ավելացվեց 🎶");
    loadEvents();
  });

  // Ով է ամրագրել միջոցառումը
  async function openGuests(e) {
    const dialog = document.getElementById("guests-dialog");
    document.getElementById("gd-title").textContent = Kinds.kindById(e.kind).emoji + " " + e.title;
    document.getElementById("gd-sub").textContent =
      shortDate(e.date) + ", " + e.time + " · ամրագրված է " + e.booked + " տեղ " + e.capacity + "-ից";
    const list = document.getElementById("gd-list");
    list.replaceChildren(el("li", "muted", "Բեռնվում է…"));
    dialog.showModal();
    const res = await api("/api/admin/events/" + e.id + "/bookings");
    list.replaceChildren();
    const bookings = res.data.bookings || [];
    if (bookings.length === 0) list.append(el("li", "muted", "Դեռ ոչ ոք չի ամրագրել։"));
    for (const b of bookings) {
      const li = el("li", b.status === "cancelled" ? "dim" : "");
      li.append(
        el("strong", "", b.customer.name),
        el("span", "", "👥 " + b.guests + " · 📞 " + b.customer.telephone + (b.status === "cancelled" ? " · չեղարկված" : ""))
      );
      if (b.note) li.append(el("small", "muted", b.note));
      list.append(li);
    }
  }

  // ---------- Ռեստորաններ ----------

  let restaurants = [];
  let images = [];
  let selected = null;

  async function loadRestaurants() {
    const res = await api("/api/admin/restaurants");
    restaurants = res.data.restaurants || [];
    images = res.data.images || [];
    restaurantOptionsReady = false; // սեղանների զտիչը կթարմացվի նոր ցանկով
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
      tr.append(name, el("td", "", "📍 " + (r.city || "—")), el("td", "", r.cuisine), el("td", "", String(r.item_count)), el("td", "", "⭐ " + r.rating.toFixed(1)), status, actions);
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

  const regionSelect = rForm.elements.region;
  const citySelect = rForm.elements.city;
  regionSelect.replaceChildren.apply(regionSelect, Regions.REGIONS.map(function (r) {
    const o = el("option", "", Regions.regionTitle(r));
    o.value = r.id;
    return o;
  }));
  function fillCities(cityValue) {
    const region = Regions.regionById(regionSelect.value) || Regions.REGIONS[0];
    citySelect.replaceChildren.apply(citySelect, region.cities.map(function (c) {
      const o = el("option", "", c);
      o.value = c;
      return o;
    }));
    citySelect.value = region.cities.indexOf(cityValue) !== -1 ? cityValue : region.center;
  }
  regionSelect.addEventListener("change", function () { fillCities(""); });

  function openRestaurantDialog(r) {
    editingRestaurant = r;
    rForm.reset();
    clearErrors(rForm);
    regionSelect.value = r && r.region ? r.region : Regions.REGIONS[0].id;
    fillCities(r ? r.city : "");
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
    if (!payload.price) return showErrors(iForm, "i-", { price: "Գրեք գինը" });
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
