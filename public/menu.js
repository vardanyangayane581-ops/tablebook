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

  // Քանակ՝ − 2 +, իսկ թիվը կարելի է նաև ձեռքով գրել
  function stepper(itemId, qty, onChange) {
    const box = el("div", "stepper");
    const minus = el("button", "step-btn", "−");
    minus.type = "button";
    minus.setAttribute("aria-label", "Պակասեցնել");
    const value = el("input", "step-value");
    value.type = "text";
    value.inputMode = "numeric";
    value.maxLength = 2;
    value.autocomplete = "off";
    value.value = String(qty);
    value.setAttribute("data-digits", "");
    value.setAttribute("aria-label", "Քանակ");
    const plus = el("button", "step-btn", "+");
    plus.type = "button";
    plus.setAttribute("aria-label", "Ավելացնել");
    minus.addEventListener("click", function () { Cart.setQty(itemId, qty - 1); if (onChange) onChange(); });
    plus.addEventListener("click", function () { Cart.setQty(itemId, qty + 1); if (onChange) onChange(); });
    // Դատարկ կամ 0 գրելու դեպքում վերադարձնում ենք նախորդ քանակը (հեռացնելու համար կա ✕ կոճակը)
    value.addEventListener("change", function () {
      const n = Number(value.value);
      if (n >= 1) {
        Cart.setQty(itemId, n);
        if (onChange) onChange();
      } else {
        value.value = String(qty);
      }
    });
    value.addEventListener("keydown", function (event) {
      if (event.key === "Enter") value.blur();
    });
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
    let loggedIn = false;

    // Ժամեր և օրեր՝ նույն կանոններով և նույն գունավոր կոճակներով, ինչ սեղանի ամրագրումը։
    // Ճաշացանկը սեղան չունի, դրա համար զբաղված ժամեր չկան
    window.TablebookTimePicker.connect({
      dateInput: form.elements.date,
      grid: document.getElementById("c-time"),
      time: "19:00"
    });

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
      document.getElementById("promo-amount").textContent = Cart.money(V.cashbackFor(total));
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
      document.getElementById("checkout-label").textContent = loggedIn ? "Վճարել" : "Մուտք գործել և վճարել";
    }).catch(function () {});

    function showErrors(errors) {
      for (const name of ["date", "time", "guests", "note", "form"]) {
        const box = document.getElementById(name + "-error");
        if (box) box.textContent = errors[name] || "";
      }
    }

    // ----- Վճարման պատուհան -----
    const payDialog = document.getElementById("pay-dialog");
    const payForm = document.getElementById("pay-form");
    const cardInput = document.getElementById("card-number");
    const payBtn = document.getElementById("pay-btn");
    let orderInput = null;
    let cardEnabled = true;
    let paying = false;

    getJSON("/api/payment-options").then(function (res) {
      cardEnabled = res.data.card !== false;
      const cardOption = document.getElementById("method-card");
      cardOption.classList.toggle("disabled", !cardEnabled);
      cardOption.querySelector("input").disabled = !cardEnabled;
      document.getElementById("cashback-promo").hidden = !cardEnabled;
      if (!cardEnabled) cardOption.querySelector(".pm-text span").textContent = "Ժամանակավորապես հասանելի չէ";
    }).catch(function () {});

    function showPayErrors(errors) {
      for (const name of ["payment", "card_number", "pay-form"]) {
        const box = document.getElementById(name + "-error");
        if (box) box.textContent = errors[name === "pay-form" ? "form" : name] || "";
      }
      cardInput.setAttribute("aria-invalid", errors.card_number ? "true" : "false");
    }

    function currentMethod() {
      const checked = payForm.querySelector("input[name=method]:checked");
      return checked ? checked.value : "";
    }

    // Քարտի համարը ցույց ենք տալիս 4-ական խմբերով, իսկ քարտի նկարում՝ միայն վերջին 4-ը
    function formatCard(digits) {
      return digits.replace(/(.{4})(?=.)/g, "$1 ");
    }

    function updateCardPreview() {
      const digits = V.cardDigits(cardInput.value).slice(0, 16);
      // Առաջին 12 թվանշանը քարտի նկարում փակ է, որ կողքից նայողը չտեսնի
      const masked = digits.replace(/\d/g, function (d, i) { return i < 12 ? "•" : d; }).padEnd(16, "•");
      document.getElementById("bc-number").textContent = formatCard(masked);
      const brand = digits.length >= 1 ? V.cardBrand(digits) : "Tablebook";
      document.getElementById("bc-brand").textContent = brand === "Քարտ" ? "Tablebook" : brand;
      document.getElementById("bank-card").dataset.brand = brand.toLowerCase();
    }

    function updatePayButton() {
      const method = currentMethod();
      const total = Cart.total();
      for (const option of payForm.querySelectorAll(".pay-method")) {
        option.classList.toggle("selected", option.querySelector("input").checked);
      }
      document.getElementById("card-panel").hidden = method !== "card";
      document.getElementById("cash-panel").hidden = method !== "cash";
      payBtn.disabled = !method || paying;
      if (!method) payBtn.textContent = "Ընտրեք վճարման եղանակը";
      else if (method === "card") payBtn.textContent = "🔒 Վճարել " + Cart.money(total);
      else payBtn.textContent = "✓ Հաստատել պատվերը";
    }

    function openPayment(input) {
      orderInput = input;
      const total = Cart.total();
      const cashback = V.cashbackFor(total);
      document.getElementById("pay-total").textContent = Cart.money(total);
      document.getElementById("pay-details").textContent =
        Cart.load().restaurant_name + " · " + formatDate(input.date) + ", " + input.time + " · " + input.guests + " հյուր";
      document.getElementById("pay-cashback").textContent = "+" + Cart.money(cashback);
      document.getElementById("cash-missed").textContent = Cart.money(cashback);
      document.getElementById("pay-step-form").hidden = false;
      document.getElementById("pay-step-done").hidden = true;
      showPayErrors({});
      updatePayButton();
      updateCardPreview();
      payDialog.showModal();
    }

    payForm.addEventListener("change", function (event) {
      if (event.target.name !== "method") return;
      showPayErrors({});
      updatePayButton();
      if (currentMethod() === "card") cardInput.focus();
    });

    cardInput.addEventListener("input", function () {
      const digits = V.cardDigits(cardInput.value).slice(0, 16);
      cardInput.value = formatCard(digits);
      cardInput.setAttribute("aria-invalid", "false");
      document.getElementById("card_number-error").textContent = "";
      updateCardPreview();
    });

    payDialog.querySelector("[data-close]").addEventListener("click", function () { payDialog.close(); });
    payDialog.addEventListener("click", function (event) {
      if (event.target === payDialog && !paying) payDialog.close();
    });
    // Փակելիս քարտի համարը ջնջում ենք էջից
    payDialog.addEventListener("close", function () {
      cardInput.value = "";
      updateCardPreview();
    });

    form.addEventListener("submit", function (event) {
      event.preventDefault();
      if (!loggedIn) {
        window.location.href = "/login?next=/cart";
        return;
      }
      const input = Object.fromEntries(new FormData(form));
      const check = V.validateReservation(input, new Date());
      if (Object.keys(check.errors).length > 0) return showErrors(check.errors);
      showErrors({});
      openPayment(input);
    });

    payForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      if (paying) return;
      const payment = { method: currentMethod(), card_number: cardInput.value };
      const check = V.validatePayment(payment);
      if (Object.keys(check.errors).length > 0) return showPayErrors(check.errors);
      showPayErrors({});

      const cart = Cart.load();
      const total = Cart.total(cart);
      paying = true;
      payBtn.disabled = true;
      payBtn.classList.add("loading");
      payBtn.textContent = payment.method === "card" ? "Վճարումը մշակվում է…" : "Ուղարկվում է…";
      try {
        const res = await getJSON("/api/evening-menus", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(Object.assign({}, orderInput, {
            restaurant_id: cart.restaurant_id,
            items: cart.items.map(function (i) { return { id: i.id, qty: i.qty }; }),
            payment: { method: check.data.method, card_number: check.data.card_number }
          }))
        });
        if (res.ok) {
          Cart.clear();
          cardInput.value = "";
          showSuccess(res.data.menu, total);
          return;
        }
        if (res.status === 401) {
          window.location.href = "/login?next=/cart";
          return;
        }
        const errors = res.data.errors || { form: V.MESSAGES.serverError };
        // Ամսաթվի կամ ժամի սխալը ցույց ենք տալիս հիմնական ձևում
        if (errors.date || errors.time || errors.guests || errors.note) {
          payDialog.close();
          showErrors(errors);
        } else {
          showPayErrors(errors);
        }
      } catch (e) {
        showPayErrors({ form: V.MESSAGES.serverDown });
      } finally {
        paying = false;
        payBtn.classList.remove("loading");
        updatePayButton();
      }
    });

    function showSuccess(menu, total) {
      const p = (menu && menu.payment) || {};
      const isCard = p.method === "card";
      document.getElementById("pay-step-form").hidden = true;
      document.getElementById("pay-step-done").hidden = false;
      document.getElementById("done-title").textContent = isCard ? "Վճարումը հաջողվեց" : "Պատվերը ուղարկվեց";
      document.getElementById("done-text").textContent = isCard
        ? Cart.money(total) + " վճարվեց " + (p.card_brand || "քարտով") + " •••• " + p.card_last4 + " քարտով։ Ռեստորանը շուտով կհաստատի պատվերը։"
        : "Վճարումը՝ կանխիկ, ռեստորանում։ Ռեստորանը շուտով կհաստատի պատվերը։";
      document.getElementById("done-cashback").hidden = !isCard;
      document.getElementById("done-cashback-amount").textContent = "+" + Cart.money(p.cashback || 0);
    }
  }

  // ---------- Իմ ճաշացանկերը ----------

  if (body.classList.contains("page-my-menus")) {
    const list = document.getElementById("menu-orders");
    const today = new Date();
    const todayIso = today.getFullYear() + "-" + String(today.getMonth() + 1).padStart(2, "0") + "-" + String(today.getDate()).padStart(2, "0");

    if (new URLSearchParams(window.location.search).get("created")) {
      const notice = document.getElementById("notice");
      notice.textContent = "✅ Պատվերը ուղարկվեց ռեստորանին։ Հաստատումից հետո կարգավիճակը կփոխվի։";
      notice.hidden = false;
      history.replaceState(null, "", "/my-menus");
    }

    function paymentRow(p) {
      p = p || { method: "cash", status: "unpaid", cashback: 0 };
      const row = el("div", "pay-row");
      if (p.method === "card") {
        row.append(el("span", "pay-chip card", "💳 " + (p.card_brand || "Քարտ") + " •••• " + (p.card_last4 || "")));
        if (p.status === "refunded") row.append(el("span", "pay-chip refunded", "↩ Գումարը վերադարձվել է"));
        else row.append(el("span", "pay-chip paid", "✓ Վճարված"));
        if (p.cashback > 0) row.append(el("span", "pay-chip cashback", "🎁 +" + Cart.money(p.cashback) + " հետվճար"));
      } else {
        row.append(el("span", "pay-chip cash", "💵 Կանխիկ"));
        row.append(el("span", "pay-chip " + (p.status === "paid" ? "paid" : "unpaid"),
          p.status === "paid" ? "✓ Վճարված" : "Վճարվելու է ռեստորանում"));
      }
      return row;
    }

    function render(menus, cashbackTotal) {
      const wallet = document.getElementById("cashback-wallet");
      wallet.hidden = !(cashbackTotal > 0);
      document.getElementById("wallet-amount").textContent = Cart.money(cashbackTotal || 0);
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
        li.append(head, dishes, paymentRow(m.payment));
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
        render(res.data.menus || [], res.data.cashback_total || 0);
      }).catch(function () {
        showFormError("Սերվերը հասանելի չէ։");
      });
    }
    load();
  }
});
