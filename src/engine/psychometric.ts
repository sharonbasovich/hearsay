/** Probability that a listener repeats a whole digit triplet correctly at a given SNR (dB). */
export interface Listener {
  srt: number;
  slope: number;
  lapse: number;
}

export const DEFAULT_SLOPE = 0.7;
export const DEFAULT_LAPSE = 0.03;

export function pCorrect(snr: number, srt: number, slope = DEFAULT_SLOPE, lapse = DEFAULT_LAPSE): number {
  return (1 - lapse) / (1 + Math.exp(-slope * (snr - srt)));
}
