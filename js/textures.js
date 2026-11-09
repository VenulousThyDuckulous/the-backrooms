import { mulberry32, textureFromDraw } from './util.js';

const SIZE = 64;

// Palette + mood per level, sampled by the renderer.
export const PALETTES = [
  {
    style: 'wallpaper',
    base: [196, 174, 99],
    shade: [150, 132, 73],
    light: [219, 202, 128],
    trim: [96, 84, 44],
    floor: [140, 122, 69],
    floor2: [110, 94, 52],
    ceil: [200, 182, 116],
    ceil2: [168, 150, 96],
    fog: [24, 20, 10],
    ambient: 0.92,
  },
  {
    style: 'concrete',
    base: [104, 104, 97],
    shade: [72, 72, 66],
    light: [128, 128, 118],
    trim: [42, 42, 38],
    floor: [62, 62, 57],
    floor2: [43, 43, 39],
    ceil: [82, 82, 76],
    ceil2: [62, 62, 57],
    fog: [8, 9, 8],
    ambient: 0.66,
  },
  {
    style: 'tile',
    base: [150, 198, 192],
    shade: [110, 156, 151],
    light: [196, 232, 226],
    trim: [78, 122, 118],
    floor: [116, 172, 166],
    floor2: [84, 138, 133],
    ceil: [186, 220, 214],
    ceil2: [152, 192, 187],
    fog: [11, 26, 26],
    ambient: 1.02,
  },
  {
    style: 'rot',
    base: [92, 39, 41],
    shade: [54, 18, 20],
    light: [126, 56, 58],
    trim: [28, 8, 9],
    floor: [48, 19, 20],
    floor2: [30, 10, 11],
    ceil: [55, 22, 23],
    ceil2: [36, 13, 14],
    fog: [13, 3, 4],
    ambient: 0.52,
  },
];

const rgba = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;

function specks(ctx, rng, count, color, maxAlpha = 0.09) {
  for (let i = 0; i < count; i++) {
    ctx.fillStyle = rgba(color, rng() * maxAlpha);
    ctx.fillRect((rng() * SIZE) | 0, (rng() * SIZE) | 0, 1, 1);
  }
}

function stains(ctx, rng, count, color, minR, maxR, maxAlpha) {
  for (let i = 0; i < count; i++) {
    const x = rng() * SIZE;
    const y = rng() * SIZE;
    const r = minR + rng() * (maxR - minR);
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    const a = 0.05 + rng() * maxAlpha;
    g.addColorStop(0, rgba(color, a));
    g.addColorStop(0.6, rgba(color, a * 0.55));
    g.addColorStop(1, rgba(color, 0));
    ctx.fillStyle = g;
    ctx.fillRect(x - r, y - r, r * 2, r * 2);
  }
}

