import type { Rng } from "./rng";

/** "7" is left out, as in several English digits-in-noise designs, because it is the only two-syllable digit. */
export const DIGITS = [0, 1, 2, 3, 4, 5, 6, 8, 9] as const;
export type Digit = (typeof DIGITS)[number];
export type Triplet = [Digit, Digit, Digit];

export function makeTriplet(rng: Rng): Triplet {
  const pool: Digit[] = [...DIGITS];
  const out: Digit[] = [];
  for (let i = 0; i < 3; i++) {
    const idx = Math.floor(rng() * pool.length);
    out.push(pool.splice(idx, 1)[0]);
  }
  return out as Triplet;
}

export function parseResponse(text: string): number[] {
  return [...text.replace(/\D/g, "")].map(Number);
}

export function scoreTriplet(target: Triplet, response: string): { correct: boolean; digitsCorrect: number } {
  const r = parseResponse(response);
  let digitsCorrect = 0;
  for (let i = 0; i < 3; i++) if (r[i] === target[i]) digitsCorrect++;
  return { correct: digitsCorrect === 3 && r.length === 3, digitsCorrect };
}
