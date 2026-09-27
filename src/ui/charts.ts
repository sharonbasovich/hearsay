import type { Comparison } from "../engine/family";
import type { Trial } from "../engine/types";

const W = 560;

function esc(s: string): string {
  return s.replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!);
}

export function posteriorChart(marginal: { srt: number; p: number }[], est?: { lo90: number; hi90: number; srt: number }): string {
  const H = 150;
  const xMin = marginal[0].srt;
  const xMax = marginal[marginal.length - 1].srt;
  const pMax = Math.max(...marginal.map((m) => m.p), 1e-9);
  const x = (v: number) => 30 + ((v - xMin) / (xMax - xMin)) * (W - 50);
  const y = (p: number) => H - 25 - (p / pMax) * (H - 45);
  const path = marginal.map((m, i) => `${i ? "L" : "M"}${x(m.srt).toFixed(1)},${y(m.p).toFixed(1)}`).join("");
  const area = `${path}L${x(xMax)},${H - 25}L${x(xMin)},${H - 25}Z`;
  const ticks = [];
  for (let t = Math.ceil(xMin / 5) * 5; t <= xMax; t += 5)
    ticks.push(`<line x1="${x(t)}" x2="${x(t)}" y1="${H - 25}" y2="${H - 20}" class="axis"/><text x="${x(t)}" y="${H - 6}" class="tick">${t}</text>`);
  const band = est
    ? `<rect x="${x(est.lo90)}" y="10" width="${Math.max(2, x(est.hi90) - x(est.lo90))}" height="${H - 35}" class="band"/><line x1="${x(est.srt)}" x2="${x(est.srt)}" y1="10" y2="${H - 25}" class="mean"/>`
    : "";
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Belief about your speech reception threshold">
    ${band}<path d="${area}" class="area"/><path d="${path}" class="line"/>
    <line x1="30" x2="${W - 20}" y1="${H - 25}" y2="${H - 25}" class="axis"/>${ticks.join("")}
    <text x="${W - 20}" y="${H - 30}" class="tick" text-anchor="end">SNR (dB) →</text>
  </svg>`;
}

export function trackChart(trials: Trial[]): string {
  const H = 130;
  const n = Math.max(12, trials.length);
  const yMin = -22;
  const yMax = 10;
  const x = (i: number) => 44 + (i / (n - 1 || 1)) * (W - 64);
  const y = (v: number) => 10 + ((yMax - v) / (yMax - yMin)) * (H - 35);
  const pts = trials.map((t, i) => `<circle cx="${x(i)}" cy="${y(t.snr)}" r="5" class="${t.correct ? "ok" : "miss"}"><title>Trial ${i + 1}: ${t.snr} dB, ${t.correct ? "correct" : "missed"}</title></circle>`);
  const line = trials.map((t, i) => `${i ? "L" : "M"}${x(i)},${y(t.snr)}`).join("");
  const grid = [-20, -10, 0, 10].map((v) => `<line x1="36" x2="${W - 20}" y1="${y(v)}" y2="${y(v)}" class="grid"/><text x="30" y="${y(v) + 4}" class="tick" text-anchor="end">${v}</text>`);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Trial-by-trial SNR track">${grid.join("")}<path d="${line}" class="track"/>${pts.join("")}
  <text x="${W - 20}" y="${H - 6}" class="tick" text-anchor="end">trial →</text></svg>`;
}

export function familyChart(rows: Comparison[]): string {
  if (!rows.length) return "";
  const rowH = 40;
  const H = rows.length * rowH + 62;
  const all = rows.flatMap((r) => [r.member.estimate.lo90, r.member.estimate.hi90]);
  const xMin = Math.floor(Math.min(...all, -14) / 2) * 2;
  const xMax = Math.ceil(Math.max(...all, 0) / 2) * 2;
  const L = 190;
  const x = (v: number) => L + ((v - xMin) / (xMax - xMin)) * (W - L - 20);
  const ticks = [];
  for (let t = xMin; t <= xMax; t += 2) ticks.push(`<line x1="${x(t)}" x2="${x(t)}" y1="10" y2="${H - 48}" class="grid"/><text x="${x(t)}" y="${H - 32}" class="tick">${t}</text>`);
  const items = rows.map((r, i) => {
    const cy = 14 + i * rowH + rowH / 2;
    const e = r.member.estimate;
    return `<text x="${L - 12}" y="${cy + 4}" class="label" text-anchor="end">${esc(r.member.name)}</text>
      <line x1="${x(e.lo90)}" x2="${x(e.hi90)}" y1="${cy}" y2="${cy}" class="ci ${r.verdict}"/>
      <circle cx="${x(e.srt)}" cy="${cy}" r="7" class="dot ${r.verdict}"><title>${e.srt.toFixed(1)} dB (90% interval ${e.lo90.toFixed(1)} to ${e.hi90.toFixed(1)})</title></circle>`;
  });
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Family comparison">${ticks.join("")}${items.join("")}
    <text x="${(L + W - 20) / 2}" y="${H - 10}" class="tick">← copes better in noise · threshold (dB SNR) · needs clearer speech →</text></svg>`;
}

export function histogram(values: number[], lo: number, hi: number, bins: number, cls: string): string {
  const H = 110;
  const counts = new Array(bins).fill(0);
  for (const v of values) counts[Math.max(0, Math.min(bins - 1, Math.floor(((v - lo) / (hi - lo)) * bins)))]++;
  const max = Math.max(...counts, 1);
  const bw = (W - 50) / bins;
  const bars = counts.map((c, i) => `<rect x="${30 + i * bw + 1}" y="${H - 25 - (c / max) * (H - 35)}" width="${bw - 2}" height="${(c / max) * (H - 35)}" class="${cls}"/>`);
  const ticks = [lo, (lo + hi) / 2, hi].map((t) => `<text x="${30 + ((t - lo) / (hi - lo)) * (W - 50)}" y="${H - 8}" class="tick">${t}</text>`);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart small">${bars.join("")}<line x1="30" x2="${W - 20}" y1="${H - 25}" y2="${H - 25}" class="axis"/>${ticks.join("")}</svg>`;
}

export function profileChart(loss: number[], freqs: readonly number[]): string {
  const H = 150;
  const x = (i: number) => 50 + (i / (freqs.length - 1)) * (W - 80);
  const y = (db: number) => 15 + (db / 80) * (H - 45);
  const path = loss.map((l, i) => `${i ? "L" : "M"}${x(i)},${y(l)}`).join("");
  const grid = [0, 20, 40, 60, 80].map((d) => `<line x1="50" x2="${W - 30}" y1="${y(d)}" y2="${y(d)}" class="grid"/><text x="44" y="${y(d) + 4}" class="tick" text-anchor="end">${d ? -d : 0}</text>`);
  const fl = freqs.map((f, i) => `<text x="${x(i)}" y="${H - 8}" class="tick">${f >= 1000 ? f / 1000 + "k" : f}</text>`);
  const pts = loss.map((l, i) => `<circle cx="${x(i)}" cy="${y(l)}" r="5" class="dot harder"/>`);
  return `<svg viewBox="0 0 ${W} ${H}" class="chart" role="img" aria-label="Illustrative attenuation by frequency">${grid.join("")}${fl.join("")}<path d="${path}" class="line"/>${pts.join("")}
    <text x="${W - 30}" y="${H - 22}" class="tick" text-anchor="end">Hz</text><text x="4" y="${H - 22}" class="tick" text-anchor="start">dB</text></svg>`;
}

export { esc };
