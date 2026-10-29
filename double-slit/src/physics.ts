// Idealised far-field (Fraunhofer) model of the two-slit experiment, in screen
// units. Detections are SIMULATED by sampling these distributions; they are
// not experimental data. Shapes follow the textbook result (e.g. Feynman
// Lectures Vol. III ch. 1):
//   no path information:   P(x) ∝ |ψ1 + ψ2|²  = envelope · cos²(π x / fringe)
//   with path information: P(x) ∝ |ψ1|² + |ψ2|² (no interference term)
import {mulberry32} from './three/math';

export const SCREEN_W = 3.2; // detector width (scene units)
export const SCREEN_H = 1.6;
export const FRINGE = 0.36; // spacing between bright fringes
export const ENVELOPE = 1.25; // single-slit diffraction width (first zero)

const sinc2 = (u: number) => (u === 0 ? 1 : (Math.sin(Math.PI * u) / (Math.PI * u)) ** 2);
export const envelope = (x: number) => sinc2(x / ENVELOPE);
/** Probability density without which-path information (interference). */
export const pInterference = (x: number) => envelope(x) * Math.cos((Math.PI * x) / FRINGE) ** 2;
/** With which-path information: the two single-slit patterns simply add. */
export const pNoInterference = (x: number) => 0.5 * (sinc2((x - 0.05) / ENVELOPE) + sinc2((x + 0.05) / ENVELOPE)) * 0.5;

/** Rejection-sample n hits (x, y) from a 1D density; y spreads along the slit length. */
export const sampleHits = (density: (x: number) => number, n: number, seed: number) => {
  const rand = mulberry32(seed);
  const xs = new Float32Array(n);
  const ys = new Float32Array(n);
  const max = density(0) * 1.02;
  for (let i = 0; i < n; ) {
    const x = (rand() - 0.5) * SCREEN_W;
    if (rand() * max > density(x)) continue;
    // vertical spread: the slits are long, so hits fill a band with soft edges
    let y = (rand() - 0.5) * SCREEN_H * 0.82;
    y += (rand() - 0.5) * 0.12;
    xs[i] = x;
    ys[i] = y;
    i++;
  }
  return {xs, ys};
};
