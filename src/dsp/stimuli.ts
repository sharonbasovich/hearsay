import { fft, nextPow2, rms } from "./fft";
import { gaussian, mulberry32 } from "../engine/rng";

export const TARGET_RMS = 0.1;

export function trimSilence(x: Float32Array, sampleRate: number, thresholdDb = -40, padMs = 15): Float32Array {
  let peak = 0;
  for (let i = 0; i < x.length; i++) peak = Math.max(peak, Math.abs(x[i]));
  if (peak === 0) return x.slice(0, 0);
  const thr = peak * Math.pow(10, thresholdDb / 20);
  let start = 0;
  while (start < x.length && Math.abs(x[start]) < thr) start++;
  let end = x.length - 1;
  while (end > start && Math.abs(x[end]) < thr) end--;
  const pad = Math.round((padMs / 1000) * sampleRate);
  return x.slice(Math.max(0, start - pad), Math.min(x.length, end + pad + 1));
}

export function normalizeRms(x: Float32Array, target = TARGET_RMS): Float32Array {
  const r = rms(x);
  if (r === 0) return x.slice();
  const g = target / r;
  const out = new Float32Array(x.length);
  for (let i = 0; i < x.length; i++) out[i] = x[i] * g;
  return out;
}

export function averagePowerSpectrum(signals: Float32Array[], n: number): Float64Array {
  const power = new Float64Array(n);
  for (const s of signals) {
    const re = new Float64Array(n);
    const im = new Float64Array(n);
    for (let i = 0; i < Math.min(n, s.length); i++) re[i] = s[i];
    fft(re, im);
    for (let k = 0; k < n; k++) power[k] += re[k] * re[k] + im[k] * im[k];
  }
  for (let k = 0; k < n; k++) power[k] /= Math.max(1, signals.length);
  return power;
}

/** Stationary noise whose long-term spectrum matches the speech tokens; circular so it loops seamlessly. */
export function speechShapedNoise(signals: Float32Array[], length: number, seed: number, target = TARGET_RMS): Float32Array {
  const n = nextPow2(length);
  const specN = nextPow2(Math.max(...signals.map((s) => s.length)));
  const p = averagePowerSpectrum(signals, specN);
  const rng = mulberry32(seed);
  const re = new Float64Array(n);
  const im = new Float64Array(n);
  for (let k = 0; k <= n / 2; k++) {
    const src = Math.min(specN - 1, Math.round((k / n) * specN));
    const mag = Math.sqrt(p[src]);
    const a = gaussian(rng);
    const b = gaussian(rng);
    re[k] = mag * a;
    im[k] = k === 0 || k === n / 2 ? 0 : mag * b;
    if (k > 0 && k < n / 2) {
      re[n - k] = re[k];
      im[n - k] = -im[k];
    }
  }
  fft(re, im, true);
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = re[i];
  return normalizeRms(out, target);
}
