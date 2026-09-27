import { describe, expect, it } from "vitest";
import { BayesianDin } from "../src/engine/bayes";
import { Staircase } from "../src/engine/staircase";
import { pCorrect } from "../src/engine/psychometric";
import { mulberry32 } from "../src/engine/rng";
import { DEFAULT_SIM, METHODS, runOnce, simulate } from "../src/engine/simulate";
import { DIGITS, makeTriplet, parseResponse, scoreTriplet } from "../src/engine/triplets";
import { headphonePassed, makeHeadphoneTrial } from "../src/engine/headphones";

describe("psychometric function", () => {
  it("is 50% of (1 - lapse) at the SRT and monotonic", () => {
    expect(pCorrect(-6, -6, 0.7, 0)).toBeCloseTo(0.5);
    expect(pCorrect(-10, -6)).toBeLessThan(pCorrect(-6, -6));
    expect(pCorrect(10, -6, 0.7, 0.03)).toBeLessThanOrEqual(0.97);
  });
});

describe("triplets", () => {
  it("uses three distinct digits from the set and never 7", () => {
    const rng = mulberry32(1);
    for (let i = 0; i < 500; i++) {
      const t = makeTriplet(rng);
      expect(new Set(t).size).toBe(3);
      for (const d of t) expect(DIGITS).toContain(d);
      expect(t).not.toContain(7);
    }
  });
  it("scores whole-triplet correctness in order", () => {
    expect(scoreTriplet([1, 2, 3], "123")).toEqual({ correct: true, digitsCorrect: 3 });
    expect(scoreTriplet([1, 2, 3], "1 2 4")).toEqual({ correct: false, digitsCorrect: 2 });
    expect(scoreTriplet([1, 2, 3], "321").correct).toBe(false);
    expect(scoreTriplet([1, 2, 3], "1234").correct).toBe(false);
    expect(parseResponse("a1-2 3")).toEqual([1, 2, 3]);
  });
});

describe("staircase", () => {
  it("moves down 2 dB after a correct triplet and up after a miss", () => {
    const s = new Staircase();
    expect(s.nextSnr()).toBe(0);
    s.update({ snr: 0, correct: true });
    expect(s.nextSnr()).toBe(-2);
    s.update({ snr: -2, correct: false });
    expect(s.nextSnr()).toBe(0);
  });
  it("runs exactly 24 trials", () => {
    const e = runOnce(METHODS.staircase, -8, 0.7, 0.02, mulberry32(3));
    expect(e.trials).toBe(24);
  });
});

describe("Bayesian procedure", () => {
  it("starts with a broad belief and narrows after informative answers", () => {
    const b = new BayesianDin();
    const sd0 = b.estimate().sd;
    const rng = mulberry32(5);
    for (let i = 0; i < 10; i++) {
      const snr = b.nextSnr();
      b.update({ snr, correct: rng() < pCorrect(snr, -9) });
    }
    expect(b.estimate().sd).toBeLessThan(sd0 / 2);
    const total = b.marginal().reduce((a, m) => a + m.p, 0);
    expect(total).toBeCloseTo(1, 6);
  });
  it("places trials near the current belief, not at the extremes", () => {
    const b = new BayesianDin();
    const first = b.nextSnr();
    expect(first).toBeGreaterThan(-16);
    expect(first).toBeLessThan(0);
  });
  it("moves its estimate toward the listener", () => {
    const good = runOnce(METHODS.bayesian, -12, 0.7, 0.02, mulberry32(11));
    const poor = runOnce(METHODS.bayesian, 0, 0.7, 0.02, mulberry32(11));
    expect(good.srt).toBeLessThan(-9);
    expect(poor.srt).toBeGreaterThan(-3);
  });
  it("respects min/max trial limits", () => {
    const e = runOnce(METHODS.bayesian, -6, 0.7, 0.02, mulberry32(2));
    expect(e.trials).toBeGreaterThanOrEqual(10);
    expect(e.trials).toBeLessThanOrEqual(24);
  });
});

describe("simulation study (the headline claims)", () => {
  const cfg = { ...DEFAULT_SIM, listeners: 200 };
  const s24 = simulate(METHODS.staircase, cfg);
  const s12 = simulate(METHODS.staircase12, cfg);
  const b = simulate(METHODS.bayesian, cfg);

  it("is deterministic for a given seed", () => {
    expect(simulate(METHODS.bayesian, { ...cfg, listeners: 30 }).rmse).toBe(simulate(METHODS.bayesian, { ...cfg, listeners: 30 }).rmse);
  });
  it("beats a staircase of the same length on error", () => {
    expect(b.meanTrials).toBeLessThan(14);
    expect(b.rmse).toBeLessThan(s12.rmse * 0.8);
  });
  it("uses roughly half the trials of the classic 24-trial track", () => {
    expect(b.meanTrials).toBeLessThan(s24.meanTrials * 0.6);
  });
  it("reports 90% intervals that are approximately calibrated", () => {
    expect(b.coverage90).toBeGreaterThan(0.85);
    expect(b.coverage90).toBeGreaterThan(s24.coverage90);
  });
});

describe("headphone check", () => {
  it("never makes the quiet tone the antiphase tone", () => {
    const rng = mulberry32(9);
    for (let i = 0; i < 200; i++) {
      const t = makeHeadphoneTrial(rng);
      expect(t.quiet).not.toBe(t.antiphase);
      expect([0, 1, 2]).toContain(t.quiet);
      expect([0, 1, 2]).toContain(t.antiphase);
    }
  });
  it("passes at 5 of 6", () => {
    expect(headphonePassed(5)).toBe(true);
    expect(headphonePassed(4)).toBe(false);
  });
});
