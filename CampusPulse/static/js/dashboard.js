"use strict";

/* =========================================================
   CAMPUSPULSE DASHBOARD
   ========================================================= */

const POLL_INTERVAL_MS = 5000;
const STALE_AFTER_MS = 15000;
const HISTORY_LEN = 30;

// Rated power draw used for the energy estimate.
// Adjust these to match the actual fixtures in your classroom.
const LIGHT_WATTS = 40;
const FAN_WATTS = 75;

const THRESHOLDS = {
    temperature: { cold: 18, warn: 30, alert: 35 },
    humidity: { dry: 30, warn: 70, alert: 85 },
    light: { dark: 50 }
};

let lastUpdatedAt = null;
let lastSensorResponse = null;
let pollingTimer = null;
let lastRequestSucceeded = false;

const history = {
    temperature: [],
    humidity: [],
    light: []
};

const devices = {
    lights: null,
    fan: null
};


/* =========================================================
   INITIALIZATION
   ========================================================= */

document.addEventListener("DOMContentLoaded", function () {

    initGreeting();
    initLiveDateTime();
    initSensorOverviewChart();

    loadDashboardSensorData();

    pollingTimer = setInterval(
        loadDashboardSensorData,
        POLL_INTERVAL_MS
    );

    renderLastUpdated();
    setInterval(renderLastUpdated, 1000);
});


/* =========================================================
   GREETING + DATE
   ========================================================= */

function initGreeting() {

    const el = document.getElementById("greeting");

    if (!el) return;

    const hour = new Date().getHours();

    let part = "evening";

    if (hour < 12) {
        part = "morning";
    } else if (hour < 17) {
        part = "afternoon";
    }

    const match = el.textContent.match(/,\s*(.+?)\s*(?:👋)?\s*$/);
    const name = match ? match[1].trim() : "Administrator";

    el.textContent = `Good ${part}, ${name}`;
}


function initLiveDateTime() {

    const el = document.getElementById("liveDateTime");

    if (!el) return;

    function updateDateTime() {

        el.textContent = new Date().toLocaleDateString(
            undefined,
            {
                day: "2-digit",
                month: "long",
                year: "numeric"
            }
        );
    }

    updateDateTime();
    setInterval(updateDateTime, 60000);
}


/* =========================================================
   SMALL HELPERS
   ========================================================= */

function isNum(value) {

    return (
        value !== null &&
        value !== undefined &&
        value !== "" &&
        Number.isFinite(Number(value))
    );
}


function setValueWithUnit(el, value, unit) {

    if (!el) return;

    if (!isNum(value)) {
        el.textContent = "--";
        return;
    }

    el.textContent = Number(value).toFixed(1);

    const unitEl = document.createElement("span");
    unitEl.className = "unit";
    unitEl.textContent = unit;

    el.appendChild(unitEl);
}


function setPill(id, level, text) {

    const el = document.getElementById(id);

    if (!el) return;

    el.className = `pill is-${level}`;
    el.textContent = text;
}


/* =========================================================
   DEVICE STATE
   ========================================================= */

function readDeviceState(data, keys) {

    for (const key of keys) {

        if (
            !(key in data) ||
            data[key] === null ||
            data[key] === undefined
        ) {
            continue;
        }

        const value = String(data[key]).toLowerCase();

        if (
            ["on", "true", "1", "active", "running"].includes(value)
        ) {
            return true;
        }

        if (
            ["off", "false", "0", "inactive", "stopped"].includes(value)
        ) {
            return false;
        }
    }

    return null;
}


/* =========================================================
   DATA FRESHNESS
   ========================================================= */

function getReadingAgeMs() {

    if (lastUpdatedAt === null) {
        return null;
    }

    return Math.max(0, Date.now() - lastUpdatedAt);
}


function hasRecentReading() {

    const age = getReadingAgeMs();

    return age !== null && age <= STALE_AFTER_MS;
}


