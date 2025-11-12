// USA Precipitation Change Heatmap (Canvas grid + SVG resorts + interactive year slider)
const W = 980, H = 560;

// Main containers
const mapDiv = d3.select("#map");
const canvas = mapDiv.append("canvas")
  .attr("width", W)
  .attr("height", H)
  .style("display", "block");
const ctx = canvas.node().getContext("2d");

const svg = mapDiv.append("svg").attr("width", W).attr("height", H);
const g = svg.append("g");

// Projection and path
const proj = d3.geoAlbersUsa()
  .translate([W * 0.55, H * 0.5])
  .scale(W * 1.3);
const path = d3.geoPath(proj);

// Color scale (blue = wetter, red = drier)
const color = d3.scaleDiverging(d3.interpolateRdBu).domain([40, 0, -40]);

// Tooltip
const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

// Slider logic
const yearInput = document.getElementById("year");
const yearLabel = document.getElementById("yearLabel");
yearInput.addEventListener("input", () => {
  yearLabel.textContent = yearInput.value;
  draw(+yearInput.value);
});

Promise.all([
  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),
  d3.csv("data/us_pr_change_by_year.csv", d3.autoType),
  d3.csv("data/resorts.csv", d3.autoType)
]).then(([us, grid, resorts]) => {
  const states = topojson.feature(us, us.objects.states);
  g.selectAll("path")
    .data(states.features)
    .join("path")
    .attr("d", path)
    .attr("fill", "none")
    .attr("stroke", "#94a3b8")
    .attr("stroke-width", 0.6);

  // Group data by year
  const byYear = d3.group(grid, d => d.year);

  // Determine grid resolution dynamically
  const lonValues = Array.from(new Set(grid.map(d => d.lon))).sort((a, b) => a - b);
  const latValues = Array.from(new Set(grid.map(d => d.lat))).sort((a, b) => a - b);
  const lonStep = lonValues[1] - lonValues[0];
  const latStep = latValues[1] - latValues[0];

  // Slider bounds
  const years = d3.extent(grid, d => d.year);
  yearInput.min = years[0];
  yearInput.max = years[1];
  yearInput.value = 2025;
  yearLabel.textContent = 2025;

  // Resort markers
  g.selectAll(".resort")
    .data(resorts)
    .join("circle")
    .attr("class", "resort")
    .attr("r", 3.3)
    .attr("fill", "#0ea5e9")
    .attr("stroke", "#fff")
    .attr("stroke-width", 0.7)
    .attr("transform", d => {
      const p = proj([d.lon, d.lat]);
      return p ? `translate(${p[0]},${p[1]})` : null;
    })
    .on("mouseover", (event, d) => {
      tooltip.style("opacity", 1)
        .style("left", (event.pageX + 10) + "px")
        .style("top", (event.pageY - 20) + "px")
        .html(`<strong>${d.name}</strong> (${d.state})<br/><span id="val">loading…</span>`);

      // Find nearest grid value for tooltip
      const yr = +yearInput.value;
      const arr = byYear.get(yr) || [];
      let best = null, bestDist = Infinity;
      const p = proj([d.lon, d.lat]);
      if (p && arr.length) {
        for (const r of arr) {
          const q = proj([r.lon, r.lat]);
          if (!q) continue;
          const dist = (q[0] - p[0]) ** 2 + (q[1] - p[1]) ** 2;
          if (dist < bestDist) { bestDist = dist; best = r; }
        }
      }
      tooltip.select("#val").text(best ? `${d3.format(".1f")(best.pct_change)}%` : "n/a");
    })
    .on("mouseout", () => tooltip.style("opacity", 0));

  // Draw heatmap for year
  function draw(year) {
    const arr = byYear.get(year);
    if (!arr) return;
    ctx.clearRect(0, 0, W, H);

    const cellSize = 6; // adjust for visual density

    for (const d of arr) {
      const p = proj([d.lon, d.lat]);
      if (!p) continue;
      ctx.fillStyle = color(d.pct_change);
      ctx.fillRect(p[0] - cellSize / 2, p[1] - cellSize / 2, cellSize, cellSize);
    }
  }

  drawLegend();
  draw(+yearInput.value);
});

// ---------- Legend ----------
function drawLegend() {
  const w = 340, h = 46;
  const svgL = d3.select("#legend").append("svg").attr("width", w).attr("height", h);
  const grad = svgL.append("defs").append("linearGradient")
    .attr("id", "grad").attr("x1", "0%").attr("x2", "100%");
  const stops = d3.range(0, 1.001, 0.05).map(t => ({t, c: d3.interpolateRdBu(1 - t)}));
  grad.selectAll("stop").data(stops).join("stop")
    .attr("offset", d => `${d.t * 100}%`)
    .attr("stop-color", d => d.c);
  svgL.append("rect").attr("x", 20).attr("y", 12)
    .attr("width", w - 40).attr("height", 12)
    .attr("fill", "url(#grad)");
  const scale = d3.scaleLinear().domain([-40, 40]).range([20, w - 20]);
  const axis = d3.axisBottom(scale).ticks(6).tickFormat(d => `${d}%`);
  svgL.append("g").attr("transform", `translate(0, 24)`).call(axis);
}