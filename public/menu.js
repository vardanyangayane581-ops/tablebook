// Ռեստորանների ցանկ, մենյու, զամբյուղ (երեկոյի ճաշացանկ) և «Իմ ճաշացանկերը» էջեր։
// Բոլոր տեքստերը էջում դնում ենք textContent-ով, որ HTML չմեկնաբանվի։

document.addEventListener("DOMContentLoaded", function () {
  const Cart = window.TablebookCart;
  const body = document.body;

  // ---------- Օգնականներ ----------

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function showFormError(text) {
    const box = document.getElementById("form-error");
    if (box) box.textContent = text || "";
  }

  async function getJSON(url, options) {
    const res = await fetch(url, options);
    const data = await res.json().catch(function () { return {}; });
    return { ok: res.ok, status: res.status, data: data };
  }

  const WEEKDAYS = ["կիրակի", "երկուշաբթի", "երեքշաբթի", "չորեքշաբթի", "հինգշաբթի", "ուրբաթ", "շաբաթ"];
  const MONTHS = ["հունվարի", "փետրվարի", "մարտի", "ապրիլի", "մայիսի", "հունիսի",
    "հուլիսի", "օգոստոսի", "սեպտեմբերի", "հոկտեմբերի", "նոյեմբերի", "դեկտեմբերի"];
  function formatDate(iso) {
    const d = new Date(iso + "T00:00");
    return WEEKDAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()];
  }

  const STATUS_TEXT = {
    pending: "Սպասում է հաստատման",
    confirmed: "Հաստատված է",
    rejected: "Մերժված է",
    cancelled: "Չեղարկված է"
  };

  // Քանակի կոճակներ՝ − 2 +
  function stepper(itemId, qty, onChange) {
    const box = el("div", "stepper");
    const minus = el("button", "step-btn", "−");
    minus.type = "button";
    minus.setAttribute("aria-label", "Պակասեցնել");
    const value = el("span", "step-value", String(qty));
    value.setAttribute("aria-live", "polite");
    const plus = el("button", "step-btn", "+");
    plus.type = "button";
    plus.setAttribute("aria-label", "Ավելացնել");
    minus.addEventListener("click", function () { Cart.setQty(itemId, qty - 1); if (onChange) onChange(); });
    plus.addEventListener("click", function () { Cart.setQty(itemId, qty + 1); if (onChange) onChange(); });
    box.append(minus, value, plus);
    return box;
  }

  // ---------- Ռեստորանների ցանկ ----------

  if (body.classList.contains("page-restaurants")) {
    const grid = document.getElementById("restaurant-grid");
    const search = document.getElementById("search");
    const chips = document.getElementById("cuisine-chips");
    const noResults = document.getElementById("no-results");
    let all = [];
    let cuisine = "";

    function card(r) {
      const a = el("a", "restaurant-card");
      a.href = "/restaurant?id=" + r.id;
      const cover = el("div", "rc-cover");
      cover.style.backgroundImage = "url('/img/" + r.image + "')";
      const rating = el("span", "rc-rating", "⭐ " + r.rating.toFixed(1));
      cover.append(rating);
      const content = el("div", "rc-body");
      content.append(
        el("span", "rc-cuisine", r.cuisine),
        el("h2", "rc-name", r.name),
        el("p", "rc-desc", r.description)
      );
      const meta = el("div", "rc-meta");
      meta.append(
        el("span", "", "🕒 " + r.hours),
        el("span", "", r.item_count + " ուտեստ" + (r.min_price !== null ? " · " + Cart.money(r.min_price) + "-ից" : ""))
      );
      content.append(meta, el("span", "rc-cta", "Դիտել մենյուն →"));
      a.append(cover, content);
      return a;
    }

    function render() {
      const term = search.value.trim().toLowerCase();
      const list = all.filter(function (r) {
        const text = (r.name + " " + r.cuisine + " " + r.description + " " + r.address).toLowerCase();
        return (!cuisine || r.cuisine === cuisine) && (!term || text.includes(term));
      });
      grid.replaceChildren.apply(grid, list.map(card));
      noResults.hidden = list.length > 0;
    }

    function renderChips() {
      const names = [""].concat(Array.from(new Set(all.map(function (r) { return r.cuisine; }))));
      chips.replaceChildren.apply(chips, names.map(function (name) {
        const b = el("button", "chip", name || "Բոլորը");
        b.type = "button";
        b.setAttribute("aria-pressed", String(name === cuisine));
        b.addEventListener("click", function () {
          cuisine = name;
          renderChips();
          render();
        });
        return b;
      }));
    }

    search.addEventListener("input", render);

    getJSON("/api/restaurants")
      .then(function (res) {
        if (!res.ok) throw new Error();
        all = res.data.restaurants;
        renderChips();
        render();
      })
      .catch(function () {
        grid.replaceChildren();
        showFormError("Չհաջողվեց բեռնել ռեստորանները։ Թարմացրեք էջը։");
      });
  }

  // ---------- Մեկ ռեստորանի մենյու ----------

  if (body.classList.contains("page-restaurant")) {
    const id = Number(new URLSearchParams(window.location.search).get("id"));
    let restaurant = null;
    let items = [];

    function renderMenu() {
      const tabs = document.getElementById("menu-tabs");
      const sections = document.getElementById("menu-sections");
      tabs.replaceChildren();
      sections.replaceChildren();

      for (const cat of Cart.CATEGORY_ORDER) {
        const list = items.filter(function (i) { return i.category === cat; });
        if (list.length === 0) continue;

        const tab = el("a", "menu-tab", Cart.CATEGORY_NAMES[cat]);
        tab.href = "#cat-" + cat;
        tabs.append(tab);

        const section = el("section", "menu-section");
        section.id = "cat-" + cat;
        section.append(el("h2", "", Cart.CATEGORY_NAMES[cat]));
        const ul = el("ul", "dish-list");
        for (const item of list) {
          const li = el("li", "dish");
          const emoji = el("span", "dish-emoji", item.emoji);
          emoji.setAttribute("aria-hidden", "true");
          const text = el("div", "dish-text");
          text.append(el("h3", "", item.name), el("p", "", item.description));
          const side = el("div", "dish-side");
          side.append(el("span", "dish-price", Cart.money(item.price)));

          const qty = Cart.load().restaurant_id === restaurant.id ? Cart.qtyOf(item.id) : 0;
          if (qty > 0) {
            side.append(stepper(item.id, qty));
            li.classList.add("in-cart");
          } else {
            const add = el("button", "add-btn", "+ Ավելացնել");
            add.type = "button";
            add.setAttribute("aria-label", "Ավելացնել զամբյուղ՝ " + item.name);
            add.addEventListener("click", function () {
              if (Cart.add(restaurant, item)) Cart.toast("«" + item.name + "»-ը ավելացվեց զամբյուղ");
            });
            side.append(add);
          }
          li.append(emoji, text, side);
          ul.append(li);
        }
        section.append(ul);
        sections.append(section);
      }
    }

    function renderMiniCart() {
      const cart = Cart.load();
      const mine = cart.restaurant_id === restaurant.id;
      const list = document.getElementById("mini-list");
      const other = document.getElementById("mini-other");
      list.replaceChildren();
      const lines = mine ? cart.items : [];
      for (const line of lines) {
        const li = el("li");
        li.append(el("span", "", line.qty + " × " + line.name), el("strong", "", Cart.money(line.price * line.qty)));
        list.append(li);
      }
      document.getElementById("mini-empty").hidden = lines.length > 0;
      document.getElementById("mini-total-row").hidden = lines.length === 0;
      document.getElementById("mini-total").textContent = Cart.money(Cart.total(mine ? cart : { items: [] }));
      document.getElementById("to-cart").hidden = lines.length === 0;
      other.hidden = mine || cart.items.length === 0;
      other.textContent = "Զամբյուղում կան «" + cart.restaurant_name + "»-ի ուտեստներ։ Այստեղից ավելացնելիս զամբյուղը կմաքրվի։";
    }

    document.addEventListener("cart:change", function () {
      if (!restaurant) return;
      renderMenu();
      renderMiniCart();
    });

    getJSON("/api/restaurants/" + id)
      .then(function (res) {
        if (!res.ok) {
          showFormError((res.data.errors && res.data.errors.form) || "Ռեստորանը չի գտնվել");
          return;
        }
        restaurant = res.data.restaurant;
        items = res.data.items;
        document.title = restaurant.name + " · Tablebook";
        const hero = document.getElementById("restaurant-hero");
        hero.style.setProperty("--cover", "url('/img/" + restaurant.image + "')");
        document.getElementById("r-cuisine").textContent = restaurant.cuisine;
        document.getElementById("r-name").textContent = restaurant.name;
        document.getElementById("r-description").textContent = restaurant.description;
        document.getElementById("r-rating").textContent = restaurant.rating.toFixed(1);
        document.getElementById("r-hours").textContent = restaurant.hours;
        document.getElementById("r-address").textContent = restaurant.address;
        document.getElementById("r-phone").textContent = restaurant.phone;
        hero.hidden = false;
        document.getElementById("menu-layout").hidden = false;
        renderMenu();
        renderMiniCart();
      })
      .catch(function () {
        showFormError("Չհաջողվեց բեռնել մենյուն։ Թարմացրեք էջը։");
      });
  }

  // ---------- Զամբյուղ / երեկոյի ճաշացանկ ----------

  if (body.classList.contains("page-cart")) {
    const V = window.TablebookValidation;
    const form = document.getElementById("checkout-form");
    const dateInput = form.elements.date;
    const timeSelect = form.elements.time;
    let loggedIn = false;

    // Ժամեր և օրեր՝ նույն կանոններով, ինչ սեղանի ամրագրումը
    const now = new Date();
    dateInput.min = V.localDate(now);
    dateInput.max = V.localDate(V.addDays(now, V.BOOKING.maxDaysAhead));
    dateInput.value = V.localDate(now);
    for (const slot of V.TIME_SLOTS) {
      const option = el("option", "", slot);
      option.value = slot;
      timeSelect.append(option);
    }
    function updateSlots() {
      const current = new Date();
      const isToday = dateInput.value === V.localDate(current);
      const nowMinutes = current.getHours() * 60 + current.getMinutes();
      let firstFree = "";
      for (const option of timeSelect.options) {
        if (!option.value) continue;
        const minutes = Number(option.value.slice(0, 2)) * 60 + Number(option.value.slice(3, 5));
        option.disabled = isToday && minutes <= nowMinutes;
        if (!option.disabled && !firstFree && minutes >= 19 * 60) firstFree = option.value;
      }
      if (!timeSelect.value || (timeSelect.selectedOptions[0] && timeSelect.selectedOptions[0].disabled)) {
        timeSelect.value = firstFree;
      }
    }
    updateSlots();
    dateInput.addEventListener("change", updateSlots);

    function render() {
      const cart = Cart.load();
      const empty = cart.items.length === 0;
      document.getElementById("cart-empty").hidden = !empty;
      document.getElementById("cart-layout").hidden = empty;
      if (empty) return;

      document.getElementById("em-title").textContent = cart.restaurant_name;
      document.getElementById("add-more").href = "/restaurant?id=" + cart.restaurant_id;

      const sections = document.getElementById("cart-sections");
      sections.replaceChildren();
      for (const cat of Cart.CATEGORY_ORDER) {
        const lines = cart.items.filter(function (i) { return i.category === cat; });
        if (lines.length === 0) continue;
        const section = el("div", "em-course");
        section.append(el("h3", "", Cart.CATEGORY_NAMES[cat]));
        const ul = el("ul", "em-list");
        for (const line of lines) {
          const li = el("li", "em-line");
          const emoji = el("span", "dish-emoji small", line.emoji);
          emoji.setAttribute("aria-hidden", "true");
          const name = el("div", "em-name");
          name.append(el("strong", "", line.name), el("span", "", Cart.money(line.price) + " / հատ"));
          const remove = el("button", "remove-btn", "✕");
          remove.type = "button";
          remove.setAttribute("aria-label", "Հեռացնել՝ " + line.name);
          remove.addEventListener("click", function () { Cart.setQty(line.id, 0); });
          li.append(emoji, name, stepper(line.id, line.qty), el("span", "em-price", Cart.money(line.price * line.qty)), remove);
          ul.append(li);
        }
        section.append(ul);
        sections.append(section);
      }

      const total = Cart.total(cart);
      const guests = Math.max(1, Number(form.elements.guests.value) || 1);
      document.getElementById("sum-count").textContent = Cart.count(cart);
      document.getElementById("sum-per").textContent = Cart.money(Math.round(total / guests));
      document.getElementById("sum-total").textContent = Cart.money(total);
    }

    document.addEventListener("cart:change", render);
    form.elements.guests.addEventListener("input", render);
    document.getElementById("clear-cart").addEventListener("click", function () {
      if (window.confirm("Մաքրե՞լ ամբողջ զամբյուղը")) Cart.clear();
    });
    render();

    getJSON("/api/me").then(function (res) {
      loggedIn = Boolean(res.data.user);
      document.getElementById("login-hint").hidden = loggedIn;
      document.getElementById("checkout-btn").textContent = loggedIn ? "Հաստատել ճաշացանկը" : "Մուտք գործել և հաստատել";
    }).catch(function () {});

    function showErrors(errors) {
      for (const name of ["date", "time", "guests", "note", "form"]) {
        const box = document.getElementById(name + "-error");
        if (box) box.textContent = errors[name] || "";
      }
    }

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (!loggedIn) {
        window.location.href = "/login?next=/cart";
        return;
      }
      const input = Object.fromEntries(new FormData(form));
      const check = V.validateReservation(input, new Date());
      if (Object.keys(check.errors).length > 0) return showErrors(check.errors);
      showErrors({});

      const cart = Cart.load();
      const button = document.getElementById("checkout-btn");
      button.disabled = true;
      try {
        const res = await getJSON("/api/evening-menus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.assign({}, input, {
            restaurant_id: cart.restaurant_id,
            items: cart.items.map(function (i) { return { id: i.id, qty: i.qty }; })
          }))
        });
        if (res.ok) {
          Cart.clear();
          window.location.href = "/my-menus?created=1";
          return;
        }
        if (res.status === 401) {
          window.location.href = "/login?next=/cart";
          return;
        }
        showErrors(res.data.errors || { form: V.MESSAGES.serverError });
      } catch (e) {
        showErrors({ form: V.MESSAGES.serverDown });
      }
      button.disabled = false;
    });
  }

  // ---------- Իմ ճաշացանկերը ----------

  if (body.classList.contains("page-my-menus")) {
    const list = document.getElementById("menu-orders");
    const today = new Date();
    const todayIso = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

    if (new URLSearchParams(window.location.search).get("created")) {
      const notice = document.getElementById("notice");
      notice.textContent = "✅ Ճաշացանկը ուղարկվեց ռեստորանին։ Հաստատումից հետո կարգավիճակը կփոխվի։";
      notice.hidden = false;
      history.replaceState(null, "", "/my-menus");
    }

    function render(menus) {
      document.getElementById("empty").hidden = menus.length > 0;
      list.replaceChildren();
      for (const m of menus) {
        const li = el("li", "order-card" + (m.date < todayIso ? " past" : ""));
        const head = el("div", "order-head");
        const when = el("div", "order-when");
        when.append(el("strong", "", m.time), el("span", "", formatDate(m.date)));
        const info = el("div", "order-info");
        info.append(el("h3", "", m.restaurant_name), el("span", "", m.guests + " հյուր · " + Cart.money(m.total)));
        head.append(when, info, el("span", "status res-" + m.status, STATUS_TEXT[m.status]));

        const dishes = el("ul", "order-dishes");
        for (const i of m.items) {
          const d = el("li");
          d.append(el("span", "", i.qty + " × " + i.name), el("span", "", Cart.money(i.price * i.qty)));
          dishes.append(d);
        }
        li.append(head, dishes);
        if (m.note) li.append(el("p", "res-note", "📝 " + m.note));

        if ((m.status === "pending" || m.status === "confirmed") && m.date >= todayIso) {
          const cancel = el("button", "logout-btn", "Չեղարկել");
          cancel.type = "button";
          cancel.addEventListener("click", async function () {
            if (!window.confirm("Չեղարկե՞լ այս ճաշացանկը")) return;
            cancel.disabled = true;
            const res = await getJSON("/api/evening-menus/" + m.id + "/cancel", { method: "POST" }).catch(function () { return { ok: false, data: {} }; });
            if (!res.ok) {
              showFormError((res.data.errors && res.data.errors.form) || "Չհաջողվեց չեղարկել");
              cancel.disabled = false;
              return;
            }
            load();
          });
          li.append(cancel);
        }
        list.append(li);
      }
    }

    function load() {
      getJSON("/api/evening-menus").then(function (res) {
        if (res.status === 401) {
          window.location.href = "/login?next=/my-menus";
          return;
        }
        render(res.data.menus || []);
      }).catch(function () {
        showFormError("Սերվերը հասանելի չէ։");
      });
    }
    load();
  }
});
