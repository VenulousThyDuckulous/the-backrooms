import { buildTextures } from './textures.js';
import { clamp, mulberry32 } from './util.js';

export const LEVEL_META = [
  {
    code: 'LEVEL 0',
    name: 'The Lobby',
    palette: 0,
    size: 30,
    bottles: 3,
    intro: 'Damp carpet. Fluorescent hum. No windows.',
    delay: 42,
    roam: 1.12,
    hunt: 1.5,
    fogDist: 16,
  },
  {
    code: 'LEVEL 1',
    name: 'Habitable Zone',
    palette: 1,
    size: 34,
    bottles: 3,
    intro: 'Concrete. Pipes. Something breathing in the walls.',
    delay: 32,
    roam: 1.22,
    hunt: 1.68,
    fogDist: 13,
  },
  {
    code: 'LEVEL 2',
    name: 'The Poolrooms',
    palette: 2,
    size: 32,
    bottles: 4,
    intro: 'Warm water. Endless tile. No swimmers.',
    delay: 24,
    roam: 1.3,
    hunt: 1.82,
    fogDist: 17,
  },
  {
    code: 'LEVEL 3',
    name: 'The Hive',
    palette: 3,
    size: 36,
    bottles: 4,
    intro: 'The walls are warm. It knows your name.',
    delay: 16,
    roam: 1.4,
    hunt: 1.98,
    fogDist: 11,
  },
];

const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

export class World {
  constructor(levelIndex, seed) {
    this.index = levelIndex;
    this.meta = LEVEL_META[levelIndex];
    this.size = this.meta.size;
    this.seed = seed >>> 0;
    const built = buildTextures(this.meta.palette);
    this.textures = built;
    this.palette = built.palette;
    this.fogDist = this.meta.fogDist;
    this.grid = new Uint8Array(this.size * this.size);
    this.generate();
  }

  isWall(x, y) {
    if (x < 0 || y < 0 || x >= this.size || y >= this.size) return true;
    return this.grid[y * this.size + x] === 1;
  }