function renderLastUpdated() {

    const el = document.getElementById("lastUpdated");
    const hero = document.getElementById("hero");
    const feed = document.getElementById("hero-feed");
    const feedNote = document.getElementById("hero-feed-note");
    const statusText = document.getElementById("systemStatus");
    const statusDot = document.getElementById("statusDot");
    const cards = document.getElementById("dashboard-sensor-cards");

    if (!el) return;

    let label;
    let stale;
    let feedLabel;
    let note;

    const age = getReadingAgeMs();

    if (!lastRequestSucceeded) {

        label = "Unable to retrieve sensor data";
        stale = true;
        feedLabel = "Unavailable";
        note = "Check the server connection";

    } else if (lastUpdatedAt === null) {

        label = "No sensor readings available";
        stale = true;
        feedLabel = "No data";
        note = "Waiting for sensor readings";

    } else {

        const secs = Math.floor(age / 1000);

        if (secs < 2) {
            label = "just now";
        } else if (secs < 60) {
            label = `${secs} sec ago`;
        } else if (secs < 3600) {
            label = `${Math.floor(secs / 60)} min ago`;
        } else {
            label = `${Math.floor(secs / 3600)} hr ago`;
        }

        stale = age > STALE_AFTER_MS;

        if (stale) {
            label = `Last recorded reading · ${label}`;
            feedLabel = "Offline";
            note = "No recent sensor readings";
        } else {
            label = `Recent sensor reading · ${label}`;
            feedLabel = "Recent";
            note = "A recent reading is available";
        }
    }

    el.textContent = label;
    el.classList.toggle("stale", stale);

    // Header status follows the real data state
    if (statusText) {
        statusText.textContent = stale ? "SENSOR OFFLINE" : "SYSTEM ONLINE";
        statusText.classList.toggle("is-offline", stale);
    }

    if (statusDot) {
        statusDot.classList.toggle("is-offline", stale);
    }

    // Dim numbers and mark them "last known" only if a reading exists
    if (cards) {
        cards.classList.toggle("is-stale", stale && lastUpdatedAt !== null);
    }

    if (hero) {
        hero.classList.toggle("is-stale", stale);
    }

    if (feed) {
        feed.textContent = feedLabel;
        feed.className = stale ? "is-warn" : "is-ok";
    }

    if (feedNote) {
        feedNote.textContent = note;
    }
}


/* =========================================================
   ENVIRONMENT STATUS RULES
   ========================================================= */

function judgeTemperature(value) {

    const t = THRESHOLDS.temperature;

    if (value >= t.alert) return ["bad", "Too hot"];
    if (value >= t.warn) return ["warn", "Warm"];
    if (value < t.cold) return ["warn", "Cool"];

    return ["ok", "Normal"];
}


function judgeHumidity(value) {

    const h = THRESHOLDS.humidity;

    if (value >= h.alert) return ["bad", "Very humid"];
    if (value >= h.warn) return ["warn", "High"];
    if (value < h.dry) return ["warn", "Dry"];

    return ["ok", "Normal"];
}


function judgeLight(value, occupied) {

    if (value < THRESHOLDS.light.dark) {
        return occupied
            ? ["warn", "Low light"]
            : ["off", "Dim"];
    }

    return ["ok", "Normal"];
}


function judgeComfort(temp, humidity) {

    if (!isNum(temp) || !isNum(humidity)) {
        return ["--", "", "No readings available"];
    }

    const t = THRESHOLDS.temperature;
    const h = THRESHOLDS.humidity;

    if (temp >= t.warn && humidity >= h.warn) {
        return [
            "Hot & humid",
            "is-bad",
            "Uncomfortable for a class"
        ];
    }

    if (temp >= t.warn) {
        return ["Warm", "is-warn", "Above comfort range"];
    }

    if (temp < t.cold) {
        return ["Cool", "is-warn", "Below comfort range"];
    }

    if (humidity >= h.warn) {
        return ["Humid", "is-warn", "Air feels heavy"];
    }

    if (humidity < h.dry) {
        return ["Dry", "is-warn", "Air is very dry"];
    }

    return [
        "Comfortable",
        "is-ok",
        "Temperature and humidity are fine"
    ];
}


/* =========================================================
   SPARKLINES + TRENDS
   ========================================================= */

function pushHistory(key, value) {

    if (!isNum(value)) return;

    history[key].push(Number(value));

    if (history[key].length > HISTORY_LEN) {
        history[key].shift();
    }
}


