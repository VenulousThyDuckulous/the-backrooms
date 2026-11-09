import { Game } from './game.js';
import { AudioEngine } from './audio.js';
import { clamp, fmtTime } from './util.js';

const $ = (id) => document.getElementById(id);

const SETTINGS_KEY = 'backrooms.settings.v1';
const BEST_KEY = 'backrooms.deepest.v1';
const DEFAULTS = { sensitivity: 1, volume: 0.72, quality: 1, muted: false, reduceFx: false };

const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;

function loadSettings() {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || '{}');
    return { ...DEFAULTS, ...raw };
  } catch (err) {
    return { ...DEFAULTS };
  }
}

function saveSettings() {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  } catch (err) {
    /* storage unavailable */
  }
}

function loadBest() {
  const v = parseInt(localStorage.getItem(BEST_KEY) || '0', 10);
  return clamp(Number.isFinite(v) ? v : 0, 0, 99);
}

function saveBest(level) {
  if (level > loadBest()) {
    try {
      localStorage.setItem(BEST_KEY, String(level));
    } catch (err) {
      /* ignore */
    }
  }
}

const settings = loadSettings();
const canvas = $('view');
const audio = new AudioEngine();
audio.volume = settings.volume;
audio.muted = settings.muted;

let toastTimer = 0;
let cardTimer = 0;

const screens = () => ({
  menu: $('menu'),
  pause: $('pause'),
  dead: $('dead'),
  win: $('win'),
});

const ui = {
  show(name) {
    const map = screens();
    for (const key of Object.keys(map)) map[key].hidden = key !== name;
    const inWorld = name === null || name === 'pause';
    $('hud').hidden = !inWorld;
    $('touch').hidden = !(isTouch && name === null);
  },
  hud(data) {
    $('levelCode').textContent = data.code;
    $('bottleCount').textContent = `${data.bottles} / ${data.total}`;
    $('timeLine').textContent = fmtTime(data.time);
    $('staminaBar').style.transform = `scaleX(${clamp(data.stamina, 0, 1)})`;
    $('flashLine').textContent = data.flashOn ? 'LIGHT ON' : 'LIGHT OFF';
    $('flashLine').classList.toggle('off', !data.flashOn);
  },
  hudFlash(on) {
    $('flashLine').textContent = on ? 'LIGHT ON' : 'LIGHT OFF';
    $('flashLine').classList.toggle('off', !on);
    const btn = $('btnFlash');
    if (btn) btn.classList.toggle('active', on);
  },
  hint(text) {
    const el = $('hintLine');
    if (el.textContent !== text) el.textContent = text;
  },
  toast(text) {
    const el = $('toast');
    el.textContent = text;
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => el.classList.remove('show'), 2800);
  },
  card(meta) {
    const el = $('card');
    if (!meta) {
      el.classList.remove('show');
      return;
    }
    $('cardCode').textContent = meta.code;
    $('cardName').textContent = meta.name;
    $('cardIntro').textContent = meta.intro;
    el.hidden = false;
    el.classList.remove('show');
    void el.offsetWidth;
    el.classList.add('show');
    clearTimeout(cardTimer);
    cardTimer = setTimeout(() => el.classList.remove('show'), 3600);
  },
  hideCard() {
    $('card').classList.remove('show');
    clearTimeout(cardTimer);
  },
  fade(v) {
    $('fade').style.opacity = String(clamp(v, 0, 1));
  },
  fear(v) {
    $('fx-fear').style.opacity = String(clamp(v, 0, 1));
  },
  refreshBest() {
    const best = loadBest();
    $('menuBest').textContent = best > 0 ? `DEEPEST RECORDED: LEVEL ${best}` : 'NO RECORDED SURVIVOR';
    $('deadBest').textContent = String(best);
  },
  death(stats) {
    saveBest(stats.level);
    $('deadLevel').textContent = `${stats.levelName.toUpperCase()} — LEVEL ${stats.level}`;
    $('deadTime').textContent = fmtTime(stats.time);
    $('deadBottles').textContent = String(stats.bottles);
    this.show('dead');
    this.refreshBest();
    releaseLock();
  },
  win(stats) {
    saveBest(stats.level);
    $('winTime').textContent = fmtTime(stats.time);
    $('winBottles').textContent = String(stats.bottles);
    $('winBest').textContent = `LEVEL ${loadBest()}`;
    this.show('win');
    releaseLock();
  },
};

