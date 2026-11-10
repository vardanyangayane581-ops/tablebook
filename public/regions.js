// Հայաստանի մարզերը և նրանց խոշոր քաղաքները՝ իրական անուններով։
// Երևանը մարզ չէ, բայց ունի մարզի կարգավիճակ, դրա համար ցուցադրվում է առաջինը։
// Սերվերը այս ֆայլը կանչում է require-ով, իսկ էջը՝ <script> թեգով

(function () {
  const REGIONS = [
    {
      id: "yerevan",
      name: "Երևան",
      center: "Երևան",
      cities: ["Երևան"],
      tagline: "Վարդագույն քաղաքը՝ Արարատի տեսարանով"
    },
    {
      id: "aragatsotn",
      name: "Արագածոտն",
      center: "Աշտարակ",
      cities: ["Աշտարակ", "Ապարան", "Թալին"],
      tagline: "Արագածի լանջերին՝ ձյունե գագաթների ներքո"
    },
    {
      id: "ararat",
      name: "Արարատ",
      center: "Արտաշատ",
      cities: ["Արտաշատ", "Արարատ", "Մասիս", "Վեդի"],
      tagline: "Այգիներ և խաղողի վազեր Մասիսի ստորոտին"
    },
    {
      id: "armavir",
      name: "Արմավիր",
      center: "Արմավիր",
      cities: ["Արմավիր", "Վաղարշապատ", "Մեծամոր"],
      tagline: "Ծիրանի այգիներ և հնագույն տաճարներ"
    },
    {
      id: "gegharkunik",
      name: "Գեղարքունիք",
      center: "Գավառ",
      cities: ["Գավառ", "Սևան", "Մարտունի", "Վարդենիս"],
      tagline: "Սևանա լճի կապույտ ափերին"
    },
    {
      id: "lori",
      name: "Լոռի",
      center: "Վանաձոր",
      cities: ["Վանաձոր", "Ալավերդի", "Ստեփանավան", "Սպիտակ"],
      tagline: "Կանաչ կիրճեր և անտառապատ լեռներ"
    },
    {
      id: "kotayk",
      name: "Կոտայք",
      center: "Հրազդան",
      cities: ["Հրազդան", "Աբովյան", "Չարենցավան", "Ծաղկաձոր"],
      tagline: "Լեռնադահուկային լանջեր և սոճու անտառներ"
    },
    {
      id: "shirak",
      name: "Շիրակ",
      center: "Գյումրի",
      cities: ["Գյումրի", "Արթիկ", "Մարալիկ"],
      tagline: "Արհեստների, հումորի և սև տուֆի քաղաք"
    },
    {
      id: "syunik",
      name: "Սյունիք",
      center: "Կապան",
      cities: ["Կապան", "Գորիս", "Սիսիան", "Մեղրի"],
      tagline: "Վեհ լեռներ, խորը ձորեր և քարե անտառներ"
    },
    {
      id: "vayots-dzor",
      name: "Վայոց ձոր",
      center: "Եղեգնաձոր",
      cities: ["Եղեգնաձոր", "Ջերմուկ", "Վայք"],
      tagline: "Ջրվեժներ, հանքային աղբյուրներ և գինի"
    },
    {
      id: "tavush",
      name: "Տավուշ",
      center: "Իջևան",
      cities: ["Իջևան", "Դիլիջան", "Բերդ", "Նոյեմբերյան"],
      tagline: "Հայաստանի Շվեյցարիան՝ խիտ անտառներով"
    }
  ];

  function regionById(id) {
    return REGIONS.find(function (r) { return r.id === id; }) || null;
  }

  // Գտնում է մարզը քաղաքի անունով (օր.՝ «Դիլիջան» → Տավուշ)
  function regionOfCity(city) {
    return REGIONS.find(function (r) { return r.cities.indexOf(city) !== -1; }) || null;
  }

  // Սեռական հոլով. «Լոռի» → «Լոռու», «Գյումրի» → «Գյումրու», «Տավուշ» → «Տավուշի»
  function genitive(name) {
    const text = String(name || "");
    return /ի$/.test(text) ? text.slice(0, -1) + "ու" : text + "ի";
  }

  // «Լոռու մարզ», իսկ Երևանի համար՝ «Երևան»
  function regionTitle(region) {
    return region.id === "yerevan" ? region.name : genitive(region.name) + " մարզ";
  }

  // Մարզի նկարազարդումը
  function regionImage(id) {
    return "regions/" + id + ".svg";
  }

  const api = { REGIONS, regionById, regionOfCity, regionImage, genitive, regionTitle };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    window.TablebookRegions = api;
  }
})();
