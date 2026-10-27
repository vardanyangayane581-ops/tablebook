// Մուտքի և գրանցման ձևերը, ինչպես նաև վերևի «Մուտք/Գրանցվել» հղումները

document.addEventListener("DOMContentLoaded", function () {
  const V = window.TablebookValidation;
  const authGuest = document.getElementById("auth-guest");
  const authUser = document.getElementById("auth-user");
  const hello = document.getElementById("hello");
  const form = document.querySelector(".auth-form");

  // Մուտք գործած հյուրի համար «Մուտք/Գրանցվել»-ի փոխարեն ցույց ենք տալիս անունը
  fetch("/api/me")
    .then(function (res) { return res.json(); })
    .then(function (body) {
      if (body.user && form) {
        window.location.href = "/";
        return;
      }
      if (body.user) {
        authGuest.hidden = true;
        authUser.hidden = false;
        hello.textContent = "Բարև, " + body.user.first_name;
      }
    })
    .catch(function () {});

  if (!form) return;

  // Սխալը ցույց ենք տալիս համապատասխան դաշտի տակ
  function showErrors(errors) {
    for (const box of form.querySelectorAll(".field-error")) box.textContent = "";
    for (const input of form.querySelectorAll("input")) input.removeAttribute("aria-invalid");

    let firstInvalid = null;
    for (const name in errors) {
      const box = document.getElementById(name + "-error");
      if (box) box.textContent = errors[name];
      const input = form.elements[name];
      if (input) {
        input.setAttribute("aria-invalid", "true");
        if (!firstInvalid) firstInvalid = input;
      }
    }
    if (firstInvalid) firstInvalid.focus();
  }

  // Երբ հյուրը ուղղում է դաշտը, նրա սխալը թաքցնում ենք
  form.addEventListener("input", function (event) {
    const box = document.getElementById(event.target.name + "-error");
    if (box) box.textContent = "";
    event.target.removeAttribute("aria-invalid");
  });

  form.addEventListener("submit", async function (event) {
    event.preventDefault();
    const isRegister = form.dataset.mode === "register";
    const input = Object.fromEntries(new FormData(form));

    // Նախ ստուգում ենք էջում (հարմարության համար), հետո սերվերը նորից կստուգի
    const check = isRegister ? V.validateRegistration(input) : V.validateLogin(input);
    if (Object.keys(check.errors).length > 0) {
      showErrors(check.errors);
      return;
    }
    showErrors({});

    const button = form.querySelector('button[type="submit"]');
    button.disabled = true;
    try {
      const res = await fetch(isRegister ? "/api/register" : "/api/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(input)
      });
      const body = await res.json().catch(function () { return {}; });
      if (res.ok) {
        window.location.href = "/";
        return;
      }
      showErrors(body.errors || { form: V.MESSAGES.serverError });
    } catch (e) {
      showErrors({ form: V.MESSAGES.serverDown });
    }
    button.disabled = false;
  });
});
