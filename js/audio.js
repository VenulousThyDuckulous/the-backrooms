import { clamp } from './util.js';

// All sound is synthesised with the Web Audio API: no external assets.
export class AudioEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.muted = false;
    this.volume = 0.75;
    this.ambient = null;
    this.growl = null;
    this.theme = 0;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    const AC = window.AudioContext || window.webkitAudioContext;
    if (!AC) return;
    this.ctx = new AC();
    this.master = this.ctx.createGain();
    this.master.gain.value = this.muted ? 0 : this.volume;
    this.master.connect(this.ctx.destination);
    this.noiseBuf = this.makeNoiseBuffer(2.5);
    this.startAmbient(this.theme);
  }

  makeNoiseBuffer(seconds) {
    const len = Math.floor(this.ctx.sampleRate * seconds);
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    return buf;
  }

  setVolume(v) {
    this.volume = clamp(v, 0, 1);
    if (this.master && !this.muted) {
      this.master.gain.setTargetAtTime(this.volume, this.ctx.currentTime, 0.05);
    }
  }

  setMuted(m) {
    this.muted = m;
    if (this.master) {
      this.master.gain.setTargetAtTime(m ? 0 : this.volume, this.ctx.currentTime, 0.05);
    }
  }

  startAmbient(theme) {
    if (!this.ctx) return;
    this.theme = theme;
    this.stopAmbient();
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const bus = ctx.createGain();
    bus.gain.value = 0.0001;
    bus.connect(this.master);
    bus.gain.setTargetAtTime(1, now, 1.4);

    const nodes = [];
    const osc = (type, freq, gain, detune = 0) => {
      const o = ctx.createOscillator();
      o.type = type;
      o.frequency.value = freq;
      o.detune.value = detune;
      const g = ctx.createGain();
      g.gain.value = gain;
      o.connect(g);
      g.connect(bus);
      o.start();
      nodes.push(o);
      return { o, g };
    };

    const noise = ctx.createBufferSource();
    noise.buffer = this.noiseBuf;
    noise.loop = true;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 340;
    lp.Q.value = 0.6;
    const ng = ctx.createGain();
    ng.gain.value = 0.05;
    noise.connect(lp);
    lp.connect(ng);
    ng.connect(bus);
    noise.start();
    nodes.push(noise);

    const cfg =
      [
        { base: 58, buzz: 118, gain: 0.035, noise: 0.05, lp: 380 },
        { base: 44, buzz: 92, gain: 0.045, noise: 0.07, lp: 260 },
        { base: 66, buzz: 236, gain: 0.02, noise: 0.1, lp: 900 },
        { base: 31, buzz: 68, gain: 0.07, noise: 0.11, lp: 190 },
      ][theme] || { base: 58, buzz: 118, gain: 0.035, noise: 0.05, lp: 380 };

    osc('sine', cfg.base, cfg.gain);
    osc('sine', cfg.base * 2.02, cfg.gain * 0.42, 4);
    osc('square', cfg.buzz, 0.0045);
    ng.gain.value = cfg.noise;
    lp.frequency.value = cfg.lp;

    this.ambient = { bus, nodes };
  }

  stopAmbient() {
    if (!this.ambient || !this.ctx) return;
    const { bus, nodes } = this.ambient;
    const now = this.ctx.currentTime;
    bus.gain.setTargetAtTime(0.0001, now, 0.15);
    for (const n of nodes) {
      try {
        n.stop(now + 1.2);
      } catch (e) {
        /* already stopped */
      }
    }
    this.ambient = null;
  }

  noiseBurst({ freq = 800, Q = 1.2, dur = 0.14, gain = 0.16, pan = 0, type = 'bandpass' }) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    f.Q.value = Q;
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + 0.012);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    src.connect(f);
    f.connect(g);
    g.connect(p);
    p.connect(this.master);
    src.start(now);
    src.stop(now + dur + 0.08);
  }

  tone({ freq = 120, endFreq = null, type = 'sine', dur = 0.25, gain = 0.08, pan = 0, attack = 0.01 }) {
    if (!this.ctx || this.muted) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, now);
    if (endFreq) o.frequency.exponentialRampToValueAtTime(Math.max(10, endFreq), now + dur);
    const g = ctx.createGain();
    g.gain.setValueAtTime(0.0001, now);
    g.gain.exponentialRampToValueAtTime(gain, now + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, now + dur);
    const p = ctx.createStereoPanner();
    p.pan.value = clamp(pan, -1, 1);
    o.connect(g);
    g.connect(p);
    p.connect(this.master);
    o.start(now);
    o.stop(now + dur + 0.05);
  }

  footstep(sprint = false, pan = 0) {
    this.noiseBurst({ freq: sprint ? 900 : 620, Q: 0.9, dur: sprint ? 0.11 : 0.09, gain: sprint ? 0.13 : 0.075, pan });
    this.tone({ freq: 88, endFreq: 54, type: 'sine', dur: 0.11, gain: sprint ? 0.09 : 0.05, pan });
  }

  heartbeat(intensity) {
    const gain = 0.06 + intensity * 0.1;
    this.tone({ freq: 54, endFreq: 38, dur: 0.16, gain, attack: 0.005 });
    setTimeout(() => this.tone({ freq: 48, endFreq: 34, dur: 0.13, gain: gain * 0.7, attack: 0.005 }), 150);
  }

  pickup() {
    this.tone({ freq: 660, dur: 0.5, gain: 0.06, type: 'sine' });
    setTimeout(() => this.tone({ freq: 990, dur: 0.7, gain: 0.05, type: 'sine' }), 90);
    setTimeout(() => this.tone({ freq: 1320, dur: 0.8, gain: 0.035, type: 'sine' }), 180);
  }

  locked() {
    this.noiseBurst({ freq: 240, Q: 0.7, dur: 0.18, gain: 0.1 });
    this.tone({ freq: 120, endFreq: 78, dur: 0.22, gain: 0.09, type: 'triangle' });
  }

  whisper() {
    const pan = Math.random() * 2 - 1;
    this.noiseBurst({ freq: 1500 + Math.random() * 900, Q: 2.4, dur: 0.5 + Math.random() * 0.5, gain: 0.035, pan });
  }

  thump() {
    this.tone({ freq: 70, endFreq: 34, dur: 0.7, gain: 0.14, type: 'sine' });
    this.noiseBurst({ freq: 180, Q: 0.6, dur: 0.4, gain: 0.05 });
  }

  screech() {
    this.tone({ freq: 880, endFreq: 190, type: 'sawtooth', dur: 0.5, gain: 0.09 });
    this.noiseBurst({ freq: 2600, Q: 1.4, dur: 0.45, gain: 0.12 });
  }

  stinger() {
    if (!this.ctx) return;
    this.tone({ freq: 220, endFreq: 32, type: 'sawtooth', dur: 1.6, gain: 0.2, attack: 0.005 });
    this.tone({ freq: 70, endFreq: 24, type: 'square', dur: 1.4, gain: 0.12, attack: 0.005 });
    this.noiseBurst({ freq: 900, Q: 0.4, dur: 1.4, gain: 0.22, type: 'lowpass' });
    this.noiseBurst({ freq: 3200, Q: 0.6, dur: 0.3, gain: 0.1 });
  }

  door() {
    this.noiseBurst({ freq: 420, Q: 2.2, dur: 0.9, gain: 0.09, type: 'bandpass' });
    this.tone({ freq: 90, endFreq: 130, dur: 0.9, gain: 0.05, type: 'triangle' });
    setTimeout(() => this.thump(), 700);
  }

  ui() {
    this.tone({ freq: 520, dur: 0.07, gain: 0.035, type: 'triangle' });
  }

  startGrowl() {
    if (!this.ctx || this.growl) return;
    const ctx = this.ctx;
    const now = ctx.currentTime;
    const g = ctx.createGain();
    g.gain.value = 0.0001;
    g.connect(this.master);
    const osc = ctx.createOscillator();
    osc.type = 'sawtooth';
    osc.frequency.value = 41;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 170;
    osc.connect(lp);
    lp.connect(g);
    osc.start(now);

    const src = ctx.createBufferSource();
    src.buffer = this.noiseBuf;
    src.loop = true;
    const bp = ctx.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.value = 230;
    bp.Q.value = 1.6;
    const ng = ctx.createGain();
    ng.gain.value = 0.55;
    src.connect(bp);
    bp.connect(ng);
    ng.connect(g);
    src.start(now);

    this.growl = { g, nodes: [osc, src] };
  }

  setGrowl(v) {
    if (!this.ctx) return;
    if (!this.growl) this.startGrowl();
    if (!this.growl) return;
    this.growl.g.gain.setTargetAtTime(clamp(v, 0, 1) * 0.2, this.ctx.currentTime, 0.3);
  }

  stopGrowl() {
    if (!this.growl || !this.ctx) return;
    const { g, nodes } = this.growl;
    const now = this.ctx.currentTime;
    g.gain.setTargetAtTime(0.0001, now, 0.12);
    for (const n of nodes) {
      try {
        n.stop(now + 1.2);
      } catch (e) {
        /* ignore */
      }
    }
    this.growl = null;
  }
}
