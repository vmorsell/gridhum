import * as Tone from "tone";

const DRONE_FREQ = 146.83; // D3

const VOICE_FREQ = DRONE_FREQ * 4; // Two octaves above drone
const OCTAVES_PER_DECIHZ = 10;
const MAX_OCTAVE_SHIFT = 3;

export class Ambient {
  private drone: Tone.Oscillator;
  private voice: Tone.Oscillator;
  private droneGain: Tone.Gain;
  private voiceGain: Tone.Gain;
  private filter: Tone.Filter;
  private chorus: Tone.Chorus;
  private reverb: Tone.Reverb;
  private master: Tone.Gain;
  private started = false;

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
      frequency: 350,
      type: "lowpass",
      rolloff: -12,
    }).connect(this.chorus);

    this.droneGain = new Tone.Gain(0.5).connect(this.filter);
    this.voiceGain = new Tone.Gain(0.15).connect(this.filter);

    this.drone = new Tone.Oscillator({
      frequency: DRONE_FREQ,
      type: "sine",
    }).connect(this.droneGain);

    this.voice = new Tone.Oscillator({
      frequency: VOICE_FREQ,
      type: "triangle",
    }).connect(this.voiceGain);
  }

  start() {
    if (this.started) return;
    this.drone.start();
    this.voice.start();
    this.started = true;
  }

  stop() {
    if (!this.started) return;
    this.drone.stop();
    this.voice.stop();
    this.drone.dispose();
    this.voice.dispose();
    this.droneGain.dispose();
    this.voiceGain.dispose();
    this.filter.dispose();
    this.chorus.dispose();
    this.reverb.dispose();
    this.master.dispose();
    this.started = false;
  }

  update(freq: number) {
    const deviation = freq - 50;
    const octaves = Math.max(
      -MAX_OCTAVE_SHIFT,
      Math.min(MAX_OCTAVE_SHIFT, deviation * OCTAVES_PER_DECIHZ),
    );
    const targetFreq = VOICE_FREQ * Math.pow(2, octaves);

    this.voice.frequency.rampTo(targetFreq, 2);
  }
}
