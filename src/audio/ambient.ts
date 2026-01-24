import * as Tone from "tone";
import {
  NOTE,
  DEGREE,
  freq,
  octave,
  freqToSemitones,
  findClosestScaleDegree,
} from "./music";

const BASE = NOTE.D_SHARP;

const VOICE_OCTAVE = 3;
const VOICE_GAIN = 0.15;
const VOICE_SLIDE_SECONDS = 2;
const OCTAVES_PER_DECIHZ = 10;
const MAX_OCTAVE_SHIFT = 6;

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

export class Ambient {
  private bass: Tone.Oscillator;
  private voice: Tone.Oscillator;
  private chordA: Tone.Oscillator[];
  private chordB: Tone.Oscillator[];
  private bassGain: Tone.Gain;
  private voiceGain: Tone.Gain;
  private chordGainA: Tone.Gain;
  private chordGainB: Tone.Gain;
  private filter: Tone.Filter;
  private chorus: Tone.Chorus;
  private reverb: Tone.Reverb;
  private master: Tone.Gain;

  private started = false;
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

    this.chorus = new Tone.Chorus({
      frequency: 0.2,
      delayTime: 4,
      depth: 0.3,
      wet: 0.4,
    })
      .connect(this.reverb)
      .start();

    this.filter = new Tone.Filter({
      frequency: 400,
      type: "lowpass",
      rolloff: -12,
    }).connect(this.chorus);

    this.bassGain = new Tone.Gain(BASS_GAIN).connect(this.filter);
    this.voiceGain = new Tone.Gain(VOICE_GAIN).connect(this.filter);
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
    this.chordA.forEach((o) => o.start());
    this.chordB.forEach((o) => o.start());
    this.started = true;
  }

  stop() {
    if (!this.started) return;

    [this.bass, this.voice, ...this.chordA, ...this.chordB].forEach((o) => {
      o.stop();
      o.dispose();
    });

    [
      this.bassGain,
      this.voiceGain,
      this.chordGainA,
      this.chordGainB,
      this.filter,
      this.chorus,
      this.reverb,
      this.master,
    ].forEach((n) => n.dispose());

    this.started = false;
  }

  update(gridFreq: number) {
    const deviation = gridFreq - 50;
    const shift = Math.max(
      -MAX_OCTAVE_SHIFT,
      Math.min(MAX_OCTAVE_SHIFT, deviation * OCTAVES_PER_DECIHZ),
    );

    const voiceFreq = octave(BASE, VOICE_OCTAVE) * Math.pow(2, shift);
    this.voice.frequency.rampTo(voiceFreq, VOICE_SLIDE_SECONDS);

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
