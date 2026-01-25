export interface FreqPoint {
  frequency: number;
  timestamp: number;
}

interface Response {
  StartPointUTC: number;
  EndPointUTC: number;
  PeriodTickMs: number;
  Measurements: number[];
}

const API_URL = "/api/frequency";

export async function fetchFrequency(): Promise<FreqPoint[] | null> {
  try {
    const response = await fetch(API_URL);
    const data: Response = await response.json();

    if (!data.Measurements || data.Measurements.length === 0) return null;

    const startTime = data.StartPointUTC;
    const tick = data.PeriodTickMs;

    return data.Measurements.map((frequency, i) => ({
      frequency,
      timestamp: startTime + i * tick,
    }));
  } catch (error) {
    console.error("Failed to fetch frequency:", error);
    return null;
  }
}
