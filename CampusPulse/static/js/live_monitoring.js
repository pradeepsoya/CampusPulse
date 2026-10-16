/* =========================================================
   CampusPulse — Live Monitoring
   Room-switcher pills drive a focus view (gauge + stats +
   device pills), matching the dashboard's language. A
   client-side timeline builds itself by diffing each poll
   against the last one — there's no backend event log yet,
   so this resets on reload. Revisit with a real log later.
   ========================================================= */

const POLL_INTERVAL_MS = 5000;
const STALE_AFTER_MS = 15000;
const GAUGE_CIRC = 440;          // matches the SVG circle's circumference
const TIMELINE_MAX = 25;

const THRESHOLDS = {
    temperature: { cold: 18, warn: 30, alert: 35 },
    humidity:    { dry: 30,  warn: 70, alert: 85 },
    light:       { dark: 50 }
};

let activeClassroomId = null;
let lastUpdatedAt = null;
let previousReading = null;      // last poll's data, for diffing into the timeline
const timelineEntries = [];      // { time, text, level }


document.addEventListener("DOMContentLoaded", function () {

    initRoomSwitcher();
    initRefreshButton();
    initExportButton();
    initSyncTimer();

    if (activeClassroomId) {
        loadLiveTelemetry();
    }

    setInterval(function () {
        if (activeClassroomId) {
            loadLiveTelemetry();
        }
    }, POLL_INTERVAL_MS);

});


/* =========================================================
   SMALL HELPERS
========================================================= */

function isNum(v) {
    return v !== null && v !== undefined && v !== "" && !isNaN(Number(v));
}

function formatTime(date) {
    return date.toLocaleTimeString(undefined, { hour: "2-digit", minute: "2-digit" });
}

function readDeviceState(data, keys) {

    for (const key of keys) {

        if (!(key in data) || data[key] === null || data[key] === undefined) {
            continue;
        }

        const v = String(data[key]).toLowerCase();

        if (["on", "true", "1", "active", "running"].includes(v)) {
            return true;
        }

        if (["off", "false", "0", "inactive", "stopped"].includes(v)) {
            return false;
        }
    }

    return null;
}


/* =========================================================
   ROOM SWITCHER
========================================================= */

function initRoomSwitcher() {

    const buttons = document.querySelectorAll("#roomSwitcher button[data-classroom-id]");

    if (!buttons.length) {
        return;
    }

    activeClassroomId = buttons[0].dataset.classroomId;
    setFocusHeader(buttons[0]);

    buttons.forEach(function (btn) {

        btn.addEventListener("click", function () {

            if (btn.classList.contains("is-active")) {
                return;
            }

            buttons.forEach(function (b) {
                b.classList.remove("is-active");
                b.setAttribute("aria-selected", "false");
            });

            btn.classList.add("is-active");
            btn.setAttribute("aria-selected", "true");

            activeClassroomId = btn.dataset.classroomId;
            setFocusHeader(btn);

            // Switching rooms starts a fresh picture — old diffs don't apply.
            previousReading = null;
            clearTimeline();

            loadLiveTelemetry();
        });
    });
}

function setFocusHeader(btn) {

    const loc = document.getElementById("focusLocation");
    const num = document.getElementById("focusRoomNumber");

    if (loc) loc.textContent = btn.dataset.roomLocation || "";
    if (num) num.textContent = btn.dataset.roomNumber || "--";
}


/* =========================================================
   STATUS RULES (same thresholds as the dashboard)
========================================================= */

function judgeTemperature(v) {
    const t = THRESHOLDS.temperature;
    if (v >= t.alert) return ["bad", "Too hot"];
    if (v >= t.warn)  return ["warn", "Warm"];
    if (v < t.cold)   return ["warn", "Cool"];
    return ["ok", "Normal"];
}

function judgeHumidity(v) {
    const h = THRESHOLDS.humidity;
    if (v >= h.alert) return ["bad", "Very humid"];
    if (v >= h.warn)  return ["warn", "High"];
    if (v < h.dry)    return ["warn", "Dry"];
    return ["ok", "Normal"];
}

