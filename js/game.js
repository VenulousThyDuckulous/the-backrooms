import { LEVEL_META, World } from './world.js';
import { Renderer } from './renderer.js';
import { buildSprites } from './sprites.js';
import { clamp, lerp, TAU, wrapAngle } from './util.js';

const WALK_SPEED = 1.95;
const RUN_SPEED = 3.5;
const PLAYER_RADIUS = 0.22;

export class Game {
  constructor({ canvas, audio, settings, ui }) {
    this.canvas = canvas;
    this.audio = audio;
    this.settings = settings;
    this.ui = ui;
    this.renderer = new Renderer(canvas);
    this.sprites = buildSprites();

    this.keys = new Set();
    this.touch = { x: 0, y: 0, sprint: false };
    this.touchMode = false;

    this.state = 'menu';
    this.prevState = 'playing';
    this.world = null;
    this.player = null;
    this.entity = null;
    this.bottles = [];
    this.exit = null;
    this.levelIndex = 0;
    this.collected = 0;
    this.totalBottles = 0;
    this.runBottles = 0;
    this.runTime = 0;
    this.time = 0;
    this.stateT = 0;
    this.hudT = -1;
    this.fear = 0;
    this.flashOn = true;
    this.flicker = 1;
    this.shake = 0;
    this.heartT = 0;
    this.whisperT = 4;
    this.noise = 0;
    this.entityTimer = 0;
    this.entityDist = Infinity;
    this.exitWarnT = 0;
    this.flavorIdx = 0;
    this.ambT = 22;
  }

  setTouchMode(v) {
    this.touchMode = v;
  }

  startRun() {
    this.runTime = 0;
    this.runBottles = 0;
    this.flavorIdx = 0;
    this.levelIndex = 0;
    this.loadLevel(0);
  }

  loadLevel(index) {
    const meta = LEVEL_META[index];
    this.levelIndex = index;
    this.world = new World(index, (Math.random() * 1e9) | 0);
    this.player = {
      x: this.world.start.x,
      y: this.world.start.y,
      angle: this.world.start.angle,
      vx: 0,
      vy: 0,
      stamina: 1,
      exhausted: false,
      bob: 0,
      bobPhase: 0,
      look: 0,
      step: 0,
    };
    this.bottles = this.world.bottles.map((b) => ({ x: b.x, y: b.y, taken: false }));
    this.totalBottles = this.bottles.length;
    this.collected = 0;
    this.exit = this.world.exit;
    this.entity = null;
    this.entityTimer = meta.delay;
    this.entityDist = Infinity;
    this.exitWarnT = 0;
    this.flashOn = true;
    this.flicker = 1;
    this.fear = 0;
    this.heartT = 0;
    this.whisperT = 4;
    this.noise = 0;
    this.shake = 0;
    this.ambT = 22;
    this.time = 0;
    this.stateT = 0;
    this.hudT = -1;
    this.enteredExit = false;
    this.state = 'intro';
    this.touch.x = 0;
    this.touch.y = 0;
    this.touch.sprint = false;
    this.keys.clear();
    this.audio.stopGrowl();
    this.audio.startAmbient(index);
    this.ui.fade(1);
    this.ui.fear(0);
    this.ui.show(null);
    this.ui.card(meta);
    this.ui.hint('');
    this.updateHud(true);
  }

