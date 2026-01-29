import type { FreqPoint } from "./data";
import { DELAY_SECONDS, NORMAL_DEVIATION, WARNING_DEVIATION } from "./config";

const HISTORY_SECONDS = 600;
const FREQ_MIN = 49.4;
const FREQ_MAX = 50.6;

const BG = "#050508";
const GRID_COLOR = "rgba(255, 255, 255, 0.03)";
const REF_LINE_COLOR = "rgba(255, 255, 255, 0.08)";
const GREEN = "#00ff77";
const YELLOW = "#ffaa00";
const RED = "#ff3366";

export class FrequencyCanvas {
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private pending: FreqPoint[] = [];
  private displayed: FreqPoint[] = [];
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
    const deviation = Math.abs(freq - 50);
    if (deviation <= NORMAL_DEVIATION) return GREEN;
    if (deviation <= WARNING_DEVIATION) return YELLOW;
    return RED;
  }

  private freqToY(freq: number): number {
    const height = this.canvas.height / this.dpr;
    const normalized = (freq - FREQ_MIN) / (FREQ_MAX - FREQ_MIN);
    return height - normalized * height;
  }

  getCurrentPoint(): FreqPoint | null {
    return this.displayed.length > 0
      ? this.displayed[this.displayed.length - 1]
      : null;
  }

  addPoints(pts: FreqPoint[]) {
    if (this.startedAt === null) {
      this.startedAt = Date.now();
    }

    const existing = new Set([
      ...this.pending.map((p) => p.timestamp),
      ...this.displayed.map((p) => p.timestamp),
    ]);
    const newPoints = pts.filter((p) => !existing.has(p.timestamp));
    this.pending.push(...newPoints);
    this.pending.sort((a, b) => a.timestamp - b.timestamp);
  }

  update(freqOffset: number) {
    const now = Date.now() - DELAY_SECONDS * 1000;

    // Move newly visible points from pending to displayed with baked offset
    const newlyVisible = this.pending.filter((p) => p.timestamp <= now);
    for (const p of newlyVisible) {
      this.displayed.push({
        timestamp: p.timestamp,
        frequency: p.frequency + freqOffset,
      });
    }
    this.pending = this.pending.filter((p) => p.timestamp > now);

    // Prune old displayed points
    const firstVisible = this.startedAt
      ? this.startedAt - DELAY_SECONDS * 1000
      : now;
    const cutoff = Math.max(now - HISTORY_SECONDS * 1000, firstVisible);
    this.displayed = this.displayed.filter((p) => p.timestamp >= cutoff);
  }

  render() {
    const w = this.canvas.width / this.dpr;
    const h = this.canvas.height / this.dpr;

    // Clear
    this.ctx.fillStyle = BG;
    this.ctx.fillRect(0, 0, w, h);

    // Draw subtle grid
    this.ctx.strokeStyle = GRID_COLOR;
    this.ctx.lineWidth = 1;

    // Horizontal grid lines (every 0.1 Hz)
    for (let freq = FREQ_MIN; freq <= FREQ_MAX; freq += 0.1) {
      const y = this.freqToY(freq);
      this.ctx.beginPath();
      this.ctx.moveTo(0, y);
      this.ctx.lineTo(w, y);
      this.ctx.stroke();
    }

    // Vertical grid lines (every minute)
    const gridSpacing = (60 / HISTORY_SECONDS) * w;
    for (let x = w; x >= 0; x -= gridSpacing) {
      this.ctx.beginPath();
      this.ctx.moveTo(x, 0);
      this.ctx.lineTo(x, h);
      this.ctx.stroke();
    }

    // Draw 50 Hz reference line
    const refY = this.freqToY(50);
    this.ctx.strokeStyle = REF_LINE_COLOR;
    this.ctx.lineWidth = 1;
    this.ctx.beginPath();
    this.ctx.moveTo(0, refY);
    this.ctx.lineTo(w, refY);
    this.ctx.stroke();

    if (this.displayed.length === 0) return;

    const now = Date.now() - DELAY_SECONDS * 1000;
    const startTime = now - HISTORY_SECONDS * 1000;

    const points = this.displayed.map((p) => ({
      x: ((p.timestamp - startTime) / (HISTORY_SECONDS * 1000)) * w,
      y: this.freqToY(p.frequency),
      freq: p.frequency,
    }));

    if (points.length === 0) return;

    if (points.length === 1) {
      const color = this.getColor(points[0].freq);
      this.ctx.fillStyle = color;
      this.ctx.beginPath();
      this.ctx.arc(points[0].x, points[0].y, 2, 0, Math.PI * 2);
      this.ctx.fill();
      return;
    }

    // Draw main line
    this.ctx.lineCap = "round";
    this.ctx.lineJoin = "round";
    this.ctx.globalAlpha = 1;
    this.ctx.lineWidth = 1.5;

    for (let i = 0; i < points.length - 1; i++) {
      const curr = points[i];
      const next = points[i + 1];
      const color = this.getColor(curr.freq);

      this.ctx.strokeStyle = color;
      this.ctx.beginPath();
      this.ctx.moveTo(curr.x, curr.y);
      this.ctx.lineTo(next.x, next.y);
      this.ctx.stroke();
    }
  }
}
