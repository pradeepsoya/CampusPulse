/* =========================================================
   ADMIN PROFILE DROPDOWN
   ========================================================= */

document.addEventListener("DOMContentLoaded", () => {

    const profileWrapper =
        document.querySelector(".admin-profile-wrapper");

    const profileButton =
        document.getElementById("adminProfileBtn");

    if (!profileWrapper || !profileButton) {
        return;
    }


    /* Toggle dropdown */

    profileButton.addEventListener("click", (event) => {

        event.stopPropagation();

        profileWrapper.classList.toggle("open");

    });


    /* Close when clicking outside */

    document.addEventListener("click", (event) => {

        if (!profileWrapper.contains(event.target)) {

            profileWrapper.classList.remove("open");

        }

    });


    /* Close with Escape */

    document.addEventListener("keydown", (event) => {

        if (event.key === "Escape") {

            profileWrapper.classList.remove("open");

        }

    });

});