function renderSpark(key) {

    const el = document.getElementById(`spark-${key}`);

    if (!el) return;

    const values = history[key];

    if (values.length < 2) {

        // No recent data: a single muted line instead of "collecting"
        if (!hasRecentReading()) {
            el.innerHTML =
                '<div class="spark-empty is-placeholder">' +
                "No recent readings</div>";
        } else {
            el.innerHTML =
                '<div class="spark-empty">Collecting data…</div>';
        }

        return;
    }

    const w = 200;
    const h = 46;
    const pad = 4;

    const min = Math.min(...values);
    const max = Math.max(...values);
    const span = max - min;

    const points = values.map(function (value, index) {

        const x = (index / (values.length - 1)) * w;

        const y = span === 0
            ? h / 2
            : h - pad - ((value - min) / span) * (h - pad * 2);

        return `${x.toFixed(1)},${y.toFixed(1)}`;
    });

    const line = points.join(" ");
    const area = `0,${h} ${line} ${w},${h}`;

    el.innerHTML =
        `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="none" aria-hidden="true">` +
        `<defs><linearGradient id="g-${key}" x1="0" y1="0" x2="0" y2="1">` +
        `<stop offset="0" stop-color="currentColor" stop-opacity=".35"/>` +
        `<stop offset="1" stop-color="currentColor" stop-opacity="0"/>` +
        `</linearGradient></defs>` +
        `<polygon points="${area}" fill="url(#g-${key})"/>` +
        `<polyline points="${line}" fill="none" stroke="currentColor" stroke-width="2" ` +
        `vector-effect="non-scaling-stroke" stroke-linejoin="round" stroke-linecap="round"/>` +
        `</svg>`;
}


function renderTrend(key, unit) {

    const values = history[key];

    const trendEl = document.getElementById(`trend-${key}`);
    const rangeEl = document.getElementById(`range-${key}`);

    if (!trendEl || !rangeEl) return;

    if (values.length === 0) {
        trendEl.textContent = hasRecentReading()
            ? "Collecting trend…"
            : "No recent trend";
        trendEl.className = "";
        rangeEl.textContent = "Min — · Max —";
        return;
    }

    const min = Math.min(...values);
    const max = Math.max(...values);

    rangeEl.textContent =
        `Min ${min.toFixed(1)} · Max ${max.toFixed(1)}`;

    if (values.length < 2) {
        trendEl.textContent = "Collecting trend…";
        return;
    }

    const delta = values[values.length - 1] - values[0];

    if (Math.abs(delta) < 0.05) {
        trendEl.textContent = "Steady";
        trendEl.className = "";
    } else if (delta > 0) {
        trendEl.textContent = `▲ ${delta.toFixed(1)}${unit} rising`;
        trendEl.className = "up";
    } else {
        trendEl.textContent =
            `▼ ${Math.abs(delta).toFixed(1)}${unit} falling`;
        trendEl.className = "down";
    }
}


/* =========================================================
   HERO + OCCUPANCY
   ========================================================= */

function updateHero(occupancyStatus, temp, humidity) {

    const hero = document.getElementById("hero");
    const state = document.getElementById("dashboard-occupancy");
    const sub = document.getElementById("dashboard-occupancy-status");

    if (hero) {
        hero.dataset.state =
            occupancyStatus === "occupied" ? "occupied" :
            occupancyStatus === "vacant" ? "vacant" : "unknown";
    }

    if (occupancyStatus === "occupied") {
        if (state) state.textContent = "Occupied";
        if (sub) sub.textContent = "Motion detected in the room";
    } else if (occupancyStatus === "vacant") {
        if (state) state.textContent = "Vacant";
        if (sub) sub.textContent = "No motion detected";
    } else {
        if (state) state.textContent = "--";
        if (sub) sub.textContent = "No occupancy data available";
    }

    const comfort = judgeComfort(temp, humidity);

    const comfortEl = document.getElementById("hero-comfort");
    const noteEl = document.getElementById("hero-comfort-note");

    if (comfortEl) {
        comfortEl.textContent = comfort[0];
        comfortEl.className = comfort[1];
    }

    if (noteEl) {
        noteEl.textContent = comfort[2];
    }
}


