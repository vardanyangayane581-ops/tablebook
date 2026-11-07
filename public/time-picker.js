// Օր + սեղան + ժամ ընտրություն գունավոր կոճակներով։
// Անցած ժամերը չեն ցուցադրվում, իսկ սեղանի զբաղված ժամերը (մեկ այլ ամրագրումից 1 ժամից քիչ) անջատված են։
// Օգտագործվում է ամրագրման էջում, «Իմ ամրագրումները» էջում և ադմին վահանակում

(function () {
  const V = window.TablebookValidation;

  // container-ում նկարում է ժամերի կոճակները (radio, name="time")
  function render(container, opts) {
    const now = new Date();
    const busy = opts.busy || [];
    container.replaceChildren();

    let shown = 0;
    for (const slot of V.TIME_SLOTS) {
      const minutes = V.toMinutes(slot);
      // Այսօրվա համար ցուցադրում ենք միայն ներկա պահից առնվազն 30 րոպե հետո եկող ժամերը
      if (V.isTooSoon(opts.date, slot, now)) continue;
      const blocked = busy.some(function (t) { return Math.abs(V.toMinutes(t) - minutes) < V.BOOKING.tableGapMinutes; });

      const label = document.createElement("label");
      label.className = "time-chip";
      const input = document.createElement("input");
      input.type = "radio";
      input.name = "time";
      input.value = slot;
      input.disabled = blocked;
      input.checked = !blocked && slot === opts.value;
      const text = document.createElement("span");
      text.textContent = slot;
      if (blocked) {
        // Սեղանն այս ժամին արդեն ամրագրված է (կամ մոտակա 1 ժամում ունի ամրագրում)
        label.classList.add("booked");
        const tag = document.createElement("small");
        tag.textContent = "Ամրագրված";
        text.append(tag);
        label.title = "Այս սեղանն այդ ժամին ամրագրված է";
      }
      label.append(input, text);
      container.append(label);
      shown++;
    }

    if (shown === 0) {
      const empty = document.createElement("p");
      empty.className = "time-empty";
      empty.textContent = "Այս օրվա համար ազատ ժամեր չկան։ Ընտրեք այլ օր։";
      container.append(empty);
    }
  }

  // Միացնում է օրվա, սեղանի և ժամի դաշտերը. զբաղված ժամերը բերում է սերվերից
  // opts: dateInput, grid, tableSelect (ըստ ցանկության), guests (թիվ կամ input), exclude, date, time, tableId, noTable
  // Վերադարձնում է set()՝ նույն դաշտերը նոր ամրագրման համար բացելու համար (օր.՝ պատուհանում)
  function connect(opts) {
    const dateInput = opts.dateInput;
    const tableSelect = opts.tableSelect || null;
    let wanted = "";
    let wantedTable = "";
    let state = { tables: [], busy: {} };

    function set(values) {
      Object.assign(opts, values);
      const now = new Date();
      dateInput.min = V.localDate(now);
      dateInput.max = V.localDate(V.addDays(now, V.BOOKING.maxDaysAhead));
      dateInput.value = opts.date && opts.date >= dateInput.min ? opts.date : V.localDate(now);
      wanted = opts.time || "";
      wantedTable = opts.tableId ? String(opts.tableId) : "";
      if (tableSelect) tableSelect.value = "";
      return load();
    }

    function guests() {
      const g = opts.guests;
      return Number(g && typeof g === "object" ? g.value : g) || 1;
    }

    // noTable՝ մենյուով պատվերի համար, որը սեղան չունի
    function useTable() {
      return tableSelect && !opts.noTable;
    }

    function fillTables() {
      if (!useTable()) return;
      const current = tableSelect.value || wantedTable;
      tableSelect.replaceChildren();
      let firstFree = "";
      for (const t of state.tables) {
        const option = document.createElement("option");
        option.value = String(t.id);
        option.textContent = t.name + " · " + t.seats + " տեղ";
        option.disabled = t.seats < guests();
        if (!option.disabled && !firstFree) firstFree = option.value;
        tableSelect.append(option);
      }
      const keep = state.tables.some(function (t) { return String(t.id) === current && t.seats >= guests(); });
      tableSelect.value = keep ? current : firstFree;
    }

    function draw() {
      const busy = useTable() ? state.busy[tableSelect.value] || [] : [];
      render(opts.grid, { date: dateInput.value, busy: busy, value: wanted });
    }

    async function load() {
      if (!dateInput.value) return;
      try {
        const query = "?date=" + encodeURIComponent(dateInput.value) + (opts.exclude ? "&exclude=" + opts.exclude : "");
        const res = await fetch("/api/availability" + query);
        state = res.ok ? await res.json() : { tables: [], busy: {} };
      } catch (e) {
        state = { tables: [], busy: {} };
      }
      fillTables();
      draw();
    }

    opts.grid.addEventListener("change", function (event) { wanted = event.target.value; });
    dateInput.addEventListener("change", load);
    if (tableSelect) {
      tableSelect.addEventListener("change", function () { wantedTable = tableSelect.value; draw(); });
    }
    if (opts.guests && typeof opts.guests === "object") {
      opts.guests.addEventListener("input", function () { fillTables(); draw(); });
    }
    set({});
    return { set: set };
  }

  window.TablebookTimePicker = { render: render, connect: connect };
})();
