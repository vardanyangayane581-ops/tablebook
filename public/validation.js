// Տվյալների ստուգում՝ նույն կանոններն ու տեքստերը սերվերում և էջում
// Սերվերը այս ֆայլը կանչում է require-ով, իսկ էջը՝ <script> թեգով

(function () {
  const MESSAGES = {
    firstNameEmpty: "Գրեք ձեր անունը",
    firstNameLong: "Անունը պետք է լինի առավելագույնը 50 նիշ",
    lastNameEmpty: "Գրեք ձեր ազգանունը",
    lastNameLong: "Ազգանունը պետք է լինի առավելագույնը 50 նիշ",
    email: "Գրեք ճիշտ էլ. փոստ",
    emailTaken: "Այս էլ. փոստով հաշիվ արդեն կա",
    telephone: "Գրեք ճիշտ հեռախոսահամար",
    passwordEmpty: "Գրեք գաղտնաբառը",
    passwordShort: "Գաղտնաբառը պետք է ունենա առնվազն 8 նիշ",
    passwordLong: "Գաղտնաբառը չափազանց երկար է",
    loginFailed: "Էլ. փոստը կամ գաղտնաբառը սխալ է",
    serverError: "Սերվերի սխալ։ Փորձեք կրկին։",
    serverDown: "Սերվերը հասանելի չէ։ Գործարկեք այն «npm start» հրամանով։",
    loginNeeded: "Ամրագրելու համար նախ մուտք գործեք",
    dateEmpty: "Ընտրեք օրը",
    datePast: "Այս օրն արդեն անցել է",
    dateFar: "Կարելի է ամրագրել առավելագույնը 60 օր առաջ",
    timeEmpty: "Ընտրեք ժամը",
    timeClosed: "Սրճարանը աշխատում է 09:00–22:00, վերջին ամրագրումը՝ 21:00",
    timePast: "Ամրագրել կարելի է ներկա պահից առնվազն 30 րոպե հետո",
    guests: "Հյուրերի քանակը պետք է լինի 1-ից 12",
    noteLong: "Նշումը պետք է լինի առավելագույնը 300 նիշ",
    duplicate: "Այս օրվա և ժամի համար դուք արդեն ամրագրում ունեք",
    notFound: "Ամրագրումը չի գտնվել",
    cannotCancel: "Այս ամրագրումն այլևս չի կարելի չեղարկել",
    cannotReschedule: "Այս ամրագրման ժամն այլևս չի կարելի փոխել",
    tableEmpty: "Ընտրեք սեղանը",
    restaurantEmpty: "Ընտրեք ռեստորանը",
    tableSeats: "Այս սեղանին այդքան հյուր չի տեղավորվում",
    tableBusy: "Այս սեղանն այդ ժամին զբաղված է։ Նույն սեղանը կարելի է ամրագրել նախորդ ամրագրումից առնվազն 1 ժամ հետո։"
  };

  // Սրճարանի աշխատանքային ժամերը և ամրագրման սահմանները
  const BOOKING = {
    firstSlot: "09:00",
    lastSlot: "21:00",
    stepMinutes: 30,
    maxGuests: 12,
    maxDaysAhead: 60,
    maxNoteLength: 300,
    // Այսօրվա համար ամրագրել կարելի է ներկա պահից առնվազն այսքան րոպե հետո
    minLeadMinutes: 30,
    // Նույն սեղանի երկու ամրագրումների միջև նվազագույն ընդմիջումը
    tableGapMinutes: 60
  };

  function toMinutes(hhmm) {
    return Number(hhmm.slice(0, 2)) * 60 + Number(hhmm.slice(3, 5));
  }

  function pad(n) {
    return String(n).padStart(2, "0");
  }

  // Ժամերի ցուցակը՝ 09:00, 09:30, ... 21:00
  const TIME_SLOTS = [];
  for (let m = toMinutes(BOOKING.firstSlot); m <= toMinutes(BOOKING.lastSlot); m += BOOKING.stepMinutes) {
    TIME_SLOTS.push(pad(Math.floor(m / 60)) + ":" + pad(m % 60));
  }

  // Օրը ՏՏՏՏ-ԱԱ-ՕՕ տեսքով՝ տեղական ժամով (ոչ UTC)
  function localDate(d) {
    return d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate());
  }

  // Ժամը արդեն ուշ է ամրագրելու համար (անցել է կամ մնացել է 30 րոպեից քիչ)
  function isTooSoon(date, time, now) {
    if (date !== localDate(now)) return false;
    return toMinutes(time) < now.getHours() * 60 + now.getMinutes() + BOOKING.minLeadMinutes;
  }

  function addDays(d, days) {
    const copy = new Date(d);
    copy.setDate(copy.getDate() + days);
    return copy;
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Թույլատրվում են միայն թվանշաններ, բացատ, գծիկ և սկզբում՝ +, ընդամենը 8–15 թվանշան
  const PHONE_RE = /^\+?[0-9 -]+$/;

  function clean(value) {
    return typeof value === "string" ? value.trim() : "";
  }

  // bcrypt-ը օգտագործում է գաղտնաբառի առաջին 72 բայթը, ավելին չենք ընդունում
  function byteLength(text) {
    return new TextEncoder().encode(text).length;
  }

  function validateRegistration(input) {
    const data = {
      first_name: clean(input.first_name),
      last_name: clean(input.last_name),
      email: clean(input.email).toLowerCase(),
      telephone: clean(input.telephone),
      password: typeof input.password === "string" ? input.password : ""
    };
    const errors = {};

    if (!data.first_name) errors.first_name = MESSAGES.firstNameEmpty;
    else if (data.first_name.length > 50) errors.first_name = MESSAGES.firstNameLong;

    if (!data.last_name) errors.last_name = MESSAGES.lastNameEmpty;
    else if (data.last_name.length > 50) errors.last_name = MESSAGES.lastNameLong;

    if (!EMAIL_RE.test(data.email) || data.email.length > 254) errors.email = MESSAGES.email;

    const digits = data.telephone.replace(/[^0-9]/g, "").length;
    if (!PHONE_RE.test(data.telephone) || digits < 8 || digits > 15) errors.telephone = MESSAGES.telephone;

    if (data.password.length < 8) errors.password = MESSAGES.passwordShort;
    else if (byteLength(data.password) > 72) errors.password = MESSAGES.passwordLong;

    return { data, errors };
  }

  function validateLogin(input) {
    const data = {
      email: clean(input.email).toLowerCase(),
      password: typeof input.password === "string" ? input.password : ""
    };
    const errors = {};
    if (!EMAIL_RE.test(data.email)) errors.email = MESSAGES.email;
    if (!data.password) errors.password = MESSAGES.passwordEmpty;
    return { data, errors };
  }

  // now-ը փոխանցում ենք դրսից, որ «այսօր»-ը որոշվի նույն պահին ամբողջ ստուգման համար
  function validateReservation(input, now) {
    now = now || new Date();
    const data = {
      date: clean(input.date),
      time: clean(input.time),
      guests: Number(input.guests),
      note: clean(input.note)
    };
    const errors = {};
    const today = localDate(now);

    // Ամսաթիվը համեմատում ենք որպես տեքստ. ՏՏՏՏ-ԱԱ-ՕՕ տեսքով դա ճիշտ է աշխատում
    if (!/^\d{4}-\d{2}-\d{2}$/.test(data.date) || isNaN(new Date(data.date + "T00:00").getTime())) {
      errors.date = MESSAGES.dateEmpty;
    } else if (data.date < today) {
      errors.date = MESSAGES.datePast;
    } else if (data.date > localDate(addDays(now, BOOKING.maxDaysAhead))) {
      errors.date = MESSAGES.dateFar;
    }

    if (!data.time) {
      errors.time = MESSAGES.timeEmpty;
    } else if (!TIME_SLOTS.includes(data.time)) {
      errors.time = MESSAGES.timeClosed;
    } else if (isTooSoon(data.date, data.time, now)) {
      errors.time = MESSAGES.timePast;
    }

    if (!Number.isInteger(data.guests) || data.guests < 1 || data.guests > BOOKING.maxGuests) {
      errors.guests = MESSAGES.guests;
    }

    if (data.note.length > BOOKING.maxNoteLength) errors.note = MESSAGES.noteLong;

    return { data, errors };
  }

  // ---------- Վճարում ----------

  // Քարտով վճարելիս հաճախորդը ստանում է պատվերի գումարի 5%-ը որպես հետվճար
  const CASHBACK_PERCENT = 5;

  const PAYMENT_MESSAGES = {
    method: "Ընտրեք վճարման եղանակը",
    cardEmpty: "Գրեք քարտի 16 թվանշանը",
    cardLength: "Քարտի համարը պետք է ունենա ճիշտ 16 թվանշան",
    cardInvalid: "Քարտի համարը սխալ է։ Ստուգեք թվանշանները"
  };

  function cashbackFor(total) {
    return Math.round((Number(total) || 0) * CASHBACK_PERCENT / 100);
  }

  // Միայն թվանշանները՝ առանց բացատների և գծիկների
  function cardDigits(value) {
    return String(value || "").replace(/\D/g, "");
  }

  // Luhn ալգորիթմ՝ իրական քարտերի համարները միշտ անցնում են այս ստուգումը
  function luhnOk(digits) {
    let sum = 0;
    for (let i = 0; i < digits.length; i++) {
      let d = Number(digits[digits.length - 1 - i]);
      if (i % 2 === 1) {
        d *= 2;
        if (d > 9) d -= 9;
      }
      sum += d;
    }
    return sum % 10 === 0;
  }

  function cardBrand(digits) {
    if (/^9051/.test(digits)) return "ArCa";
    if (/^4/.test(digits)) return "Visa";
    if (/^(5[1-5]|222[1-9]|22[3-9]\d|2[3-6]\d\d|27[01]\d|2720)/.test(digits)) return "Mastercard";
    if (/^220[0-4]/.test(digits)) return "Mir";
    return "Քարտ";
  }

  function validatePayment(input) {
    const method = input && input.method;
    const errors = {};
    const data = { method: method === "card" ? "card" : method === "cash" ? "cash" : "" };
    if (!data.method) errors.payment = PAYMENT_MESSAGES.method;
    if (data.method === "card") {
      const digits = cardDigits(input.card_number);
      if (!digits) errors.card_number = PAYMENT_MESSAGES.cardEmpty;
      else if (digits.length !== 16) errors.card_number = PAYMENT_MESSAGES.cardLength;
      else if (!luhnOk(digits)) errors.card_number = PAYMENT_MESSAGES.cardInvalid;
      else data.card_number = digits;
    }
    return { data, errors };
  }

  const api = {
    MESSAGES,
    CASHBACK_PERCENT,
    PAYMENT_MESSAGES,
    cashbackFor,
    cardDigits,
    cardBrand,
    validatePayment,
    BOOKING,
    TIME_SLOTS,
    toMinutes,
    isTooSoon,
    localDate,
    addDays,
    validateRegistration,
    validateLogin,
    validateReservation
  };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    window.TablebookValidation = api;
  }
})();
