# Gridhum

Sonification of the European electrical grid.

The grid runs at 50 Hz. Deviations from this frequency indicate stress on the system. This app turns that data into ambient sound — calm when stable, tense when drifting.

## How it works

- Fetches real-time frequency data from the Nordic grid (Statnett)
- Visualizes frequency as a scrolling line graph
- Generates ambient audio that responds to grid state:
  - **49.9–50.1 Hz**: Calm drone
  - **49.5–50.5 Hz**: Increasing tension (tremolo, dissonance, distortion)
  - **Outside**: Maximum tension

## Run locally

```bash
pnpm install
pnpm dev
```

## Debug mode

Add `?debug` to the URL to show frequency offset controls. Useful for testing tension effects without waiting for real grid events.
