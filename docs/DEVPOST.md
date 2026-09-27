# Hearsay

**Tagline:** A 3-minute hearing-in-noise check that finds the family member who's quietly saying "what?" — without pretending your earbuds are calibrated.

## Inspiration

Every family has a dinner-table moment. Someone tells a story, Grandpa laughs half a second late, and three people repeat the punchline at increasing volume. Nobody says "hearing test," because nobody wants to be *that* relative, and online hearing tests either feel like homework or confidently tell you you're "normal" through $9 earbuds they've never met.

Speech-in-noise is usually the first thing to slip, and it's exactly what those tests skip. I wanted something a family could pass around on one laptop in three minutes, that measures the right thing, and that is honest about what a browser can and can't know.

## What it does

- **Takes the check (≈3 min):** set a volume, pass a 30-second headphone check (a phase trick that fools loudspeakers), then hear three spoken digits in noise and type them. A live chart shows the engine's belief about your threshold tightening with every answer. It usually stops after ~12 triplets.
- **Family board:** results are grouped by device. Each person is compared with the median of everyone else on the *same* device and headphones, so unknown device loudness cancels out. Someone is flagged only if the gap is > 3 dB **and** bigger than the measurement uncertainty — then Hearsay gently suggests mentioning it to a doctor.
- **Hear-through:** plays a message ("Hi Grandpa! I'm picking you up at 4:15…") through illustrative high-frequency loss profiles, so the rest of the family can hear why shouting doesn't help.
- **Lab:** a reproducible simulation study in the browser comparing Hearsay's engine with classic staircases on hundreds of virtual listeners. Includes a "watch a virtual listener take the check" demo.
- **Honesty page:** provenance, safety framing and every known limitation.

## How I built it

- **TypeScript + Vite + Web Audio**, no backend, no tracking — results live in `localStorage`.
- **Stimuli:** nine digit words synthesized once with ElevenLabs TTS, silence-trimmed and RMS-equalized; speech-shaped noise generated locally from their long-term spectrum with a hand-written FFT. Digits are phase-inverted in one ear (antiphasic presentation, as in published digits-in-noise research).
- **The AI part — a Bayesian adaptive engine:** a grid posterior over threshold × psychometric slope. Each next noise level is chosen to minimize the expected entropy of the threshold posterior (QUEST+/psi-style active learning), and the test stops when the 90% credible interval is tight.
- **Family comparison:** leave-one-out median with an uncertainty-aware threshold; unit-tested to be invariant to any shared device offset.
- **32 Vitest tests** covering the FFT, noise shaping, SNR mixing, antiphasic channels, clipping, triplet scoring, both procedures, the family logic, the shipped audio files, and the headline simulation claims.

## Results (simulated listeners — not people)

400 virtual listeners, each tested twice:

| | Avg. triplets | RMSE | 90% interval really contains the truth |
|---|---|---|---|
| Classic 24-trial staircase | 24 | 0.79 dB | 62% |
| 12-trial staircase | 12 | 1.53 dB | 54% |
| **Hearsay** | **11.8** | **1.01 dB** | **94%** |

Same length as a short staircase → ~34% lower error. Half the length of the classic track → slightly less precise (1.01 vs 0.79 dB), but with error bars that are actually honest.

## Challenges

- **Calibration is unsolvable in a browser**, so I stopped trying and designed around it: relative, same-device comparison instead of fake norms.
- **Honest uncertainty:** in simulation, the classic staircase's "90%" error bars only contained the true threshold 62% of the time. Hearsay's posterior intervals hit 94%, and the Lab shows that coverage number openly instead of hiding it.
- **Making noise that sounds like speech** without any third-party audio: an FFT, random phase, and a lot of listening.

## Accomplishments I'm proud of

A working, measurable health tool that tells a judge exactly how good it is — and exactly where it isn't.

## What I learned

Adaptive testing, psychometric functions, why antiphasic presentation matters, and that "not a diagnosis" is a design constraint, not a disclaimer.

## What's next

A small ethics-approved pilot against a calibrated clinical digits-in-noise test; per-digit intelligibility balancing; more languages; an exportable summary to bring to an appointment.

## Honesty box

- Educational self-check, **not a medical device**; not clinically validated; never outputs a diagnosis, category or pass/fail.
- All validation data is simulated; the demo family is invented and labelled "(synthetic)"; no human-subject data was collected.
- Speech: ElevenLabs TTS (attributed). Noise, code, charts and profiles: original.

## Built with

typescript · vite · web-audio-api · vitest · elevenlabs · bayesian-inference · github-pages
