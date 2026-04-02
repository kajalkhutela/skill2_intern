document.addEventListener("DOMContentLoaded", () => {
  const btn = document.getElementById("themeToggle");

  // load saved theme
  if (localStorage.getItem("theme") === "dark") {
    document.body.classList.add("dark");
    if (btn) btn.textContent = "☀️";
  }

  // toggle theme
  if (btn) {
    btn.addEventListener("click", () => {
      document.body.classList.toggle("dark");

      const isDark = document.body.classList.contains("dark");
      localStorage.setItem("theme", isDark ? "dark" : "light");

      btn.textContent = isDark ? "☀️" : "🌙";
    });
  }
});
