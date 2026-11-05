/** To switch to real data, set source to 'firebase', configure firebase-config.js, enable Email/Password auth and rules. */
export const config = Object.freeze({
  source:'demo', // demo: fully offline; firebase: requires operator sign-in, working device and inference bridge
  deviceId:'saluran-01',
  intervalMs:5000,
  staleAfterMs:30000,
  thresholds:{flowLossPercent:20,heightGapCm:1.5}, // Comparison only; NOT ML decisions or safety interlocks.
});
