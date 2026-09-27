import { BayesianDin } from "./bayes";
import { pCorrect } from "./psychometric";
import { mulberry32 } from "./rng";
import { Staircase } from "./staircase";
import type { AdaptiveProcedure } from "./types";

export interface SimConfig {
  listeners: number;
  seed: number;
  trueSlope: number;
  trueLapse: number;
  srtRange: [number, number];
}

export interface MethodStats {
  method: string;
  rmse: number;
  bias: number;
  meanTrials: number;
  /** Fraction of runs whose reported 90% interval contained the true SRT. */
  coverage90: number;
  /** SD of the difference between two independent runs on the same simulated listener. */
  retestSd: number;
  errors: number[];
  trials: number[];
}

export const DEFAULT_SIM: SimConfig = { listeners: 400, seed: 7, trueSlope: 0.7, trueLapse: 0.02, srtRange: [-14, 2] };

export type ProcedureFactory = () => AdaptiveProcedure;

export const METHODS: Record<string, ProcedureFactory> = {
  staircase: () => new Staircase(),
  staircase12: () => new Staircase({ trials: 12, discard: 2 }),
  bayesian: () => new BayesianDin(),
};

export function runOnce(make: ProcedureFactory, srt: number, slope: number, lapse: number, rng: () => number) {
  const proc = make();
  while (!proc.done()) {
    const snr = proc.nextSnr();
    proc.update({ snr, correct: rng() < pCorrect(snr, srt, slope, lapse) });
  }
  return proc.estimate();
}

export function simulate(make: ProcedureFactory, cfg: SimConfig = DEFAULT_SIM): MethodStats {
  const rng = mulberry32(cfg.seed);
  const errors: number[] = [];
  const trials: number[] = [];
  const diffs: number[] = [];
  let covered = 0;
  let name = "";
  for (let i = 0; i < cfg.listeners; i++) {
    const srt = cfg.srtRange[0] + rng() * (cfg.srtRange[1] - cfg.srtRange[0]);
    const a = runOnce(make, srt, cfg.trueSlope, cfg.trueLapse, rng);
    const b = runOnce(make, srt, cfg.trueSlope, cfg.trueLapse, rng);
    errors.push(a.srt - srt);
    trials.push(a.trials);
    diffs.push(a.srt - b.srt);
    if (a.lo90 <= srt && srt <= a.hi90) covered++;
    name ||= make().name;
  }
  const mean = (x: number[]) => x.reduce((s, v) => s + v, 0) / x.length;
  const md = mean(diffs);
  return {
    method: name,
    rmse: Math.sqrt(mean(errors.map((e) => e * e))),
    bias: mean(errors),
    meanTrials: mean(trials),
    coverage90: covered / cfg.listeners,
    retestSd: Math.sqrt(mean(diffs.map((d) => (d - md) ** 2))),
    errors,
    trials,
  };
}
