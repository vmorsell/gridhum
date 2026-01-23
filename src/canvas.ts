import type { FreqPoint } from "./data";

const HISTORY_SECONDS = 120;
const FREQ_MIN = 49.4;
const FREQ_MAX = 50.6;

const BG = "#0a0a0a";
const REF_LINE_COLOR = "rgba(255, 255, 255, 0.1)";
const GREEN = "#22c55e";
const YELLOW = "#eab308";
const RED = "#ef4444";

const NORMAL_BAND = [49.9, 50.1];
const WARNING_BAND = [49.5, 50.5];

export class FrequencyCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private history: FreqPoint[] = [];
  private dpr: number;

  constructor(canvas: HTMLCanvasElement) {
    this.canvas = canvas;
    this.ctx = canvas.getContext("2d")!;
    this.dpr = window.devicePixelRatio || 1;
    this.resize();
    window.addEventListener("resize", () => this.resize());
  }

  private resize() {
    const rect = this.canvas.getBoundingClientRect();
    this.canvas.width = rect.width * this.dpr;
    this.canvas.height = rect.height * this.dpr;
    this.ctx.scale(this.dpr, this.dpr);
  }

  private getColor(freq: number): string {
    if (freq >= NORMAL_BAND[0] && freq <= NORMAL_BAND[1]) return GREEN;
    if (freq >= WARNING_BAND[0] && freq <= WARNING_BAND[1]) return YELLOW;
    return RED;
  }

  private freqToY(freq: number): number {
    const height = this.canvas.height / this.dpr;
    const normalized = (freq - FREQ_MIN) / (FREQ_MAX - FREQ_MIN);
    return height - normalized * height;
  }

  addPoint(pt: FreqPoint) {
    this.history.push(pt);

    // Keep only last HISTORY_SECONDS worth of data
    const cutoff = Date.now() - HISTORY_SECONDS * 1000;
    this.history = this.history.filter((p) => p.timestamp > cutoff);
  }

  render() {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;

    // Clear
    this.ctx.fillStyle = BG;
    this.ctx.fillRect(0, 0, w, h);

    if (this.history.length === 0) return;

    // Draw 50 Hz reference line
    const refY = this.freqToY(50);
    this.ctx.strokeStyle = REF_LINE_COLOR;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, refY);
    this.ctx.lineTo(w, refY);
    this.ctx.stroke();

    // Draw frequency line
    const now = Date.now();
    const startTime = now - HISTORY_SECONDS * 1000;

    this.ctx.lineWidth = 2;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    // Draw as stepped line with color segments
    for (let i = 0; i < this.history.length; i++) {
      const point = this.history[i];
      const nextPoint = this.history[i + 1];

      const x = ((point.timestamp - startTime) / (HISTORY_SECONDS * 1000)) * w;
      const y = this.freqToY(point.frequency);

      const endX = nextPoint
        ? ((nextPoint.timestamp - startTime) / (HISTORY_SECONDS * 1000)) * w
        : ((now - startTime) / (HISTORY_SECONDS * 1000)) * w;

      this.ctx.strokeStyle = this.getColor(point.frequency);
      this.ctx.beginPath();
      this.ctx.moveTo(x, y);
      this.ctx.lineTo(endX, y); // Horizontal step
      if (nextPoint) {
        this.ctx.lineTo(endX, this.freqToY(nextPoint.frequency)); // Vertical step
      }
      this.ctx.stroke();
    }
  }
}
