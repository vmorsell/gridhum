import * as Tone from "tone";
import {
  NOTE,
  DEGREE,
  freq,
  octave,
  freqToSemitones,
  findClosestScaleDegree,
} from "./music";
import { NORMAL_DEVIATION, WARNING_DEVIATION } from "../config";

const BASE = NOTE.D_SHARP;

const VOICE_OCTAVE = 3;
const VOICE_GAIN = 0.15;
const VOICE_SLIDE_SECONDS = 2;

// Octave shift: 1 octave in normal band, 1 more in warning band
function deviationToOctaves(deviation: number): number {
  const abs = Math.abs(deviation);
  const sign = Math.sign(deviation);

  if (abs <= NORMAL_DEVIATION) {
    return sign * (abs / NORMAL_DEVIATION);
  }
  const warningRange = WARNING_DEVIATION - NORMAL_DEVIATION;
  const warningProgress = Math.min(1, (abs - NORMAL_DEVIATION) / warningRange);
  return sign * (1 + warningProgress);
}

const CHORD_MAP: Record<number, number[]> = {
  [DEGREE.I]: [DEGREE.I, DEGREE.V],
  [DEGREE.II]: [DEGREE.VII, DEGREE.II, DEGREE.V],
  [DEGREE.III]: [DEGREE.III, DEGREE.V],
  [DEGREE.IV]: [DEGREE.I, DEGREE.IV, DEGREE.VI],
  [DEGREE.V]: [DEGREE.I, DEGREE.V],
  [DEGREE.VI]: [DEGREE.I, DEGREE.IV, DEGREE.VI],
  [DEGREE.VII]: [DEGREE.VII, DEGREE.II, DEGREE.V],
};

const MAX_CHORD_VOICES = 4;
const CHORD_DELAY_SECONDS = 1.5;
const CHORD_FADE_SECONDS = 3;
const CHORD_GAIN = 0.12;

const BASS_GAIN = 0.2;

const FILTER_NORMAL = 300;
const FILTER_DISTURBED = 3000;
const TREMOLO_RATE_MAX = 8;
const TREMOLO_DEPTH_MAX = 0.6;

export class Ambient {
  private bass: Tone.Oscillator;
  private voice: Tone.Oscillator;
  private tensionVoice: Tone.Oscillator;
  private chordA: Tone.Oscillator[];
  private chordB: Tone.Oscillator[];
  private bassGain: Tone.Gain;
  private voiceGain: Tone.Gain;
  private tensionGain: Tone.Gain;
  private chordGainA: Tone.Gain;
  private chordGainB: Tone.Gain;
  private filter: Tone.Filter;
  private distortion: Tone.Distortion;
  private tremolo: Tone.Tremolo;
  private reverb: Tone.Reverb;
  private master: Tone.Gain;

  private started = false;
  private firstUpdate = true;
  private activeChord: "A" | "B" = "A";
  private targetDegree: number | null = null;
  private activeDegree: number | null = null;
  private chordTimer: ReturnType<typeof setTimeout> | null = null;

  constructor() {
    this.master = new Tone.Gain(0.1).toDestination();

    this.reverb = new Tone.Reverb({
      decay: 15,
      wet: 0.85,
      preDelay: 0.1,
    }).connect(this.master);

    this.tremolo = new Tone.Tremolo({
      frequency: 0,
      depth: 0,
      spread: 0,
    })
      .connect(this.reverb)
      .start();

    this.distortion = new Tone.Distortion({
      distortion: 0,
      wet: 0,
    }).connect(this.tremolo);

    this.filter = new Tone.Filter({
      frequency: FILTER_NORMAL,
      type: "lowpass",
      rolloff: -12,
    }).connect(this.distortion);

    this.bassGain = new Tone.Gain(BASS_GAIN).connect(this.filter);
    this.voiceGain = new Tone.Gain(VOICE_GAIN).connect(this.filter);
    this.tensionGain = new Tone.Gain(0).connect(this.filter);
    this.chordGainA = new Tone.Gain(CHORD_GAIN).connect(this.filter);
    this.chordGainB = new Tone.Gain(0).connect(this.filter);

    this.bass = new Tone.Oscillator({
      frequency: octave(BASE, -1),
      type: "sine",
    }).connect(this.bassGain);

    this.voice = new Tone.Oscillator({
      frequency: octave(BASE, VOICE_OCTAVE),
      type: "triangle",
    }).connect(this.voiceGain);

    // Detuned tension voice - minor 2nd above main voice
    this.tensionVoice = new Tone.Oscillator({
      frequency: octave(BASE, VOICE_OCTAVE),
      type: "sawtooth",
    }).connect(this.tensionGain);

    this.chordA = this.createChordBank(this.chordGainA);
    this.chordB = this.createChordBank(this.chordGainB);
  }

