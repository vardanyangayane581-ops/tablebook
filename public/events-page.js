// Երեկոների օրացույց (/events)՝ առաջիկա միջոցառումներ, զտիչներ և ամրագրում

document.addEventListener("DOMContentLoaded", function () {
  const V = window.TablebookValidation;
  const Kinds = window.TablebookEventKinds;
  const Cart = window.TablebookCart;

  const WEEKDAYS = ["կիրակի", "երկուշաբթի", "երեքշաբթի", "չորեքշաբթի", "հինգշաբթի", "ուրբաթ", "շաբաթ"];
  const WEEKDAYS_SHORT = ["Կիր", "Երկ", "Երք", "Չրք", "Հնգ", "Ուրբ", "Շբթ"];
  const MONTHS = ["հունվարի", "փետրվարի", "մարտի", "ապրիլի", "մայիսի", "հունիսի",
    "հուլիսի", "օգոստոսի", "սեպտեմբերի", "հոկտեմբերի", "նոյեմբերի", "դեկտեմբերի"];
  const MONTHS_SHORT = ["հուն", "փետ", "մար", "ապր", "մայ", "հուն", "հուլ", "օգս", "սեպ", "հոկ", "նոյ", "դեկ"];
  // Օրացույցի շերտում ցույց ենք տալիս այսքան օր
  const STRIP_DAYS = 14;

  let events = [];
  let kind = "";
  let day = "";
  let current = null;

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function parse(isoDate) {
    return new Date(isoDate + "T00:00");
  }

  function dayTitle(isoDate) {
    const today = V.localDate(new Date());
    const tomorrow = V.localDate(V.addDays(new Date(), 1));
    const d = parse(isoDate);
    const text = WEEKDAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()];
    if (isoDate === today) return "Այսօր · " + text;
    if (isoDate === tomorrow) return "Վաղը · " + text;
    return text;
  }

  function priceText(price) {
    return price > 0 ? Cart.money(price) + " / հյուր" : "Անվճար մուտք";
  }

  // ---------- Բեռնում ----------

  async function load() {
    try {
      const res = await fetch("/api/events");
      const body = await res.json();
      events = body.events || [];
      drawKinds();
      drawDays();
      drawList();
    } catch (e) {
      document.getElementById("ev-list").replaceChildren();
      document.getElementById("form-error").textContent = V.MESSAGES.serverDown;
    }
  }

  // ---------- Տեսակների զտիչ ----------

  function drawKinds() {
    const box = document.getElementById("kind-chips");
    box.replaceChildren();
    const options = [{ id: "", emoji: "✨", name: "Բոլորը" }].concat(Kinds.KINDS);
    for (const k of options) {
      const count = events.filter(function (e) { return !k.id || e.kind === k.id; }).length;
      if (k.id && count === 0) continue;
      const chip = el("button", "chip", k.emoji + " " + k.name);
      chip.type = "button";
      chip.setAttribute("aria-pressed", String(kind === k.id));
      chip.addEventListener("click", function () {
        kind = k.id;
        drawKinds();
        drawDays();
        drawList();
      });
      box.append(chip);
    }
  }

  // ---------- Օրացույցի շերտ՝ առաջիկա 14 օր ----------

  function drawDays() {
    const box = document.getElementById("ev-days");
    box.replaceChildren();
    const now = new Date();
    for (let i = 0; i < STRIP_DAYS; i++) {
      const iso = V.localDate(V.addDays(now, i));
      const d = parse(iso);
      const list = filtered(iso);
      const btn = el("button", "ev-day" + (list.length ? " has-events" : ""));
      btn.type = "button";
      btn.setAttribute("aria-pressed", String(day === iso));
      btn.setAttribute("aria-label", dayTitle(iso) + (list.length ? ", " + list.length + " միջոցառում" : ", միջոցառումներ չկան"));
      btn.append(
        el("span", "ev-day-week", i === 0 ? "Այսօր" : WEEKDAYS_SHORT[d.getDay()]),
        el("strong", "ev-day-num", String(d.getDate())),
        el("span", "ev-day-month", MONTHS_SHORT[d.getMonth()])
      );
      const dots = el("span", "ev-day-dots");
      for (const e of list.slice(0, 3)) dots.append(el("span", "", Kinds.kindById(e.kind).emoji));
      btn.append(dots);
      btn.addEventListener("click", function () {
        day = day === iso ? "" : iso;
        drawDays();
        drawList();
      });
      box.append(btn);
    }
  }

  // onlyDay՝ միայն այդ օրվա միջոցառումները (օրացույցի շերտի համար)
  function filtered(onlyDay) {
    return events.filter(function (e) {
      if (kind && e.kind !== kind) return false;
      const wanted = onlyDay === undefined ? day : onlyDay;
      return !wanted || e.date === wanted;
    });
  }

  // ---------- Միջոցառումների ցանկ՝ ըստ օրերի ----------

  function drawList() {
    const box = document.getElementById("ev-list");
    box.replaceChildren();
    const list = filtered();
    document.getElementById("ev-empty").hidden = list.length > 0;
    document.getElementById("ev-empty-text").textContent = events.length === 0
      ? "Առաջիկայում միջոցառումներ դեռ չկան։ Շուտով կավելանան։"
      : "Այս ընտրությամբ միջոցառումներ չկան։";
    document.getElementById("ev-reset").hidden = events.length === 0;

    let lastDate = "";
    let group = null;
    for (const e of list) {
      if (e.date !== lastDate) {
        lastDate = e.date;
        const section = el("section", "ev-group");
        section.append(el("h2", "ev-group-title", dayTitle(e.date)));
        group = el("div", "ev-cards");
        section.append(group);
        box.append(section);
      }
      group.append(card(e));
    }
  }

  function card(e) {
    const k = Kinds.kindById(e.kind);
    const d = parse(e.date);
    const article = el("article", "ev-card kind-" + e.kind);

    const badge = el("div", "ev-date");
    badge.append(
      el("strong", "", String(d.getDate())),
      el("span", "", MONTHS_SHORT[d.getMonth()]),
      el("span", "ev-time", e.time)
    );

    const body = el("div", "ev-body");
    body.append(el("span", "ev-kind", k.emoji + " " + k.name), el("h3", "", e.title));
    const place = el("a", "ev-place", "🍽️ " + e.restaurant_name + " · 📍 " + e.restaurant_city);
    place.href = "/restaurant?id=" + e.restaurant_id;
    body.append(place);
    if (e.description) body.append(el("p", "ev-desc", e.description));

    // Քանի տեղ է մնացել՝ գծիկով
    const taken = e.capacity - e.seats_left;
    const meter = el("div", "ev-seats");
    const bar = el("span", "ev-bar");
    const fill = el("span", "");
    fill.style.width = Math.round((taken / e.capacity) * 100) + "%";
    bar.append(fill);
    const few = e.seats_left > 0 && e.seats_left <= Math.max(5, Math.round(e.capacity * 0.2));
    meter.append(bar, el("span", few ? "ev-few" : "", e.seats_left > 0
      ? (few ? "🔥 Մնացել է " + e.seats_left + " տեղ" : e.seats_left + " ազատ տեղ")
      : "Տեղեր չկան"));
    body.append(meter);

    const side = el("div", "ev-side");
    side.append(el("span", "ev-price" + (e.price > 0 ? "" : " free"), priceText(e.price)));
    const btn = el("button", "btn-pill " + (e.is_open ? "primary" : "ghost") + " small", e.is_open ? "Ամրագրել" : (e.seats_left > 0 ? "Փակ է" : "Տեղեր չկան"));
    btn.type = "button";
    btn.disabled = !e.is_open;
    btn.addEventListener("click", function () { open(e); });
    side.append(btn);

    article.append(badge, body, side);
    return article;
  }

  // ---------- Ամրագրման պատուհան ----------

  const dialog = document.getElementById("ev-dialog");
  const form = document.getElementById("ev-form");

  function errors(list) {
    for (const box of form.querySelectorAll(".field-error")) box.textContent = "";
    for (const key in list) {
      const box = document.getElementById("ev-" + key + "-error");
      if (box) box.textContent = list[key];
    }
  }

  function total() {
    const guests = Number(form.elements.guests.value) || 0;
    document.getElementById("ev-total").textContent = current.price > 0
      ? Cart.money(current.price * guests)
      : "Անվճար";
  }

  async function open(e) {
    // Ամրագրելու համար պետք է մուտք գործել
    const me = await fetch("/api/me").then(function (r) { return r.json(); }).catch(function () { return {}; });
    if (!me.user) {
      window.location.href = "/login?next=" + encodeURIComponent("/events");
      return;
    }
    current = e;
    form.reset();
    errors({});
    const k = Kinds.kindById(e.kind);
    document.getElementById("ev-d-kind").textContent = k.emoji + " " + k.name;
    document.getElementById("ev-d-title").textContent = e.title;
    document.getElementById("ev-d-place").textContent =
      dayTitle(e.date) + ", " + e.time + " · " + e.restaurant_name + " · " + e.restaurant_city +
      " · մնացել է " + e.seats_left + " տեղ";
    form.elements.guests.value = String(Math.min(2, e.seats_left));
    total();
    dialog.showModal();
  }

  form.elements.guests.addEventListener("input", function () {
    errors({});
    total();
  });

  for (const btn of form.querySelectorAll("[data-close]")) {
    btn.addEventListener("click", function () { dialog.close(); });
  }

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const guests = Number(form.elements.guests.value);
    if (!Number.isInteger(guests) || guests < 1 || guests > V.BOOKING.maxGuests) {
      return errors({ guests: V.MESSAGES.guests });
    }
    if (guests > current.seats_left) return errors({ guests: "Մնացել է միայն " + current.seats_left + " տեղ" });

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const res = await fetch("/api/events/" + current.id + "/book", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ guests: guests, note: form.elements.note.value })
      });
      if (res.status === 401) {
        window.location.href = "/login?next=" + encodeURIComponent("/events");
        return;
      }
      const body = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        errors(body.errors || { form: V.MESSAGES.serverError });
      } else {
        dialog.close();
        Cart.toast("🎉 Տեղերն ամրագրված են։ Տեսեք «Ամրագրումներ» էջում");
        load();
      }
    } catch (e) {
      errors({ form: V.MESSAGES.serverDown });
    }
    button.disabled = false;
  });

  document.getElementById("ev-reset").addEventListener("click", function () {
    kind = "";
    day = "";
    drawKinds();
    drawDays();
    drawList();
  });

  load();
});
