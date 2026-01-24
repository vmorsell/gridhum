// Note frequencies (octave 3)
export const NOTE = {
  C: 130.81,
  C_SHARP: 138.59,
  D: 146.83,
  D_SHARP: 155.56,
  E: 164.81,
  F: 174.61,
  F_SHARP: 185.0,
  G: 196.0,
  G_SHARP: 207.65,
  A: 220.0,
  A_SHARP: 233.08,
  B: 246.94,
} as const;

// Scale degrees (semitones in major scale)
export const DEGREE = {
  I: 0,
  II: 2,
  III: 4,
  IV: 5,
  V: 7,
  VI: 9,
  VII: 11,
} as const;

export const MAJOR_SCALE = Object.values(DEGREE);

export function transpose(frequency: number, semitones: number): number {
  return frequency * Math.pow(2, semitones / 12);
}

export function octave(frequency: number, octaves: number): number {
  return frequency * Math.pow(2, octaves);
}

export function freq(
  note: number,
  interval: number = 0,
  octaveShift: number = 0,
): number {
  return transpose(octave(note, octaveShift), interval);
}

export function freqToSemitones(frequency: number, base: number): number {
  return 12 * Math.log2(frequency / base);
}

export function findClosestScaleDegree(
  semitones: number,
  scale: number[] = MAJOR_SCALE,
): number {
  const normalized = ((semitones % 12) + 12) % 12;

  let closest = scale[0];
  let minDist = Infinity;

  for (const degree of scale) {
    const dist = Math.min(
      Math.abs(normalized - degree),
      12 - Math.abs(normalized - degree),
    );
    if (dist < minDist) {
      minDist = dist;
      closest = degree;
    }
  }

  return closest;
}
