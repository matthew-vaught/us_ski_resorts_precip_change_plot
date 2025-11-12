// USA precipitation change explorer (smooth contour heatmap + resort markers)
const W = 980, H = 560;
const svg = d3.select("#map").append("svg").attr("width", W).attr("height", H);
const g = svg.append("g");

// Albers projection centered for CONUS
const proj = d3.geoAlbersUsa()
  .translate([W * 0.55, H * 0.5])
  .scale(W * 1.3);
const path = d3.geoPath(proj);

// Red–blue diverging color scale (blue = wetter, red = drier)
const color = d3.scaleDiverging(d3.interpolateRdBu)
  .domain([-40, 0, 40])
  .clamp(true);

// Tooltip for resorts
const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

// Year slider
const yearInput = document.getElementById("year");
const yearLabel = document.getElementById("yearLabel");
yearInput.addEventListener("input", () => {
  yearLabel.textContent = yearInput.value;
  update(+yearInput.value);
});

// ---------- Load data ----------
Promise.all([
  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
  d3.csv("data/us_pr_change_by_year.csv").then(raw =>
    raw.map(d => ({
      year: +d.year,
      lat: +d.lat,
      lon: +d.lon,
      pct_change: +d.pct_change
    }))
  ),
  d3.csv("data/resorts.csv", d3.autoType)
]).then(([us, grid, resorts]) => {
  const states = topojson.feature(us, us.objects.states);
  g.selectAll("path").data(states.features)
    .join("path")
    .attr("d", path)
    .attr("fill", "#f8fafc")
    .attr("stroke", "#94a3b8")
    .attr("stroke-width", 0.6);

  // Slider bounds from data
  const years = d3.extent(grid, d => d.year);
  yearInput.min = years[0];
  yearInput.max = years[1];
  yearInput.step = 1;
  yearInput.value = 2025;
  yearLabel.textContent = yearInput.value;

  // Group data by year
  const byYear = d3.group(grid, d => d.year);

  // Resort markers
  g.selectAll(".resort").data(resorts).join("circle")
    .attr("class", "resort")
    .attr("r", 3.3)
    .attr("fill", "#0ea5e9")
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.7)
    .attr("transform", d => {
      const p = proj([+d.lon, +d.lat]);
      return p ? `translate(${p[0]},${p[1]})` : null;
    })
    .on("mouseover", (event, d) => {
      tooltip.style("opacity", 1)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 20) + "px")
        .html(`<strong>${d.name}</strong> (${d.state})`);
    })
    .on("mouseout", () => tooltip.style("opacity", 0));

  // Contour layer group
  const contourLayer = g.append("g").attr("class", "contourLayer");

  // Function to draw/update heatmap
  function update(year) {
    const arr = byYear.get(year);
    if (!arr) return;

    // Project to pixel coords
    const points = arr.map(d => {
      const p = proj([d.lon, d.lat]);
      return p ? [p[0], p[1], d.pct_change] : null;
    }).filter(Boolean);

    // Build smooth contours
    const contours = d3.contourDensity()
      .x(d => d[0])
      .y(d => d[1])
      .weight(d => Math.abs(d[2]) + 0.01)
      .size([W, H])
      .bandwidth(35)   // higher = smoother
      (points);

    const maxChange = d3.max(points, d => Math.abs(d[2])) || 40;

    // Animate between frames with morph
    const paths = contourLayer.selectAll("path")
      .data(contours, d => d.value);

    paths.join(
      enter => enter.append("path")
        .attr("d", d3.geoPath())
        .attr("fill", d => color(d.value * 40 / maxChange))
        .attr("opacity", 0)
        .transition().duration(800)
        .attr("opacity", 0.9),
      update => update.transition().duration(800)
        .attr("d", d3.geoPath())
        .attr("fill", d => color(d.value * 40 / maxChange)),
      exit => exit.transition().duration(500)
        .attr("opacity", 0)
        .remove()
    );
  }

  drawLegend();
  update(+yearInput.value);
});

// ---------- Legend ----------
function drawLegend() {
  const w = 340, h = 46;
  const svgL = d3.select("#legend").append("svg").attr("width", w).attr("height", h);
  const grad = svgL.append("defs").append("linearGradient")
    .attr("id", "grad").attr("x1", "0%").attr("x2", "100%");
  const stops = d3.range(0, 1.001, 0.05).map(t => ({ t, c: d3.interpolateRdBu(t) }));
  grad.selectAll("stop").data(stops).join("stop")
    .attr("offset", d => `${d.t * 100}%`).attr("stop-color", d => d.c);
  svgL.append("rect").attr("x", 20).attr("y", 12)
    .attr("width", w - 40).attr("height", 12).attr("fill", "url(#grad)");
  const scale = d3.scaleLinear().domain([-40, 40]).range([20, w - 20]);
  const axis = d3.axisBottom(scale).ticks(6).tickFormat(d => `${d}%`);
  svgL.append("g").attr("transform", `translate(0, 24)`).call(axis);
}