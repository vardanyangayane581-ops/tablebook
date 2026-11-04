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
    const dateInput = form.elements.date;
    const timeSelect = form.elements.time;

    const now = new Date();
    const today = V.localDate(now);
    dateInput.min = today;
    dateInput.max = V.localDate(V.addDays(now, V.BOOKING.maxDaysAhead));
    dateInput.value = today;

    for (const slot of V.TIME_SLOTS) {
      const option = document.createElement("option");
      option.value = slot;
      option.textContent = slot;
      timeSelect.append(option);
    }

    // Այսօրվա համար անցած ժամերը անջատում ենք
    function updateSlots() {
      const current = new Date();
      const isToday = dateInput.value === V.localDate(current);
      const nowMinutes = current.getHours() * 60 + current.getMinutes();
      for (const option of timeSelect.options) {
        if (!option.value) continue;
        const minutes = Number(option.value.slice(0, 2)) * 60 + Number(option.value.slice(3, 5));
        option.disabled = isToday && minutes <= nowMinutes;
      }
      if (timeSelect.selectedOptions[0] && timeSelect.selectedOptions[0].disabled) timeSelect.value = "";
    }
    updateSlots();
    dateInput.addEventListener("change", updateSlots);

    function showErrors(errors) {
      for (const box of form.querySelectorAll(".field-error")) box.textContent = "";
      for (const el of form.elements) if (el.removeAttribute) el.removeAttribute("aria-invalid");

      let firstInvalid = null;
      for (const name in errors) {
        const box = document.getElementById(name + "-error");
        if (box) box.textContent = errors[name];
        const el = form.elements[name];
        if (el) {
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
      guests.textContent = "👥 " + r.guests + " հյուր";
      const status = document.createElement("span");
      status.className = "status res-" + r.status;
      status.textContent = STATUS_TEXT[r.status] || r.status;
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
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "logout-btn res-cancel";
        btn.textContent = "Չեղարկել";
        btn.addEventListener("click", function () { cancel(r, btn); });
        li.append(btn);
      }

      list.append(li);
    }
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