  generate() {
    const size = this.size;
    const rng = mulberry32(this.seed);
    const grid = this.grid;
    grid.fill(1);
    const at = (x, y) => y * size + x;

    const carve = (x, y) => {
      if (x > 0 && y > 0 && x < size - 1 && y < size - 1) grid[at(x, y)] = 0;
    };

    // roaming corridors
    for (let walker = 0; walker < 4; walker++) {
      let x = 1 + Math.floor(rng() * (size - 2));
      let y = 1 + Math.floor(rng() * (size - 2));
      carve(x, y);
      let dir = Math.floor(rng() * 4);
      const steps = Math.floor(size * size * 0.6);
      for (let i = 0; i < steps; i++) {
        if (rng() < 0.18) dir = (dir + (rng() < 0.5 ? 1 : 3)) % 4;
        else if (rng() < 0.05) dir = (dir + 2) % 4;
        const nx = x + DX[dir];
        const ny = y + DY[dir];
        if (nx < 1 || ny < 1 || nx >= size - 1 || ny >= size - 1) {
          dir = (dir + 2) % 4;
          continue;
        }
        x = nx;
        y = ny;
        carve(x, y);
        if (rng() < 0.13) carve(x + DX[(dir + 1) % 4], y + DY[(dir + 1) % 4]);
      }
    }

    // open rooms with pillars
    const rooms = 5 + Math.floor(rng() * 4);
    for (let i = 0; i < rooms; i++) {
      const rw = 4 + Math.floor(rng() * 5);
      const rh = 3 + Math.floor(rng() * 4);
      const rx = 1 + Math.floor(rng() * Math.max(1, size - rw - 2));
      const ry = 1 + Math.floor(rng() * Math.max(1, size - rh - 2));
      for (let y = ry; y < ry + rh; y++) {
        for (let x = rx; x < rx + rw; x++) carve(x, y);
      }
      if (rng() < 0.65) {
        for (let y = ry + 1; y < ry + rh - 1; y += 2) {
          for (let x = rx + 1; x < rx + rw - 1; x += 2) {
            if (rng() < 0.55) grid[at(x, y)] = 1;
          }
        }
      }
    }

    // find a start near the middle
    const mid = Math.floor(size / 2);
    let startCell = null;
    let best = Infinity;
    for (let y = 1; y < size - 1; y++) {
      for (let x = 1; x < size - 1; x++) {
        if (grid[at(x, y)] !== 0) continue;
        const d = (x - mid) * (x - mid) + (y - mid) * (y - mid);
        if (d < best) {
          best = d;
          startCell = { x, y };
        }
      }
    }
    if (!startCell) {
      startCell = { x: mid, y: mid };
      carve(mid, mid);
    }

    // flood fill reachable region from the start
    const dist = this.bfs(startCell.x, startCell.y);
    const reachable = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const d = dist[at(x, y)];
        if (d >= 0) reachable.push({ x, y, dist: d });
      }
    }

    const openDirs = [];
    for (let d = 0; d < 4; d++) {
      if (!this.isWall(startCell.x + DX[d], startCell.y + DY[d])) openDirs.push(d);
    }
    const dirPick = openDirs.length ? openDirs[Math.floor(rng() * openDirs.length)] : 0;
    const startAngle = Math.atan2(DY[dirPick], DX[dirPick]);

    // exit is the farthest reachable cell
    let exitCell = reachable[0];
    for (const c of reachable) if (c.dist > exitCell.dist) exitCell = c;

    this.start = {
      x: startCell.x + 0.5,
      y: startCell.y + 0.5,
      angle: startAngle,
    };
    this.startCell = startCell;
    this.exit = { x: exitCell.x + 0.5, y: exitCell.y + 0.5 };
    this.maxDist = exitCell.dist;

    // almond water, spread out and far from the start
    const sorted = reachable
      .filter((c) => c.dist > Math.min(6, this.maxDist * 0.25))
      .sort((a, b) => b.dist - a.dist);
    const bottles = [];
    for (const c of sorted) {
      if (bottles.length >= this.meta.bottles) break;
      if (c.x === exitCell.x && c.y === exitCell.y) continue;
      if (Math.hypot(c.x - startCell.x, c.y - startCell.y) < 5) continue;
      if (bottles.some((b) => Math.hypot(b.cx - c.x, b.cy - c.y) < 6)) continue;
      if (rng() < 0.5 && sorted.length > this.meta.bottles * 5) continue;
      bottles.push({ x: c.x + 0.5, y: c.y + 0.5, cx: c.x, cy: c.y });
    }
    for (const c of sorted) {
      if (bottles.length >= this.meta.bottles) break;
      if (c.x === exitCell.x && c.y === exitCell.y) continue;
      if (bottles.some((b) => Math.hypot(b.cx - c.x, b.cy - c.y) < 4)) continue;
      bottles.push({ x: c.x + 0.5, y: c.y + 0.5, cx: c.x, cy: c.y });
    }
    this.bottles = bottles;
    this.reachable = reachable;
    this.cellDist = dist;
    this.rooms = rooms;
  }

  bfs(startX, startY) {
    const size = this.size;
    const field = new Int32Array(size * size).fill(-1);
    if (this.isWall(startX, startY)) return field;
    const queue = new Int32Array(size * size);
    let head = 0;
    let tail = 0;
    const start = startY * size + startX;
    field[start] = 0;
    queue[tail++] = start;
    while (head < tail) {
      const cur = queue[head++];
      const cx = cur % size;
      const cy = (cur / size) | 0;
      const d = field[cur];
      for (let i = 0; i < 4; i++) {
        const nx = cx + DX[i];
        const ny = cy + DY[i];
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) continue;
        const ni = ny * size + nx;
        if (this.grid[ni] === 1 || field[ni] !== -1) continue;
        field[ni] = d + 1;
        queue[tail++] = ni;
      }
    }
    return field;
  }

  lineOfSight(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const dist = Math.hypot(dx, dy);
    const steps = Math.ceil(dist * 6);
    for (let i = 1; i < steps; i++) {
      const t = i / steps;
      if (this.isWall(Math.floor(x0 + dx * t), Math.floor(y0 + dy * t))) return false;
    }
    return true;
  }

  collides(x, y, radius) {
    const minX = Math.floor(x - radius);
    const maxX = Math.floor(x + radius);
    const minY = Math.floor(y - radius);
    const maxY = Math.floor(y + radius);
    for (let cy = minY; cy <= maxY; cy++) {
      for (let cx = minX; cx <= maxX; cx++) {
        if (!this.isWall(cx, cy)) continue;
        const nx = clamp(x, cx, cx + 1);
        const ny = clamp(y, cy, cy + 1);
        const ddx = x - nx;
        const ddy = y - ny;
        if (ddx * ddx + ddy * ddy < radius * radius) return true;
      }
    }
    return false;
  }

  farSpawn(minDistance, fromX, fromY) {
    const options = this.reachable.filter(
      (c) => Math.hypot(c.x + 0.5 - fromX, c.y + 0.5 - fromY) > minDistance
    );
    const pool = options.length ? options : this.reachable;
    const c = pool[Math.floor(Math.random() * pool.length)];
    return { x: c.x + 0.5, y: c.y + 0.5 };
  }
}
