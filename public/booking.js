// Ամրագրման ձևը (/book) և «Իմ ամրագրումները» էջը (/my-reservations)

document.addEventListener("DOMContentLoaded", function () {
  const V = window.TablebookValidation;
  const form = document.querySelector(".book-form");
  const list = document.getElementById("reservations");

  const STATUS_TEXT = {
    pending: "Սպասում է հաստատման",
    confirmed: "Հաստատված է",
    rejected: "Մերժված է",
    cancelled: "Չեղարկված է"
  };

  // Մուտք չգործած հյուրին ուղարկում ենք մուտքի էջ, իսկ հետո՝ հետ այս էջ
  function goToLogin() {
    window.location.href = "/login?next=" + encodeURIComponent(window.location.pathname);
  }

  fetch("/api/me")
    .then(function (res) { return res.json(); })
    .then(function (body) {
      if (!body.user) return goToLogin();
      if (list) loadReservations();
    })
    .catch(function () {
      showFormError(V.MESSAGES.serverDown);
    });

  function showFormError(text) {
    const box = document.getElementById("form-error");
    if (box) box.textContent = text;
  }

  // Օրը ցույց ենք տալիս հայերեն՝ «հինգշաբթի, 5 նոյեմբերի 2026»։
  // Անունները գրում ենք ձեռքով, քանի որ ոչ բոլոր բրաուզերներն ունեն հայերեն ամսաթվեր
  const WEEKDAYS = ["կիրակի", "երկուշաբթի", "երեքշաբթի", "չորեքշաբթի", "հինգշաբթի", "ուրբաթ", "շաբաթ"];
  const MONTHS = ["հունվարի", "փետրվարի", "մարտի", "ապրիլի", "մայիսի", "հունիսի",
    "հուլիսի", "օգոստոսի", "սեպտեմբերի", "հոկտեմբերի", "նոյեմբերի", "դեկտեմբերի"];

  function formatDate(isoDate) {
    const d = new Date(isoDate + "T00:00");
    return WEEKDAYS[d.getDay()] + ", " + d.getDate() + " " + MONTHS[d.getMonth()] + " " + d.getFullYear();
  }

  // ---------- Ամրագրման ձև ----------

  if (form) {
    const R = window.TablebookRegions;
    const restaurantSelect = form.elements.restaurant_id;
    let restaurants = [];

    // Ռեստորանները խմբավորված ըստ մարզի և քաղաքի
    function fillRestaurants(selectedId) {
      for (const region of R.REGIONS) {
        const list = restaurants.filter(function (r) { return r.region === region.id; });
        if (list.length === 0) continue;
        const group = document.createElement("optgroup");
        group.label = R.regionTitle(region);
        for (const r of list) {
          const option = document.createElement("option");
          option.value = String(r.id);
          option.textContent = r.name + " · " + r.city;
          group.append(option);
        }
        restaurantSelect.append(group);
      }
      if (selectedId && restaurants.some(function (r) { return String(r.id) === selectedId; })) {
        restaurantSelect.value = selectedId;
      }
      showPlace();
    }

    // Ընտրված ռեստորանի փոքր քարտը՝ նկարով
    function showPlace() {
      const r = restaurants.find(function (x) { return String(x.id) === restaurantSelect.value; });
      const box = document.getElementById("book-place");
      box.hidden = !r;
      if (!r) return;
      box.style.setProperty("--cover", "url('/img/" + r.image + "')");
      const region = R.regionById(r.region);
      document.getElementById("bp-city").textContent = "📍 " + r.city + (region && region.id !== "yerevan" ? " · " + R.regionTitle(region) : "");
      document.getElementById("bp-name").textContent = r.name;
      document.getElementById("bp-menu").href = "/restaurant?id=" + r.id;
      history.replaceState(null, "", "/book?restaurant=" + r.id);
    }

    restaurantSelect.addEventListener("change", showPlace);

    // Սրահի քարտեզ. սեղանի վրա սեղմելը նույնն է, ինչ ցանկից ընտրելը
    const tableSelect = form.elements.table_id;
    const plan = window.TablebookFloorPlan.create(document.getElementById("book-plan"), {
      onSelect: function (id) {
        tableSelect.value = String(id);
        tableSelect.dispatchEvent(new Event("change"));
        const box = document.getElementById("table_id-error");
        if (box) box.textContent = "";
      }
    });

    // Ժամն ընտրելուց հետո քարտեզը ցույց է տալիս, թե որ սեղաններն են այդ ժամին զբաղված
    function drawPlan(state, time) {
      const guests = Number(form.elements.guests.value) || 1;
      plan.update(state.tables || [], function (t) {
        if (t.seats < guests) return "small";
        const taken = (state.busy && state.busy[String(t.id)]) || [];
        const busy = time && taken.some(function (x) {
          return Math.abs(V.toMinutes(x) - V.toMinutes(time)) < V.BOOKING.tableGapMinutes;
        });
        if (busy) return "busy";
        return String(t.id) === tableSelect.value ? "selected" : "free";
      }, restaurantSelect.value ? "Այս ռեստորանը դեռ ազատ սեղաններ չունի" : "Նախ ընտրեք ռեստորանը");
    }

    // Անցած ժամերը չեն ցուցադրվում, իսկ ընտրված սեղանի զբաղված ժամերը անջատված են
    const picker = window.TablebookTimePicker.connect({
      dateInput: form.elements.date,
      tableSelect: tableSelect,
      grid: document.getElementById("book-time"),
      guests: form.elements.guests,
      restaurant: restaurantSelect,
      onUpdate: drawPlan
    });

    fetch("/api/restaurants")
      .then(function (res) { return res.json(); })
      .then(function (body) {
        restaurants = body.restaurants || [];
        fillRestaurants(new URLSearchParams(window.location.search).get("restaurant"));
        if (restaurantSelect.value) picker.set({ date: form.elements.date.value });
      })
      .catch(function () {});

    function showErrors(errors) {
      for (const box of form.querySelectorAll(".field-error")) box.textContent = "";
      for (const el of form.elements) if (el.removeAttribute) el.removeAttribute("aria-invalid");

      let firstInvalid = null;
      for (const name in errors) {
        const box = document.getElementById(name + "-error");
        if (box) box.textContent = errors[name];
        // Ժամը կոճակների խումբ է (RadioNodeList), նրան ընդգծում ենք CSS-ով՝ սխալի տեքստի կողքին
        const el = form.elements[name];
        if (el && el.setAttribute) {
          el.setAttribute("aria-invalid", "true");
          if (!firstInvalid) firstInvalid = el;
        }
      }
      if (firstInvalid) firstInvalid.focus();
    }

    form.addEventListener("input", function (event) {
      const box = document.getElementById(event.target.name + "-error");
      if (box) box.textContent = "";
      event.target.removeAttribute("aria-invalid");
    });

    form.addEventListener("submit", async function (event) {
      event.preventDefault();
      const input = Object.fromEntries(new FormData(form));

      const check = V.validateReservation(input, new Date());
      if (!input.restaurant_id) check.errors.restaurant_id = V.MESSAGES.restaurantEmpty;
      if (!input.table_id) check.errors.table_id = V.MESSAGES.tableEmpty;
      if (Object.keys(check.errors).length > 0) {
        showErrors(check.errors);
        return;
      }
      showErrors({});

      const button = form.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const res = await fetch("/api/reservations", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        if (res.status === 401) return goToLogin();
        const body = await res.json().catch(function () { return {}; });
        if (res.ok) {
          window.location.href = "/my-reservations?new=1";
          return;
        }
        showErrors(body.errors || { form: V.MESSAGES.serverError });
      } catch (e) {
        showErrors({ form: V.MESSAGES.serverDown });
      }
      button.disabled = false;
    });
  }

  // ---------- Իմ ամրագրումները ----------

  async function loadReservations() {
    if (new URLSearchParams(window.location.search).get("new")) {
      const notice = document.getElementById("notice");
      notice.textContent = "✅ Ամրագրումն ուղարկված է։ Սրճարանը շուտով կհաստատի այն։";
      notice.hidden = false;
      // Հասցեից հանում ենք ?new=1-ը, որ էջը թարմացնելիս հաղորդագրությունը չկրկնվի
      history.replaceState(null, "", window.location.pathname);
    }

    try {
      const res = await fetch("/api/reservations");
      if (res.status === 401) return goToLogin();
      const body = await res.json();
      if (!res.ok) return showFormError((body.errors && body.errors.form) || V.MESSAGES.serverError);
      render(body.reservations);
    } catch (e) {
      showFormError(V.MESSAGES.serverDown);
    }
  }

  function render(reservations) {
    list.textContent = "";
    document.getElementById("empty").hidden = reservations.length > 0;
    const today = V.localDate(new Date());

    // Սկզբում՝ մոտակա ամրագրումները (ամենամոտը վերևում), հետո՝ անցածները (ամենաթարմը վերևում)
    const key = function (r) { return r.date + " " + r.time; };
    const upcoming = reservations.filter(function (r) { return r.date >= today; })
      .sort(function (a, b) { return key(a) < key(b) ? -1 : 1; });
    const past = reservations.filter(function (r) { return r.date < today; })
      .sort(function (a, b) { return key(a) < key(b) ? 1 : -1; });

    for (const r of upcoming.concat(past)) {
      const li = document.createElement("li");
      li.className = "reservation" + (r.date < today ? " past" : "");

      const when = document.createElement("div");
      when.className = "res-when";
      const time = document.createElement("strong");
      time.textContent = r.time;
      const date = document.createElement("span");
      date.textContent = formatDate(r.date);
      when.append(time, date);

      const info = document.createElement("div");
      info.className = "res-info";
      const guests = document.createElement("span");
      guests.textContent = "👥 " + r.guests + " հյուր" + (r.table_name ? " · 🪑 " + r.table_name : "");
      const status = document.createElement("span");
      status.className = "status res-" + r.status;
      status.textContent = STATUS_TEXT[r.status] || r.status;
      if (r.restaurant_name) {
        const place = document.createElement("strong");
        place.className = "res-place";
        place.textContent = "🍽️ " + r.restaurant_name + (r.restaurant_city ? " · 📍 " + r.restaurant_city : "");
        info.append(place);
      }
      info.append(guests, status);
      if (r.note) {
        const note = document.createElement("p");
        note.className = "res-note";
        note.textContent = r.note;
        info.append(note);
      }

      li.append(when, info);

      const canCancel = (r.status === "pending" || r.status === "confirmed") && r.date >= today;
      if (canCancel) {
        const actions = document.createElement("div");
        actions.className = "res-actions";
        const move = document.createElement("button");
        move.type = "button";
        move.className = "btn-pill ghost small";
        move.textContent = "🕒 Փոխել ժամը";
        move.addEventListener("click", function () { openMove(r); });
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "logout-btn res-cancel";
        btn.textContent = "Չեղարկել";
        btn.addEventListener("click", function () { cancel(r, btn); });
        actions.append(move, btn);
        li.append(actions);
      }

      list.append(li);
    }
  }

  // ---------- Ժամի փոփոխություն ----------

  const moveDialog = document.getElementById("move-dialog");
  const moveForm = document.getElementById("move-form");
  let moving = null;
  let picker = null;

  function moveErrors(errors) {
    for (const box of moveForm.querySelectorAll(".field-error")) box.textContent = "";
    for (const name in errors) {
      const box = document.getElementById("m-" + name + "-error");
      if (box) box.textContent = errors[name];
    }
  }

  function openMove(r) {
    moving = r;
    moveErrors({});
    const values = { date: r.date, time: r.time, tableId: r.table_id, guests: r.guests, exclude: r.id };
    if (!picker) {
      picker = window.TablebookTimePicker.connect(Object.assign({
        dateInput: moveForm.elements.date,
        tableSelect: moveForm.elements.table_id,
        grid: document.getElementById("m-time")
      }, values));
    } else {
      picker.set(values);
    }
    moveDialog.showModal();
  }

  if (moveForm) {
    for (const btn of moveForm.querySelectorAll("[data-close]")) {
      btn.addEventListener("click", function () { moveDialog.close(); });
    }
    moveForm.addEventListener("submit", async function (event) {
      event.preventDefault();
      const input = Object.fromEntries(new FormData(moveForm));
      if (!input.time) return moveErrors({ time: V.MESSAGES.timeEmpty });
      const button = moveForm.querySelector('button[type="submit"]');
      button.disabled = true;
      try {
        const res = await fetch("/api/reservations/" + moving.id + "/move", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input)
        });
        if (res.status === 401) return goToLogin();
        const body = await res.json().catch(function () { return {}; });
        if (!res.ok) {
          moveErrors(body.errors || { form: V.MESSAGES.serverError });
        } else {
          moveDialog.close();
          const notice = document.getElementById("notice");
          notice.textContent = "✅ Ժամը փոխվեց։ Ամրագրումը նորից սպասում է սրճարանի հաստատմանը։";
          notice.hidden = false;
          loadReservations();
        }
      } catch (e) {
        moveErrors({ form: V.MESSAGES.serverDown });
      }
      button.disabled = false;
    });
  }

  async function cancel(reservation, btn) {
    if (!window.confirm("Չեղարկե՞լ " + reservation.time + "-ի ամրագրումը։")) return;
    btn.disabled = true;
    try {
      const res = await fetch("/api/reservations/" + reservation.id + "/cancel", { method: "POST" });
      if (res.status === 401) return goToLogin();
      const body = await res.json().catch(function () { return {}; });
      if (!res.ok) {
        showFormError((body.errors && body.errors.form) || V.MESSAGES.serverError);
        btn.disabled = false;
        return;
      }
      loadReservations();
    } catch (e) {
      showFormError(V.MESSAGES.serverDown);
      btn.disabled = false;
    }
  }
});
