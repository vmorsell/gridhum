import "./style.css";
import type { FreqPoint } from "./data";
import { FrequencyCanvas } from "./canvas";
import { createAudioEngine } from "./audio";
import { inject } from "@vercel/analytics";
import { NORMAL_DEVIATION, WARNING_DEVIATION } from "./config";
import PollWorker from "./poll-worker?worker";

if (import.meta.env.PROD) inject();

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const frequencyCanvas = new FrequencyCanvas(canvas);
const audioEngine = createAudioEngine();

const debug = new URLSearchParams(window.location.search).has("debug");
const debugPanel = document.getElementById("debug") as HTMLDivElement;
const freqOffsetSlider = document.getElementById(
  "freq-offset",
) as HTMLInputElement;
const freqOffsetValue = document.getElementById(
  "freq-offset-value",
) as HTMLSpanElement;
const freqDisplay = document.getElementById("freq") as HTMLDivElement;
const volumeSlider = document.getElementById("volume") as HTMLInputElement;
const volumeIcon = document.getElementById("volume-icon") as HTMLButtonElement;

if (!debug) debugPanel.style.display = "none";

let hasData = false;
let lastVolume = 70; // Remember volume before muting

function updateVolumeIcon() {
  const volume = parseFloat(volumeSlider.value);
  volumeIcon.className = volume === 0 ? "muted" : volume <= 50 ? "low" : "high";
}

function updateVolume() {
  const volume = hasData ? parseFloat(volumeSlider.value) : 0;
  audioEngine.setVolume(volume);
  updateVolumeIcon();
}

volumeSlider.addEventListener("input", async () => {
  if (!audioEngine.isStarted()) {
    await startAudio();
  }
  const volume = parseFloat(volumeSlider.value);
  if (volume > 0) lastVolume = volume;
  updateVolume();
});

volumeIcon.addEventListener("click", async () => {
  if (!audioEngine.isStarted()) {
    await startAudio();
  }
  const currentVolume = parseFloat(volumeSlider.value);
  if (currentVolume > 0) {
    lastVolume = currentVolume;
    volumeSlider.value = "0";
  } else {
    volumeSlider.value = lastVolume.toString();
  }
  updateVolume();
});

let freqOffset = 0;

function getFreqColor(freq: number): string {
  const deviation = Math.abs(freq - 50);
  if (deviation <= NORMAL_DEVIATION) return "#00ff77";
  if (deviation <= WARNING_DEVIATION) return "#ffaa00";
  return "#ff3366";
}

function updateOffset(value: number) {
  freqOffset = Math.round(Math.max(-0.6, Math.min(0.6, value)) * 100) / 100;
  freqOffsetSlider.value = freqOffset.toString();
  const sign = freqOffset >= 0 ? "+" : "";
  freqOffsetValue.textContent = `${sign}${freqOffset.toFixed(2)} Hz`;
}

freqOffsetSlider.addEventListener("input", () =>
  updateOffset(parseFloat(freqOffsetSlider.value)),
);
document
  .getElementById("freq-down")!
  .addEventListener("click", () => updateOffset(freqOffset - 0.01));
document
  .getElementById("freq-up")!
  .addEventListener("click", () => updateOffset(freqOffset + 0.01));

// Use Web Worker for polling
const pollWorker = new PollWorker();
pollWorker.onmessage = (e) => {
  if (e.data.type === "data") {
    frequencyCanvas.addPoints(e.data.points);
  }
};

let lastDisplayedPoint: FreqPoint | null = null;

// Audio update loop
function updateAudio() {
  frequencyCanvas.update(freqOffset);

  const current = frequencyCanvas.getCurrentPoint();
  const hadData = hasData;
  hasData = current !== null;

  if (hasData !== hadData) {
    updateVolume();
  }

  if (current && current !== lastDisplayedPoint) {
    freqDisplay.textContent = `${current.frequency.toFixed(3)} Hz`;
    freqDisplay.style.color = getFreqColor(current.frequency);
    audioEngine.update(current);
    lastDisplayedPoint = current;
  } else if (!current) {
    freqDisplay.textContent = "";
  }
}

// Render loop
function render() {
  frequencyCanvas.render();
  requestAnimationFrame(render);
}

// Start audio on first user interaction
const prompt = document.getElementById("prompt");

async function startAudio() {
  if (audioEngine.isStarted()) return;

  await audioEngine.start();
  prompt?.classList.add("hidden");
  updateVolume();

  // Update with current data if available
  const current = frequencyCanvas.getCurrentPoint();
  if (current) {
    audioEngine.update(current);
  }

  // Remove listeners after starting
  document.removeEventListener("click", startAudio);
  document.removeEventListener("keydown", startAudio);
  document.removeEventListener("touchstart", startAudio);
}

document.addEventListener("click", startAudio);
document.addEventListener("keydown", startAudio);
document.addEventListener("touchstart", startAudio);

setInterval(updateAudio, 100);
render();
updateVolumeIcon();