/* =========================================================
   DEVICE STATES
   ========================================================= */

function updateDevices(data) {

    const lights = readDeviceState(data, [
        "light_status",
        "lights_status",
        "light_state",
        "lights"
    ]);

    const fan = readDeviceState(data, [
        "fan_status",
        "fan_state",
        "fan"
    ]);

    devices.lights = lights;
    devices.fan = fan;

    applyDevice("light", lights);
    applyDevice("fan", fan);

    syncChip("chip-lights", "Lights", lights);
    syncChip("chip-fan", "Fan", fan);

    const chips = document.getElementById("hero-chips");

    if (chips) {
        chips.hidden = lights === null && fan === null;
    }
}


function applyDevice(kind, on) {

    const el = document.getElementById(`device-${kind}-state`);

    if (!el) return;

    el.classList.remove("on", "off", "unknown");

    if (on === null) {
        el.textContent = "Unknown";
        el.classList.add("unknown");
        return;
    }

    el.textContent = on ? "ON" : "OFF";
    el.classList.add(on ? "on" : "off");
}


function syncChip(id, label, on) {

    const el = document.getElementById(id);

    if (!el) return;

    const b = el.querySelector("b");

    if (b) {
        b.textContent = on === null ? "--" : (on ? "ON" : "OFF");
    }

    el.classList.toggle("is-on", on === true);
    el.classList.toggle("is-off", on === false);
}


function updateRoomRow(classroomId, occupancyStatus) {

    const row = document.querySelector(
        `.room-item[data-classroom-id="${classroomId}"]`
    );

    if (!row) return;

    let kind = "unknown";
    let text = "No Data";

    if (occupancyStatus === "occupied") {
        kind = "occupied";
        text = "Occupied";
    } else if (occupancyStatus === "vacant") {
        kind = "available";
        text = "Available";
    }

    const icon = row.querySelector(".room-icon");
    const status = row.querySelector(".room-status");
    const label = row.querySelector(".rs-text");

    if (icon) icon.className = `room-icon ${kind}`;
    if (status) status.className = `room-status ${kind}-status`;
    if (label) label.textContent = text;
}


/* =========================================================
   ENERGY STRIP
   ========================================================= */

function updateEnergy(ctx) {

    const devicesEl = document.getElementById("energy-devices");
    const devicesNote = document.getElementById("energy-devices-note");
    const loadEl = document.getElementById("energy-load");
    const tip = document.getElementById("energy-tip");
    const tipIcon = document.getElementById("energy-tip-icon");
    const tipTitle = document.getElementById("energy-tip-title");
    const tipText = document.getElementById("energy-tip-text");

    if (!devicesEl || !loadEl || !tip) return;

    const known = [devices.lights, devices.fan].filter(function (v) {
        return v !== null;
    });

    // No device data at all
    if (known.length === 0) {
        devicesEl.textContent = "--";
        loadEl.textContent = "--";
        if (devicesNote) devicesNote.textContent = "No device data";

        tip.className = "energy-tip";
        if (tipIcon) tipIcon.className = "bi bi-lightbulb";
        if (tipTitle) tipTitle.textContent = "Waiting for device data";
        if (tipText) {
            tipText.textContent =
                "Suggestions appear once device status is available.";
        }
        return;
    }

    const onCount =
        (devices.lights === true ? 1 : 0) +
        (devices.fan === true ? 1 : 0);

    const watts =
        (devices.lights === true ? LIGHT_WATTS : 0) +
        (devices.fan === true ? FAN_WATTS : 0);

    const stale = !hasRecentReading();

    devicesEl.textContent = `${onCount} of 2`;
    loadEl.textContent = `~${watts} W`;

    if (devicesNote) {
        devicesNote.textContent = stale
            ? "From the last reading"
            : "Lights and fan";
    }

    let level = "";
    let icon = "bi-lightbulb";
    let title;
    let text;

    if (ctx.vacant && onCount > 0) {

        const names = [];
        if (devices.lights === true) names.push("lights");
        if (devices.fan === true) names.push("fan");

        level = "is-warn";
        icon = "bi-lightbulb-off";
        title = "Room is empty with devices on";
        text =
            `Turning off the ${names.join(" and ")} would save ` +
            `about ${watts} W.`;

    } else if (ctx.vacant && onCount === 0) {

        level = "is-ok";
        icon = "bi-check-lg";
        title = "Room is saving energy";
        text = "Nobody is inside and all devices are off.";

    } else if (ctx.occupied) {

        level = "is-ok";
        icon = "bi-check-lg";
        title = "Devices match occupancy";
        text = "The room is in use and devices are running as expected.";

    } else {

        title = "Occupancy unknown";
        text = "Savings tips need an occupancy reading.";
    }

    if (stale && level === "is-warn") {
        text += " (Based on the last reading.)";
    }

    tip.className = `energy-tip ${level}`.trim();
    if (tipIcon) tipIcon.className = `bi ${icon}`;
    if (tipTitle) tipTitle.textContent = title;
    if (tipText) tipText.textContent = text;
}


