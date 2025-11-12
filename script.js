// USA precipitation change explorer (gridded heatmap + resort markers)
const W = 980, H = 560;
const svg = d3.select("#map").append("svg").attr("width", W).attr("height", H);
const g = svg.append("g");

// Projection
const proj = d3.geoAlbersUsa()
  .translate([W * 0.55, H * 0.5])
  .scale(W * 1.3);
const path = d3.geoPath(proj);

// Diverging red–blue color scale
const color = d3.scaleDiverging(d3.interpolateRdBu).domain([-40, 0, 40]).clamp(true);

// Tooltip
const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

// Year slider
const yearInput = document.getElementById("year");
const yearLabel = document.getElementById("yearLabel");
yearInput.addEventListener("input", () => {
  yearLabel.textContent = yearInput.value;
  draw(+yearInput.value);
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
  g.append("path")
    .datum(states)
    .attr("fill", "none")
    .attr("stroke", "#94a3b8")
    .attr("stroke-width", 0.6)
    .attr("d", path);

  const years = d3.extent(grid, d => d.year);
  yearInput.min = years[0];
  yearInput.max = years[1];
  yearInput.step = 1;
  yearInput.value = 2025;
  yearLabel.textContent = yearInput.value;

  // Group data by year for fast access
  const byYear = d3.group(grid, d => d.year);

  // Estimate grid cell size (lon/lat resolution)
  const lonStep = d3.median(d3.pairs(d3.sort(Array.from(new Set(grid.map(d => d.lon))))).map(p => p[1]-p[0]));
  const latStep = d3.median(d3.pairs(d3.sort(Array.from(new Set(grid.map(d => d.lat))))).map(p => p[1]-p[0]));

  // Group of heatmap tiles
  const heatLayer = g.append("g").attr("class", "heatLayer");

  function draw(year) {
    const arr = byYear.get(year);
    if (!arr) return;

    const rects = heatLayer.selectAll("path").data(arr, d => `${d.lat},${d.lon}`);

    rects.join(
      enter => enter.append("path")
        .attr("d", d => {
          const coords = [
            [d.lon - lonStep/2, d.lat - latStep/2],
            [d.lon + lonStep/2, d.lat - latStep/2],
            [d.lon + lonStep/2, d.lat + latStep/2],
            [d.lon - lonStep/2, d.lat + latStep/2],
            [d.lon - lonStep/2, d.lat - latStep/2]
          ];
          return path({type: "Polygon", coordinates: [coords]});
        })
        .attr("fill", d => color(d.pct_change))
        .attr("opacity", 0.9),
      update => update.transition().duration(500)
        .attr("fill", d => color(d.pct_change)),
      exit => exit.remove()
    );
  }

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

  // Legend
  drawLegend();

  // Initial draw
  draw(+yearInput.value);
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