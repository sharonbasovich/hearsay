# Hearsay

**Tagline:** A 3-minute hearing-in-noise check that finds the family member who's quietly saying "what?", without pretending your earbuds are calibrated.

> **"What?"**
> **"WHAT?"**
> **"...never mind."**

That little three-word exchange happens at dinner tables everywhere, and the person who says "never mind" first usually isn't the one with the problem. Understanding speech in noise is often the first part of hearing to slip, and people commonly wait years before getting it checked.

**Hearsay turns that dinner-table moment into a 3-minute game you pass around on one laptop.** Put on headphones, type the three digits you hear through the noise, and hand it to the next person. Hearsay won't tell anyone they're "normal", because a browser can't know how loud your earbuds are. What it *can* tell you honestly is whether one person on the same headphones is clearly struggling more than everyone else.

**Try it:** https://sharonbasovich.github.io/hearsay/ (headphones on; the Lab tab works without them). **Watch the 2-minute demo:** https://sharonbasovich.github.io/hearsay/video/

## Inspiration

Someone tells a story, Grandpa laughs half a second late, and three people repeat the punchline louder and louder. Nobody says "hearing test", because nobody wants to be *that* relative. Online hearing tests feel like homework, or they confidently call you "normal" through $9 earbuds they've never met. I wanted something a family would actually do together, that measures the thing that slips first, and that is upfront about what a browser can and can't know.

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
- Speech: ElevenLabs TTS, generated offline (attributed). Noise, charts and hearing profiles: generated for this project. Code: written with an AI coding agent (see above).

## AI use disclosure

UnivaBio encourages AI assistants, so here's exactly what I used:

- **Devin (Cognition's AI coding agent)** generated most of the code, tests, docs, screenshots and this demo video. The source is organized around the Bayesian engine (`src/engine/bayes.ts`), the family comparison (`src/engine/family.ts`), and the noise and mixing DSP (`src/dsp`, `src/audio/mix.ts`).
- **ElevenLabs text-to-speech** was used once, offline, to record the nine digits and the hear-through sentence (`scripts/make-stimuli.ts`, `public/stimuli/manifest.json`), plus the demo-video narration. **The live site makes no ElevenLabs or other API calls**; it only plays the pre-generated files. No sponsor API is used, and none is required by the rules.
- **The "AI" inside Hearsay** is Bayesian active learning that runs entirely in your browser: a posterior over threshold and slope, where each trial is chosen to maximize expected information. There is no LLM and no trained model at runtime.

## Links

- Live demo: https://sharonbasovich.github.io/hearsay/
- Demo video (2:20): https://sharonbasovich.github.io/hearsay/video/
- Source: https://github.com/sharonbasovich/hearsay
- Provenance and limitations: https://github.com/sharonbasovich/hearsay/blob/main/docs/PROVENANCE.md

## Built with

typescript · vite · web-audio-api · vitest · elevenlabs · bayesian-inference · github-pages · devin
