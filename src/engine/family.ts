import type { Estimate } from "./types";

export interface Member {
  id: string;
  name: string;
  estimate: Estimate;
  takenAt: string;
  device: string;
}

export type Verdict = "similar" | "harder" | "easier" | "too-few";

export interface Comparison {
  member: Member;
  reference: number;
  delta: number;
  verdict: Verdict;
}

/** Minimum gap (dB) before Hearsay calls a difference notable, regardless of measured precision. */
export const MIN_NOTABLE_DB = 3;

export function median(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b);
  const m = s.length >> 1;
  return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
}

/**
 * Compare each member with the median of everyone else tested on the same device and headphones.
 * Because everyone shares the same (uncalibrated) output chain, device-level offsets cancel out.
 * A difference is notable only if it exceeds both MIN_NOTABLE_DB and 1.645x the combined uncertainty.
 */
export function compareGroup(members: Member[]): Comparison[] {
  return members.map((member) => {
    const others = members.filter((m) => m.id !== member.id);
    if (others.length === 0) return { member, reference: NaN, delta: NaN, verdict: "too-few" as const };
    const reference = median(others.map((m) => m.estimate.srt));
    const refSd = median(others.map((m) => m.estimate.sd));
    const delta = member.estimate.srt - reference;
    const threshold = Math.max(MIN_NOTABLE_DB, 1.645 * Math.hypot(member.estimate.sd, refSd));
    const verdict: Verdict = delta > threshold ? "harder" : delta < -threshold ? "easier" : "similar";
    return { member, reference, delta, verdict };
  });
}