/* =========================================================
   LIVE INSIGHTS
   ========================================================= */

function renderInsights(ctx) {

    const list = document.getElementById("live-insights");
    const ok = document.getElementById("alert-ok");
    const count = document.getElementById("hero-insights");

    const items = [];
    const t = THRESHOLDS;

    if (isNum(ctx.temp) && ctx.temp >= t.temperature.warn && ctx.occupied) {

        const fanOff = devices.fan === false;

        items.push({
            type: ctx.temp >= t.temperature.alert ? "critical" : "warning",
            icon: "bi-thermometer-high",
            title: fanOff
                ? "Room is warm and the fan is off"
                : "Room is warm",
            message:
                `${ctx.temp.toFixed(1)}°C with people inside.` +
                (fanOff ? " Check the fan automation." : "")
        });
    }

    if (isNum(ctx.hum) && ctx.hum >= t.humidity.warn) {
        items.push({
            type: ctx.hum >= t.humidity.alert ? "critical" : "warning",
            icon: "bi-droplet-half",
            title: "Humidity is high",
            message:
                `${ctx.hum.toFixed(1)}% is above the ` +
                `${t.humidity.warn}% comfort limit.`
        });
    }

    if (devices.lights === true && ctx.vacant) {
        items.push({
            type: "warning",
            icon: "bi-lightbulb-off",
            title: "Lights are on in an empty room",
            message: "Energy is being wasted while nobody is inside."
        });
    }

    if (
        devices.lights === true &&
        isNum(ctx.lux) &&
        ctx.lux < t.light.dark
    ) {
        items.push({
            type: "info",
            icon: "bi-brightness-low",
            title: "Very low light with lights ON",
            message:
                `${ctx.lux.toFixed(1)} Lux. ` +
                "Check the light sensor or the bulbs."
        });
    }

    if (list) {

        list.innerHTML = "";

        items.forEach(function (item) {

            const row = document.createElement("div");
            row.className = `system-alert ${item.type}`;

            const iconWrap = document.createElement("div");
            iconWrap.className = "alert-icon";

            const icon = document.createElement("i");
            icon.className = `bi ${item.icon}`;

            iconWrap.appendChild(icon);

            const body = document.createElement("div");

            const title = document.createElement("strong");
            title.textContent = item.title;

            const msg = document.createElement("span");
            msg.textContent = item.message;

            body.appendChild(title);
            body.appendChild(msg);

            row.appendChild(iconWrap);
            row.appendChild(body);

            list.appendChild(row);
        });
    }

    if (ok) {
        ok.hidden = items.length > 0;
    }

    if (count) {
        count.textContent = items.length;
        count.className = items.length ? "is-warn" : "is-ok";
    }
}


/* =========================================================
   DASHBOARD SENSOR DATA
   ========================================================= */

