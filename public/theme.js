// Թեմայի փոխում՝ մուգի և բացի միջև (օգտագործվում է բոլոր էջերում)

// Թեման կիրառում ենք դեռ էջը նկարելուց առաջ, որ գույները չթարթեն
(function () {
  try {
    const saved = localStorage.getItem("theme");
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    if (saved === "dark" || (!saved && prefersDark)) document.documentElement.classList.add("dark");
  } catch (e) {}
})();

document.addEventListener("DOMContentLoaded", function () {
  const themeBtn = document.getElementById("theme-btn");
  const root = document.documentElement;
  if (!themeBtn) return;

  // Կիրառում ենք թեման (գույները CSS-ում են) և թարմացնում կոճակի տեքստը
  function applyTheme(name) {
    root.classList.toggle("dark", name === "dark");
    themeBtn.textContent = name === "dark" ? "☀️ Բաց թեմա" : "🌙 Մուգ թեմա";
  }

  let current = root.classList.contains("dark") ? "dark" : "light";
  applyTheme(current);

  themeBtn.addEventListener("click", function () {
    current = current === "dark" ? "light" : "dark";
    applyTheme(current);
    // Պահպանում ենք ընտրությունը
    try {
      localStorage.setItem("theme", current);
    } catch (e) {}
  });
});