const game = new Game({ canvas, audio, settings, ui });
game.setTouchMode(isTouch);
game.renderer.setQuality(settings.quality);
ui.refreshBest();
ui.show('menu');
ui.fear(0);
ui.fade(0);

function releaseLock() {
  if (document.pointerLockElement === canvas) document.exitPointerLock?.();
}

function requestLock() {
  if (isTouch) return;
  try {
    const p = canvas.requestPointerLock?.();
    if (p && typeof p.catch === 'function') p.catch(() => {});
  } catch (err) {
    /* pointer lock unavailable */
  }
}

function startGame() {
  audio.init();
  audio.setVolume(settings.volume);
  audio.setMuted(settings.muted);
  ui.show(null);
  game.startRun();
  requestLock();
}

function resumeGame() {
  game.resumeGame();
  requestLock();
}

function toggleMute() {
  settings.muted = !settings.muted;
  audio.setMuted(settings.muted);
  $('optMute').checked = settings.muted;
  saveSettings();
  ui.toast(settings.muted ? 'AUDIO MUTED' : 'AUDIO ON');
}

// ---- menu buttons -------------------------------------------------------

$('btnStart').addEventListener('click', () => {
  audio.ui();
  startGame();
});

$('btnHow').addEventListener('click', () => {
  audio.ui();
  const panel = $('howto');
  panel.hidden = !panel.hidden;
  $('options').hidden = true;
});

$('btnOpts').addEventListener('click', () => {
  audio.ui();
  const panel = $('options');
  panel.hidden = !panel.hidden;
  $('howto').hidden = true;
});

$('btnResume').addEventListener('click', resumeGame);
$('btnRestart').addEventListener('click', () => {
  startGame();
});
$('btnQuit').addEventListener('click', () => {
  releaseLock();
  game.quitToMenu();
  ui.refreshBest();
});

$('btnRetry').addEventListener('click', startGame);
$('btnMenuDead').addEventListener('click', () => {
  game.quitToMenu();
  ui.refreshBest();
});
$('btnAgain').addEventListener('click', startGame);
$('btnMenuWin').addEventListener('click', () => {
  game.quitToMenu();
  ui.refreshBest();
});

// ---- options ------------------------------------------------------------

const optSens = $('optSens');
const optVol = $('optVol');
const optQuality = $('optQuality');
const optReduce = $('optReduce');
const optMute = $('optMute');

optSens.value = String(settings.sensitivity);
$('sensVal').textContent = Number(settings.sensitivity).toFixed(2);
optVol.value = String(settings.volume);
$('volVal').textContent = String(Math.round(settings.volume * 100));
optQuality.value = String(settings.quality);
optReduce.checked = !!settings.reduceFx;
optMute.checked = !!settings.muted;

optSens.addEventListener('input', (e) => {
  settings.sensitivity = parseFloat(e.target.value);
  $('sensVal').textContent = settings.sensitivity.toFixed(2);
  saveSettings();
});

optVol.addEventListener('input', (e) => {
  settings.volume = parseFloat(e.target.value);
  $('volVal').textContent = String(Math.round(settings.volume * 100));
  audio.setVolume(settings.volume);
  saveSettings();
});

optQuality.addEventListener('change', (e) => {
  settings.quality = parseInt(e.target.value, 10);
  game.renderer.setQuality(settings.quality);
  saveSettings();
});

optReduce.addEventListener('change', (e) => {
  settings.reduceFx = e.target.checked;
  saveSettings();
});

optMute.addEventListener('change', (e) => {
  settings.muted = e.target.checked;
  audio.setMuted(settings.muted);
  saveSettings();
});

// ---- keyboard -----------------------------------------------------------

const MOVE_KEYS = new Set([
  'KeyW',
  'KeyA',
  'KeyS',
  'KeyD',
  'ArrowUp',
  'ArrowDown',
  'ArrowLeft',
  'ArrowRight',
  'ShiftLeft',
  'ShiftRight',
]);

