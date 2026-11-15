// Return a reproducible pseudo-random number generator.
export function createSeededRandom(seed) {
  let state = seed >>> 0;

  return function random() {
    state = (
      Math.imul(1664525, state) + 1013904223
    ) >>> 0;

    return state / 4294967296;
  };
}