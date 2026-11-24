// All sound is synthesized locally. The long return is mixed by enclosure: the booth is dry,
// the spillway is open air, and the core shaft rings for seconds.
import { LIFT, OUTLET, GATES, DAM } from '../game/layout.js';

export class Soundscape {
  constructor() {
    this.volume = 0.65;
    this.muted = false;
    this.active = false;
  }
  start() {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (!Ctx) return;
    if (!this.ctx) this.build(new Ctx());
    this.active = true;
    this.ctx.resume().catch(() => {});
    this.apply();
  }
  build(c) {
    this.ctx = c;
    this.master = c.createGain();
    this.master.gain.value = 0;
    this.master.connect(c.destination);
    this.mix = c.createGain();
    this.mix.gain.value = 0.7;
    this.mix.connect(this.master);
    this.echo = c.createConvolver();
    const len = Math.floor(c.sampleRate * 4.6),
      ir = c.createBuffer(2, len, c.sampleRate);
    for (let ch = 0; ch < 2; ch++) {
      const a = ir.getChannelData(ch);
      for (let i = 0; i < len; i++)
        a[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / len, 3.4) * (i < 0.05 * c.sampleRate ? 0.05 : 1);
    }
    this.echo.buffer = ir;
    this.return = c.createGain();
    this.return.gain.value = 0.31;
    this.echo.connect(this.return).connect(this.mix);
    const samples = c.sampleRate * 4;
    this.noise = c.createBuffer(1, samples, c.sampleRate);
    const a = this.noise.getChannelData(0);
    let prev = 0;
    for (let i = 0; i < samples; i++) {
      prev = (prev + 0.022 * (Math.random() * 2 - 1)) / 1.018;
      a[i] = prev * 4.1;
    }
    const loop = (rate = 1) => {
      const s = c.createBufferSource();
      s.buffer = this.noise;
      s.loop = true;
      s.playbackRate.value = rate;
      s.start();
      return s;
    };
    const panner = () => (c.createStereoPanner ? c.createStereoPanner() : c.createGain());
    // Wind, stronger with height.
    this.windFilter = c.createBiquadFilter();
    this.windFilter.type = 'bandpass';
    this.windFilter.Q.value = 0.45;
    this.windFilter.frequency.value = 400;
    this.wind = c.createGain();
    this.wind.gain.value = 0.13;
    loop().connect(this.windFilter).connect(this.wind).connect(this.mix);
    // A low bed under everything.
    const bed = c.createOscillator();
    bed.frequency.value = 46.25;
    const bg = c.createGain();
    bg.gain.value = 0.022;
    bed.connect(bg).connect(this.mix);
    bed.start();
    // Spill outlet.
    const spillFilter = c.createBiquadFilter();
    spillFilter.type = 'highpass';
    spillFilter.frequency.value = 310;
    this.spill = c.createGain();
    this.spill.gain.value = 0;
    this.spillPan = panner();
    loop(2.7).connect(spillFilter).connect(this.spill).connect(this.spillPan).connect(this.mix);
    this.spill.connect(this.echo);
    // Lift motor.
    const motor = c.createOscillator();
    motor.type = 'triangle';
    motor.frequency.value = 57.8;
    this.motor = c.createGain();
    this.motor.gain.value = 0;
    this.motorPan = panner();
    motor.connect(this.motor).connect(this.motorPan).connect(this.mix);
    this.motor.connect(this.echo);
    motor.start();
    this.motorOsc = motor;
    // Cart axle.
    this.axle = c.createOscillator();
    this.axle.type = 'triangle';
    this.axle.frequency.value = 38;
    this.rolling = c.createGain();
    this.rolling.gain.value = 0;
    this.axle.connect(this.rolling).connect(this.mix);
    this.axle.start();
    // The core once it runs: two detuned drones and a slow swell.
    this.hum = c.createGain();
    this.hum.gain.value = 0;
    for (const [f, g] of [
      [41.2, 0.5],
      [82.6, 0.28],
      [123.1, 0.1],
    ]) {
      const o = c.createOscillator();
      o.frequency.value = f;
      const og = c.createGain();
      og.gain.value = g;
      o.connect(og).connect(this.hum);
      o.start();
    }
    this.hum.connect(this.mix);
    this.hum.connect(this.echo);

    // ---------- Chapter two: the storm ----------
    // Rain: bright hiss over a softer patter, muffled by a roof overhead.
    const rainHigh = c.createBiquadFilter();
    rainHigh.type = 'highpass';
    rainHigh.frequency.value = 1300;
    this.rainRoof = c.createBiquadFilter();
    this.rainRoof.type = 'lowpass';
    this.rainRoof.frequency.value = 9000;
    this.rain = c.createGain();
    this.rain.gain.value = 0;
    loop(3.1).connect(rainHigh).connect(this.rainRoof);
    const patter = c.createBiquadFilter();
    patter.type = 'bandpass';
    patter.frequency.value = 520;
    patter.Q.value = 0.7;
    loop(1.7).connect(patter).connect(this.rainRoof);
    this.rainRoof.connect(this.rain).connect(this.mix);
    // A whistle across the bridge rails that climbs before each gust.
    this.whistleFilter = c.createBiquadFilter();
    this.whistleFilter.type = 'bandpass';
    this.whistleFilter.Q.value = 9;
    this.whistleFilter.frequency.value = 600;
    this.whistle = c.createGain();
    this.whistle.gain.value = 0;
    loop(1.3).connect(this.whistleFilter).connect(this.whistle).connect(this.mix);
    // The dam spilling: a low roar from the open bays, louder the more gates are open.
    const roarLow = c.createBiquadFilter();
    roarLow.type = 'lowpass';
    roarLow.frequency.value = 520;
    this.roar = c.createGain();
    this.roar.gain.value = 0;
    this.roarPan = panner();
    loop(0.8).connect(roarLow).connect(this.roar).connect(this.roarPan).connect(this.mix);
    this.roar.connect(this.echo);
  }
  // Thunder from a strike some kilometres off: a crack when it is close, then a long roll.
  thunder(delay = 2, power = 0.6) {
    if (!this.ctx || !this.active) return;
    const p = Math.max(0.15, Math.min(1, power));
    if (p > 0.72) this.burst(2600, 0.32, 0.5 * p, 'highpass', 1.6, delay);
    this.burst(160, 3.2 + p * 1.6, 0.85 * p, 'lowpass', 0.55, delay + 0.05);
    this.burst(90, 4.2, 0.55 * p, 'lowpass', 0.4, delay + 0.6);
    this.tone(48, 31, 3.4, 0.12 * p, delay + 0.1);
  }
  apply() {
    if (this.ctx)
      this.master.gain.setTargetAtTime(this.active && !this.muted ? this.volume * 0.63 : 0, this.ctx.currentTime, 0.09);
  }
  set(volume, muted) {
    this.volume = volume;
    this.muted = muted;
    this.apply();
  }
  idle() {
    this.active = false;
    this.apply();
  }
  pan(sx, sz, x, z, yaw, min = 4) {
    const dx = sx - x,
      dz = sz - z;
    return Math.max(-1, Math.min(1, (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / Math.max(min, Math.hypot(dx, dz))));
  }
  // p: { x, y, z, yaw, inside, booth, small, site, storm: { rain, storm, warn, push, exposed } }
  update(p) {
    if (!this.ctx) return;
    const { x, y, z, yaw, inside, booth, site } = p,
      c = this.ctx.currentTime;
    const storm = p.storm || { rain: 0, storm: 0, warn: 0, push: 0, exposed: 0 };
    const height = Math.max(0, Math.min(1, y / 130));
    const open = 1 - Math.max(inside, booth);
    // Small rooms on the dam ring briefly; the core shaft rings for seconds.
    this.return.gain.setTargetAtTime(booth > 0.5 || p.small ? 0.12 : inside > 0.5 ? 0.62 : 0.38, c, 0.6);
    const gust = storm.push * storm.exposed;
    this.wind.gain.setTargetAtTime(
      0.05 + open * (0.1 + height * 0.2 + storm.storm * 0.12) + 0.025 * Math.sin(site.time * 0.21) + gust * 0.34,
      c,
      gust > 0.1 ? 0.15 : 0.6
    );
    this.windFilter.frequency.setTargetAtTime(220 + open * (260 + height * 380) + 80 * Math.sin(site.time * 0.13) + gust * 420, c, 0.5);
    this.rain.gain.setTargetAtTime(storm.rain * (0.2 - 0.09 * inside), c, 0.8);
    this.rainRoof.frequency.setTargetAtTime(inside > 0.5 ? 700 : 9000, c, 0.3);
    const onBridge = storm.exposed || (storm.rain > 0.5 && y > 90 && z < -300 && z > -470 && inside < 0.5) ? 1 : 0;
    this.whistle.gain.setTargetAtTime(onBridge * (storm.warn * 0.055 + storm.push * 0.07), c, 0.25);
    this.whistleFilter.frequency.setTargetAtTime(520 + storm.warn * 520 + storm.push * 380, c, 0.4);
    // The open bays roar from the foot of the dam face.
    const flow = site.gates ? GATES.reduce((n, g) => n + site.gates[g.id], 0) : 0;
    const roarX = 100,
      roarD = Math.hypot(roarX - x, (DAM.face - y) * 0.6, DAM.down + 4 - z);
    this.roar.gain.setTargetAtTime(flow > 0 ? (0.42 * Math.min(1, flow / 2)) / (1 + (roarD / 60) ** 1.6) * (1 - inside * 0.6) : 0, c, 0.8);
    if (this.roarPan.pan) this.roarPan.pan.setTargetAtTime(this.pan(roarX, DAM.down + 4, x, z, yaw, 20), c, 0.2);
    const range = Math.hypot(OUTLET.x - x, OUTLET.z - z, y * 0.5);
    this.spill.gain.setTargetAtTime(site.has('valve') ? (0.47 / (1 + (range / 24) ** 1.7)) * (1 - inside * 0.8) : 0.002, c, 0.55);
    if (this.spillPan.pan) this.spillPan.pan.setTargetAtTime(this.pan(OUTLET.x, OUTLET.z, x, z, yaw, 3), c, 0.1);
    const liftD = Math.hypot(LIFT.cx - x, site.liftY - y, LIFT.cz - z);
    const running = site.liftMoving ? 1 : 0;
    this.motor.gain.setTargetAtTime(running * (0.16 / (1 + liftD * 0.03)) + (site.has('main') ? 0.004 : 0), c, 0.4);
    this.motorOsc.frequency.setTargetAtTime(52 + running * 14, c, 0.6);
    if (this.motorPan.pan) this.motorPan.pan.setTargetAtTime(this.pan(LIFT.cx, LIFT.cz, x, z, yaw, 5), c, 0.18);
    this.axle.frequency.setTargetAtTime(37 + site.cartSpeed * 7.3, c, 0.17);
    this.rolling.gain.setTargetAtTime(site.aboard ? 0.014 + site.cartSpeed * 0.0055 : 0, c, 0.17);
    const humLevel = site.has('console') ? 0.03 + inside * 0.07 + height * 0.02 : 0;
    this.hum.gain.setTargetAtTime(humLevel, c, 1.2);
  }
  tone(hz, end, length, level, delay = 0, type = 'sine') {
    if (!this.ctx) return;
    const c = this.ctx,
      at = c.currentTime + delay,
      src = c.createOscillator(),
      g = c.createGain();
    src.type = type;
    src.frequency.setValueAtTime(hz, at);
    src.frequency.exponentialRampToValueAtTime(end, at + length);
    g.gain.setValueAtTime(0.0001, at);
    g.gain.exponentialRampToValueAtTime(level, at + 0.015);
    g.gain.exponentialRampToValueAtTime(0.0001, at + length);
    src.connect(g);
    g.connect(this.mix);
    g.connect(this.echo);
    src.start(at);
    src.stop(at + length + 0.02);
    src.onended = () => {
      src.disconnect();
      g.disconnect();
    };
  }
  burst(freq, length, level, type = 'highpass', rate = 1.5, delay = 0) {
    if (!this.ctx) return;
    const c = this.ctx,
      t = c.currentTime + delay,
      src = c.createBufferSource(),
      g = c.createGain(),
      f = c.createBiquadFilter();
    src.buffer = this.noise;
    src.playbackRate.value = rate + Math.random() * 0.6;
    f.type = type;
    f.frequency.value = freq;
    g.gain.setValueAtTime(level, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + length);
    src.connect(f).connect(g);
    g.connect(this.mix);
    g.connect(this.echo);
    src.start(t, Math.random() * 1.3);
    src.stop(t + length + 0.02);
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    };
  }
  step(metal, run) {
    this.burst(metal ? 850 : 310, 0.145, run ? 0.58 : 0.43);
    this.tone(metal ? 181 : 108, metal ? 76 : 44, 0.15, run ? 0.115 : 0.083);
    if (metal) this.tone(1240, 900, 0.06, 0.012, 0.01, 'triangle');
  }
  land(height, metal) {
    const k = Math.min(1, height / 4);
    this.burst(metal ? 600 : 220, 0.22 + k * 0.2, 0.4 + k * 0.5, 'lowpass', 1.1);
    this.tone(metal ? 140 : 80, 40, 0.25 + k * 0.2, 0.1 + k * 0.12);
  }
  effect(name) {
    const t = (...a) => this.tone(...a);
    switch (name) {
      case 'detent':
        t(247, 90, 0.055, 0.075, 0, 'triangle');
        break;
      case 'gate':
        t(34, 53, 3.8, 0.2);
        t(159, 49, 0.39, 0.16, 0.12, 'triangle');
        t(69, 37, 1.1, 0.12, 2.7);
        break;
      case 'board':
        t(124, 47, 0.28, 0.15, 0, 'triangle');
        break;
      case 'door':
        t(96, 44, 0.85, 0.16);
        t(241, 54, 0.12, 0.19, 0.42, 'triangle');
        break;
      case 'switch':
        t(320, 60, 0.12, 0.22, 0, 'triangle');
        t(90, 40, 0.3, 0.12, 0.05);
        t(880, 870, 0.25, 0.03, 0.18);
        break;
      case 'power':
        t(182, 41, 0.23, 0.29, 0, 'triangle');
        t(44, 68, 2.8, 0.085, 0.23);
        t(460, 435, 0.34, 0.04, 0.7);
        break;
      case 'lift':
        t(660, 660, 0.45, 0.055);
        t(61, 80, 2.1, 0.1, 0.3);
        break;
      case 'arrive':
        t(572, 572, 0.55, 0.06);
        t(437, 437, 0.83, 0.04, 0.42);
        break;
      case 'stall':
        t(70, 28, 2.4, 0.16, 0, 'sawtooth');
        t(440, 220, 1.6, 0.03, 0.2);
        this.burst(200, 1.2, 0.25, 'lowpass', 0.8);
        break;
      case 'archive':
        t(784, 784, 0.6, 0.035);
        t(1175, 1175, 0.9, 0.025, 0.12);
        this.burst(3000, 0.18, 0.12, 'highpass', 2.2);
        break;
      case 'jump':
        this.burst(900, 0.12, 0.18, 'bandpass', 1.8);
        break;
      case 'restart':
        t(30, 62, 6.5, 0.24);
        t(110, 220, 5, 0.04, 0.5);
        t(165, 330, 5, 0.03, 1.2);
        t(392, 392, 2.5, 0.03, 4.2);
        t(523, 523, 3, 0.025, 4.8);
        this.burst(120, 3, 0.3, 'lowpass', 0.6);
        break;
      case 'fall':
        this.burst(500, 0.9, 0.35, 'bandpass', 0.9);
        t(300, 80, 0.9, 0.03);
        break;
      case 'splash':
        this.burst(700, 0.8, 0.6, 'lowpass', 1.2);
        break;
      case 'deny':
        t(180, 150, 0.18, 0.08, 0, 'square');
        t(140, 120, 0.2, 0.06, 0.16, 'square');
        break;
      case 'alarm':
        for (let i = 0; i < 3; i++) {
          t(880, 880, 0.22, 0.06, i * 0.5, 'square');
          t(660, 660, 0.22, 0.05, i * 0.5 + 0.25, 'square');
        }
        break;
      case 'pump':
        t(150, 70, 0.18, 0.12, 0, 'triangle');
        this.burst(420, 0.2, 0.18, 'lowpass', 0.9, 0.04);
        break;
      case 'thunder':
        this.thunder(0.2, 0.9);
        break;
      case 'record':
        t(523, 523, 1.6, 0.05);
        t(659, 659, 1.6, 0.04, 0.25);
        t(784, 784, 2.2, 0.04, 0.5);
        t(1047, 1047, 2.8, 0.03, 0.9);
        break;
    }
  }
}
