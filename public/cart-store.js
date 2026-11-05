// Զամբյուղ՝ պահվում է բրաուզերում (localStorage), որ հյուրը կարողանա ընտրել ուտեստներ
// նույնիսկ մինչև մուտք գործելը։ Զամբյուղում կարող են լինել միայն մեկ ռեստորանի ուտեստներ։
// Վերջնական գներն ու անունները սերվերը միշտ նորից վերցնում է բազայից։

(function () {
  const KEY = "tablebook-cart";

  const CATEGORY_NAMES = {
    starter: "Նախուտեստներ",
    salad: "Աղցաններ",
    main: "Հիմնական ուտեստներ",
    dessert: "Աղանդեր",
    drink: "Ըմպելիքներ"
  };
  const CATEGORY_ORDER = ["starter", "salad", "main", "dessert", "drink"];

  function empty() {
    return { restaurant_id: null, restaurant_name: "", items: [] };
  }

  function load() {
    try {
      const cart = JSON.parse(localStorage.getItem(KEY));
      if (cart && Array.isArray(cart.items)) return cart;
    } catch (e) {}
    return empty();
  }

  function save(cart) {
    try {
      localStorage.setItem(KEY, JSON.stringify(cart));
    } catch (e) {}
    updateBadges(cart);
    document.dispatchEvent(new CustomEvent("cart:change", { detail: cart }));
  }

  function count(cart) {
    return (cart || load()).items.reduce(function (n, i) { return n + i.qty; }, 0);
  }

  function total(cart) {
    return (cart || load()).items.reduce(function (sum, i) { return sum + i.price * i.qty; }, 0);
  }

  function qtyOf(itemId) {
    const found = load().items.find(function (i) { return i.id === itemId; });
    return found ? found.qty : 0;
  }

  // Ավելացնում է ուտեստը։ Եթե զամբյուղում այլ ռեստորանի ուտեստներ կան, հարցնում ենք
  function add(restaurant, item) {
    let cart = load();
    if (cart.restaurant_id && cart.restaurant_id !== restaurant.id && cart.items.length > 0) {
      const ok = window.confirm(
        "Զամբյուղում արդեն կան «" + cart.restaurant_name + "»-ի ուտեստներ։\n" +
        "Մաքրե՞լ զամբյուղը և սկսել նոր ճաշացանկ «" + restaurant.name + "»-ում։"
      );
      if (!ok) return false;
      cart = empty();
    }
    cart.restaurant_id = restaurant.id;
    cart.restaurant_name = restaurant.name;
    const found = cart.items.find(function (i) { return i.id === item.id; });
    if (found) {
      found.qty = Math.min(50, found.qty + 1);
    } else {
      cart.items.push({
        id: item.id,
        name: item.name,
        price: item.price,
        emoji: item.emoji,
        category: item.category,
        qty: 1
      });
    }
    save(cart);
    return true;
  }

  function setQty(itemId, qty) {
    const cart = load();
    const found = cart.items.find(function (i) { return i.id === itemId; });
    if (!found) return;
    if (qty <= 0) cart.items = cart.items.filter(function (i) { return i.id !== itemId; });
    else found.qty = Math.min(50, qty);
    if (cart.items.length === 0) return save(empty());
    save(cart);
  }

  function clear() {
    save(empty());
  }

  function money(n) {
    return Number(n).toLocaleString("en-US").replace(/,/g, " ") + " ֏";
  }

  function updateBadges(cart) {
    const n = count(cart);
    for (const badge of document.querySelectorAll("[data-cart-count]")) {
      badge.textContent = n;
      badge.hidden = n === 0;
    }
  }

  // Փոքր ծանուցում էկրանի ներքևում
  function toast(text) {
    let box = document.getElementById("toast");
    if (!box) {
      box = document.createElement("div");
      box.id = "toast";
      box.className = "toast";
      box.setAttribute("role", "status");
      document.body.append(box);
    }
    box.textContent = text;
    box.classList.add("show");
    clearTimeout(box._timer);
    box._timer = setTimeout(function () { box.classList.remove("show"); }, 2200);
  }

  // Այլ ներդիրում զամբյուղը փոխվելիս թարմացնում ենք նշանը
  window.addEventListener("storage", function (event) {
    if (event.key === KEY) {
      updateBadges();
      document.dispatchEvent(new CustomEvent("cart:change", { detail: load() }));
    }
  });

  document.addEventListener("DOMContentLoaded", function () { updateBadges(); });

  window.TablebookCart = {
    CATEGORY_NAMES: CATEGORY_NAMES,
    CATEGORY_ORDER: CATEGORY_ORDER,
    load: load,
    add: add,
    setQty: setQty,
    clear: clear,
    count: count,
    total: total,
    qtyOf: qtyOf,
    money: money,
    toast: toast
  };
})();