function judgeComfort(temp, hum) {

    if (!isNum(temp) || !isNum(hum)) {
        return { word: "--", sub: "Waiting for data", level: "off", gauge: 0.12, note: "Waiting for the first reading…" };
    }

    const t = THRESHOLDS.temperature;
    const h = THRESHOLDS.humidity;

    if (temp >= t.alert || hum >= h.alert) {
        return { word: "Needs attention", sub: "Uncomfortable", level: "bad", gauge: 0.3,
            note: `${temp.toFixed(1)}°C and ${hum.toFixed(1)}% humidity — well outside the comfortable range.` };
    }
    if (temp >= t.warn && hum >= h.warn) {
        return { word: "Hot & humid", sub: "Occupied", level: "warn", gauge: 0.45,
            note: "Both temperature and humidity are running high — worth a look." };
    }
    if (temp >= t.warn) {
        return { word: "Running warm", sub: "Above comfort range", level: "warn", gauge: 0.55,
            note: `${temp.toFixed(1)}°C is above the comfortable range.` };
    }
    if (temp < t.cold) {
        return { word: "Running cool", sub: "Below comfort range", level: "warn", gauge: 0.55,
            note: `${temp.toFixed(1)}°C is below the comfortable range.` };
    }
    if (hum >= h.warn) {
        return { word: "Humid", sub: "Air feels heavy", level: "warn", gauge: 0.6,
            note: `Humidity is at ${hum.toFixed(1)}%, above the comfortable range.` };
    }
    if (hum < h.dry) {
        return { word: "Dry", sub: "Air is very dry", level: "warn", gauge: 0.6,
            note: `Humidity is at ${hum.toFixed(1)}%, below the comfortable range.` };
    }

    return { word: "Comfortable", sub: "Steady", level: "ok", gauge: 0.85,
        note: "Temperature and humidity are both within range." };
}


/* =========================================================
   GAUGE + FOCUS RENDER
========================================================= */

function renderGauge(comfort) {

    const fill = document.getElementById("gaugeFill");
    const word = document.getElementById("focusState");
    const sub = document.getElementById("focusSub");

    if (!fill) {
        return;
    }

    fill.classList.remove("is-ok", "is-warn", "is-bad", "is-off");

    if (comfort.level === "ok") fill.classList.add("is-ok");
    else if (comfort.level === "warn") fill.classList.add("is-warn");
    else if (comfort.level === "bad") fill.classList.add("is-bad");
    else if (comfort.level === "off") fill.classList.add("is-off");

    fill.style.strokeDashoffset = GAUGE_CIRC - (comfort.gauge * GAUGE_CIRC * 0.75);

    if (word) word.textContent = comfort.word;
    if (sub) sub.textContent = comfort.sub;
}


/* =========================================================
   DEVICE PILLS
========================================================= */

function renderDevicePill(id, label, on) {

    const el = document.getElementById(id);

    if (!el) {
        return;
    }

    el.classList.toggle("is-on", on === true);

    const text = on === null ? "--" : (on ? "On" : "Off");
    el.innerHTML = `<span class="d-dot"></span>${label} · ${text}`;
}


/* =========================================================
   TIMELINE (built client-side by diffing polls)
========================================================= */

function clearTimeline() {

    timelineEntries.length = 0;

    const el = document.getElementById("timeline");
    const empty = document.getElementById("timelineEmpty");

    if (el && empty) {
        el.innerHTML = "";
        el.appendChild(empty);
    }
}

function pushTimelineEntry(text, level) {

    timelineEntries.unshift({ time: formatTime(new Date()), text: text, level: level || "" });

    if (timelineEntries.length > TIMELINE_MAX) {
        timelineEntries.pop();
    }

    renderTimeline();
}

function renderTimeline() {

    const el = document.getElementById("timeline");

    if (!el) {
        return;
    }

    if (timelineEntries.length === 0) {
        el.innerHTML = '<p class="timeline-empty">Nothing to report yet — this fills in as readings come in.</p>';
        return;
    }

    el.innerHTML = "";

    timelineEntries.forEach(function (entry) {

        const row = document.createElement("div");
        row.className = "t-row";

        row.innerHTML =
            `<span class="t-time">${entry.time}</span>` +
            `<span class="t-rail"><span class="t-dot ${entry.level}"></span><span class="t-line"></span></span>` +
            `<span class="t-body">${entry.text}</span>`;

        el.appendChild(row);
    });
}