function cracks(ctx, rng, count, color) {
  ctx.strokeStyle = rgba(color, 0.35);
  ctx.lineWidth = 1;
  for (let i = 0; i < count; i++) {
    let x = rng() * SIZE;
    let y = rng() * SIZE;
    ctx.beginPath();
    ctx.moveTo(x, y);
    const steps = 3 + ((rng() * 5) | 0);
    for (let s = 0; s < steps; s++) {
      x += (rng() - 0.5) * 14;
      y += (rng() - 0.5) * 14;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
}

function drawWall(pal, seed, variant) {
  const rng = mulberry32(seed);
  return textureFromDraw(SIZE, (ctx) => {
    ctx.fillStyle = rgba(pal.base);
    ctx.fillRect(0, 0, SIZE, SIZE);

    if (pal.style === 'wallpaper') {
      for (let x = 0; x < SIZE; x += 8) {
        ctx.fillStyle = rgba(pal.shade, variant ? 0.34 : 0.26);
        ctx.fillRect(x, 0, 2, SIZE);
        ctx.fillStyle = rgba(pal.light, 0.2);
        ctx.fillRect(x + 4, 0, 1, SIZE);
      }
      // faint damask dots
      for (let y = 6; y < SIZE - 8; y += 12) {
        for (let x = 6; x < SIZE; x += 16) {
          ctx.fillStyle = rgba(pal.light, 0.1);
          ctx.beginPath();
          ctx.arc(x + (y % 24 ? 4 : 0), y, 1.4, 0, Math.PI * 2);
          ctx.fill();
        }
      }
    } else if (pal.style === 'concrete') {
      for (let y = 0; y < SIZE; y += 16) {
        ctx.fillStyle = rgba(pal.shade, 0.16);
        ctx.fillRect(0, y, SIZE, 1);
      }
      cracks(ctx, rng, 3, pal.trim);
      stains(ctx, rng, 7, pal.shade, 6, 22, 0.4);
    } else if (pal.style === 'tile') {
      for (let y = 0; y < SIZE; y += 16) {
        for (let x = 0; x < SIZE; x += 16) {
          ctx.fillStyle = rgba(pal.shade, 0.22 + rng() * 0.12);
          ctx.fillRect(x, y, 16, 1);
          ctx.fillRect(x, y, 1, 16);
          ctx.fillStyle = rgba(pal.light, 0.09);
          ctx.fillRect(x + 2, y + 2, 12, 5);
        }
      }
      stains(ctx, rng, 5, [54, 74, 62], 4, 14, 0.35);
    } else {
      for (let i = 0; i < 9; i++) {
        const x = rng() * SIZE;
        ctx.strokeStyle = rgba(pal.shade, 0.5);
        ctx.lineWidth = 1 + rng() * 2;
        ctx.beginPath();
        ctx.moveTo(x, RANDOM_TOP(rng));
        ctx.bezierCurveTo(x + 6, 20, x - 5, 40, x + 3, 64);
        ctx.stroke();
      }
      stains(ctx, rng, 10, [20, 4, 5], 5, 20, 0.5);
    }

    stains(ctx, rng, 10, pal.shade, 5, 24, 0.34);
    specks(ctx, rng, 900, pal.trim, 0.14);
    specks(ctx, rng, 220, pal.light, 0.1);

    // baseboard
    ctx.fillStyle = rgba(pal.trim, 0.9);
    ctx.fillRect(0, SIZE - 6, SIZE, 6);
    ctx.fillStyle = rgba(pal.light, 0.16);
    ctx.fillRect(0, SIZE - 7, SIZE, 1);
  });
}

function RANDOM_TOP(rng) {
  return rng() * 12;
}

function drawFloor(pal, seed) {
  const rng = mulberry32(seed);
  return textureFromDraw(SIZE, (ctx) => {
    ctx.fillStyle = rgba(pal.floor);
    ctx.fillRect(0, 0, SIZE, SIZE);

    if (pal.style === 'wallpaper') {
      // damp office carpet
      for (let i = 0; i < 2400; i++) {
        const c = rng() > 0.5 ? pal.floor2 : pal.light;
        ctx.fillStyle = rgba(c, rng() * 0.22);
        ctx.fillRect((rng() * SIZE) | 0, (rng() * SIZE) | 0, 1, 1);
      }
      stains(ctx, rng, 8, [58, 46, 20], 5, 20, 0.4);
    } else if (pal.style === 'concrete') {
      specks(ctx, rng, 1800, pal.ceil, 0.12);
      specks(ctx, rng, 700, pal.shade, 0.2);
      cracks(ctx, rng, 5, pal.trim);
      stains(ctx, rng, 4, [16, 20, 18], 8, 24, 0.5);
    } else if (pal.style === 'tile') {
      for (let y = 0; y < SIZE; y += 16) {
        for (let x = 0; x < SIZE; x += 16) {
          ctx.fillStyle = rgba(pal.light, 0.06 + rng() * 0.1);
          ctx.fillRect(x + 1, y + 1, 14, 14);
          ctx.fillStyle = rgba(pal.ceil2, 0.55);
          ctx.fillRect(x, y, 16, 1);
          ctx.fillRect(x, y, 1, 16);
        }
      }
      // water sheen
      const g = ctx.createLinearGradient(0, 0, SIZE, SIZE);
      g.addColorStop(0, 'rgba(210,255,250,0.13)');
      g.addColorStop(0.5, 'rgba(210,255,250,0)');
      g.addColorStop(1, 'rgba(210,255,250,0.09)');
      ctx.fillStyle = g;
      ctx.fillRect(0, 0, SIZE, SIZE);
      stains(ctx, rng, 5, [40, 76, 66], 4, 14, 0.4);
    } else {
      for (let i = 0; i < 1700; i++) {
        ctx.fillStyle = rgba(pal.floor2, rng() * 0.5);
        ctx.fillRect((rng() * SIZE) | 0, (rng() * SIZE) | 0, 1, 1);
      }
      stains(ctx, rng, 9, [12, 2, 3], 5, 22, 0.55);
    }
    specks(ctx, rng, 500, pal.trim, 0.1);
  });
}

function drawCeil(pal, seed) {
  const rng = mulberry32(seed);
  return textureFromDraw(SIZE, (ctx) => {
    ctx.fillStyle = rgba(pal.ceil);
    ctx.fillRect(0, 0, SIZE, SIZE);

    if (pal.style === 'wallpaper' || pal.style === 'tile') {
      for (let y = 0; y < SIZE; y += 16) {
        for (let x = 0; x < SIZE; x += 16) {
          ctx.fillStyle = rgba(pal.ceil2, 0.75);
          ctx.fillRect(x, y, 16, 1);
          ctx.fillRect(x, y, 1, 16);
          ctx.fillStyle = rgba(pal.light, 0.1);
          ctx.fillRect(x + 2, y + 2, 12, 3);
        }
      }
      stains(ctx, rng, 6, [120, 100, 48], 4, 16, 0.4);
    } else if (pal.style === 'concrete') {
      specks(ctx, rng, 1200, pal.ceil2, 0.2);
      cracks(ctx, rng, 4, pal.trim);
      stains(ctx, rng, 6, [10, 12, 10], 6, 24, 0.55);
    } else {
      stains(ctx, rng, 12, [12, 2, 3], 6, 26, 0.6);
      specks(ctx, rng, 900, pal.light, 0.12);
    }
    specks(ctx, rng, 400, pal.trim, 0.1);
  });
}

export function buildTextures(paletteIndex) {
  const pal = PALETTES[paletteIndex] || PALETTES[0];
  return {
    palette: pal,
    wall: drawWall(pal, 1000 + paletteIndex * 71, 0),
    wallB: drawWall(pal, 5000 + paletteIndex * 37, 1),
    floor: drawFloor(pal, 9000 + paletteIndex * 53),
    ceil: drawCeil(pal, 3000 + paletteIndex * 29),
  };
}