  update(dt) {
    if (!this.world) return;
    const step = Math.min(dt, 0.05);

    if (this.state === 'intro') {
      this.stateT += step;
      this.time += step;
      this.flicker = 0.9 + Math.sin(this.time * 6.7) * 0.06;
      this.ui.fade(clamp(1 - (this.stateT - 0.5) / 1.1, 0, 1));
      if (this.stateT > 3.1) {
        this.state = 'playing';
        this.ui.fade(0);
        this.ui.hideCard();
      }
      this.updateHud(false);
      return;
    }

    if (this.state === 'playing') {
      this.time += step;
      this.runTime += step;
      this.updatePlayer(step);
      this.updateEntity(step);
      this.checkObjects(step);
      this.updateFx(step);
      this.updateHud(false);
      return;
    }

    if (this.state === 'leaving') {
      this.stateT += step;
      this.ui.fade(clamp(this.stateT / 1.4, 0, 1));
      if (this.stateT > 1.6) this.advanceLevel();
      return;
    }

    if (this.state === 'dying') {
      this.stateT += step;
      this.time += step;
      this.fear = 1;
      this.ui.fear(this.settings.reduceFx ? 0.65 : 1);
      this.shake = 0.58 + Math.sin(this.time * 47) * 0.34;
      if (this.stateT > 1.5) this.ui.fade(clamp((this.stateT - 1.5) / 0.9, 0, 1));
      if (this.stateT > 2.55) {
        this.state = 'dead';
        this.ui.fade(0);
        this.audio.stopGrowl();
        this.ui.show('dead');
        this.ui.death(this.stats());
      }
      return;
    }
  }

  updatePlayer(dt) {
    const p = this.player;
    const keys = this.keys;
    let fwd = 0;
    let str = 0;
    if (keys.has('KeyW') || keys.has('ArrowUp')) fwd += 1;
    if (keys.has('KeyS') || keys.has('ArrowDown')) fwd -= 1;
    if (keys.has('KeyD') || keys.has('ArrowRight')) str += 1;
    if (keys.has('KeyA') || keys.has('ArrowLeft')) str -= 1;
    fwd = clamp(fwd + this.touch.y, -1, 1);
    str = clamp(str + this.touch.x, -1, 1);
    const len = Math.hypot(fwd, str);
    if (len > 1) {
      fwd /= len;
      str /= len;
    }
    const moving = len > 0.06;
    const wantsSprint = (keys.has('ShiftLeft') || keys.has('ShiftRight') || this.touch.sprint) && fwd > -0.25;
    if (p.exhausted && p.stamina > 0.32) p.exhausted = false;
    const sprinting = wantsSprint && moving && !p.exhausted && p.stamina > 0.02;

    if (sprinting) {
      p.stamina = Math.max(0, p.stamina - dt * 0.23);
      if (p.stamina <= 0.001) p.exhausted = true;
    } else {
      p.stamina = Math.min(1, p.stamina + dt * 0.15);
    }

    const speed = sprinting ? RUN_SPEED : WALK_SPEED;
    const cos = Math.cos(p.angle);
    const sin = Math.sin(p.angle);
    const targetVx = (cos * fwd - sin * str) * speed;
    const targetVy = (sin * fwd + cos * str) * speed;
    const accel = moving ? 12 : 9;
    p.vx = lerp(p.vx, targetVx, Math.min(1, dt * accel));
    p.vy = lerp(p.vy, targetVy, Math.min(1, dt * accel));

    const nx = p.x + p.vx * dt;
    if (!this.world.collides(nx, p.y, PLAYER_RADIUS)) p.x = nx;
    else p.vx = 0;
    const ny = p.y + p.vy * dt;
    if (!this.world.collides(p.x, ny, PLAYER_RADIUS)) p.y = ny;
    else p.vy = 0;

    if (moving) {
      p.bobPhase += dt * (sprinting ? 12.5 : 8.2);
      p.bob = Math.sin(p.bobPhase) * (sprinting ? 0.0115 : 0.0072);
      p.step += Math.hypot(p.vx, p.vy) * dt;
      const stepLen = sprinting ? 0.95 : 1.2;
      if (p.step > stepLen) {
        p.step = 0;
        this.audio.footstep(sprinting, (Math.random() - 0.5) * 0.5);
        if (sprinting) this.noise = 2.4;
      }
    } else {
      p.bob = Math.sin(this.time * 1.4) * 0.0022;
      p.bobPhase = 0;
    }
    p.look = clamp(p.look, -0.19, 0.19);
  }

