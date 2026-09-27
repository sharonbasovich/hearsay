/** Audiogram frequencies (Hz) used by the hear-through simulator. */
export const AUDIOGRAM_FREQS = [250, 500, 1000, 2000, 4000, 8000] as const;

export interface Profile {
  id: string;
  label: string;
  description: string;
  /** Attenuation in dB at each AUDIOGRAM_FREQS entry. Illustrative only. */
  loss: number[];
}

export const PROFILES: Profile[] = [
  { id: "none", label: "Typical", description: "No filtering.", loss: [0, 0, 0, 0, 0, 0] },
  {
    id: "mild-hf",
    label: "Mild high-frequency",
    description: "Illustrative gentle slope above 2 kHz — consonants like s, f and th start to blur.",
    loss: [0, 0, 5, 20, 35, 45],
  },
  {
    id: "moderate-sloping",
    label: "Moderate sloping",
    description: "Illustrative steeper slope — vowels stay loud, so speech sounds 'there' but unclear.",
    loss: [10, 15, 30, 45, 60, 70],
  },
  {
    id: "noise-notch",
    label: "Noise notch",
    description: "Illustrative dip around 4 kHz, a pattern often discussed with long-term loud-noise exposure.",
    loss: [0, 0, 5, 15, 40, 20],
  },
];

/** Linear interpolation (in log-frequency) of a profile's attenuation at frequency f. */
export function lossAt(profile: Profile, f: number): number {
  const fs = AUDIOGRAM_FREQS;
  if (f <= fs[0]) return profile.loss[0];
  if (f >= fs[fs.length - 1]) return profile.loss[fs.length - 1];
  for (let i = 0; i < fs.length - 1; i++) {
    if (f >= fs[i] && f <= fs[i + 1]) {
      const t = Math.log(f / fs[i]) / Math.log(fs[i + 1] / fs[i]);
      return profile.loss[i] + t * (profile.loss[i + 1] - profile.loss[i]);
    }
  }
  return 0;
}
