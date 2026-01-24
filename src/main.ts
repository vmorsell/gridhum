import "./style.css";
import { fetchFrequency } from "./data";
import type { FreqPoint } from "./data";
import { FrequencyCanvas } from "./canvas";
import { createAudioEngine } from "./audio";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const frequencyCanvas = new FrequencyCanvas(canvas);
const audioEngine = createAudioEngine();

const debug = new URLSearchParams(window.location.search).has("debug");
const debugPanel = document.getElementById("debug") as HTMLDivElement;
const freqOffsetSlider = document.getElementById("freq-offset") as HTMLInputElement;
const freqOffsetValue = document.getElementById("freq-offset-value") as HTMLSpanElement;
const freqDisplay = document.getElementById("freq") as HTMLDivElement;
const muteBtn = document.getElementById("mute") as HTMLButtonElement;

if (!debug) debugPanel.style.display = "none";

let audioEnabled = false;

function updateMuteButton() {
  muteBtn.className = audioEnabled && !audioEngine.isMuted() ? "on" : "off";
}

muteBtn.addEventListener("click", async () => {
  if (!audioEngine.isStarted()) {
    await startAudio();
  } else {
    audioEngine.setMuted(!audioEngine.isMuted());
  }
  updateMuteButton();
});

let latestPoint: FreqPoint | null = null;
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

freqOffsetSlider.addEventListener("input", () => updateOffset(parseFloat(freqOffsetSlider.value)));
document.getElementById("freq-down")!.addEventListener("click", () => updateOffset(freqOffset - 0.01));
document.getElementById("freq-up")!.addEventListener("click", () => updateOffset(freqOffset + 0.01));

async function poll() {
  const point = await fetchFrequency();
  if (point) {
    const adjustedPoint = { ...point, frequency: point.frequency + freqOffset };
    frequencyCanvas.addPoint(adjustedPoint);
    latestPoint = adjustedPoint;

    freqDisplay.textContent = `${adjustedPoint.frequency.toFixed(3)} Hz`;
    freqDisplay.style.color = getFreqColor(adjustedPoint.frequency);

    audioEngine.update(adjustedPoint);
  }
}

function animate() {
  frequencyCanvas.render();
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

  // Update with latest data if available
  if (latestPoint) {
    audioEngine.update(latestPoint);
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
setInterval(poll, 1000);

// Start render loop
animate();

// Initial mute button state
updateMuteButton();
