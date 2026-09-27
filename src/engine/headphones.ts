import type { Rng } from "./rng";

/**
 * Headphone screening in the style of Woods et al. (2017): three 200 Hz tones, one of which is
 * presented in antiphase between the ears. Over headphones the antiphase tone is not quieter;
 * the target is the one that is actually 6 dB quieter. Over loudspeakers the antiphase tone
 * partially cancels acoustically and tends to be picked instead.
 */
export interface HeadphoneTrial {
  quiet: number;
  antiphase: number;
}

export function makeHeadphoneTrial(rng: Rng): HeadphoneTrial {
  const quiet = Math.floor(rng() * 3);
  let antiphase = Math.floor(rng() * 2);
  if (antiphase >= quiet) antiphase++;
  return { quiet, antiphase };
}

export const HEADPHONE_TRIALS = 6;
export const HEADPHONE_PASS = 5;

export function headphonePassed(correct: number): boolean {
  return correct >= HEADPHONE_PASS;
}
