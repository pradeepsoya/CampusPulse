/* =========================================================
   ADMIN PROFILE DROPDOWN
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const profileWrapper = document.querySelector(".admin-profile-wrapper");
    const profileButton = document.getElementById("adminProfileBtn");

    if (profileWrapper && profileButton) {
        // Toggle dropdown
        profileButton.addEventListener("click", (event) => {
            event.stopPropagation();
            profileWrapper.classList.toggle("open");
        });

        // Close when clicking outside
        document.addEventListener("click", (event) => {
            if (!profileWrapper.contains(event.target)) {
                profileWrapper.classList.remove("open");
            }
        });

        // Close with Escape
        document.addEventListener("keydown", (event) => {
            if (event.key === "Escape") {
                profileWrapper.classList.remove("open");
            }
        });
    }
});


/* =========================================================
   THEME TOGGLE
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {
    const toggleBtn = document.getElementById("themeToggleBtn");
    const icon = document.getElementById("themeIcon");
    const root = document.documentElement;

    // Update the theme icon safely
    function updateIcon(theme) {
        if (!icon) return;

        icon.className =
            theme === "dark"
                ? "bi bi-moon-stars-fill"
                : "bi bi-sun-fill";
    }

    // Load the saved theme, if available
    const savedTheme = localStorage.getItem("theme");
    const currentTheme =
        savedTheme || root.getAttribute("data-theme") || "dark";

    root.setAttribute("data-theme", currentTheme);
    updateIcon(currentTheme);

    // Stop here if the theme toggle button doesn't exist
    if (!toggleBtn) return;

    // Toggle between dark and light themes
    toggleBtn.addEventListener("click", () => {
        const current = root.getAttribute("data-theme") || "dark";
        const next = current === "dark" ? "light" : "dark";

        root.setAttribute("data-theme", next);
        localStorage.setItem("theme", next);

        updateIcon(next);
    });
});