import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { dbToGain, fft, rms } from "../src/dsp/fft";
import { normalizeRms, speechShapedNoise, trimSilence } from "../src/dsp/stimuli";
import { mixTriplet } from "../src/audio/mix";
import { lossAt, PROFILES } from "../src/audio/hearloss";

function readWav(path: string): Float32Array {
  const b = readFileSync(path);
  const n = b.readUInt32LE(40) / 2;
  const out = new Float32Array(n);
  for (let i = 0; i < n; i++) out[i] = b.readInt16LE(44 + i * 2) / 32768;
  return out;
}

describe("FFT", () => {
  it("round-trips", () => {
    const re = Float64Array.from({ length: 64 }, (_, i) => Math.sin(i) + 0.3 * i);
    const orig = re.slice();
    const im = new Float64Array(64);
    fft(re, im);
    fft(re, im, true);
    re.forEach((v, i) => expect(v).toBeCloseTo(orig[i], 9));
  });
  it("puts a pure tone in the right bin", () => {
    const n = 256;
    const re = Float64Array.from({ length: n }, (_, i) => Math.cos((2 * Math.PI * 10 * i) / n));
    const im = new Float64Array(n);
    fft(re, im);
    const mags = [...re].map((r, i) => Math.hypot(r, im[i]));
    expect(mags.indexOf(Math.max(...mags.slice(0, n / 2)))).toBe(10);
  });
  it("rejects non power-of-two lengths", () => {
    expect(() => fft(new Float64Array(3), new Float64Array(3))).toThrow();
  });
});

describe("stimulus processing", () => {
  it("trims silence and normalizes RMS", () => {
    const x = new Float32Array(1000);
    for (let i = 400; i < 600; i++) x[i] = Math.sin(i);
    const t = trimSilence(x, 1000, -40, 0);
    expect(t.length).toBeLessThan(220);
    expect(rms(normalizeRms(t, 0.1))).toBeCloseTo(0.1, 5);
  });
  it("makes noise with the speech's spectral tilt", () => {
    const low = Float32Array.from({ length: 1024 }, (_, i) => Math.sin((2 * Math.PI * 20 * i) / 1024));
    const noise = speechShapedNoise([low], 4096, 1);
    expect(noise.length).toBe(4096);
    expect(rms(noise)).toBeCloseTo(0.1, 4);
    const re = Float64Array.from(noise);
    const im = new Float64Array(4096);
    fft(re, im);
    const band = (a: number, b: number) => {
      let s = 0;
      for (let k = a; k < b; k++) s += re[k] ** 2 + im[k] ** 2;
      return s;
    };
    expect(band(60, 100)).toBeGreaterThan(band(1000, 1040) * 100);
  });
});

describe("shipped stimuli", () => {
  it("are RMS-equalized digits and matching noise", () => {
    for (const d of [0, 1, 2, 3, 4, 5, 6, 8, 9]) {
      const x = readWav(`public/stimuli/digit-${d}.wav`);
      expect(x.length / 24000).toBeGreaterThan(0.2);
      expect(x.length / 24000).toBeLessThan(1);
      expect(rms(x)).toBeCloseTo(0.1, 2);
    }
    expect(rms(readWav("public/stimuli/noise.wav"))).toBeCloseTo(0.1, 2);
  });
});

describe("triplet mixing", () => {
  const tok = Float32Array.from({ length: 200 }, (_, i) => 0.1 * Math.sin(i / 3) * Math.SQRT2);
  const noise = Float32Array.from({ length: 997 }, (_, i) => 0.1 * Math.sin(i * 1.7) * Math.SQRT2);
  it("sets the requested SNR", () => {
    for (const snr of [-10, 0, 6]) {
      const m = mixTriplet([tok, tok, tok], new Float32Array(997), { sampleRate: 1000, snr, antiphasic: false, noiseGain: 0.1 });
      const seg = m.left.slice(Math.round(m.onsets[0] * 1000), Math.round(m.onsets[0] * 1000) + 200);
      expect(20 * Math.log10(rms(seg) / (0.1 * 0.1))).toBeCloseTo(snr, 1);
    }
  });
  it("inverts speech but not noise in the right ear when antiphasic", () => {
    const m = mixTriplet([tok, tok, tok], noise, { sampleRate: 1000, snr: 0, antiphasic: true, noiseGain: 0.1 });
    for (let i = 0; i < 400; i++) expect(m.left[i]).toBeCloseTo(m.right[i], 6);
    const on = Math.round(m.onsets[1] * 1000) + 50;
    const sum = m.left[on] + m.right[on];
    const nz = noise[on % noise.length] * 0.1;
    expect(sum).toBeCloseTo(2 * nz, 5);
  });
  it("never clips", () => {
    const loud = tok.map((v) => v * 30);
    const m = mixTriplet([loud, loud, loud], noise, { sampleRate: 1000, snr: 10, antiphasic: true });
    expect(Math.max(...m.left.map(Math.abs))).toBeLessThanOrEqual(0.95 + 1e-6);
  });
});

describe("hear-through profiles", () => {
  it("interpolate in log-frequency and slope downward", () => {
    const p = PROFILES.find((x) => x.id === "mild-hf")!;
    expect(lossAt(p, 250)).toBe(0);
    expect(lossAt(p, 8000)).toBe(45);
    expect(lossAt(p, Math.sqrt(2000 * 4000))).toBeCloseTo(27.5);
    expect(dbToGain(-20)).toBeCloseTo(0.1);
  });
});