  updateEntity(dt) {
    const p = this.player;
    if (!this.entity) {
      this.entityTimer -= dt;
      if (this.entityTimer <= 0) this.spawnEntity();
      return;
    }

    const e = this.entity;
    e.anim += dt;
    const dx = e.x - p.x;
    const dy = e.y - p.y;
    const dist = Math.hypot(dx, dy);
    this.entityDist = dist;
    const visible = this.world.lineOfSight(p.x, p.y, e.x, e.y);
    const diff = Math.abs(wrapAngle(Math.atan2(dy, dx) - p.angle));
    const watched = visible && diff < 0.26 && dist < 15;

    if (watched) {
      e.rage += dt;
      e.speed = 0;
    } else {
      e.rage = Math.max(0, e.rage - dt * 0.65);
      e.speed = visible || dist < 5 ? e.hunt : e.roam;
    }

    if (e.lunge > 0) {
      e.lunge -= dt;
      e.speed = e.hunt * 1.75;
    } else if (watched && e.rage > 2.1) {
      e.lunge = 1.15;
      e.rage = 0;
      this.audio.screech();
      this.shake = 1;
      this.ui.toast('IT DOES NOT LIKE BEING LOOKED AT.');
    }

    if (this.noise > 0) e.speed = Math.max(e.speed, e.roam * 1.2);

    e.repath -= dt;
    if (e.repath <= 0 || !e.field) {
      e.field = this.world.bfs(Math.floor(p.x), Math.floor(p.y));
      e.repath = 0.35;
    }

    const size = this.world.size;
    const ecx = Math.floor(e.x);
    const ecy = Math.floor(e.y);
    let best = e.field[ecy * size + ecx];
    let bx = ecx;
    let by = ecy;
    const offsets = [
      [1, 0],
      [0, 1],
      [-1, 0],
      [0, -1],
    ];
    for (const [ox, oy] of offsets) {
      const nx = ecx + ox;
      const ny = ecy + oy;
      if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
      const d = e.field[ny * size + nx];
      if (d >= 0 && (best < 0 || d < best)) {
        best = d;
        bx = nx;
        by = ny;
      }
    }

    let targetX = p.x;
    let targetY = p.y;
    if (best > 0) {
      targetX = bx + 0.5;
      targetY = by + 0.5;
    }

    if (e.speed > 0.001) {
      const ax = targetX - e.x;
      const ay = targetY - e.y;
      const al = Math.hypot(ax, ay) || 1;
      const move = e.speed * dt;
      const nxp = e.x + (ax / al) * move;
      if (!this.world.collides(nxp, e.y, 0.28)) e.x = nxp;
      const nyp = e.y + (ay / al) * move;
      if (!this.world.collides(e.x, nyp, 0.28)) e.y = nyp;

      e.stepT -= dt;
      if (e.stepT <= 0 && dist < 11) {
        e.stepT = 0.62;
        this.audio.noiseBurst({ freq: 150, Q: 0.7, dur: 0.22, gain: 0.05 });
      }
    }

    const prox = clamp(1 - dist / 12, 0, 1);
    this.audio.setGrowl(prox * (visible ? 1 : 0.4));

    if (dist < 0.5) this.die();
  }

  spawnEntity() {
    const meta = LEVEL_META[this.levelIndex];
    const pos = this.world.farSpawn(12, this.player.x, this.player.y);
    this.entity = {
      x: pos.x,
      y: pos.y,
      speed: 0,
      roam: meta.roam,
      hunt: meta.hunt,
      rage: 0,
      lunge: 0,
      repath: 0,
      field: null,
      anim: 0,
      stepT: 0,
    };
    this.audio.thump();
    this.audio.setGrowl(0.12);
    this.ui.toast('Something just woke up.');
  }

