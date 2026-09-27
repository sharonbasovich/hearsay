import { dbToGain } from "../dsp/fft";

export interface MixOptions {
  sampleRate: number;
  snr: number;
  /** Invert the speech in the right ear (antiphasic presentation); noise stays identical in both ears. */
  antiphasic: boolean;
  noiseGain?: number;
  leadMs?: number;
  gapMs?: number;
  tailMs?: number;
  noiseOffset?: number;
}

export interface StereoMix {
  left: Float32Array;
  right: Float32Array;
  onsets: number[];
}

/** Mix three digit tokens into looping speech-shaped noise at the requested SNR. */
export function mixTriplet(tokens: Float32Array[], noise: Float32Array, o: MixOptions): StereoMix {
  const sr = o.sampleRate;
  const noiseGain = o.noiseGain ?? 0.35;
  const lead = Math.round(((o.leadMs ?? 500) / 1000) * sr);
  const gap = Math.round(((o.gapMs ?? 300) / 1000) * sr);
  const tail = Math.round(((o.tailMs ?? 400) / 1000) * sr);
  const len = lead + tokens.reduce((a, t) => a + t.length, 0) + gap * (tokens.length - 1) + tail;
  const left = new Float32Array(len);
  const right = new Float32Array(len);
  const off = o.noiseOffset ?? 0;
  const ramp = Math.round(0.02 * sr);
  for (let i = 0; i < len; i++) {
    const env = Math.min(1, i / ramp, (len - 1 - i) / ramp);
    const n = noise[(i + off) % noise.length] * noiseGain * env;
    left[i] = n;
    right[i] = n;
  }
  const sg = noiseGain * dbToGain(o.snr);
  const onsets: number[] = [];
  let pos = lead;
  for (const t of tokens) {
    onsets.push(pos / sr);
    for (let i = 0; i < t.length; i++) {
      left[pos + i] += t[i] * sg;
      right[pos + i] += (o.antiphasic ? -1 : 1) * t[i] * sg;
    }
    pos += t.length + gap;
  }
  let peak = 0;
  for (let i = 0; i < len; i++) peak = Math.max(peak, Math.abs(left[i]), Math.abs(right[i]));
  if (peak > 0.95) {
    const g = 0.95 / peak;
    for (let i = 0; i < len; i++) {
      left[i] *= g;
      right[i] *= g;
    }
  }
  return { left, right, onsets };
}