document.addEventListener('keydown', (e) => {
  if (MOVE_KEYS.has(e.code)) {
    game.keys.add(e.code);
    if (game.state === 'playing' || game.state === 'intro') e.preventDefault();
  }
  if (e.code === 'KeyF') {
    game.toggleFlash();
  }
  if (e.code === 'KeyM') {
    toggleMute();
  }
  if (e.code === 'Escape') {
    if (game.state === 'paused') resumeGame();
    else if (game.state === 'playing' || game.state === 'intro') game.pauseGame();
  }
});

document.addEventListener('keyup', (e) => {
  game.keys.delete(e.code);
});

window.addEventListener('blur', () => game.keys.clear());

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === canvas;
  if (!locked && !isTouch && (game.state === 'playing' || game.state === 'intro')) {
    game.pauseGame();
  }
});

document.addEventListener('mousemove', (e) => {
  if (document.pointerLockElement !== canvas) return;
  game.look(e.movementX, e.movementY);
});

canvas.addEventListener('click', () => {
  if (isTouch) return;
  if (game.state === 'playing' || game.state === 'intro') requestLock();
});

document.addEventListener('visibilitychange', () => {
  if (document.hidden && (game.state === 'playing' || game.state === 'intro')) {
    game.pauseGame();
    ui.show('pause');
  }
});

// ---- touch controls -----------------------------------------------------

const padMove = $('stickL');
const knobMove = $('knobL');
const padLook = $('stickR');
let movePid = null;
let lookPid = null;
let baseX = 0;
let baseY = 0;
let lastX = 0;
let lastY = 0;

function updateMove(e) {
  if (e.pointerId !== movePid) return;
  let dx = e.clientX - baseX;
  let dy = e.clientY - baseY;
  const max = 46;
  const d = Math.hypot(dx, dy);
  if (d > max) {
    dx = (dx / d) * max;
    dy = (dy / d) * max;
  }
  knobMove.style.transform = `translate(${dx}px, ${dy}px)`;
  game.touch.x = dx / max;
  game.touch.y = -dy / max;
}

padMove.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  movePid = e.pointerId;
  padMove.setPointerCapture(movePid);
  const r = padMove.getBoundingClientRect();
  baseX = r.left + r.width / 2;
  baseY = r.top + r.height / 2;
  padMove.classList.add('active');
  updateMove(e);
});
padMove.addEventListener('pointermove', updateMove);
function endMove(e) {
  if (e.pointerId !== movePid) return;
  movePid = null;
  game.touch.x = 0;
  game.touch.y = 0;
  knobMove.style.transform = '';
  padMove.classList.remove('active');
}
padMove.addEventListener('pointerup', endMove);
padMove.addEventListener('pointercancel', endMove);

padLook.addEventListener('pointerdown', (e) => {
  e.preventDefault();
  lookPid = e.pointerId;
  padLook.setPointerCapture(lookPid);
  lastX = e.clientX;
  lastY = e.clientY;
  padLook.classList.add('active');
});
padLook.addEventListener('pointermove', (e) => {
  if (e.pointerId !== lookPid) return;
  const dx = e.clientX - lastX;
  const dy = e.clientY - lastY;
  lastX = e.clientX;
  lastY = e.clientY;
  game.look(dx * 2.1, dy * 2.1);
});
function endLook(e) {
  if (e.pointerId !== lookPid) return;
  lookPid = null;
  padLook.classList.remove('active');
}
padLook.addEventListener('pointerup', endLook);
padLook.addEventListener('pointercancel', endLook);

const btnSprint = $('btnSprint');
const setSprint = (v) => (e) => {
  e.preventDefault();
  game.touch.sprint = v;
  btnSprint.classList.toggle('active', v);
};
btnSprint.addEventListener('pointerdown', setSprint(true));
btnSprint.addEventListener('pointerup', setSprint(false));
btnSprint.addEventListener('pointercancel', setSprint(false));
btnSprint.addEventListener('pointerleave', setSprint(false));

$('btnFlash').addEventListener('click', (e) => {
  e.preventDefault();
  game.toggleFlash();
  e.currentTarget.classList.toggle('active', game.flashOn);
});
$('btnPause').addEventListener('click', (e) => {
  e.preventDefault();
  game.pauseGame();
});

// ---- loop ---------------------------------------------------------------

let resizeTimer = 0;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => game.resize(), 80);
});

let last = performance.now();
function frame(now) {
  const dt = (now - last) / 1000;
  last = now;
  game.update(dt);
  game.renderScene();
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);
