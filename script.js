// USA precipitation change explorer (canvas heatmap + resort markers)
const W = 980, H = 560;

const svg = d3.select("#map").append("svg").attr("width", W).attr("height", H);
const g = svg.append("g");

// Albers USA projection (good for CONUS)
const proj = d3.geoAlbersUsa()
  .translate([W * 0.55, H * 0.5])   // shift center slightly right
  .scale(W * 1.3);                  // scale relative to canvas width
const path = d3.geoPath(proj);

// Canvas for the heat layer
const canvas = d3.select("#map").append("canvas")
  .attr("width", W)
  .attr("height", H)
  .style("position", "absolute")
  .style("left", "0px")
  .style("top", "0px")
  .style("pointer-events", "none");
const ctx = canvas.node().getContext("2d");

// Tooltip
const tooltip = d3.select("body").append("div")
  .attr("class", "tooltip")
  .style("opacity", 0);

// Diverging colors around 0% (brown=drier, green=wetter)
const color = d3.scaleDiverging(d3.interpolateBrBG)
  .domain([50, 0, -50]) // 50% wetter -> green, -50% drier -> brown
  .clamp(true);

// Year slider elements
const yearInput = document.getElementById("year");
const yearLabel = document.getElementById("yearLabel");
yearInput.addEventListener("input", () => {
  yearLabel.textContent = yearInput.value;
  draw(+yearInput.value);
});

// ---------- Load data ----------
Promise.all([
  d3.json("https://cdn.jsdelivr.net/npm/us-atlas@3/states-10m.json"),

  // Convert numeric fields properly
  d3.csv("data/us_pr_change_by_year.csv").then(raw =>
    raw.map(d => ({
      year: +d.year,
      lat: +d.lat,
      lon: +d.lon,
      pct_change: +d.pct_change
    }))
  ),

  // Resort data: name, state, lat, lon
  d3.csv("data/resorts.csv", d3.autoType)
]).then(([us, grid, resorts]) => {
  const states = topojson.feature(us, us.objects.states);

  // Slider bounds from data
  const years = d3.extent(grid, d => d.year);
  yearInput.min = years[0];
  yearInput.max = years[1];
  yearInput.step = 1;
  yearInput.value = Math.min(2085, years[1]);
  yearLabel.textContent = yearInput.value;

  // Draw state boundaries
  g.selectAll("path").data(states.features).join("path")
    .attr("d", path)
    .attr("fill", "#f8fafc")
    .attr("stroke", "#94a3b8")
    .attr("stroke-width", 0.6);

  // Group grid by year for fast redraws
  const byYear = d3.group(grid, d => d.year);

  // Resort markers (SVG)
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
        .html(`<strong>${d.name}</strong> (${d.state})<br/><span id="val">loading…</span>`);

      const yr = +yearInput.value;
      const arr = byYear.get(yr) || [];
      const p = proj([+d.lon, +d.lat]);
      if (p && arr.length) {
        let best = null, bestD = Infinity;
        for (const row of arr) {
          const q = proj([+row.lon, +row.lat]);
          if (!q) continue;
          const dd = (q[0]-p[0])**2 + (q[1]-p[1])**2;
          if (dd < bestD) { bestD = dd; best = row; }
        }
        tooltip.select("#val").text(best ? `${d3.format(".1f")(best.pct_change)}%` : "n/a");
      } else {
        tooltip.select("#val").text("n/a");
      }
    })
    .on("mouseout", () => tooltip.style("opacity", 0));

  // Draw the precipitation heatmap for a given year
  function draw(year) {
    ctx.clearRect(0, 0, W, H);
    const arr = byYear.get(year) || [];
    const r = 2.0;
    for (const d of arr) {
      const p = proj([+d.lon, +d.lat]);
      if (!p) continue;
      ctx.fillStyle = color(+d.pct_change);
      ctx.fillRect(p[0] - r/2, p[1] - r/2, r, r);
    }
  }

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
  const stops = d3.range(0, 1.001, 0.05).map(t => ({t, c: d3.interpolateBrBG(1 - t)})); // flipped
  grad.selectAll("stop").data(stops).join("stop")
    .attr("offset", d => `${d.t * 100}%`)
    .attr("stop-color", d => d.c);
  svgL.append("rect")
    .attr("x", 20).attr("y", 12).attr("width", w - 40).attr("height", 12)
    .attr("fill", "url(#grad)");
  const scale = d3.scaleLinear().domain([-50, 50]).range([20, w - 20]);
  const axis = d3.axisBottom(scale).ticks(6).tickFormat(d => `${d}%`);
  svgL.append("g").attr("transform", "translate(0, 24)").call(axis);
}