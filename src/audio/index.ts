import * as Tone from "tone";
import type { FreqPoint } from "../data";
import { Ambient } from "./ambient";

export interface AudioEngine {
  start(): Promise<void>;
  update(point: FreqPoint): void;
  isStarted(): boolean;
  isMuted(): boolean;
  setMuted(muted: boolean): void;
}

export function createAudioEngine(): AudioEngine {
  let started = false;
  let ambient: Ambient | null = null;

  return {
    async start() {
      if (started) return;
      await Tone.start();
      ambient = new Ambient();
      await ambient.start();
      started = true;
    },

    update(point: FreqPoint) {
      if (!started || !ambient) return;
      ambient.update(point.frequency);
    },

    isStarted: () => started,

    isMuted: () => Tone.getDestination().mute,

    setMuted(muted: boolean) {
      Tone.getDestination().mute = muted;
    },
  };
}