  private createChordBank(gain: Tone.Gain): Tone.Oscillator[] {
    return Array.from({ length: MAX_CHORD_VOICES }, () =>
      new Tone.Oscillator({
        frequency: BASE,
        type: "sine",
        volume: -Infinity,
      }).connect(gain),
    );
  }

  start() {
    if (this.started) return;
    this.bass.start();
    this.voice.start();
    this.tensionVoice.start();
    this.chordA.forEach((o) => o.start());
    this.chordB.forEach((o) => o.start());
    this.started = true;
  }

  stop() {
    if (!this.started) return;

    [
      this.bass,
      this.voice,
      this.tensionVoice,
      ...this.chordA,
      ...this.chordB,
    ].forEach((o) => {
      o.stop();
      o.dispose();
    });

    [
      this.bassGain,
      this.voiceGain,
      this.tensionGain,
      this.chordGainA,
      this.chordGainB,
      this.filter,
      this.distortion,
      this.tremolo,
      this.reverb,
      this.master,
    ].forEach((n) => n.dispose());

    this.started = false;
  }

  update(gridFreq: number) {
    const deviation = gridFreq - 50;
    const shift = deviationToOctaves(deviation);

    const voiceFreq = octave(BASE, VOICE_OCTAVE) * Math.pow(2, shift);
    if (this.firstUpdate) {
      this.voice.frequency.value = voiceFreq;
      this.firstUpdate = false;
    } else {
      this.voice.frequency.rampTo(voiceFreq, VOICE_SLIDE_SECONDS);
    }

    // Tension: 0 = normal, 1 = edge of danger zone
    const warningRange = WARNING_DEVIATION - NORMAL_DEVIATION;
    const tension = Math.min(
      1,
      Math.max(0, Math.abs(deviation) - NORMAL_DEVIATION) / warningRange,
    );

    // Filter opens up
    const filterFreq =
      FILTER_NORMAL + tension * (FILTER_DISTURBED - FILTER_NORMAL);
    this.filter.frequency.rampTo(filterFreq, 1);

    // Tremolo speeds up and deepens
    this.tremolo.frequency.rampTo(tension * TREMOLO_RATE_MAX, 0.5);
    this.tremolo.depth.rampTo(tension * TREMOLO_DEPTH_MAX, 0.5);

    // Dissonant tension voice fades in (minor 2nd = 1 semitone above)
    const tensionFreq = voiceFreq * Math.pow(2, 1 / 12);
    this.tensionVoice.frequency.rampTo(tensionFreq, VOICE_SLIDE_SECONDS);
    this.tensionGain.gain.rampTo(tension * 0.1, 1);

    // Distortion kicks in outside normal band
    this.distortion.distortion = tension * 0.4;
    this.distortion.wet.rampTo(tension * 0.5, 0.5);

    const semitones = freqToSemitones(voiceFreq, BASE);
    const degree = findClosestScaleDegree(semitones);

    if (degree === this.targetDegree) return;
    this.targetDegree = degree;

    if (degree === this.activeDegree) {
      if (this.chordTimer) {
        clearTimeout(this.chordTimer);
        this.chordTimer = null;
      }
      return;
    }

    if (this.chordTimer) clearTimeout(this.chordTimer);

    this.chordTimer = setTimeout(() => {
      this.chordTimer = null;
      this.crossfadeChord(degree);
    }, CHORD_DELAY_SECONDS * 1000);
  }

  private crossfadeChord(degree: number) {
    this.activeDegree = degree;

    const tones = CHORD_MAP[degree] ?? [DEGREE.I, DEGREE.V];
    const [bank, fadeIn, fadeOut] =
      this.activeChord === "A"
        ? [this.chordB, this.chordGainB, this.chordGainA]
        : [this.chordA, this.chordGainA, this.chordGainB];

    this.activeChord = this.activeChord === "A" ? "B" : "A";

    bank.forEach((osc, i) => {
      if (i < tones.length) {
        osc.frequency.value = freq(BASE, tones[i]);
        osc.volume.value = 0;
      } else {
        osc.volume.value = -Infinity;
      }
    });

    fadeOut.gain.rampTo(0, CHORD_FADE_SECONDS);
    fadeIn.gain.rampTo(CHORD_GAIN, CHORD_FADE_SECONDS);
  }
}
