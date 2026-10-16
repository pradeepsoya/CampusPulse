(function () {
    "use strict";

    const STORAGE_KEY = "campuspulse-theme";
    const root = document.documentElement;

    function getSavedTheme() {
        try {
            return localStorage.getItem(STORAGE_KEY) || "dark";
        } catch (error) {
            return "dark";
        }
    }

    function saveTheme(theme) {
        try {
            localStorage.setItem(STORAGE_KEY, theme);
        } catch (error) {
            console.warn("Unable to save theme preference.");
        }
    }

    function applyTheme(theme) {
        theme = theme === "light" ? "light" : "dark";

        root.setAttribute("data-theme", theme);

        const button = document.getElementById("siteThemeToggle");

        if (button) {
            const sunIcon = button.querySelector(".theme-icon-sun");
            const moonIcon = button.querySelector(".theme-icon-moon");

            // Dark mode: show the sun to indicate switching to light mode.
            // Light mode: show the moon to indicate switching to dark mode.
            if (sunIcon) {
                sunIcon.style.display = theme === "dark" ? "inline-block" : "none";
            }

            if (moonIcon) {
                moonIcon.style.display = theme === "light" ? "inline-block" : "none";
            }

            const nextTheme = theme === "dark" ? "light" : "dark";

            button.setAttribute("aria-label", "Switch to " + nextTheme + " mode");
            button.setAttribute("title", "Switch to " + nextTheme + " mode");
            button.setAttribute("aria-pressed", theme === "light" ? "true" : "false");
        }

        document.dispatchEvent(
            new CustomEvent("themechange", {
                detail: { theme: theme }
            })
        );
    }

    // Apply the saved preference immediately, before the page finishes loading.
    applyTheme(getSavedTheme());

    // Set up the toggle after the shared page elements are available.
    function initializeThemeToggle() {
        const button = document.getElementById("siteThemeToggle");

        if (!button || button.dataset.themeHandlerAttached === "true") {
            return;
        }

        button.dataset.themeHandlerAttached = "true";

        button.addEventListener("click", function () {
            const currentTheme = root.getAttribute("data-theme") || "dark";
            const nextTheme = currentTheme === "dark" ? "light" : "dark";

            saveTheme(nextTheme);
            applyTheme(nextTheme);
        });
    }

    if (document.readyState === "loading") {
        document.addEventListener("DOMContentLoaded", initializeThemeToggle);
    } else {
        initializeThemeToggle();
    }

    // Keep the theme synchronized if the preference changes in another tab.
    window.addEventListener("storage", function (event) {
        if (event.key === STORAGE_KEY) {
            applyTheme(event.newValue === "light" ? "light" : "dark");
        }
    });
})();