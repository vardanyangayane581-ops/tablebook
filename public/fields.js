// Թվային դաշտեր առանց վերև-ներքև սլաքների. օգտատերը քանակը գրում է ձեռքով։
// data-digits՝ միայն ամբողջ թվեր, data-decimal՝ թիվ կետով (ստորակետը դառնում է կետ)

(function () {
  function clean(input) {
    let value = input.value;
    if (input.hasAttribute("data-decimal")) {
      value = value.replace(",", ".").replace(/[^0-9.]/g, "");
      const dot = value.indexOf(".");
      if (dot !== -1) value = value.slice(0, dot + 1) + value.slice(dot + 1).replace(/\./g, "");
    } else {
      value = value.replace(/[^0-9]/g, "");
    }
    if (value !== input.value) input.value = value;
  }

  // Լսում ենք ամբողջ էջում, որ աշխատի նաև հետո ավելացված դաշտերի համար (պատուհաններ, զամբյուղ)
  document.addEventListener("input", function (event) {
    const target = event.target;
    if (target.matches && target.matches("[data-digits], [data-decimal]")) clean(target);
  }, true);
})();
