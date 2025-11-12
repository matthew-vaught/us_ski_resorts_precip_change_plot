// Leaflet-based true heatmap choropleth

// Initialize map
const map = L.map("map").setView([39, -96], 4);

// Base layer
L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: '&copy; <a href="https://carto.com/">CartoDB</a>',
}).addTo(map);

// Color scale function (red = drier, blue = wetter)
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

// Style each polygon (state or grid cell)
function style(feature) {
  return {
    fillColor: getColor(feature.properties.pct_change),
    weight: 0.5,
    opacity: 1,
    color: "white",
    fillOpacity: 0.8,
  };
}

// Tooltip popup
function onEachFeature(feature, layer) {
  if (feature.properties && feature.properties.name) {
    layer.bindPopup(
      `<strong>${feature.properties.name}</strong><br/>Δ Precip: ${feature.properties.pct_change.toFixed(1)}%`
    );
  }
}

// Load base GeoJSON and data
Promise.all([
  fetch("https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json").then(r => r.json()),
  d3.csv("data/us_pr_change_by_year.csv", d3.autoType),
  d3.csv("data/resorts.csv", d3.autoType)
]).then(([usStates, grid, resorts]) => {

  // Group precipitation data by year
  const byYear = d3.group(grid, d => d.year);

  // Function to update map colors
  function updateMap(year) {
    const data = byYear.get(year);
    if (!data) return;

    // Compute average per state
    const stateData = {};
    for (const d of data) {
      if (!stateData[d.state]) stateData[d.state] = [];
      stateData[d.state].push(d.pct_change);
    }

    usStates.features.forEach(f => {
      const s = stateData[f.properties.name];
      f.properties.pct_change = s ? d3.mean(s) : 0;
    });

    // Remove old layer and add updated one
    if (window.stateLayer) map.removeLayer(window.stateLayer);
    window.stateLayer = L.geoJSON(usStates, {
      style,
      onEachFeature,
    }).addTo(map);

    // Resort markers
    if (window.resortLayer) map.removeLayer(window.resortLayer);
    window.resortLayer = L.layerGroup(
      resorts.map(r =>
        L.circleMarker([r.lat, r.lon], {
          radius: 4,
          color: "#0ea5e9",
          fillColor: "#0ea5e9",
          fillOpacity: 0.9,
          weight: 1,
        }).bindTooltip(`<strong>${r.name}</strong><br>${r.state}`)
      )
    ).addTo(map);
  }

  // Slider interaction
  const yearSlider = document.getElementById("yearSlider");
  const yearLabel = document.getElementById("yearLabel");
  yearSlider.addEventListener("input", () => {
    const year = +yearSlider.value;
    yearLabel.textContent = year;
    updateMap(year);
  });

  // Initial draw
  updateMap(2025);
});