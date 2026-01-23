import "./style.css";
import { fetchFrequency } from "./data";
import { FrequencyCanvas } from "./canvas";

const canvas = document.getElementById("canvas") as HTMLCanvasElement;
const frequencyCanvas = new FrequencyCanvas(canvas);

async function poll() {
  const point = await fetchFrequency();
  if (point) {
    console.debug(point.frequency.toFixed(3), "Hz");
    frequencyCanvas.addPoint(point);
  }
}

function animate() {
  frequencyCanvas.render();
  requestAnimationFrame(animate);
}

// Poll API every second
poll();
setInterval(poll, 1000);

// Start render loop
animate();
