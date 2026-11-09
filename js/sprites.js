import { makeCanvas, texFromCanvas } from './util.js';

function makeBottle() {
  const w = 48;
  const h = 80;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');

  // soft aura so bottles read in the dark
  const aura = g.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, 26);
  aura.addColorStop(0, 'rgba(160, 220, 255, 0.35)');
  aura.addColorStop(1, 'rgba(160, 220, 255, 0)');
  g.fillStyle = aura;
  g.fillRect(0, 0, w, h);

  // carton body
  g.fillStyle = '#e9e4d6';
  g.beginPath();
  g.moveTo(13, 24);
  g.lineTo(35, 24);
  g.lineTo(35, 71);
  g.lineTo(13, 71);
  g.closePath();
  g.fill();
  g.fillStyle = '#cbc3ae';
  g.fillRect(29, 24, 6, 47);

  // gable top
  g.fillStyle = '#f2edde';
  g.beginPath();
  g.moveTo(13, 24);
  g.lineTo(24, 12);
  g.lineTo(35, 24);
  g.closePath();
  g.fill();
  g.fillStyle = '#cfc7b1';
  g.beginPath();
  g.moveTo(24, 12);
  g.lineTo(35, 24);
  g.lineTo(28, 24);
  g.closePath();
  g.fill();
  g.fillStyle = '#e6e0cf';
  g.fillRect(21, 8, 6, 5);
  g.fillStyle = '#8ea6b8';
  g.fillRect(20, 6, 8, 2);

  // label
  g.fillStyle = '#3f6f8f';
  g.fillRect(13, 34, 22, 22);
  g.fillStyle = '#cfe7f2';
  g.fillRect(15, 37, 18, 3);
  g.fillRect(15, 43, 12, 2);
  g.fillRect(15, 48, 15, 2);
  g.fillStyle = '#e9e4d6';
  g.fillRect(17, 52, 6, 2);
  g.fillStyle = '#2d5570';
  g.fillRect(13, 34, 22, 1);
  g.fillRect(13, 55, 22, 1);
  g.strokeStyle = 'rgba(60,80,90,0.5)';
  g.strokeRect(13.5, 24.5, 21, 46);

  // highlight
  g.fillStyle = 'rgba(255,255,255,0.28)';
  g.fillRect(15, 25, 2, 45);

  return texFromCanvas(c);
}

function makeExit() {
  const w = 96;
  const h = 132;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');

  // sign glow
  const glow = g.createRadialGradient(w / 2, 20, 2, w / 2, 20, 44);
  glow.addColorStop(0, 'rgba(120, 255, 170, 0.55)');
  glow.addColorStop(1, 'rgba(120, 255, 170, 0)');
  g.fillStyle = glow;
  g.fillRect(0, 0, w, 70);

  // frame
  g.fillStyle = '#23241f';
  g.fillRect(16, 30, 64, 102);
  g.fillStyle = '#151612';
  g.fillRect(21, 36, 54, 96);

  // door
  const doorGrad = g.createLinearGradient(21, 0, 75, 0);
  doorGrad.addColorStop(0, '#3d4b41');
  doorGrad.addColorStop(0.45, '#54655a');
  doorGrad.addColorStop(1, '#2b352e');
  g.fillStyle = doorGrad;
  g.fillRect(25, 40, 46, 92);

  g.fillStyle = 'rgba(0,0,0,0.35)';
  g.fillRect(25, 54, 46, 3);
  g.fillRect(25, 122, 46, 3);
  g.fillStyle = '#8fa197';
  g.fillRect(57, 82, 10, 5);
  g.fillStyle = '#0d0f0c';
  g.fillRect(59, 84, 6, 2);

  // light spill under the door
  const spill = g.createLinearGradient(0, 124, 0, 132);
  spill.addColorStop(0, 'rgba(150,255,190,0.55)');
  spill.addColorStop(1, 'rgba(150,255,190,0)');
  g.fillStyle = spill;
  g.fillRect(24, 124, 48, 8);

  // exit sign
  g.fillStyle = '#0b2416';
  g.fillRect(30, 12, 36, 16);
  g.fillStyle = '#7dffb2';
  g.font = 'bold 12px monospace';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('EXIT', 48, 20);
  g.strokeStyle = 'rgba(180,255,210,0.7)';
  g.strokeRect(30.5, 12.5, 35, 15);

  return texFromCanvas(c);
}