  checkObjects(dt) {
    const p = this.player;
    this.exitWarnT = Math.max(0, this.exitWarnT - dt);

    for (const b of this.bottles) {
      if (b.taken) continue;
      if (Math.hypot(b.x - p.x, b.y - p.y) < 0.62) {
        b.taken = true;
        this.collected++;
        this.runBottles++;
        this.audio.pickup();
        const lines = [
          'Almond water. It tastes like being alive.',
          'You drink. The humming gets a little quieter.',
          'One more reason to keep walking.',
          'The carton is warm. You do not ask why.',
        ];
        if (this.collected >= this.totalBottles) {
          this.ui.toast('That was the last one. The exit is open.');
          this.audio.tone({ freq: 440, dur: 1.2, gain: 0.05, type: 'sine' });
        } else {
          this.ui.toast(lines[this.flavorIdx++ % lines.length]);
        }
        this.updateHud(true);
      }
    }

    if (Math.hypot(this.exit.x - p.x, this.exit.y - p.y) < 0.9) {
      if (this.collected < this.totalBottles) {
        if (this.exitWarnT <= 0) {
          this.ui.toast('Locked. It wants the almond water first.');
          this.audio.locked();
          this.exitWarnT = 3;
        }
      } else if (!this.enteredExit) {
        this.enteredExit = true;
        this.state = 'leaving';
        this.stateT = 0;
        this.audio.door();
        this.audio.stopGrowl();
        this.ui.hint('');
      }
    }
  }

  updateFx(dt) {
    const p = this.player;
    let target = 1;
    if (this.entity && this.entityDist < 7.5) {
      const n =
        Math.sin(this.time * 17.3) * Math.sin(this.time * 5.1) + Math.sin(this.time * 31.7) * 0.5;
      if (n > 0.72) target = 0.22;
      else if (n > 0.4) target = 0.6;
    }
    this.flicker = lerp(this.flicker, target, Math.min(1, dt * 18));
    this.shake = Math.max(0, this.shake - dt * 2.4);

    let fearTarget = 0.02;
    if (this.entity) {
      fearTarget = clamp(1 - this.entityDist / 11, 0, 1);
      if (this.entityDist < 15 && this.world.lineOfSight(p.x, p.y, this.entity.x, this.entity.y)) {
        fearTarget = Math.min(1, fearTarget + 0.2);
      }
    }
    this.fear = lerp(this.fear, fearTarget, Math.min(1, dt * 0.9));
    this.ui.fear(this.settings.reduceFx ? this.fear * 0.55 : this.fear);

    this.noise = Math.max(0, this.noise - dt);
    this.heartT -= dt;
    if (this.fear > 0.16 && this.heartT <= 0) {
      this.audio.heartbeat(this.fear);
      this.heartT = lerp(1.25, 0.38, this.fear);
    }

    this.whisperT -= dt;
    if (this.fear > 0.5 && this.whisperT <= 0) {
      this.audio.whisper();
      this.whisperT = 2 + Math.random() * 5;
    }

    this.ambT -= dt;
    if (this.ambT <= 0) {
      this.ambT = 22 + Math.random() * 38;
      if (Math.random() < 0.7) this.audio.thump();
      else this.audio.whisper();
    }
  }

  updateHud(force) {
    if (!this.player) return;
    if (!force && this.time - this.hudT < 0.1) return;
    this.hudT = this.time;
    const meta = LEVEL_META[this.levelIndex];
    this.ui.hud({
      code: meta.code,
      bottles: this.collected,
      total: this.totalBottles,
      time: this.runTime,
      stamina: this.player.stamina,
      flashOn: this.flashOn,
    });
    this.ui.hint(this.currentHint());
  }

