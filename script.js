// Leaflet USA Precipitation Change Heatmap — working version

const map = L.map("map", {
  minZoom: 3,
  maxZoom: 6,
  zoomControl: true,
  maxBounds: [
    [50, -130],
    [23, -65],
  ], // lock to continental US
}).setView([39, -96], 4);

L.tileLayer("https://{s}.basemaps.cartocdn.com/light_all/{z}/{x}/{y}{r}.png", {
  attribution: "&copy; CartoDB",
}).addTo(map);

// Color scale (red = drier, blue = wetter)
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

// Load GeoJSON + data
Promise.all([
  fetch("https://raw.githubusercontent.com/PublicaMundi/MappingAPI/master/data/geojson/us-states.json").then(r => r.json()),
  d3.csv("data/us_pr_change_by_year.csv", d3.autoType),
  d3.csv("data/resorts.csv", d3.autoType)
]).then(([usStates, grid, resorts]) => {

  const byYear = d3.group(grid, d => d.year);

  function updateMap(year) {
    const data = byYear.get(year);
    if (!data) return;

    // Normalize state names for matching
    const stateData = {};
    for (const d of data) {
      const name = d.state?.trim().toLowerCase();
      if (!stateData[name]) stateData[name] = [];
      stateData[name].push(d.pct_change);
    }

    usStates.features.forEach(f => {
      const sname = f.properties.name.toLowerCase();
      const vals = stateData[sname];
      f.properties.pct_change = vals ? d3.mean(vals) : 0;
    });

    // Replace state polygons
    if (window.stateLayer) map.removeLayer(window.stateLayer);
    window.stateLayer = L.geoJSON(usStates, {
      style,
      onEachFeature,
    }).addTo(map);

    // Replace resorts
    if (window.resortLayer) map.removeLayer(window.resortLayer);
    window.resortLayer = L.layerGroup(
      resorts.map(r => {
        const marker = L.circleMarker([r.lat, r.lon], {
          radius: 4,
          color: "#0ea5e9",
          fillColor: "#0ea5e9",
          fillOpacity: 0.9,
          weight: 1,
        });
        marker.bindTooltip(`<strong>${r.name}</strong><br>${r.state}`);
        return marker;
      })
    ).addTo(map);
  }

  const yearSlider = document.getElementById("yearSlider");
  const yearLabel = document.getElementById("yearLabel");
  yearSlider.addEventListener("input", () => {
    const year = +yearSlider.value;
    yearLabel.textContent = year;
    updateMap(year);
  });

  updateMap(2025);
});