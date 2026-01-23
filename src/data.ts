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

export async function fetchFrequency(): Promise<FreqPoint | null> {
  try {
    const response = await fetch(API_URL);
    const data: Response = await response.json();

    if (!data.Measurements || data.Measurements.length === 0) return null;

    const latestFrequency = data.Measurements[data.Measurements.length - 1];
    const timestamp = data.EndPointUTC;

    return {
      frequency: latestFrequency,
      timestamp,
    };
  } catch (error) {
    console.error("Failed to fetch frequency:", error);
    return null;
  }
}
