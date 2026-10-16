document.addEventListener("DOMContentLoaded", () => {

  // ==========================================================
  // ELEMENTS
  // ==========================================================

  const rangeButtons =
    document.querySelectorAll(".cp-filter-btn");

  const customInputs =
    document.getElementById("custom-range-inputs");

  const classroomSelect =
    document.getElementById("classroom-select");

  const applyCustomBtn =
    document.getElementById("apply-custom");

  const toggleButtons =
    document.querySelectorAll(".cp-toggle-btn");

  const chartPanels =
    document.querySelectorAll(".cp-panel");


  // ==========================================================
  // STATE
  // ==========================================================

  let currentRange = "today";
  let currentStart = null;
  let currentEnd = null;

  let occupancyChart = null;
  let tempHumidityChart = null;
  let lightChart = null;
  let usageChart = null;


  // ==========================================================
  // THEME-AWARE COLOR HELPERS
  // Reads the live design tokens from theme.css instead of
  // hardcoded hex values, so charts match light/dark mode.
  // ==========================================================

  function cssVar(name) {

    return getComputedStyle(document.documentElement)
      .getPropertyValue(name)
      .trim();
  }


  function hexToRgba(hex, alpha) {

    const clean = hex.replace("#", "");

    const bigint = parseInt(
      clean.length === 3
        ? clean.split("").map(c => c + c).join("")
        : clean,
      16
    );

    if (Number.isNaN(bigint)) {
      return `rgba(0, 0, 0, ${alpha})`;
    }

    const r = (bigint >> 16) & 255;
    const g = (bigint >> 8) & 255;
    const b = bigint & 255;

    return `rgba(${r}, ${g}, ${b}, ${alpha})`;
  }


  function chartPalette() {

    return {
      text: cssVar("--text-faint"),
      grid: cssVar("--border-soft"),
      accent: cssVar("--accent"),
      accentSoft: cssVar("--accent-soft"),
      temp: cssVar("--chart-temp"),
      tempFill: cssVar("--chart-temp-fill"),
      humidity: cssVar("--chart-humidity"),
      light: cssVar("--chart-light"),
      info: cssVar("--info")
    };
  }


  function applyChartDefaults() {

    if (typeof Chart === "undefined") {
      return;
    }

    const palette = chartPalette();

    Chart.defaults.color = palette.text;
    Chart.defaults.borderColor = palette.grid;
    Chart.defaults.font.family = "'Inter', sans-serif";
  }


  // ==========================================================
  // FORMAT TIME
  // ==========================================================

  function formatTime(timestamp) {

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "--";
    }

    return date.toLocaleTimeString([], {
      hour: "2-digit",
      minute: "2-digit"
    });
  }


  function formatDateTime(timestamp) {

    const date = new Date(timestamp);

    if (Number.isNaN(date.getTime())) {
      return "--";
    }

    return date.toLocaleString([], {
      day: "2-digit",
      month: "short",
      hour: "2-digit",
      minute: "2-digit"
    });
  }


  // ==========================================================
  // VALUE HELPERS
  // ==========================================================

  function numericValue(value) {

    if (
      value === null ||
      value === undefined ||
      value === ""
    ) {
      return null;
    }

    const number = Number(value);

    return Number.isFinite(number)
      ? number
      : null;
  }


  function normalizeOccupancy(status) {

    if (
      status === null ||
      status === undefined
    ) {
      return null;
    }

    const value =
      String(status)
        .trim()
        .toLowerCase();

    if (
      value === "occupied" ||
      value === "present" ||
      value === "detected"
    ) {
      return "occupied";
    }

    if (
      value === "vacant" ||
      value === "unoccupied" ||
      value === "absent"
    ) {
      return "vacant";
    }

    return null;
  }


  // ==========================================================
  // BUILD API URL
  // ==========================================================

  function buildUrl() {

    const params =
      new URLSearchParams();

    params.set(
      "range",
      currentRange
    );


    if (
      currentRange === "custom" &&
      currentStart &&
      currentEnd
    ) {

      params.set(
        "start",
        currentStart
      );

      params.set(
        "end",
        currentEnd
      );
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


  // ==========================================================
  // LOAD ANALYTICS
  // ==========================================================

  async function loadAnalytics() {

    try {

      console.log(
        "Loading analytics:",
        buildUrl()
      );


      const res = await fetch(
        buildUrl(),
        {
          method: "GET",
          cache: "no-store",
          headers: {
            "Accept": "application/json"
          }
        }
      );


      if (!res.ok) {

        throw new Error(
          `Analytics API returned ${res.status}`
        );
      }


      const data =
        await res.json();


      console.log(
        "Analytics API response:",
        data
      );


      applyChartDefaults();


      renderSummary(
        data.summary || {}
      );


      renderNoDataBanner(
        Boolean(data.has_data)
      );


      // Each chart is isolated so one chart error
      // cannot stop the remaining charts.
      try {

        renderOccupancyChart(
          Array.isArray(
            data.occupancy_timeline
          )
            ? data.occupancy_timeline
            : []
        );

      } catch (error) {

        console.error(
          "Occupancy chart error:",
          error
        );
      }


      try {

        renderTempHumidityChart(
          Array.isArray(
            data.temperature_trend
          )
            ? data.temperature_trend
            : [],

          Array.isArray(
            data.humidity_trend
          )
            ? data.humidity_trend
            : []
        );

      } catch (error) {

        console.error(
          "Temperature/Humidity chart error:",
          error
        );
      }


      try {

        renderLightChart(
          Array.isArray(
            data.light_trend
          )
            ? data.light_trend
            : []
        );

      } catch (error) {

        console.error(
          "Light chart error:",
          error
        );
      }


      try {

        renderUsageChart(
          data.usage_bar || {}
        );

      } catch (error) {

        console.error(
          "Usage chart error:",
          error
        );
      }


      try {

        renderWasteTable(
          Array.isArray(
            data.waste_events
          )
            ? data.waste_events
            : []
        );

      } catch (error) {

        console.error(
          "Waste table error:",
          error
        );
      }


      try {

        renderInsights(
          data.insights || {}
        );

      } catch (error) {

        console.error(
          "Insights error:",
          error
        );
      }

    }

    catch (err) {

      console.error(
        "Error loading analytics data:",
        err
      );

      renderNoDataBanner(false);
    }
  }


  // ==========================================================
  // NO DATA BANNER
  // ==========================================================

  function renderNoDataBanner(hasData) {

    const banner =
      document.getElementById(
        "no-data-banner"
      );

    if (!banner) {
      return;
    }

    banner.style.display =
      hasData ? "none" : "flex";
  }


  // ==========================================================
  // SUMMARY
  // ==========================================================

  function renderSummary(summary) {

    const avgTemp =
      document.getElementById(
        "avg-temp"
      );

    const avgHumidity =
      document.getElementById(
        "avg-humidity"
      );

    const avgLight =
      document.getElementById(
        "avg-light"
      );

    const totalOccupied =
      document.getElementById(
        "total-occupied"
      );

    const totalUnoccupied =
      document.getElementById(
        "total-unoccupied"
      );

    const lightOn =
      document.getElementById(
        "light-on"
      );

    const fanOn =
      document.getElementById(
        "fan-on"
      );


    if (avgTemp) {

      const value =
        numericValue(
          summary.avg_temperature
        );

      avgTemp.textContent =
        value !== null
          ? `${value.toFixed(1)} °C`
          : "--";
    }


    if (avgHumidity) {

      const value =
        numericValue(
          summary.avg_humidity
        );

      avgHumidity.textContent =
        value !== null
          ? `${value.toFixed(1)} %`
          : "--";
    }


    if (avgLight) {

      const value =
        numericValue(
          summary.avg_light
        );

      avgLight.textContent =
        value !== null
          ? `${value.toFixed(1)} Lux`
          : "--";
    }


    if (totalOccupied) {

      totalOccupied.textContent =
        summary.total_occupied_fmt ||
        "0h 0m";
    }


    if (totalUnoccupied) {

      totalUnoccupied.textContent =
        summary.total_unoccupied_fmt ||
        "0h 0m";
    }


    if (lightOn) {

      lightOn.textContent =
        summary.light_on_fmt ||
        "0h 0m";
    }


    if (fanOn) {

      fanOn.textContent =
        summary.fan_on_fmt ||
        "0h 0m";
    }
  }


  // ==========================================================
  // OCCUPANCY / MOTION CHART
  // ==========================================================

  function renderOccupancyChart(timeline) {

    if (occupancyChart) {

      occupancyChart.destroy();
      occupancyChart = null;
    }


    const canvas =
      document.getElementById(
        "occupancy-chart"
      );

    if (!canvas) {
      return;
    }


    if (
      !Array.isArray(timeline) ||
      timeline.length === 0
    ) {

      console.warn(
        "No occupancy data returned."
      );

      return;
    }


    // --------------------------------------------------------
    // Normalize occupancy states
    // --------------------------------------------------------

    const points =
      timeline
        .map(point => {

          const status =
            normalizeOccupancy(
              point.status
            );

          if (
            !point.timestamp ||
            !status
          ) {
            return null;
          }

          const date =
            new Date(point.timestamp);

          if (
            Number.isNaN(
              date.getTime()
            )
          ) {
            return null;
          }

          return {
            timestamp: point.timestamp,
            time: date.getTime(),
            status: status
          };
        })
        .filter(Boolean)
        .sort(
          (a, b) =>
            a.time - b.time
        );


    if (points.length === 0) {

      console.warn(
        "Occupancy data contains no valid states."
      );

      return;
    }


    // --------------------------------------------------------
    // Collapse consecutive identical states
    // --------------------------------------------------------

    const simplified = [];


    points.forEach(point => {

      const previous =
        simplified[
          simplified.length - 1
        ];


      if (
        !previous ||
        previous.status !== point.status
      ) {

        simplified.push(point);
      }

    });


    // --------------------------------------------------------
    // Labels + values
    // --------------------------------------------------------

    const labels =
      simplified.map(
        point =>
          formatTime(
            point.timestamp
          )
      );


    const values =
      simplified.map(
        point =>
          point.status === "occupied"
            ? 1
            : 0
      );


    if (
      typeof Chart === "undefined"
    ) {

      console.error(
        "Chart.js is not loaded."
      );

      return;
    }


    // --------------------------------------------------------
    // Create chart
    // --------------------------------------------------------

    const palette = chartPalette();

    occupancyChart =
      new Chart(
        canvas,
        {

          type: "line",

          data: {

            labels: labels,

            datasets: [{

              label: "Occupancy",

              data: values,

              stepped: true,

              borderColor: palette.accent,

              backgroundColor: palette.accentSoft,

              fill: true,

              pointRadius: 3,

              pointHoverRadius: 6,

              borderWidth: 2.5,

              tension: 0

            }]
          },


          options: {

            responsive: true,

            maintainAspectRatio: false,


            interaction: {

              intersect: false,

              mode: "index"
            },


            scales: {

              x: {

                type: "category",

                ticks: {

                  maxRotation: 0,

                  minRotation: 0,

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

                    if (
                      Number(value) === 1
                    ) {
                      return "Occupied";
                    }

                    if (
                      Number(value) === 0
                    ) {
                      return "Vacant";
                    }

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

                backgroundColor: cssVar("--tooltip-bg"),

                callbacks: {

                  label: context => {

                    return Number(
                      context.raw
                    ) === 1
                      ? "Occupied"
                      : "Vacant";
                  }

                }

              }

            }

          }

        }
      );


    setTimeout(() => {

      if (occupancyChart) {

        occupancyChart.resize();

        occupancyChart.update("none");
      }

    }, 100);
  }


  // ==========================================================
  // TEMPERATURE + HUMIDITY
  // ==========================================================

  function renderTempHumidityChart(
    tempPoints,
    humidityPoints
  ) {

    if (tempHumidityChart) {

      tempHumidityChart.destroy();

      tempHumidityChart = null;
    }


    const canvas =
      document.getElementById(
        "temp-humidity-chart"
      );

    if (!canvas) {
      return;
    }


    if (
      tempPoints.length === 0 &&
      humidityPoints.length === 0
    ) {
      return;
    }


    // --------------------------------------------------------
    // Create common labels
    // --------------------------------------------------------

    const allPoints = [
      ...tempPoints,
      ...humidityPoints
    ]
      .filter(
        point =>
          point &&
          point.timestamp
      )
      .sort(
        (a, b) =>
          new Date(a.timestamp).getTime() -
          new Date(b.timestamp).getTime()
      );


    const labelMap = new Map();


    allPoints.forEach(point => {

      const time =
        new Date(
          point.timestamp
        ).getTime();

      if (
        !Number.isNaN(time) &&
        !labelMap.has(time)
      ) {

        labelMap.set(
          time,
          formatTime(
            point.timestamp
          )
        );
      }

    });


    const sortedTimes =
      Array.from(
        labelMap.keys()
      ).sort(
        (a, b) => a - b
      );


    const labels =
      sortedTimes.map(
        time =>
          labelMap.get(time)
      );


    // --------------------------------------------------------
    // Map values to the correct label
    // --------------------------------------------------------

    const tempMap = new Map();

    tempPoints.forEach(point => {

      const value =
        numericValue(
          point.value
        );

      const time =
        new Date(
          point.timestamp
        ).getTime();

      if (
        value !== null &&
        !Number.isNaN(time)
      ) {

        tempMap.set(
          time,
          value
        );
      }

    });


    const humidityMap = new Map();

    humidityPoints.forEach(point => {

      const value =
        numericValue(
          point.value
        );

      const time =
        new Date(
          point.timestamp
        ).getTime();

      if (
        value !== null &&
        !Number.isNaN(time)
      ) {

        humidityMap.set(
          time,
          value
        );
      }

    });


    const temperatureValues =
      sortedTimes.map(
        time =>
          tempMap.has(time)
            ? tempMap.get(time)
            : null
      );


    const humidityValues =
      sortedTimes.map(
        time =>
          humidityMap.has(time)
            ? humidityMap.get(time)
            : null
      );


    // --------------------------------------------------------
    // Create chart
    // --------------------------------------------------------

    const palette = chartPalette();

    tempHumidityChart =
      new Chart(
        canvas,
        {

          type: "line",

          data: {

            labels: labels,

            datasets: [

              {

                label:
                  "Temperature (°C)",

                data:
                  temperatureValues,

                borderColor:
                  palette.temp,

                backgroundColor:
                  palette.tempFill,

                pointRadius: 0,

                pointHoverRadius: 5,

                borderWidth: 2.5,

                tension: 0.35,

                spanGaps: true,

                yAxisID: "yTemp"

              },


              {

                label:
                  "Humidity (%)",

                data:
                  humidityValues,

                borderColor:
                  palette.humidity,

                backgroundColor:
                  "transparent",

                pointRadius: 0,

                pointHoverRadius: 5,

                borderWidth: 2.5,

                tension: 0.35,

                spanGaps: true,

                yAxisID: "yHum"

              }

            ]

          },


          options: {

            responsive: true,

            maintainAspectRatio: false,


            interaction: {

              intersect: false,

              mode: "index"
            },


            scales: {

              x: {

                type: "category",

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

            },


            plugins: {

              legend: {

                display: true,

                position: "top"
              },

              tooltip: {

                backgroundColor: cssVar("--tooltip-bg")

              }

            }

          }

        }
      );
  }


  // ==========================================================
  // LIGHT INTENSITY
  // ==========================================================

  function renderLightChart(lightPoints) {

    if (lightChart) {

      lightChart.destroy();

      lightChart = null;
    }


    const canvas =
      document.getElementById(
        "light-chart"
      );

    if (!canvas) {
      return;
    }


    if (
      !Array.isArray(lightPoints) ||
      lightPoints.length === 0
    ) {

      console.warn(
        "No light data returned."
      );

      return;
    }


    const validPoints =
      lightPoints
        .map(point => {

          const value =
            numericValue(
              point.value
            );

          if (
            !point.timestamp ||
            value === null
          ) {
            return null;
          }

          return {
            timestamp:
              point.timestamp,

            time:
              new Date(
                point.timestamp
              ).getTime(),

            value:
              value
          };

        })
        .filter(point =>
          point !== null &&
          !Number.isNaN(point.time)
        )
        .sort(
          (a, b) =>
            a.time - b.time
        );


    if (
      validPoints.length === 0
    ) {
      return;
    }


    const labels =
      validPoints.map(
        point =>
          formatTime(
            point.timestamp
          )
      );


    const values =
      validPoints.map(
        point =>
          point.value
      );


    // --------------------------------------------------------
    // Create chart
    // --------------------------------------------------------

    const palette = chartPalette();

    lightChart =
      new Chart(
        canvas,
        {

          type: "line",

          data: {

            labels: labels,

            datasets: [{

              label:
                "Light intensity (Lux)",

              data: values,

              borderColor:
                palette.light,

              backgroundColor:
                hexToRgba(palette.light, 0.12),

              fill: true,

              pointRadius: 0,

              pointHoverRadius: 5,

              borderWidth: 2.5,

              tension: 0.35

            }]
          },


          options: {

            responsive: true,

            maintainAspectRatio: false,


            interaction: {

              intersect: false,

              mode: "index"
            },


            scales: {

              x: {

                type: "category",

                ticks: {

                  maxRotation: 0,

                  autoSkip: true,

                  maxTicksLimit: 12
                }

              },


              y: {

                beginAtZero: true,


                title: {

                  display: true,

                  text: "Lux"
                }

              }

            },

            plugins: {

              tooltip: {

                backgroundColor: cssVar("--tooltip-bg")

              }

            }

          }

        }
      );
  }


  // ==========================================================
  // APPLIANCE USAGE
  // ==========================================================

  function renderUsageChart(usage) {

    if (usageChart) {

      usageChart.destroy();

      usageChart = null;
    }


    const canvas =
      document.getElementById(
        "usage-chart"
      );

    if (!canvas) {
      return;
    }


    const lightHours =
      numericValue(
        usage.light_on_hours
      ) ?? 0;


    const fanHours =
      numericValue(
        usage.fan_on_hours
      ) ?? 0;


    const palette = chartPalette();

    usageChart =
      new Chart(
        canvas,
        {

          type: "bar",

          data: {

            labels: [
              "Light",
              "Fan"
            ],

            datasets: [{

              label: "Hours ON",

              data: [
                lightHours,
                fanHours
              ],

              backgroundColor: [
                palette.light,
                palette.info
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
              },

              tooltip: {

                backgroundColor: cssVar("--tooltip-bg")

              }

            }

          }

        }
      );
  }


  // ==========================================================
  // WASTE TABLE
  // ==========================================================

  function renderWasteTable(events) {

    const body =
      document.getElementById(
        "waste-table-body"
      );


    const emptyMsg =
      document.getElementById(
        "waste-empty"
      );


    if (!body || !emptyMsg) {
      return;
    }


    body.innerHTML = "";


    if (
      !Array.isArray(events) ||
      events.length === 0
    ) {

      emptyMsg.style.display =
        "flex";

      return;
    }


    emptyMsg.style.display =
      "none";


    events.forEach(event => {

      const tr =
        document.createElement(
          "tr"
        );


      tr.innerHTML = `
        <td>${event.appliance || "--"}</td>
        <td>${formatDateTime(event.start)}</td>
        <td>${formatDateTime(event.end)}</td>
        <td>${event.duration || "--"}</td>
      `;


      body.appendChild(tr);

    });

  }


  // ==========================================================
  // ENERGY INSIGHTS
  // ==========================================================

  function renderInsights(insights) {

    const unoccupied =
      document.getElementById(
        "ins-unoccupied"
      );


    const lightWaste =
      document.getElementById(
        "ins-light-waste"
      );


    const fanWaste =
      document.getElementById(
        "ins-fan-waste"
      );


    const insufficientLight =
      document.getElementById(
        "ins-sufficient-light"
      );


    const lightPercentage =
      document.getElementById(
        "ins-light-pct"
      );


    const fanPercentage =
      document.getElementById(
        "ins-fan-pct"
      );


    if (unoccupied) {

      unoccupied.textContent =
        insights.total_unoccupied_fmt ||
        "0h 0m";
    }


    if (lightWaste) {

      lightWaste.textContent =
        insights.light_on_while_unoccupied_fmt ||
        "0h 0m";
    }


    if (fanWaste) {

      fanWaste.textContent =
        insights.fan_on_while_unoccupied_fmt ||
        "0h 0m";
    }


    if (insufficientLight) {

      insufficientLight.textContent =
        insights.sufficient_light_pct != null
          ? `${insights.sufficient_light_pct}%`
          : "--";
    }


    if (lightPercentage) {

      lightPercentage.textContent =
        `${insights.light_usage_pct || 0}%`;
    }


    if (fanPercentage) {

      fanPercentage.textContent =
        `${insights.fan_usage_pct || 0}%`;
    }
  }


  // ==========================================================
  // RANGE BUTTONS
  // ==========================================================

  rangeButtons.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        rangeButtons.forEach(
          item =>
            item.classList.remove(
              "active"
            )
        );


        button.classList.add(
          "active"
        );


        currentRange =
          button.dataset.range;


        if (customInputs) {

          customInputs.classList.toggle(
            "visible",
            currentRange === "custom"
          );
        }


        if (
          currentRange !== "custom"
        ) {

          loadAnalytics();
        }

      }
    );

  });


  // ==========================================================
  // CUSTOM RANGE
  // ==========================================================

  applyCustomBtn?.addEventListener(
    "click",
    () => {

      const startInput =
        document.getElementById(
          "start-date"
        );


      const endInput =
        document.getElementById(
          "end-date"
        );


      currentStart =
        startInput?.value || null;


      currentEnd =
        endInput?.value || null;


      if (
        !currentStart ||
        !currentEnd
      ) {

        alert(
          "Please select both dates."
        );

        return;
      }


      if (
        currentStart > currentEnd
      ) {

        alert(
          "Start date cannot be after end date."
        );

        return;
      }


      currentRange = "custom";

      loadAnalytics();

    }
  );


  // ==========================================================
  // CLASSROOM FILTER
  // ==========================================================

  classroomSelect?.addEventListener(
    "change",
    () => {

      loadAnalytics();

    }
  );


  // ==========================================================
  // CHART TOGGLES
  // ==========================================================

  toggleButtons.forEach(button => {

    button.addEventListener(
      "click",
      () => {

        toggleButtons.forEach(
          item =>
            item.classList.remove(
              "active"
            )
        );


        chartPanels.forEach(
          panel =>
            panel.classList.remove(
              "active"
            )
        );


        button.classList.add(
          "active"
        );


        const targetPanel =
          document.getElementById(
            button.dataset.target
          );


        if (!targetPanel) {
          return;
        }


        targetPanel.classList.add(
          "active"
        );


        setTimeout(() => {

          if (
            button.dataset.target ===
              "panel-occupancy" &&
            occupancyChart
          ) {

            occupancyChart.resize();
          }


          if (
            button.dataset.target ===
              "panel-temp-humidity" &&
            tempHumidityChart
          ) {

            tempHumidityChart.resize();
          }


          if (
            button.dataset.target ===
              "panel-light" &&
            lightChart
          ) {

            lightChart.resize();
          }


          if (
            button.dataset.target ===
              "panel-usage" &&
            usageChart
          ) {

            usageChart.resize();
          }

        }, 50);

      }
    );

  });


  // ==========================================================
  // THEME CHANGE — rebuild charts with the new palette
  // ==========================================================

  window.addEventListener(
    "campuspulse:theme-change",
    () => {
      loadAnalytics();
    }
  );


  // ==========================================================
  // INITIAL LOAD
  // ==========================================================

  loadAnalytics();

});