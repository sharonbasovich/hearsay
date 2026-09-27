export interface Trial {
  snr: number;
  correct: boolean;
}

export interface Estimate {
  srt: number;
  /** Uncertainty (posterior SD for Bayesian; SD of tracked SNRs / sqrt(n) for the staircase). */
  sd: number;
  lo90: number;
  hi90: number;
  trials: number;
}

export interface AdaptiveProcedure {
  readonly name: string;
  nextSnr(): number;
  update(trial: Trial): void;
  done(): boolean;
  estimate(): Estimate;
}
