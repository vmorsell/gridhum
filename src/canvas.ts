import type { FreqPoint } from "./data";
import { DELAY_SECONDS } from "./config";

const HISTORY_SECONDS = 600;
const FREQ_MIN = 49.4;
const FREQ_MAX = 50.6;

const BG = "#0a0a0a";
const REF_LINE_COLOR = "rgba(255, 255, 255, 0.15)";
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
  private startedAt: number | null = null;

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

  getCurrentPoint(): FreqPoint | null {
    if (!this.startedAt) return null;

    const now = Date.now() - DELAY_SECONDS * 1000;
    const firstVisible = this.startedAt - DELAY_SECONDS * 1000;

    const visible = this.history.filter(
      (p) => p.timestamp >= firstVisible && p.timestamp <= now,
    );

    return visible.length > 0 ? visible[visible.length - 1] : null;
  }

  addPoints(pts: FreqPoint[]) {
    if (this.startedAt === null) {
      this.startedAt = Date.now();
    }

    const existingTimestamps = new Set(this.history.map((p) => p.timestamp));
    const newPoints = pts.filter((p) => !existingTimestamps.has(p.timestamp));
    this.history.push(...newPoints);
    this.history.sort((a, b) => a.timestamp - b.timestamp);

    // Keep only data within display window
    const cutoff = Date.now() - (HISTORY_SECONDS + DELAY_SECONDS) * 1000;
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

    const now = Date.now() - DELAY_SECONDS * 1000;
    const startTime = now - HISTORY_SECONDS * 1000;
    const firstVisible = this.startedAt
      ? this.startedAt - DELAY_SECONDS * 1000
      : now;

    this.ctx.lineWidth = 2;
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";

    const visible = this.history.filter(
      (p) => p.timestamp >= firstVisible && p.timestamp <= now,
    );

    const points = visible.map((p) => ({
      x: ((p.timestamp - startTime) / (HISTORY_SECONDS * 1000)) * w,
      y: this.freqToY(p.frequency),
      freq: p.frequency,
    }));

    if (points.length === 0) return;

    if (points.length === 1) {
      this.ctx.strokeStyle = this.getColor(points[0].freq);
      this.ctx.beginPath();
      this.ctx.arc(points[0].x, points[0].y, 2, 0, Math.PI * 2);
      this.ctx.fill();
      return;
    }

    // Interpolate lines
    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];

      this.ctx.strokeStyle = this.getColor(curr.freq);
      this.ctx.beginPath();
      this.ctx.moveTo(curr.x, curr.y);
      this.ctx.lineTo(next.x, next.y);
      this.ctx.stroke();
    }
  }
}
