import type { AdaptiveProcedure, Estimate, Trial } from "./types";

export interface StaircaseOptions {
  start?: number;
  step?: number;
  trials?: number;
  discard?: number;
  min?: number;
  max?: number;
}

/**
 * Classic fixed-length digits-in-noise track: 1-up/1-down with 2 dB steps.
 * The SRT is the mean SNR of trials after `discard`, plus the level the next trial would have used.
 */
export class Staircase implements AdaptiveProcedure {
  readonly name: string;
  private snr: number;
  private readonly history: Trial[] = [];
  private readonly o: Required<StaircaseOptions>;

  constructor(opts: StaircaseOptions = {}) {
    this.o = { start: 0, step: 2, trials: 24, discard: 4, min: -24, max: 12, ...opts };
    this.snr = this.o.start;
    this.name = `Staircase (${this.o.trials} trials)`;
  }

  nextSnr(): number {
    return this.snr;
  }

  update(trial: Trial): void {
    this.history.push(trial);
    const next = trial.snr + (trial.correct ? -this.o.step : this.o.step);
    this.snr = Math.max(this.o.min, Math.min(this.o.max, next));
  }

  done(): boolean {
    return this.history.length >= this.o.trials;
  }

  estimate(): Estimate {
    const levels = this.history.slice(this.o.discard).map((t) => t.snr);
    levels.push(this.snr);
    const mean = levels.reduce((a, b) => a + b, 0) / levels.length;
    const variance = levels.reduce((a, b) => a + (b - mean) ** 2, 0) / Math.max(1, levels.length - 1);
    const sd = Math.sqrt(variance / levels.length);
    return { srt: mean, sd, lo90: mean - 1.645 * sd, hi90: mean + 1.645 * sd, trials: this.history.length };
  }
}
