import * as Tone from "tone";
import type { FreqPoint } from "../data";
import { Ambient } from "./ambient";

export interface AudioEngine {
  start(): Promise<void>;
  update(point: FreqPoint): void;
  isStarted(): boolean;
  setVolume(volume: number): void;
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

    setVolume(volume: number) {
      // Convert 0-100 to dB using logarithmic curve for perceptual linearity
      // Max at -6dB for headroom (reverb can add gain)
      if (volume === 0) {
        Tone.getDestination().volume.value = -Infinity;
      } else {
        // Attempt to follow a perceptual volume curve
        // Volume 100 -> -6dB, Volume 1 -> -60dB
        const normalized = volume / 100;
        const db = -6 + 20 * Math.log10(normalized);
        Tone.getDestination().volume.value = Math.max(-60, db);
      }
    },
  };
}
