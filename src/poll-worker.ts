import { FETCH_INTERVAL_SECONDS } from "./config";

interface Response {
  StartPointUTC: number;
  EndPointUTC: number;
  PeriodTickMs: number;
  Measurements: number[];
}

const API_URL = "/api/frequency";

async function poll() {
  try {
    const res = await fetch(API_URL);
    if (res.ok) {
      const data: Response = await res.json();
      if (data.Measurements && data.Measurements.length > 0) {
        const startTime = data.StartPointUTC;
        const tick = data.PeriodTickMs;
        const points = data.Measurements.map((frequency, i) => ({
          frequency,
          timestamp: startTime + i * tick,
        }));
        self.postMessage({ type: "data", points });
      }
    }
  } catch (e: any) {
    console.error("Poll error:", e);
  }
}

poll();
setInterval(poll, FETCH_INTERVAL_SECONDS * 1000);
