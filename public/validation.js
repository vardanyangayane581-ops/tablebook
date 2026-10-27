// Տվյալների ստուգում՝ նույն կանոններն ու տեքստերը սերվերում և էջում
// Սերվերը այս ֆայլը կանչում է require-ով, իսկ էջը՝ <script> թեգով

(function () {
  const MESSAGES = {
    firstNameEmpty: "Գրեք ձեր անունը",
    firstNameLong: "Անունը պետք է լինի առավելագույնը 50 նիշ",
    lastNameEmpty: "Գրեք ձեր ազգանունը",
    lastNameLong: "Ազգանունը պետք է լինի առավելագույնը 50 նիշ",
    email: "Գրեք ճիշտ էլ-փոստ",
    emailTaken: "Արդեն գրանցված էլ-փոստ",
    telephone: "Գրեք ճիշտ հեռախոսահամար",
    passwordEmpty: "Գրեք գաղտնաբառը",
    passwordShort: "Գաղտնաբառը պետք է լինի առնվազն 8 նիշ",
    passwordLong: "Գաղտնաբառը չափազանց երկար է",
    loginFailed: "Սխալ մուտք",
    serverError: "Սերվերի սխալ։ Փորձեք կրկին։",
    serverDown: "Սերվերը հասանելի չէ։ Գործարկեք այն «npm start» հրամանով։"
  };

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  // Թույլատրվում են միայն թվանշաններ, բացատ, գծիկ և սկզբում՝ +
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
    if (!PHONE_RE.test(data.telephone) || digits < 6 || digits > 15) errors.telephone = MESSAGES.telephone;

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

  const api = { MESSAGES, validateRegistration, validateLogin };

  if (typeof module === "object" && module.exports) {
    module.exports = api;
  } else {
    window.TablebookValidation = api;
  }
})();
