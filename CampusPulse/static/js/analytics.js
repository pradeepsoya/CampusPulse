document.addEventListener("DOMContentLoaded", () => {

  const rangeButtons = document.querySelectorAll(".cp-filter-btn");
  const customInputs = document.getElementById("custom-range-inputs");
  const classroomSelect = document.getElementById("classroom-select");
  const applyCustomBtn = document.getElementById("apply-custom");

  const toggleButtons = document.querySelectorAll(".cp-toggle-btn");
  const chartPanels = document.querySelectorAll(".cp-panel");

  let currentRange = "today";
  let currentStart = null;
  let currentEnd = null;

  let occupancyChart = null;
  let tempHumidityChart = null;
  let lightChart = null;
  let usageChart = null;


  // --------------------------------------------------
  // Chart.js global styling
  // --------------------------------------------------

  Chart.defaults.color = "#78788c";
  Chart.defaults.borderColor = "rgba(255, 255, 255, 0.05)";
  Chart.defaults.font.family = "'Plus Jakarta Sans', 'Inter', sans-serif";


  // --------------------------------------------------
  // Format timestamp for chart labels
  // --------------------------------------------------

  function formatTime(timestamp) {
    const date = new Date(timestamp);

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }


  function formatDateTime(timestamp) {
    const date = new Date(timestamp);

    return date.toLocaleString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }


  // --------------------------------------------------
  // Classroom / range API URL
  // --------------------------------------------------

  function buildUrl() {

    const params = new URLSearchParams({
      range: currentRange
    });

    if (
      currentRange === "custom" &&
      currentStart &&
      currentEnd
    ) {
      params.set("start", currentStart);
      params.set("end", currentEnd);
    }

    if (
      classroomSelect &&
      classroomSelect.value
    ) {
      params.set(
        "classroom_id",
        classroomSelect.value
      );
    }

    return `/api/analytics-data/?${params.toString()}`;
  }


  // --------------------------------------------------
  // Load analytics
  // --------------------------------------------------

  async function loadAnalytics() {

    try {

      const res = await fetch(buildUrl());

      if (!res.ok) {
        throw new Error(
          `Analytics API returned ${res.status}`
        );
      }

      const data = await res.json();

      console.log("Analytics data:", data);

      renderSummary(data.summary);

      renderNoDataBanner(data.has_data);

      renderOccupancyChart(
        data.occupancy_timeline || []
      );

      renderTempHumidityChart(
        data.temperature_trend || [],
        data.humidity_trend || []
      );

      renderLightChart(
        data.light_trend || []
      );

      renderUsageChart(
        data.usage_bar || {
          light_on_hours: 0,
          fan_on_hours: 0
        }
      );

      renderWasteTable(
        data.waste_events || []
      );

      renderInsights(
        data.insights || {}
      );

    } catch (err) {

      console.error(
        "Error loading analytics data:",
        err
      );

    }
  }


  // --------------------------------------------------
  // No data banner
  // --------------------------------------------------

  function renderNoDataBanner(hasData) {

    const banner =
      document.getElementById("no-data-banner");

    if (!banner) return;

    banner.style.display =
      hasData ? "none" : "block";
  }


  // --------------------------------------------------
  // Summary cards
  // --------------------------------------------------

  function renderSummary(s) {

    document.getElementById("avg-temp").textContent =
      s.avg_temperature != null
        ? `${s.avg_temperature} °C`
        : "--";

    document.getElementById("avg-humidity").textContent =
      s.avg_humidity != null
        ? `${s.avg_humidity} %`
        : "--";

    document.getElementById("avg-light").textContent =
      s.avg_light != null
        ? `${s.avg_light} Lux`
        : "--";

    document.getElementById("total-occupied").textContent =
      s.total_occupied_fmt || "0h 0m";

    document.getElementById("total-unoccupied").textContent =
      s.total_unoccupied_fmt || "0h 0m";

    document.getElementById("light-on").textContent =
      s.light_on_fmt || "0h 0m";

    document.getElementById("fan-on").textContent =
      s.fan_on_fmt || "0h 0m";
  }


  // --------------------------------------------------
  // Occupancy chart
  // --------------------------------------------------

  function renderOccupancyChart(timeline) {

    if (occupancyChart) {
      occupancyChart.destroy();
    }

    const canvas =
      document.getElementById("occupancy-chart");

    if (!canvas) return;

    const labels = timeline.map(
      p => formatTime(p.timestamp)
    );

    const values = timeline.map(
      p => p.status === "occupied" ? 1 : 0
    );

    occupancyChart = new Chart(canvas, {

      type: "line",

      data: {
        labels: labels,

        datasets: [{
          label: "Occupancy",
          data: values,

          stepped: true,

          borderColor: "#8b5cf6",
          backgroundColor: "rgba(139, 92, 246, 0.15)",

          fill: true,

          pointRadius: 2,
          pointHoverRadius: 5,

          borderWidth: 2
        }]
      },

      options: {

        responsive: true,
        maintainAspectRatio: false,

        scales: {

          x: {
            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12
            }
          },

          y: {

            min: -0.1,
            max: 1.1,

            ticks: {

              stepSize: 1,

              callback: value => {

                if (value === 1)
                  return "Occupied";

                if (value === 0)
                  return "Vacant";

                return "";
              }
            }
          }
        },

        plugins: {

          legend: {
            display: false
          },

          tooltip: {

            callbacks: {

              label: context => {

                return context.raw === 1
                  ? "Occupied"
                  : "Vacant";
              }
            }
          }
        }
      }
    });
  }


  // --------------------------------------------------
  // Temperature + Humidity chart
  // --------------------------------------------------

  function renderTempHumidityChart(
    tempPoints,
    humidityPoints
  ) {

    if (tempHumidityChart) {
      tempHumidityChart.destroy();
    }

    const canvas =
      document.getElementById(
        "temp-humidity-chart"
      );

    if (!canvas) return;


    const tempLabels = tempPoints.map(
      p => formatTime(p.timestamp)
    );

    const humidityLabels = humidityPoints.map(
      p => formatTime(p.timestamp)
    );


    tempHumidityChart = new Chart(canvas, {

      type: "line",

      data: {

        labels: tempLabels,

        datasets: [

          {
            label: "Temperature (°C)",

            data: tempPoints.map(
              p => p.value
            ),

            borderColor: "#f43f5e",
            backgroundColor: "transparent",

            pointRadius: 2,
            pointHoverRadius: 5,

            borderWidth: 2.5,

            tension: 0.35,

            yAxisID: "yTemp"
          },

          {
            label: "Humidity (%)",

            data: humidityPoints.map(
              p => p.value
            ),

            borderColor: "#38bdf8",
            backgroundColor: "transparent",

            pointRadius: 2,
            pointHoverRadius: 5,

            borderWidth: 2.5,

            tension: 0.35,

            yAxisID: "yHum"
          }

        ]
      },

      options: {

        responsive: true,
        maintainAspectRatio: false,

        scales: {

          x: {

            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12
            }
          },

          yTemp: {

            type: "linear",

            position: "left",

            title: {
              display: true,
              text: "°C"
            }
          },

          yHum: {

            type: "linear",

            position: "right",

            title: {
              display: true,
              text: "%"
            },

            grid: {
              drawOnChartArea: false
            }
          }
        }
      }
    });
  }


  // --------------------------------------------------
  // Light intensity chart
  // --------------------------------------------------

  function renderLightChart(lightPoints) {

    if (lightChart) {
      lightChart.destroy();
    }

    const canvas =
      document.getElementById("light-chart");

    if (!canvas) return;


    const labels = lightPoints.map(
      p => formatTime(p.timestamp)
    );

    const values = lightPoints.map(
      p => p.value
    );


    lightChart = new Chart(canvas, {

      type: "line",

      data: {

        labels: labels,

        datasets: [{

          label: "Light Intensity (Lux)",

          data: values,

          borderColor: "#a855f7",
          backgroundColor: "rgba(168, 85, 247, 0.12)",

          fill: true,

          pointRadius: 2,
          pointHoverRadius: 5,

          borderWidth: 2.5,

          tension: 0.35
        }]
      },

      options: {

        responsive: true,
        maintainAspectRatio: false,

        scales: {

          x: {

            ticks: {
              maxRotation: 0,
              autoSkip: true,
              maxTicksLimit: 12
            }
          },

          y: {

            title: {
              display: true,
              text: "Lux"
            },

            beginAtZero: true
          }
        }
      }
    });
  }


  // --------------------------------------------------
  // Appliance usage chart
  // --------------------------------------------------

  function renderUsageChart(usage) {

    if (usageChart) {
      usageChart.destroy();
    }

    const canvas =
      document.getElementById("usage-chart");

    if (!canvas) return;


    usageChart = new Chart(canvas, {

      type: "bar",

      data: {

        labels: [
          "Light",
          "Fan"
        ],

        datasets: [{

          label: "Hours ON",

          data: [
            usage.light_on_hours || 0,
            usage.fan_on_hours || 0
          ],

          backgroundColor: [
            "#8b5cf6",
            "#38bdf8"
          ],

          borderRadius: 8,

          barThickness: 48
        }]
      },

      options: {

        responsive: true,
        maintainAspectRatio: false,

        scales: {

          y: {

            beginAtZero: true,

            title: {
              display: true,
              text: "Hours"
            }
          }
        },

        plugins: {

          legend: {
            display: false
          }
        }
      }
    });
  }


  // --------------------------------------------------
  // Waste table
  // --------------------------------------------------

  function renderWasteTable(events) {

    const body =
      document.getElementById(
        "waste-table-body"
      );

    const emptyMsg =
      document.getElementById(
        "waste-empty"
      );

    if (!body || !emptyMsg) return;

    body.innerHTML = "";


    if (!events || events.length === 0) {

      emptyMsg.style.display = "block";

      return;
    }


    emptyMsg.style.display = "none";


    events.forEach(ev => {

      const tr =
        document.createElement("tr");

      tr.innerHTML = `
        <td>${ev.appliance}</td>
        <td>${formatDateTime(ev.start)}</td>
        <td>${formatDateTime(ev.end)}</td>
        <td>${ev.duration}</td>
      `;

      body.appendChild(tr);
    });
  }


  // --------------------------------------------------
  // Energy insights
  // --------------------------------------------------

  function renderInsights(ins) {

    document.getElementById(
      "ins-unoccupied"
    ).textContent =
      ins.total_unoccupied_fmt || "0h 0m";


    document.getElementById(
      "ins-light-waste"
    ).textContent =
      ins.light_on_while_unoccupied_fmt || "0h 0m";


    document.getElementById(
      "ins-fan-waste"
    ).textContent =
      ins.fan_on_while_unoccupied_fmt || "0h 0m";


    document.getElementById(
      "ins-sufficient-light"
    ).textContent =
      ins.sufficient_light_pct != null
        ? `${ins.sufficient_light_pct}%`
        : "--";


    document.getElementById(
      "ins-light-pct"
    ).textContent =
      `${ins.light_usage_pct || 0}%`;


    document.getElementById(
      "ins-fan-pct"
    ).textContent =
      `${ins.fan_usage_pct || 0}%`;
  }


  // --------------------------------------------------
  // Range buttons
  // --------------------------------------------------

  rangeButtons.forEach(btn => {

    btn.addEventListener("click", () => {

      rangeButtons.forEach(
        b => b.classList.remove("active")
      );

      btn.classList.add("active");

      currentRange =
        btn.dataset.range;

      customInputs.style.display =
        currentRange === "custom"
          ? "flex"
          : "none";

      if (currentRange !== "custom") {
        loadAnalytics();
      }
    });
  });


  // --------------------------------------------------
  // Custom date range
  // --------------------------------------------------

  applyCustomBtn?.addEventListener(
    "click",
    () => {

      currentStart =
        document.getElementById(
          "start-date"
        ).value;

      currentEnd =
        document.getElementById(
          "end-date"
        ).value;

      if (
        currentStart &&
        currentEnd
      ) {
        loadAnalytics();
      }
    }
  );


  // --------------------------------------------------
  // Classroom filter
  // --------------------------------------------------

  classroomSelect?.addEventListener(
    "change",
    loadAnalytics
  );


  // --------------------------------------------------
  // Chart toggle panels
  // --------------------------------------------------

  toggleButtons.forEach(btn => {

    btn.addEventListener("click", () => {

      toggleButtons.forEach(
        b => b.classList.remove("active")
      );

      chartPanels.forEach(
        p => p.classList.remove("active")
      );


      btn.classList.add("active");


      const targetPanel =
        document.getElementById(
          btn.dataset.target
        );


      if (targetPanel) {

        targetPanel.classList.add("active");


        setTimeout(() => {

          if (
            btn.dataset.target === "panel-occupancy" &&
            occupancyChart
          ) {
            occupancyChart.resize();
          }

          if (
            btn.dataset.target === "panel-temp-humidity" &&
            tempHumidityChart
          ) {
            tempHumidityChart.resize();
          }

          if (
            btn.dataset.target === "panel-light" &&
            lightChart
          ) {
            lightChart.resize();
          }

          if (
            btn.dataset.target === "panel-usage" &&
            usageChart
          ) {
            usageChart.resize();
          }

        }, 50);
      }
    });
  });


  // --------------------------------------------------
  // Initial load
  // --------------------------------------------------

  loadAnalytics();

});