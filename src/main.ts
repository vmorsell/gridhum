import "./style.css";
import { fetchFrequency } from "./data";
import type { FreqPoint } from "./data";
import { FrequencyCanvas } from "./canvas";
import { createAudioEngine } from "./audio";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const frequencyCanvas = new FrequencyCanvas(canvas);
const audioEngine = createAudioEngine();

let latestPoint: FreqPoint | null = null;

async function poll() {
  const point = await fetchFrequency();
  if (point) {
    console.debug(point.frequency.toFixed(3), "Hz");
    frequencyCanvas.addPoint(point);
    latestPoint = point;

    // Update audio with latest data
    audioEngine.update(point);
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
  prompt?.classList.add("hidden");

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
