// Միջոցառումների տեսակները։ Օգտագործվում է և՛ սերվերում (events.js), և՛ էջերում

(function () {
  const KINDS = [
    { id: "live", emoji: "🎸", name: "Կենդանի երաժշտություն" },
    { id: "jazz", emoji: "🎷", name: "Ջազային երեկո" },
    { id: "football", emoji: "⚽", name: "Ֆուտբոլի դիտում" },
    { id: "other", emoji: "🎤", name: "Այլ միջոցառում" }
  ];

  function kindById(id) {
    return KINDS.find(function (k) { return k.id === id; }) || KINDS[KINDS.length - 1];
  }

  const api = { KINDS: KINDS, kindById: kindById };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    window.TablebookEventKinds = api;
  }
})();