  currentHint() {
    const p = this.player;
    if (!p) return '';
    if (this.state === 'intro') return '';
    if (this.entity && this.entityDist < 7) return 'DO NOT LET IT TOUCH YOU';
    if (this.collected >= this.totalBottles) {
      const d = Math.hypot(this.exit.x - p.x, this.exit.y - p.y);
      return d < 10 ? 'THE EXIT IS CLOSE' : 'FIND THE EXIT DOOR';
    }
    let nearest = Infinity;
    for (const b of this.bottles) {
      if (b.taken) continue;
      nearest = Math.min(nearest, Math.hypot(b.x - p.x, b.y - p.y));
    }
    if (nearest < 7) return 'SOMETHING SWEET IS CLOSE';
    if (this.touchMode) return 'LEFT STICK MOVES · RIGHT SIDE LOOKS';
    return 'WASD MOVE · SHIFT RUN · F FLASHLIGHT';
  }

  look(dx, dy) {
    if (!this.player) return;
    if (this.state !== 'playing' && this.state !== 'intro') return;
    const s = this.settings.sensitivity;
    this.player.angle = (this.player.angle + dx * 0.0022 * s) % TAU;
    this.player.look = clamp(this.player.look - dy * 0.0007 * s, -0.19, 0.19);
  }

  toggleFlash() {
    if (this.state !== 'playing' && this.state !== 'intro') return;
    this.flashOn = !this.flashOn;
    this.audio.ui();
    this.ui.hudFlash(this.flashOn);
  }

  pauseGame() {
    if (this.state !== 'playing' && this.state !== 'intro') return;
    this.prevState = this.state;
    this.state = 'paused';
    this.audio.stopGrowl();
    this.ui.show('pause');
  }

  resumeGame() {
    if (this.state !== 'paused') return;
    this.state = this.prevState || 'playing';
    this.ui.show(null);
    this.audio.ui();
  }

  quitToMenu() {
    this.state = 'menu';
    this.world = null;
    this.entity = null;
    this.player = null;
    this.keys.clear();
    this.audio.stopGrowl();
    this.audio.stopAmbient();
    this.ui.show('menu');
    this.ui.hideCard();
    this.ui.fade(0);
    this.ui.fear(0);
    this.ui.hint('');
    if (this.renderer) this.renderer.clear();
  }

  die() {
    if (this.state !== 'playing' || !this.entity) return;
    this.state = 'dying';
    this.stateT = 0;
    const p = this.player;
    this.audio.stinger();
    this.audio.stopGrowl();
    this.entity.x = p.x + Math.cos(p.angle) * 0.62;
    this.entity.y = p.y + Math.sin(p.angle) * 0.62;
    this.entity.speed = 0;
    this.entity.anim = 0;
  }

  advanceLevel() {
    if (this.levelIndex + 1 < LEVEL_META.length) {
      this.loadLevel(this.levelIndex + 1);
    } else {
      this.state = 'won';
      this.ui.fade(0);
      this.audio.stopGrowl();
      this.audio.door();
      this.ui.show('win');
      this.ui.win(this.stats());
    }
  }

  stats() {
    const meta = LEVEL_META[this.levelIndex];
    return {
      level: this.levelIndex + 1,
      levelName: meta.name,
      time: this.runTime,
      bottles: this.runBottles,
      escaped: false,
    };
  }

  renderScene() {
    if (!this.world || !this.player) {
      this.renderer.clear();
      return;
    }
    const p = this.player;
    const sprites = [];
    for (const b of this.bottles) {
      if (b.taken) continue;
      sprites.push({ x: b.x, y: b.y, tex: this.sprites.bottle, height: 0.3, emissive: true });
    }
    sprites.push({
      x: this.exit.x,
      y: this.exit.y,
      tex: this.sprites.exit,
      height: 0.92,
      emissive: true,
      pulse: this.collected >= this.totalBottles,
    });
    if (this.entity) {
      const frame = Math.sin(this.entity.anim * 5.5) > 0 ? 1 : 0;
      sprites.push({
        x: this.entity.x,
        y: this.entity.y,
        tex: this.sprites.entity[frame],
        height: 0.93,
        entity: true,
      });
    }
    this.renderer.render({
      world: this.world,
      player: p,
      sprites,
      flash: this.flashOn,
      flicker: this.flicker,
      time: this.time,
      shake: this.shake,
    });
  }
}
