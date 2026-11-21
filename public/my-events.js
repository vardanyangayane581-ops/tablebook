// «Ամրագրումներ» էջի «Իմ երեկոները» բաժինը՝ միջոցառումների ամրագրումներ և չեղարկում

document.addEventListener("DOMContentLoaded", function () {
  const section = document.getElementById("my-events");
  const list = document.getElementById("my-events-list");
  if (!section || !list) return;
  const V = window.TablebookValidation;
  const Kinds = window.TablebookEventKinds;
  const Cart = window.TablebookCart;

  const WEEKDAYS = ["կիրակի", "երկուշաբթի", "երեքշաբթի", "չորեքշաբթի", "հինգշաբթի", "ուրբաթ", "շաբաթ"];
  const MONTHS = ["հունվարի", "փետրվարի", "մարտի", "ապրիլի", "մայիսի", "հունիսի",
    "հուլիսի", "օգոստոսի", "սեպտեմբերի", "հոկտեմբերի", "նոյեմբերի", "դեկտեմբերի"];
  const STATUS = {
    confirmed: ["Ամրագրված է", "res-confirmed"],
    cancelled: ["Չեղարկված է", "res-cancelled"],
    event_cancelled: ["Միջոցառումը չեղարկվել է", "res-rejected"]
  };

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function formatDate(iso) {
    const d = new Date(iso + "T00:00");
    return WEEKDAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  async function load() {
    let body;
    try {
      const res = await fetch("/api/event-bookings");
      if (!res.ok) return;
      body = await res.json();
    } catch (e) {
      return;
    }
    const bookings = body.bookings || [];
    section.hidden = bookings.length === 0;
    list.replaceChildren();

    // Սկզբում՝ մոտակաները, հետո՝ անցածները
    const today = V.localDate(new Date());
    const key = function (b) { return b.date + " " + b.time; };
    const upcoming = bookings.filter(function (b) { return b.date >= today; })
      .sort(function (a, b) { return key(a) < key(b) ? -1 : 1; });
    const past = bookings.filter(function (b) { return b.date < today; });

    for (const b of upcoming.concat(past)) {
      const k = Kinds.kindById(b.kind);
      const li = el("li", "reservation" + (b.date < today ? " past" : ""));

      const when = el("div", "res-when");
      when.append(el("strong", "", b.time), el("span", "", formatDate(b.date)));

      const info = el("div", "res-info");
      info.append(
        el("strong", "res-place", k.emoji + " " + b.title),
        el("span", "", "🍽️ " + b.restaurant_name + " · 📍 " + b.restaurant_city),
        el("span", "", "👥 " + b.guests + " հյուր · " + (b.price > 0 ? Cart.money(b.price * b.guests) + " (վճարվում է տեղում)" : "Անվճար մուտք"))
      );
      const st = STATUS[b.status] || [b.status, ""];
      info.append(el("span", "status " + st[1], st[0]));
      if (b.note) info.append(el("p", "res-note", b.note));
      li.append(when, info);

      if (b.can_cancel) {
        const actions = el("div", "res-actions");
        const btn = el("button", "logout-btn res-cancel", "Չեղարկել");
        btn.type = "button";
        btn.addEventListener("click", function () { cancel(b, btn); });
        actions.append(btn);
        li.append(actions);
      }
      list.append(li);
    }
  }

  async function cancel(b, btn) {
    if (!window.confirm("Չեղարկե՞լ «" + b.title + "»-ի ամրագրումը։")) return;
    btn.disabled = true;
    try {
      const res = await fetch("/api/event-bookings/" + b.id + "/cancel", { method: "POST" });
      const body = await res.json().catch(function () { return {}; });
      Cart.toast(res.ok ? "Ամրագրումը չեղարկվեց" : ((body.errors && body.errors.form) || V.MESSAGES.serverError));
    } catch (e) {
      Cart.toast(V.MESSAGES.serverDown);
    }
    load();
  }

  load();
});
