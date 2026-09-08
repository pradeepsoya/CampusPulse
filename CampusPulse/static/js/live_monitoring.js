document.addEventListener("DOMContentLoaded", function () {

    initSyncTimer();
    initRefreshButton();
    initRoomSelector();
    initExportButton();

});


/* =========================================================
   TELEMETRY SYNC TIMER
========================================================= */

function initSyncTimer() {

    const el = document.getElementById("sync-timer");

    if (!el) {
        return;
    }

    let secondsAgo = 0;

    function tick() {
        secondsAgo += 1;
        el.textContent = `${secondsAgo}s ago`;
    }

    setInterval(tick, 1000);

    // Exposed so the refresh button can reset the counter.
    window.__lmResetSyncTimer = function () {
        secondsAgo = 0;
        el.textContent = "0s ago";
    };

}


/* =========================================================
   FORCE REFRESH BUTTON
========================================================= */

function initRefreshButton() {

    const btn = document.getElementById("refresh-btn");

    if (!btn) {
        return;
    }

    btn.addEventListener("click", function () {

        if (btn.classList.contains("is-syncing")) {
            return;
        }

        btn.classList.add("is-syncing");

        // Placeholder for a real telemetry fetch (AJAX/fetch call to your Django API).
        setTimeout(function () {
            btn.classList.remove("is-syncing");

            if (window.__lmResetSyncTimer) {
                window.__lmResetSyncTimer();
            }

        }, 700);

    });

}


/* =========================================================
   ROOM SELECTOR
========================================================= */

function initRoomSelector() {

    const select = document.getElementById("room-selector");

    if (!select) {
        return;
    }

    select.addEventListener("change", function () {

        const roomId = select.value;

        // Placeholder: wire this to your Django view/API to reload
        // telemetry for the selected room, e.g.:
        // window.location.href = `/live-monitoring/?room=${roomId}`;
        console.log(`Room switched to: ${roomId}`);

    });

}


/* =========================================================
   EXPORT LOG BUTTON
========================================================= */

function initExportButton() {

    const btn = document.getElementById("export-btn");

    if (!btn) {
        return;
    }

    btn.addEventListener("click", function () {

        // Placeholder: replace with a real endpoint that returns a CSV/JSON export.
        console.log("Export requested for current telemetry log.");

    });

}