function diffAndLog(current) {

    if (!previousReading) {
        previousReading = current;
        return;
    }

    const prev = previousReading;

    if (current.occupied !== prev.occupied) {
        if (current.occupied) {
            pushTimelineEntry("Motion detected — the room became occupied.", "good");
        } else if (current.vacant) {
            pushTimelineEntry("No motion detected — the room is now empty.", "");
        }
    }

    if (current.lights !== null && current.lights !== prev.lights) {
        pushTimelineEntry(`Lights turned ${current.lights ? "on" : "off"}.`, current.lights ? "good" : "");
    }

    if (current.fan !== null && current.fan !== prev.fan) {
        pushTimelineEntry(`Fan turned ${current.fan ? "on" : "off"}.`, current.fan ? "good" : "");
    }

    if (isNum(current.temp) && isNum(prev.temp)) {

        const prevLevel = judgeTemperature(prev.temp)[0];
        const curLevel = judgeTemperature(current.temp)[0];

        if (curLevel !== prevLevel && (curLevel === "warn" || curLevel === "bad")) {
            pushTimelineEntry(`Temperature crossed into "${judgeTemperature(current.temp)[1]}" at ${current.temp.toFixed(1)}°C.`, curLevel === "bad" ? "bad" : "warn");
        } else if (curLevel !== prevLevel && prevLevel !== "ok") {
            pushTimelineEntry(`Temperature is back to normal at ${current.temp.toFixed(1)}°C.`, "good");
        }
    }

    previousReading = current;
}


/* =========================================================
   SYNC TIMER
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

        const status = el.closest(".lm-sync-status");

        if (status) {
            status.classList.toggle("stale", secondsAgo * 1000 > STALE_AFTER_MS);
        }
    }

    setInterval(tick, 1000);

    window.__lmResetSyncTimer = function () {
        secondsAgo = 0;
        el.textContent = "0s ago";

        const status = el.closest(".lm-sync-status");
        if (status) status.classList.remove("stale");
    };
}


/* =========================================================
   LOAD LIVE TELEMETRY
========================================================= */

async function loadLiveTelemetry() {

    if (!activeClassroomId) {
        return;
    }

    try {

        const response = await fetch(`/api/live-monitoring/?classroom_id=${activeClassroomId}`);

        if (!response.ok) {
            throw new Error("Failed to fetch telemetry data");
        }

        const data = await response.json();

        lastUpdatedAt = Date.now();

        if (window.__lmResetSyncTimer) {
            window.__lmResetSyncTimer();
        }

        const occupancyStatus = data.occupancy_status;
        const occupied = occupancyStatus === "occupied";
        const vacant = occupancyStatus === "vacant";

        const temp = isNum(data.temperature) ? Number(data.temperature) : null;
        const hum = isNum(data.humidity) ? Number(data.humidity) : null;
        const lux = isNum(data.light_intensity) ? Number(data.light_intensity) : null;

        const lights = readDeviceState(data, ["light_status", "lights_status", "light_state", "lights"]);
        const fan = readDeviceState(data, ["fan_status", "fan_state", "fan"]);


        /* Gauge + comfort note */

        const comfort = judgeComfort(temp, hum);
        renderGauge(comfort);

        const note = document.getElementById("focusNote");
        if (note) note.textContent = comfort.note;


        /* Stat values */

        const tEl = document.getElementById("focusTemp");
        const hEl = document.getElementById("focusHum");
        const lEl = document.getElementById("focusLight");

        if (tEl) tEl.textContent = temp !== null ? `${temp.toFixed(1)}°` : "--";
        if (hEl) hEl.textContent = hum !== null ? `${hum.toFixed(1)}%` : "--";
        if (lEl) lEl.textContent = lux !== null ? `${lux.toFixed(0)}lx` : "--";


        /* Device pills */

        renderDevicePill("pillLights", "Lights", lights);
        renderDevicePill("pillFan", "Fan", fan);
        renderDevicePill("pillSensor", "Node", true); // we got a response, so the node answered

        /* Diff against the previous poll and log anything that changed */

        diffAndLog({ occupied: occupied, vacant: vacant, lights: lights, fan: fan, temp: temp, hum: hum, lux: lux });

    }
    catch (error) {

        renderDevicePill("pillSensor", "Node", false);
        console.error("Live telemetry error:", error);
    }

}


/* =========================================================
   REFRESH BUTTON
========================================================= */

function initRefreshButton() {

    const btn = document.getElementById("refresh-btn");

    if (!btn) {
        return;
    }

    btn.addEventListener("click", async function () {

        if (btn.classList.contains("is-syncing")) {
            return;
        }

        btn.classList.add("is-syncing");
        await loadLiveTelemetry();

        setTimeout(function () {
            btn.classList.remove("is-syncing");
        }, 300);
    });
}


/* =========================================================
   EXPORT BUTTON
========================================================= */

function initExportButton() {

    const btn = document.getElementById("export-btn");

    if (!btn) {
        return;
    }

    btn.addEventListener("click", function () {
        // Export functionality will be implemented later.
        console.log("Export requested for current telemetry log.");
    });
}