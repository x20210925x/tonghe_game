// All sound is synthesized locally. The long return is mixed according to enclosure.
export class Soundscape {
  constructor() {
    this.volume = 0.65;
    this.muted = false;
    this.active = false;
  }
  start() {
    const Audio = window.AudioContext || window.webkitAudioContext;
    if (!Audio) return;
    if (!this.ctx) {
      const c = (this.ctx = new Audio());
      this.master = c.createGain();
      this.master.gain.value = 0;
      this.master.connect(c.destination);
      this.mix = c.createGain();
      this.mix.gain.value = 0.7;
      this.mix.connect(this.master);
      this.echo = c.createConvolver();
      const len = Math.floor(c.sampleRate * 3.8),
        ir = c.createBuffer(2, len, c.sampleRate);
      for (let ch = 0; ch < 2; ch++) {
        const a = ir.getChannelData(ch);
        for (let i = 0; i < len; i++)
          a[i] =
            (Math.random() * 2 - 1) * Math.pow(1 - i / len, 4) * (i < 0.042 * c.sampleRate ? 0.05 : 1);
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
      const breeze = c.createBufferSource();
      breeze.buffer = this.noise;
      breeze.loop = true;
      this.windFilter = c.createBiquadFilter();
      this.windFilter.type = 'bandpass';
      this.windFilter.Q.value = 0.45;
      this.windFilter.frequency.value = 400;
      this.wind = c.createGain();
      this.wind.gain.value = 0.13;
      breeze.connect(this.windFilter).connect(this.wind).connect(this.mix);
      breeze.start();
      const bed = c.createOscillator();
      bed.frequency.value = 46.25;
      const bg = c.createGain();
      bg.gain.value = 0.026;
      bed.connect(bg).connect(this.mix);
      bed.start();
      const motor = c.createOscillator();
      motor.type = 'triangle';
      motor.frequency.value = 57.8;
      this.motor = c.createGain();
      this.motor.gain.value = 0;
      this.pan = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
      motor.connect(this.motor).connect(this.pan).connect(this.mix);
      motor.start();
      const spill = c.createBufferSource();
      spill.buffer = this.noise;
      spill.loop = true;
      spill.playbackRate.value = 2.7;
      this.spill = c.createGain();
      this.spill.gain.value = 0;
      const filter = c.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.value = 310;
      this.outletPan = c.createStereoPanner ? c.createStereoPanner() : c.createGain();
      spill.connect(filter).connect(this.spill).connect(this.outletPan).connect(this.mix);
      this.spill.connect(this.echo);
      spill.start();
      this.axle = c.createOscillator();
      this.axle.type = 'triangle';
      this.axle.frequency.value = 38;
      this.rolling = c.createGain();
      this.rolling.gain.value = 0;
      this.axle.connect(this.rolling).connect(this.mix);
      this.axle.start();
    }
    this.active = true;
    this.ctx.resume().catch(() => {});
    this.apply();
  }
  apply() {
    if (this.ctx)
      this.master.gain.setTargetAtTime(
        this.active && !this.muted ? this.volume * 0.63 : 0,
        this.ctx.currentTime,
        0.09
      );
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
  update(x, z, yaw, stage, time, site) {
    if (!this.ctx) return;
    const room = z > 4 && Math.abs(x) < 4,
      c = this.ctx.currentTime;
    this.return.gain.setTargetAtTime(room ? 0.13 : 0.42, c, 0.6);
    this.wind.gain.setTargetAtTime(room ? 0.052 : 0.14 + 0.028 * Math.sin(time * 0.21), c, 0.6);
    this.windFilter.frequency.setTargetAtTime(room ? 220 : 490 + 80 * Math.sin(time * 0.13), c, 0.8);
    this.motor.gain.setTargetAtTime(
      stage >= 2 ? 0.085 / (1 + Math.hypot(81 - x, -263 - z) * 0.028) : 0.003,
      c,
      0.8
    );
    const range = Math.hypot(24 - x, -64 - z);
    this.spill.gain.setTargetAtTime(site.regulated ? 0.47 / (1 + (range / 24) ** 1.7) : 0.002, c, 0.55);
    if (this.outletPan.pan)
      this.outletPan.pan.setTargetAtTime(
        ((24 - x) * Math.cos(yaw) - (-64 - z) * Math.sin(yaw)) / Math.max(3, range),
        c,
        0.1
      );
    this.axle.frequency.setTargetAtTime(37 + site.cartSpeed * 7.3, c, 0.17);
    this.rolling.gain.setTargetAtTime(site.aboard ? 0.014 + site.cartSpeed * 0.0055 : 0, c, 0.17);
    if (this.pan.pan) {
      const dx = 81 - x,
        dz = -263 - z;
      this.pan.pan.setTargetAtTime(
        (dx * Math.cos(yaw) - dz * Math.sin(yaw)) / Math.max(5, Math.hypot(dx, dz)),
        c,
        0.18
      );
    }
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
  step(metal, run) {
    if (!this.ctx) return;
    const c = this.ctx,
      t = c.currentTime,
      src = c.createBufferSource(),
      g = c.createGain(),
      f = c.createBiquadFilter();
    src.buffer = this.noise;
    src.playbackRate.value = 1.5 + Math.random();
    f.type = 'highpass';
    f.frequency.value = metal ? 850 : 310;
    g.gain.setValueAtTime(run ? 0.58 : 0.43, t);
    g.gain.exponentialRampToValueAtTime(0.001, t + 0.145);
    src.connect(f).connect(g);
    g.connect(this.mix);
    g.connect(this.echo);
    src.start(t, Math.random() * 1.3);
    src.stop(t + 0.15);
    src.onended = () => {
      src.disconnect();
      f.disconnect();
      g.disconnect();
    };
    this.tone(metal ? 181 : 108, metal ? 76 : 44, 0.15, run ? 0.115 : 0.083);
  }
  effect(name) {
    if (name === 'detent') {
      this.tone(247, 90, 0.055, 0.075, 0, 'triangle');
    }
    if (name === 'gate') {
      this.tone(34, 53, 3.8, 0.2);
      this.tone(159, 49, 0.39, 0.16, 0.12, 'triangle');
      this.tone(69, 37, 1.1, 0.12, 2.7);
    }
    if (name === 'board') {
      this.tone(124, 47, 0.28, 0.15, 0, 'triangle');
    }
    if (name === 'door') {
      this.tone(96, 44, 0.85, 0.16);
      this.tone(241, 54, 0.12, 0.19, 0.42, 'triangle');
    }
    if (name === 'power') {
      this.tone(182, 41, 0.23, 0.29, 0, 'triangle');
      this.tone(44, 68, 2.8, 0.085, 0.23);
      this.tone(460, 435, 0.34, 0.04, 0.7);
    }
    if (name === 'lift') {
      this.tone(660, 660, 0.45, 0.055);
      this.tone(61, 80, 2.1, 0.1, 0.3);
    }
    if (name === 'arrive') {
      this.tone(572, 572, 0.55, 0.06);
      this.tone(437, 437, 0.83, 0.04, 0.42);
    }
  }
}
