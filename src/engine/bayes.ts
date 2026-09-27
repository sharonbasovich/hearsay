import { DEFAULT_LAPSE, pCorrect } from "./psychometric";
import type { AdaptiveProcedure, Estimate, Trial } from "./types";

export interface BayesOptions {
  srtMin?: number;
  srtMax?: number;
  srtStep?: number;
  slopes?: number[];
  priorMean?: number;
  priorSd?: number;
  lapse?: number;
  candidates?: number[];
  minTrials?: number;
  maxTrials?: number;
  targetSd?: number;
}

function range(a: number, b: number, step: number): number[] {
  const out: number[] = [];
  for (let x = a; x <= b + 1e-9; x += step) out.push(Math.round(x * 1000) / 1000);
  return out;
}

/**
 * Grid-based Bayesian adaptive procedure (in the spirit of QUEST+/psi).
 * Joint posterior over SRT and psychometric slope; each trial is placed at the SNR that
 * minimizes the expected posterior entropy of the SRT, and the run stops once the
 * SRT posterior is tight enough.
 */
export class BayesianDin implements AdaptiveProcedure {
  readonly name = "Hearsay Bayesian";
  readonly srts: number[];
  readonly slopes: number[];
  readonly candidates: number[];
  private post: Float64Array;
  private readonly o: Required<BayesOptions>;
  private readonly lik: Float64Array[];
  private n = 0;

  constructor(opts: BayesOptions = {}) {
    this.o = {
      srtMin: -22,
      srtMax: 10,
      srtStep: 0.25,
      slopes: [0.4, 0.7, 1.1],
      priorMean: -8,
      priorSd: 7,
      lapse: DEFAULT_LAPSE,
      candidates: range(-22, 10, 1),
      minTrials: 10,
      maxTrials: 24,
      targetSd: 1.25,
      ...opts,
    };
    this.srts = range(this.o.srtMin, this.o.srtMax, this.o.srtStep);
    this.slopes = this.o.slopes;
    this.candidates = this.o.candidates;
    const S = this.srts.length;
    const K = this.slopes.length;
    this.post = new Float64Array(S * K);
    for (let i = 0; i < S; i++) {
      const z = (this.srts[i] - this.o.priorMean) / this.o.priorSd;
      for (let k = 0; k < K; k++) this.post[i * K + k] = Math.exp(-0.5 * z * z) / K;
    }
    normalize(this.post);
    this.lik = this.candidates.map((snr) => {
      const l = new Float64Array(S * K);
      for (let i = 0; i < S; i++) for (let k = 0; k < K; k++) l[i * K + k] = pCorrect(snr, this.srts[i], this.slopes[k], this.o.lapse);
      return l;
    });
  }

  private srtMarginal(p: Float64Array): Float64Array {
    const K = this.slopes.length;
    const m = new Float64Array(this.srts.length);
    for (let i = 0; i < m.length; i++) for (let k = 0; k < K; k++) m[i] += p[i * K + k];
    return m;
  }

  nextSnr(): number {
    let best = 0;
    let bestH = Infinity;
    const tmp = new Float64Array(this.post.length);
    for (let c = 0; c < this.candidates.length; c++) {
      const l = this.lik[c];
      let pc = 0;
      for (let j = 0; j < l.length; j++) pc += this.post[j] * l[j];
      let h = 0;
      for (const outcome of [true, false]) {
        const po = outcome ? pc : 1 - pc;
        if (po < 1e-9) continue;
        for (let j = 0; j < l.length; j++) tmp[j] = (this.post[j] * (outcome ? l[j] : 1 - l[j])) / po;
        h += po * entropy(this.srtMarginal(tmp));
      }
      if (h < bestH - 1e-12) {
        bestH = h;
        best = c;
      }
    }
    return this.candidates[best];
  }

  update(trial: Trial): void {
    const K = this.slopes.length;
    for (let i = 0; i < this.srts.length; i++) {
      for (let k = 0; k < K; k++) {
        const p = pCorrect(trial.snr, this.srts[i], this.slopes[k], this.o.lapse);
        this.post[i * K + k] *= trial.correct ? p : 1 - p;
      }
    }
    normalize(this.post);
    this.n++;
  }

  done(): boolean {
    if (this.n >= this.o.maxTrials) return true;
    return this.n >= this.o.minTrials && this.estimate().sd <= this.o.targetSd;
  }

  /** SRT marginal posterior (for plotting). */
  marginal(): { srt: number; p: number }[] {
    const m = this.srtMarginal(this.post);
    return this.srts.map((srt, i) => ({ srt, p: m[i] }));
  }

  estimate(): Estimate {
    const m = this.srtMarginal(this.post);
    let mean = 0;
    for (let i = 0; i < m.length; i++) mean += m[i] * this.srts[i];
    let v = 0;
    for (let i = 0; i < m.length; i++) v += m[i] * (this.srts[i] - mean) ** 2;
    return { srt: mean, sd: Math.sqrt(v), lo90: quantile(m, this.srts, 0.05), hi90: quantile(m, this.srts, 0.95), trials: this.n };
  }
}

function normalize(p: Float64Array): void {
  let s = 0;
  for (let i = 0; i < p.length; i++) s += p[i];
  for (let i = 0; i < p.length; i++) p[i] /= s;
}

function entropy(p: Float64Array): number {
  let h = 0;
  for (let i = 0; i < p.length; i++) if (p[i] > 0) h -= p[i] * Math.log(p[i]);
  return h;
}

function quantile(p: Float64Array, xs: number[], q: number): number {
  let c = 0;
  for (let i = 0; i < p.length; i++) {
    c += p[i];
    if (c >= q) return xs[i];
  }
  return xs[xs.length - 1];
}
