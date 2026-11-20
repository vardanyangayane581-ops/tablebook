// Սրահի քարտեզ՝ սեղանները իրենց տեղերում, աթոռներով։
// Ամրագրման էջում հյուրը սեղմում է սեղանի վրա, իսկ ադմին վահանակում սեղանները քաշում և դասավորում են։
// Դիրքերը (x, y) սեղանի կենտրոնն են՝ սրահի լայնության և բարձրության տոկոսներով (0–100)

(function () {
  // Սեղանը չի կարող դուրս գալ պատերից, պատուհանից և մուտքից
  const LIMITS = { minX: 8, maxX: 92, minY: 17, maxY: 82 };

  function clamp(value, min, max) {
    return Math.min(max, Math.max(min, value));
  }

  // Սեղանի զբաղեցրած լայնությունը աթոռներով՝ սրահի լայնության տոկոսներով
  const FOOTPRINT = { round: 17, square: 20, long: 23, longer: 28, banquet: 33 };
  const GAP = 5;

  // Դեռ չդասավորված սեղանները շարում ենք տողերով՝ ըստ իրենց լայնության, որ իրար վրա չընկնեն
  function autoLayout(tables) {
    const width = LIMITS.maxX - LIMITS.minX;
    const rows = [[]];
    let used = 0;
    for (const t of tables) {
      const w = FOOTPRINT[shapeOf(t.seats)];
      if (rows[rows.length - 1].length > 0 && used + GAP + w > width) {
        rows.push([]);
        used = 0;
      }
      used += (rows[rows.length - 1].length > 0 ? GAP : 0) + w;
      rows[rows.length - 1].push({ id: t.id, w: w });
    }

    const out = [];
    rows.forEach(function (row, r) {
      const total = row.reduce(function (sum, item) { return sum + item.w; }, 0) + GAP * (row.length - 1);
      let x = 50 - total / 2;
      const y = LIMITS.minY + 6 + ((r + 0.5) / rows.length) * (LIMITS.maxY - LIMITS.minY - 6);
      for (const item of row) {
        out.push({ id: item.id, x: Math.round(x + item.w / 2), y: Math.round(y) });
        x += item.w + GAP;
      }
    });
    return out;
  }

  // Սեղանի ձևը՝ ըստ տեղերի քանակի
  function shapeOf(seats) {
    if (seats <= 2) return "round";
    if (seats <= 4) return "square";
    if (seats <= 6) return "long";
    if (seats <= 8) return "longer";
    return "banquet";
  }

  // Աթոռների դիրքերը սեղանի շուրջ՝ սեղանի չափի տոկոսներով
  function chairSpots(shape, seats) {
    const spots = [];
    if (shape === "round") {
      for (let i = 0; i < seats; i++) {
        const a = Math.PI + (i * 2 * Math.PI) / seats;
        spots.push([50 + 72 * Math.cos(a), 50 + 72 * Math.sin(a)]);
      }
    } else if (shape === "square") {
      const sides = [[50, -24], [124, 50], [50, 124], [-24, 50]];
      for (let i = 0; i < seats; i++) spots.push(sides[i]);
    } else {
      const top = Math.ceil(seats / 2);
      const bottom = seats - top;
      for (let i = 0; i < top; i++) spots.push([((i + 0.5) / top) * 100, -26]);
      for (let i = 0; i < bottom; i++) spots.push([((i + 0.5) / bottom) * 100, 126]);
    }
    return spots;
  }

  // «Սեղան 3 · բազմոց» → «3»
  function shortName(name) {
    const first = String(name).split("·")[0].trim().replace(/^Սեղան\s*/i, "");
    return first.length > 0 && first.length <= 4 ? first : "🪑";
  }

  // opts.editable՝ ադմինի համար (քաշել), opts.onSelect(id)՝ ամրագրման էջի համար,
  // opts.onMove()՝ երբ ադմինը տեղաշարժել է սեղանը
  function create(container, opts) {
    opts = opts || {};
    container.classList.add("floor-plan");
    container.replaceChildren();

    const hall = document.createElement("div");
    hall.className = "fp-hall" + (opts.editable ? " editable" : "");
    const windows = document.createElement("div");
    windows.className = "fp-windows";
    windows.textContent = "Պատուհաններ";
    const door = document.createElement("div");
    door.className = "fp-door";
    door.textContent = "Մուտք";
    const empty = document.createElement("p");
    empty.className = "fp-empty";
    hall.append(windows, door, empty);
    container.append(hall);

    let positions = {};
    let nodes = {};

    function place(node, pos) {
      node.style.left = pos.x + "%";
      node.style.top = pos.y + "%";
    }

    // tables՝ սերվերից, stateOf(table)՝ "free" | "selected" | "busy" | "small" | "hidden"
    function update(tables, stateOf, emptyText) {
      const auto = autoLayout(tables);
      const fresh = {};
      tables.forEach(function (t, i) {
        const keep = positions[t.id];
        fresh[t.id] = keep || (t.x !== null && t.x !== undefined && t.y !== null && t.y !== undefined
          ? { x: t.x, y: t.y }
          : { x: auto[i].x, y: auto[i].y });
      });
      positions = fresh;

      for (const id in nodes) nodes[id].remove();
      nodes = {};
      empty.textContent = emptyText || "";
      empty.hidden = tables.length > 0;

      for (const t of tables) {
        const state = stateOf ? stateOf(t) : "free";
        const shape = shapeOf(t.seats);
        const node = document.createElement(opts.editable ? "div" : "button");
        node.className = "fp-table " + shape + " is-" + state;
        node.dataset.id = String(t.id);

        const label = document.createElement("span");
        label.className = "fp-label";
        label.textContent = shortName(t.name);
        const seats = document.createElement("small");
        seats.textContent = t.seats + " տեղ";
        label.append(seats);
        node.append(label);

        for (const spot of chairSpots(shape, Math.min(t.seats, 12))) {
          const chair = document.createElement("span");
          chair.className = "fp-chair";
          chair.style.left = spot[0] + "%";
          chair.style.top = spot[1] + "%";
          node.append(chair);
        }

        const hint = {
          free: "ազատ է",
          selected: "ընտրված է",
          busy: "այդ ժամին զբաղված է",
          small: "փոքր է հյուրերի համար",
          hidden: "թաքցված է"
        }[state];
        node.title = t.name + " · " + t.seats + " տեղ" + (hint ? " · " + hint : "");
        node.setAttribute("aria-label", node.title);

        if (opts.editable) {
          node.tabIndex = 0;
          node.setAttribute("role", "button");
          enableDrag(node, t.id);
        } else {
          node.type = "button";
          node.disabled = state === "busy" || state === "small";
          node.setAttribute("aria-pressed", state === "selected" ? "true" : "false");
          node.addEventListener("click", function () {
            if (opts.onSelect) opts.onSelect(t.id);
          });
        }

        place(node, positions[t.id]);
        hall.append(node);
        nodes[t.id] = node;
      }
    }

    // Քաշել մկնիկով կամ մատով, իսկ ստեղնաշարով՝ սլաքներով (Shift-ով՝ ավելի մեծ քայլ)
    function enableDrag(node, id) {
      let start = null;

      node.addEventListener("pointerdown", function (event) {
        if (event.button !== 0) return;
        event.preventDefault();
        node.setPointerCapture(event.pointerId);
        node.classList.add("dragging");
        node.focus();
        start = { px: event.clientX, py: event.clientY, x: positions[id].x, y: positions[id].y };
      });

      node.addEventListener("pointermove", function (event) {
        if (!start) return;
        const box = hall.getBoundingClientRect();
        positions[id] = {
          x: clamp(start.x + ((event.clientX - start.px) / box.width) * 100, LIMITS.minX, LIMITS.maxX),
          y: clamp(start.y + ((event.clientY - start.py) / box.height) * 100, LIMITS.minY, LIMITS.maxY)
        };
        place(node, positions[id]);
      });

      function stop() {
        if (!start) return;
        const moved = positions[id].x !== start.x || positions[id].y !== start.y;
        start = null;
        node.classList.remove("dragging");
        if (moved && opts.onMove) opts.onMove();
      }
      node.addEventListener("pointerup", stop);
      node.addEventListener("pointercancel", stop);

      node.addEventListener("keydown", function (event) {
        const step = event.shiftKey ? 5 : 1;
        const delta = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[event.key];
        if (!delta) return;
        event.preventDefault();
        positions[id] = {
          x: clamp(positions[id].x + delta[0], LIMITS.minX, LIMITS.maxX),
          y: clamp(positions[id].y + delta[1], LIMITS.minY, LIMITS.maxY)
        };
        place(node, positions[id]);
        if (opts.onMove) opts.onMove();
      });
    }

    // Բոլոր սեղանները նորից շարել ցանցով (ադմինի «Դասավորել ավտոմատ» կոճակը)
    function arrange(tables) {
      for (const p of autoLayout(tables)) {
        positions[p.id] = { x: p.x, y: p.y };
        if (nodes[p.id]) place(nodes[p.id], positions[p.id]);
      }
    }

    function getPositions() {
      return Object.keys(positions).map(function (id) {
        return { id: Number(id), x: Math.round(positions[id].x * 10) / 10, y: Math.round(positions[id].y * 10) / 10 };
      });
    }

    // Նոր ռեստորան ընտրելիս հին դիրքերը մոռանում ենք
    function reset() {
      positions = {};
    }

    return { update: update, arrange: arrange, getPositions: getPositions, reset: reset };
  }

  window.TablebookFloorPlan = { create: create };
})();