function makeEntity(frame) {
  const w = 100;
  const h = 168;
  const c = makeCanvas(w, h);
  const g = c.getContext('2d');
  const sway = frame ? 3 : -3;

  g.lineJoin = 'round';
  g.strokeStyle = '#0a0908';
  g.fillStyle = '#0a0908';

  // long legs
  g.lineWidth = 7;
  g.beginPath();
  g.moveTo(46, 104);
  g.lineTo(40 + sway, 150);
  g.lineTo(36 + sway, 164);
  g.moveTo(54, 104);
  g.lineTo(60 - sway, 150);
  g.lineTo(64 - sway, 164);
  g.stroke();

  // torso
  g.beginPath();
  g.moveTo(38, 58);
  g.quadraticCurveTo(30, 84, 37, 108);
  g.lineTo(63, 108);
  g.quadraticCurveTo(70, 84, 62, 58);
  g.quadraticCurveTo(50, 48, 38, 58);
  g.fill();

  // arms, far too long
  g.lineWidth = 5.5;
  g.beginPath();
  g.moveTo(39, 64);
  g.quadraticCurveTo(24 + sway, 92, 22 + sway, 126);
  g.moveTo(61, 64);
  g.quadraticCurveTo(76 - sway, 92, 78 - sway, 126);
  g.stroke();
  g.beginPath();
  g.arc(22 + sway, 128, 3.4, 0, Math.PI * 2);
  g.arc(78 - sway, 128, 3.4, 0, Math.PI * 2);
  g.fill();

  // shoulders / neck
  g.beginPath();
  g.moveTo(41, 60);
  g.lineTo(59, 60);
  g.lineTo(57, 44);
  g.lineTo(43, 44);
  g.closePath();
  g.fill();

  // head
  const headGrad = g.createRadialGradient(47, 26, 3, 50, 30, 24);
  headGrad.addColorStop(0, '#d8cfb9');
  headGrad.addColorStop(0.7, '#b8ae97');
  headGrad.addColorStop(1, '#6d6555');
  g.fillStyle = headGrad;
  g.beginPath();
  g.ellipse(50, 28, 16, 21, 0, 0, Math.PI * 2);
  g.fill();

  // hollow eyes
  g.fillStyle = '#070606';
  g.beginPath();
  g.ellipse(43, 24, 5.2, 6.4, -0.2, 0, Math.PI * 2);
  g.ellipse(57, 24, 5.2, 6.4, 0.2, 0, Math.PI * 2);
  g.fill();

  // pinprick glints
  g.fillStyle = '#f6f1e2';
  g.beginPath();
  g.arc(44.5, 23, 1.1, 0, Math.PI * 2);
  g.arc(58.5, 23, 1.1, 0, Math.PI * 2);
  g.fill();

  // the smile
  g.strokeStyle = '#1a0607';
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(39, 37);
  g.quadraticCurveTo(50, 50, 61, 37);
  g.stroke();
  g.fillStyle = '#efe9d8';
  for (let i = 0; i < 8; i++) {
    const x = 40.5 + i * 2.6;
    const y = 38.5 + Math.sin((i / 7) * Math.PI) * 5.2;
    g.fillRect(x, y, 2.1, 2.4);
  }

  // grime
  g.globalAlpha = 0.22;
  g.fillStyle = '#000';
  g.beginPath();
  g.ellipse(46, 104, 10, 6, 0.4, 0, Math.PI * 2);
  g.fill();
  g.globalAlpha = 1;

  return texFromCanvas(c);
}

export function buildSprites() {
  return {
    bottle: makeBottle(),
    exit: makeExit(),
    entity: [makeEntity(0), makeEntity(1)],
  };
}