async function loadDashboardSensorData() {

    const cards = document.getElementById("dashboard-sensor-cards");

    if (!cards) return;

    const classroomId = cards.dataset.classroomId;

    if (!classroomId) {

        lastRequestSucceeded = false;
        lastUpdatedAt = null;

        renderLastUpdated();

        return;
    }

    try {

        const response = await fetch(
            `/api/live-monitoring/?classroom_id=${encodeURIComponent(classroomId)}`,
            { cache: "no-store" }
        );

        if (!response.ok) {
            throw new Error("Failed to fetch sensor data");
        }

        const data = await response.json();

        lastRequestSucceeded = true;
        lastSensorResponse = data;

        // Use the database reading timestamp, not the browser's
        // response time, to determine freshness.
        if (data.timestamp) {

            const parsedTimestamp = Date.parse(data.timestamp);

            lastUpdatedAt = Number.isNaN(parsedTimestamp)
                ? null
                : parsedTimestamp;

        } else {
            lastUpdatedAt = null;
        }

        renderLastUpdated();

        const occupancyStatus = data.occupancy_status;

        const occupied = occupancyStatus === "occupied";
        const vacant = occupancyStatus === "vacant";

        const temp = isNum(data.temperature)
            ? Number(data.temperature)
            : null;

        const humidity = isNum(data.humidity)
            ? Number(data.humidity)
            : null;

        const lux = isNum(data.light_intensity)
            ? Number(data.light_intensity)
            : null;


        /* Sensor values */

        setValueWithUnit(
            document.getElementById("dashboard-temperature"),
            temp,
            "°C"
        );

        setValueWithUnit(
            document.getElementById("dashboard-humidity"),
            humidity,
            "%"
        );

        setValueWithUnit(
            document.getElementById("dashboard-light"),
            lux,
            "Lux"
        );


        /* Status pills */

        if (temp !== null) {
            const result = judgeTemperature(temp);

            setPill(
                "dashboard-temperature-status",
                result[0],
                result[1]
            );
        } else {
            setPill(
                "dashboard-temperature-status",
                "off",
                "No data"
            );
        }

        if (humidity !== null) {
            const result = judgeHumidity(humidity);

            setPill(
                "dashboard-humidity-status",
                result[0],
                result[1]
            );
        } else {
            setPill(
                "dashboard-humidity-status",
                "off",
                "No data"
            );
        }

        if (lux !== null) {
            const result = judgeLight(lux, occupied);

            setPill(
                "dashboard-light-status",
                result[0],
                result[1]
            );
        } else {
            setPill(
                "dashboard-light-status",
                "off",
                "No data"
            );
        }


        /* Sparklines and trends */

        // Only add new sparkline points when readings are recent.
        if (hasRecentReading()) {

            pushHistory("temperature", temp);
            pushHistory("humidity", humidity);
            pushHistory("light", lux);

        }

        renderSpark("temperature");
        renderSpark("humidity");
        renderSpark("light");

        renderTrend("temperature", "°C");
        renderTrend("humidity", "%");
        renderTrend("light", " Lux");


        /* Hero, devices, occupancy and insights */

        updateHero(occupancyStatus, temp, humidity);
        updateDevices(data);
        updateRoomRow(classroomId, occupancyStatus);

        updateEnergy({
            occupied,
            vacant
        });

        renderInsights({
            temp,
            hum: humidity,
            lux,
            occupied,
            vacant
        });


        /* Classroom summary */

        const summary = document.querySelector(
            `.room-item[data-classroom-id="${classroomId}"] .room-summary`
        );

        if (summary) {

            const parts = [];

            if (temp !== null) parts.push(`${temp.toFixed(1)}°C`);
            if (humidity !== null) parts.push(`${humidity.toFixed(1)}%`);

            if (occupied) {
                parts.push("Occupied");
            } else if (vacant) {
                parts.push("Vacant");
            }

            summary.textContent = parts.join(" · ");
        }

    } catch (error) {

        lastRequestSucceeded = false;

        // Keep the original timestamp. It will become stale
        // naturally instead of being refreshed by polling.
        console.error("Dashboard sensor error:", error);

        renderLastUpdated();
    }
}


/* =========================================================
   SENSOR OVERVIEW CHART
   ========================================================= */

function initSensorOverviewChart() {

    const canvas = document.getElementById("sensorOverviewChart");

    if (!canvas) return;

    // Preserve your existing chart implementation here
}