// CMIP6 USA Precipitation Change Heatmap — Fixed and Final Version

// Create fixed map view (no zooming or panning)
const map = L.map("map", {
  zoomControl: false,
  dragging: false,
  scrollWheelZoom: false,
  doubleClickZoom: false,
  boxZoom: false,
  keyboard: false,
  tap: false,
  touchZoom: false,
}).setView([39, -96], 4.1);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: "&copy; CartoDB",
}).addTo(map);

// Color scale (blue = wetter, red = drier)
function getColor(pct) {
  return pct > 30 ? "#08306b" :
         pct > 20 ? "#2171b5" :
         pct > 10 ? "#6baed6" :
         pct > 0  ? "#bdd7e7" :
         pct > -10 ? "#fcae91" :
         pct > -20 ? "#fb6a4a" :
         pct > -30 ? "#de2d26" :
                     "#a50f15";
}

function style(feature) {
  return {
    fillColor: getColor(feature.properties.pct_change),
    weight: 1,
    opacity: 1,
    color: "white",
    fillOpacity: 0.8,
  };
}

function onEachFeature(feature, layer) {
  if (feature.properties && feature.properties.name) {
    layer.bindPopup(
      `<strong>${feature.properties.name}</strong><br>Δ Precipitation: ${feature.properties.pct_change.toFixed(1)}%`
    );
  }
}

// ---------- Load Data ----------
Promise.all([
  fetch("https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json").then(r => r.json()),
  d3.csv("data/us_pr_change_by_year.csv", d3.autoType),
  d3.csv("data/resorts.csv", d3.autoType)
]).then(([usStates, grid, resorts]) => {

  // 🔹 Remove Alaska and Hawaii
  usStates.features = usStates.features.filter(f =>
    !["Alaska", "Hawaii", "Puerto Rico"].includes(f.properties.name)
  );

  // Group precipitation data by year
  const byYear = d3.group(grid, d => d.year);

  // ---------- Update Function ----------
  function updateMap(year) {
    const data = byYear.get(year);
    if (!data) return;

    // Build lookup table for each state
    const stateData = {};
    for (const d of data) {
      const name = d.state?.trim().toLowerCase();
      if (!stateData[name]) stateData[name] = [];
      stateData[name].push(d.pct_change);
    }

    // Assign averaged value to state polygons
    usStates.features.forEach(f => {
      const sname = f.properties.name.toLowerCase();
      const vals = stateData[sname];
      f.properties.pct_change = vals ? d3.mean(vals) : 0;
    });

    // Replace state polygons layer
    if (window.stateLayer) map.removeLayer(window.stateLayer);
    window.stateLayer = L.geoJSON(usStates, {
      style,
      onEachFeature,
    }).addTo(map);

    // Resort markers
    if (window.resortLayer) map.removeLayer(window.resortLayer);
    window.resortLayer = L.layerGroup(
      resorts.map(r => {
        // Find nearest data point for this year
        const arr = byYear.get(year) || [];
        let best = null, bestDist = Infinity;
        for (const d of arr) {
          const dx = d.lon - r.lon, dy = d.lat - r.lat;
          const dist = dx * dx + dy * dy;
          if (dist < bestDist) { bestDist = dist; best = d; }
        }
        const pct = best ? d3.format(".1f")(best.pct_change) : "n/a";

        return L.circleMarker([r.lat, r.lon], {
          radius: 4,
          color: "#0ea5e9",
          fillColor: "#0ea5e9",
          fillOpacity: 0.9,
          weight: 1,
        }).bindTooltip(`<strong>${r.name}</strong><br>${r.state}<br>Δ Precip: ${pct}%`);
      })
    ).addTo(map);
  }

  // ---------- Slider Control ----------
  const yearSlider = document.getElementById("yearSlider");
  const yearLabel = document.getElementById("yearLabel");

  yearSlider.addEventListener("input", () => {
    const year = +yearSlider.value;
    yearLabel.textContent = year;
    updateMap(year);
  });

  // ---------- Initial Draw ----------
  updateMap(2025);
});