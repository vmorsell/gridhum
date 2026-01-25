import "./style.css";
import { fetchFrequency } from "./data";
import type { FreqPoint } from "./data";
import { FrequencyCanvas } from "./canvas";
import { createAudioEngine } from "./audio";
import { inject } from "@vercel/analytics";
import { FETCH_INTERVAL_SECONDS } from "./config";

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
const muteBtn = document.getElementById("mute") as HTMLButtonElement;

if (!debug) debugPanel.style.display = "none";

let audioEnabled = false;
let userMuted = false;
let hasData = false;

function updateMuteButton() {
  muteBtn.className = audioEnabled && !userMuted && hasData ? "on" : "off";
}

function updateAudioMute() {
  audioEngine.setMuted(userMuted || !hasData);
}

muteBtn.addEventListener("click", async () => {
  if (!audioEngine.isStarted()) {
    await startAudio();
  } else {
    userMuted = !userMuted;
    updateAudioMute();
  }
  updateMuteButton();
});

let freqOffset = 0;

function getFreqColor(freq: number): string {
  if (freq >= 49.9 && freq <= 50.1) return "#22c55e";
  if (freq >= 49.5 && freq <= 50.5) return "#eab308";
  return "#ef4444";
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

async function poll() {
  const points = await fetchFrequency();
  if (points && points.length > 0) {
    frequencyCanvas.addPoints(points);
  }
}

let lastDisplayedPoint: FreqPoint | null = null;

function animate() {
  frequencyCanvas.update(freqOffset);
  frequencyCanvas.render();

  const current = frequencyCanvas.getCurrentPoint();
  const hadData = hasData;
  hasData = current !== null;

  if (hasData !== hadData) {
    updateAudioMute();
    updateMuteButton();
  }

  if (current && current !== lastDisplayedPoint) {
    freqDisplay.textContent = `${current.frequency.toFixed(3)} Hz`;
    freqDisplay.style.color = getFreqColor(current.frequency);
    audioEngine.update(current);
    lastDisplayedPoint = current;
  } else if (!current) {
    freqDisplay.textContent = "";
  }

  requestAnimationFrame(animate);
}

// Start audio on first user interaction
const prompt = document.getElementById("prompt");

async function startAudio() {
  if (audioEngine.isStarted()) return;

  await audioEngine.start();
  audioEnabled = true;
  prompt?.classList.add("hidden");
  updateMuteButton();

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

// Poll API every second
poll();
setInterval(poll, FETCH_INTERVAL_SECONDS * 1000);

// Start render loop
animate();

// Initial mute button state
updateMuteButton();
