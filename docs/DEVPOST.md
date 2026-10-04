# Hearsay

**Tagline:** An educational speech-in-noise task with adaptive questions and a same-setup comparison board.

> **"What?"**
> **"WHAT?"**
> **"...never mind."**

That little three-word exchange happens at dinner tables everywhere, and the person who says "never mind" first usually isn't the one with the problem. Understanding speech in noise is often the first part of hearing to slip, and people commonly wait years before getting it checked.

Hearsay explores that dinner-table question through an educational listening task. Hear three digits in noise, enter an answer, and see the Bayesian model update its estimate. The family board compares task results collected on the same setup, with uncertainty shown. These comparisons have not been clinically validated and do not establish who has a hearing condition.

**Try it:** https://sharonbasovich.github.io/hearsay/ (headphones on; the Lab tab works without them). **Watch the 2-minute demo:** https://sharonbasovich.github.io/hearsay/video/

## Inspiration

Someone tells a story, Grandpa laughs half a second late, and three people repeat the punchline louder and louder. Nobody says "hearing test", because nobody wants to be *that* relative. Online hearing tests feel like homework, or they confidently call you "normal" through $9 earbuds they've never met. The design goal was a task families could explore together, with clear limits on what an uncalibrated browser task can establish.

## What it does

- **Adaptive digits task:** set a comfortable volume and try a short tone task, which cannot establish equipment type or calibrate levels. Hear three spoken digits in noise and enter them. A live chart shows the model-estimated task threshold and uncertainty. The run stops after at least 10 triplets when posterior SD is at most 1.25 dB, or at 24 triplets; the simulated evaluation averaged 11.8.
- **Family board:** results are grouped by device and compared with the median of others on the same setup. A shared offset cancels mathematically under the model; fit, attention, language and environment can still differ. The >3 dB flagging rule and uncertainty comparison are educational design choices, not clinically validated thresholds.
- **Hear-through:** plays a message ("Hi Grandpa! I'm picking you up at 4:15…") through illustrative high-frequency loss profiles, so the rest of the family can hear why shouting doesn't help.
- **Lab:** a reproducible simulation study in the browser comparing Hearsay's engine with classic staircases on hundreds of virtual listeners. Includes a "watch a virtual listener take the check" demo.
- **Honesty page:** provenance, safety framing and every known limitation.

## How I built it

- **TypeScript + Vite + Web Audio**, no backend, no tracking — results live in `localStorage`.
- **Stimuli:** nine digit words synthesized once with ElevenLabs TTS, silence-trimmed and RMS-equalized; speech-shaped noise generated locally from their long-term spectrum with a hand-written FFT. Digits are phase-inverted in one ear (antiphasic presentation, as in published digits-in-noise research).
- **The AI part — a Bayesian adaptive engine:** a grid posterior over threshold × psychometric slope. Each next noise level is chosen to minimize the expected entropy of the threshold posterior (QUEST+/psi-style active learning), and the run stops at posterior SD ≤ 1.25 dB after at least 10 triplets, or at 24 triplets.
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

- **Uncalibrated home audio:** the prototype avoids a clinical normal range and makes same-setup task comparisons, while explicitly preserving the limitations of that comparison model.
- **Honest uncertainty:** in simulation, the classic staircase's "90%" error bars only contained the true threshold 62% of the time. Hearsay's posterior intervals hit 94%, and the Lab shows that coverage number openly instead of hiding it.
- **Making noise that sounds like speech** without any third-party audio: an FFT, random phase, and a lot of listening.

## Accomplishments I'm proud of

A working educational prototype with a reproducible simulated-listener evaluation and visible uncertainty. Its practical benefit and clinical validity remain unevaluated.

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
- Demo video (1:52): https://sharonbasovich.github.io/hearsay/video/
- Source: https://github.com/sharonbasovich/hearsay
- Provenance and limitations: https://github.com/sharonbasovich/hearsay/blob/main/docs/PROVENANCE.md

## Built with

typescript · vite · web-audio-api · vitest · elevenlabs · bayesian-inference · github-pages · devin
