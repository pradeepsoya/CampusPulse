document.addEventListener("DOMContentLoaded", function () {

    initLiveDateTime();
    initSensorOverviewChart();

});


/* =========================================================
   LIVE DATE & TIME
========================================================= */

function initLiveDateTime() {

    const el = document.getElementById("liveDateTime");

    if (!el) {
        return;
    }

    function updateLiveDateTime() {

        const now = new Date();

        const dateStr = now.toLocaleDateString("en-GB", {
            day: "2-digit",
            month: "long",
            year: "numeric"
        });

        const timeStr = now.toLocaleTimeString("en-IN", {
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true
        });

        el.textContent = `${dateStr} · ${timeStr}`;

    }

    updateLiveDateTime();
    setInterval(updateLiveDateTime, 1000);

}


/* =========================================================
   SENSOR OVERVIEW CHART
========================================================= */

function initSensorOverviewChart() {

    const canvas = document.getElementById("sensorOverviewChart");

    if (!canvas || typeof Chart === "undefined") {
        return;
    }

    new Chart(canvas, {

        type: "line",

        data: {

            labels: [
                "10 AM",
                "11 AM",
                "12 PM",
                "1 PM",
                "2 PM",
                "3 PM",
                "4 PM"
            ],

            datasets: [

                {
                    label: "Temperature",
                    data: [26, 27, 27, 28, 28, 29, 28],
                    borderColor: "#FB7185",
                    backgroundColor: "rgba(251,113,133,0.08)",
                    tension: 0.4,
                    fill: true,
                    pointRadius: 3,
                    pointHoverRadius: 5
                },

                {
                    label: "Humidity",
                    data: [61, 63, 65, 66, 67, 68, 67],
                    borderColor: "#38BDF8",
                    backgroundColor: "transparent",
                    tension: 0.4,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 5
                },

                {
                    label: "Light",
                    data: [350, 390, 410, 430, 420, 440, 420],
                    borderColor: "#FBBF24",
                    backgroundColor: "transparent",
                    tension: 0.4,
                    fill: false,
                    pointRadius: 3,
                    pointHoverRadius: 5
                }

            ]

        },

        options: {

            responsive: true,

            maintainAspectRatio: false,

            interaction: {
                mode: "index",
                intersect: false
            },

            plugins: {

                legend: {
                    position: "top",
                    align: "end",

                    labels: {
                        usePointStyle: true,
                        boxWidth: 7,
                        padding: 18,
                        color: "#8B85A0",
                        font: {
                            family: "Poppins",
                            size: 10
                        }
                    }
                },

                tooltip: {
                    backgroundColor: "#191526",
                    borderColor: "rgba(255,255,255,0.08)",
                    borderWidth: 1,
                    titleColor: "#F1EEFB",
                    bodyColor: "#A7A0B8",
                    padding: 12
                }

            },

            scales: {

                x: {
                    grid: {
                        display: false
                    },

                    ticks: {
                        color: "#665F7A",
                        font: {
                            family: "JetBrains Mono",
                            size: 9
                        }
                    }
                },

                y: {
                    grid: {
                        color: "rgba(255,255,255,0.045)"
                    },

                    ticks: {
                        color: "#665F7A",
                        font: {
                            family: "JetBrains Mono",
                            size: 9
                        }
                    }
                }

            }

        }

    });

}