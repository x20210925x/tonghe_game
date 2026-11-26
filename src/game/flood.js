// Chapter two's rules: the rising reservoir, the gusts on the storm bridge and the hand pump.
// Pure functions of time and position, so they run under node --test.
import { STORM_BRIDGE, REFUGE, NORTH_DOOR, RESERVOIR } from './layout.js';

// Metres per second the reservoir climbs with 0, 1, 2 and 3 gates open (the last drains it).
// A shift at half the expected pace still reaches the third gate below the crest.
export const RISE = [0.0095, 0.0062, 0.0034, -0.07];
export function riseRate(open) {
  const n = Math.max(0, Math.min(3, open)),
    i = Math.min(2, Math.floor(n));
  return RISE[i] + (RISE[i + 1] - RISE[i]) * (n - i);
}
// Warnings as the water climbs; the last one is a short way under the crest.
export const ALARMS = [94.5, 95.2, 95.6];

// Gate 3 is hydraulic. Each stroke of the hand pump adds pressure, which leaks away; above
// the cracking pressure the gate rises and spends pressure as it goes.
export const PUMP = { stroke: 0.085, auto: 2.4, leak: 0.035, crack: 0.62, rate: 0.06, cost: 0.05 };
// Commanded rope-hoist gates take this many seconds to open fully.
export const GATE_TIME = 9;

// Gusts cross the bridge from the west every period: calm, a warning, then the blow.
export const GUST = { period: 12, warn: 2.4, blow: 2.8, speed: 4.6 };
export function gustAt(t) {
  const p = ((t % GUST.period) + GUST.period) % GUST.period,
    blowAt = GUST.period - GUST.blow,
    warnAt = blowAt - GUST.warn;
  if (p < warnAt) return { phase: 'calm', warn: 0, push: 0 };
  if (p < blowAt) return { phase: 'warn', warn: (p - warnAt) / GUST.warn, push: 0 };
  const k = (p - blowAt) / GUST.blow;
  return { phase: 'gust', warn: 1, push: Math.max(0, Math.min(1, k / 0.18, (1 - k) / 0.18)) };
}
// 1 on the open deck of the storm bridge, 0 in the lee of a windbreak, in the doorway or off it.
export function windExposure(x, y, z) {
  if (y < STORM_BRIDGE.top - 2 || y > STORM_BRIDGE.top + 4) return 0;
  if (x < REFUGE.x0 - 2 || x > REFUGE.x1 + 4) return 0;
  if (z > STORM_BRIDGE.z0 - 2.2 || z < STORM_BRIDGE.z1 + 0.5) return 0;
  for (const p of STORM_BRIDGE.piers) if (Math.abs(z - p) < REFUGE.half - 0.5 && x < REFUGE.x1 + 0.5) return 0;
  return 1;
}
// Where a gust victim starts again: the last refuge passed on the way north, or the door.
export function refugeBehind(z) {
  const passed = STORM_BRIDGE.piers.filter((p) => p > z + REFUGE.half - 0.5);
  if (!passed.length) return [(NORTH_DOOR.x0 + NORTH_DOOR.x1) / 2, STORM_BRIDGE.top, STORM_BRIDGE.z0 - 1.2, 0];
  return [REFUGE.x0 + 2.2, STORM_BRIDGE.top, Math.min(...passed), 0];
}
export const clampLevel = (v) => Math.max(RESERVOIR.low, Math.min(RESERVOIR.crest, v));
