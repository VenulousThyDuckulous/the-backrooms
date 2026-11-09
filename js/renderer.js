import { clamp } from './util.js';

const FOV = 0.72;

export class Renderer {
  constructor(canvas) {
    this.canvas = canvas;
    this.ctx = canvas.getContext('2d', { alpha: false });
    this.quality = 1;
    this.w = 320;
    this.h = 200;
    this.img = null;
    this.px = null;
    this.zbuf = new Float32Array(1);
    this.resize();
  }

  setQuality(q) {
    this.quality = clamp(q | 0, 0, 2);
    this.resize();
  }

  resize() {
    const rect = this.canvas.getBoundingClientRect();
    const vw = rect.width || window.innerWidth || 1280;
    const vh = rect.height || window.innerHeight || 720;
    const aspect = clamp(vw / Math.max(1, vh), 0.55, 2.8);
    const targetH = [160, 224, 300][this.quality] || 224;
    const h = Math.round(targetH);
    const w = Math.round(h * aspect);
    this.w = w;
    this.h = h;
    this.canvas.width = w;
    this.canvas.height = h;
    this.img = this.ctx.createImageData(w, h);
    this.px = this.img.data;
    this.zbuf = new Float32Array(w);
  }

  clear() {
    if (!this.ctx) return;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, this.w, this.h);
  }

  render(scene) {
    const { world, player, sprites, flash, flicker, time, shake } = scene;
    if (!world || !this.px) return;

    const w = this.w;
    const h = this.h;
    const px = this.px;
    const pal = world.palette;
    const fog = pal.fog;
    const ambient = pal.ambient;

    const dirX = Math.cos(player.angle);
    const dirY = Math.sin(player.angle);
    const planeX = -dirY * FOV;
    const planeY = dirX * FOV;

    const bob = (player.bob || 0) * h;
    const shakeY = (shake || 0) * Math.sin(time * 87) * 5;
    const horizon = Math.round(h / 2 + (player.look || 0) * h + bob + shakeY);
    const flashPower = flash ? clamp(flicker, 0, 1) : 0;

    const rayX0 = dirX - planeX;
    const rayY0 = dirY - planeY;
    const rayX1 = dirX + planeX;
    const rayY1 = dirY + planeY;
    const posZ = 0.5 * h;

    // floor + ceiling
    for (let y = 0; y < h; y++) {
      const p = y - horizon;
      const rowStart = y * w * 4;
      if (p === 0) {
        for (let x = 0; x < w; x++) {
          const idx = rowStart + x * 4;
          px[idx] = fog[0];
          px[idx + 1] = fog[1];
          px[idx + 2] = fog[2];
          px[idx + 3] = 255;
        }
        continue;
      }
      const isFloor = p > 0;
      const rowDist = posZ / Math.abs(p);
      if (rowDist > 48) {
        for (let x = 0; x < w; x++) {
          const idx = rowStart + x * 4;
          px[idx] = fog[0];
          px[idx + 1] = fog[1];
          px[idx + 2] = fog[2];
          px[idx + 3] = 255;
        }
        continue;
      }
      const tex = isFloor ? world.textures.floor : world.textures.ceil;
      const tsize = tex.size;
      const data = tex.data;
      const stepX = (rowDist * (rayX1 - rayX0)) / w;
      const stepY = (rowDist * (rayY1 - rayY0)) / w;
      let wx = player.x + rowDist * rayX0;
      let wy = player.y + rowDist * rayY0;
      const fogMix = Math.pow(clamp(rowDist / world.fogDist, 0, 1), 1.15) * (isFloor ? 1 : 0.92);
      const inv = 1 / (1 + rowDist * 0.8);
      const baseLight = ambient * 0.55 + flashPower * 0.24 * inv;
      const coneLight = flashPower * 1.2 * inv;
      const fr = fog[0] * fogMix;
      const fg = fog[1] * fogMix;
      const fb = fog[2] * fogMix;
      const keep = 1 - fogMix;

      for (let x = 0; x < w; x++) {
        const tx = ((wx - Math.floor(wx)) * tsize) | 0;
        const ty = ((wy - Math.floor(wy)) * tsize) | 0;
        const ti = (ty * tsize + tx) * 4;
        const cxn = Math.abs((x / w) * 2 - 1);
        let cone = cxn > 0.96 ? 0 : 1 - cxn / 0.96;
        cone = cone * cone * (3 - 2 * cone);
        const light = baseLight + coneLight * cone;
        const idx = rowStart + x * 4;
        px[idx] = data[ti] * light * keep + fr;
        px[idx + 1] = data[ti + 1] * light * keep + fg;
        px[idx + 2] = data[ti + 2] * light * keep + fb;
        px[idx + 3] = 255;
        wx += stepX;
        wy += stepY;
      }
    }

    // walls
    const zbuf = this.zbuf;
    const wallTex = world.textures.wall;
    const wallTexB = world.textures.wallB;

    for (let x = 0; x < w; x++) {
      const cameraX = (2 * x) / w - 1;
      const rdx = dirX + planeX * cameraX;
      const rdy = dirY + planeY * cameraX;

      let mapX = Math.floor(player.x);
      let mapY = Math.floor(player.y);
      const deltaX = rdx === 0 ? 1e30 : Math.abs(1 / rdx);
      const deltaY = rdy === 0 ? 1e30 : Math.abs(1 / rdy);
      let stepX;
      let stepY;
      let sideDistX;
      let sideDistY;

      if (rdx < 0) {
        stepX = -1;
        sideDistX = (player.x - mapX) * deltaX;
      } else {
        stepX = 1;
        sideDistX = (mapX + 1 - player.x) * deltaX;
      }
      if (rdy < 0) {
        stepY = -1;
        sideDistY = (player.y - mapY) * deltaY;
      } else {
        stepY = 1;
        sideDistY = (mapY + 1 - player.y) * deltaY;
      }

      let side = 0;
      let hit = false;
      for (let i = 0; i < 160; i++) {
        if (sideDistX < sideDistY) {
          sideDistX += deltaX;
          mapX += stepX;
          side = 0;
        } else {
          sideDistY += deltaY;
          mapY += stepY;
          side = 1;
        }
        if (world.isWall(mapX, mapY)) {
          hit = true;
          break;
        }
      }

      if (!hit) {
        zbuf[x] = Infinity;
        continue;
      }

      const perp = side === 0 ? sideDistX - deltaX : sideDistY - deltaY;
      const dist = Math.max(0.0001, perp);
      zbuf[x] = dist;

      const lineH = h / dist;
      const drawStart = Math.floor(horizon - lineH / 2);
      const drawEnd = Math.floor(horizon + lineH / 2);
      const y0 = Math.max(0, drawStart);
      const y1 = Math.min(h, drawEnd);
      if (y1 <= y0) continue;

      let wallX = side === 0 ? player.y + dist * rdy : player.x + dist * rdx;
      wallX -= Math.floor(wallX);
      let texX = Math.floor(wallX * wallTex.size);
      if ((side === 0 && rdx > 0) || (side === 1 && rdy < 0)) {
        texX = wallTex.size - texX - 1;
      }
      if (texX < 0) texX = 0;
      else if (texX >= wallTex.size) texX = wallTex.size - 1;

      const useB = (mapX * 5 + mapY * 3) % 11 === 0;
      const tex = useB ? wallTexB : wallTex;
      const tsize = tex.size;
      const data = tex.data;
      const texStep = tsize / lineH;
      let texPos = (y0 - horizon + lineH / 2) * texStep;

      const cxn = Math.abs(cameraX);
      let cone = cxn > 0.96 ? 0 : 1 - cxn / 0.96;
      cone = cone * cone * (3 - 2 * cone);

      const sideFactor = side === 1 ? 0.84 : 1;
      const light =
        (ambient * 0.56 + flashPower * (0.24 + 1.4 * cone) / (1 + dist * 0.85)) * sideFactor;
      const fogMix = Math.pow(clamp(dist / world.fogDist, 0, 1), 1.15);
      const keep = 1 - fogMix;
      const fr = fog[0] * fogMix;
      const fg = fog[1] * fogMix;
      const fb = fog[2] * fogMix;

      let idx = (y0 * w + x) * 4;
      for (let y = y0; y < y1; y++) {
        let ty = texPos | 0;
        texPos += texStep;
        if (ty < 0) ty = 0;
        else if (ty >= tsize) ty = tsize - 1;
        const ti = (ty * tsize + texX) * 4;
        px[idx] = data[ti] * light * keep + fr;
        px[idx + 1] = data[ti + 1] * light * keep + fg;
        px[idx + 2] = data[ti + 2] * light * keep + fb;
        idx += w * 4;
      }
    }

    // billboards
    const order = sprites
      .map((s) => {
        const sx = s.x - player.x;
        const sy = s.y - player.y;
        const invDet = 1 / (planeX * dirY - dirX * planeY);
        return {
          s,
          tx: invDet * (dirY * sx - dirX * sy),
          ty: invDet * (-planeY * sx + planeX * sy),
        };
      })
      .filter((o) => o.ty > 0.12)
      .sort((a, b) => b.ty - a.ty);

    for (const { s, tx, ty } of order) {
      const tex = s.tex;
      if (!tex) continue;
      const screenX = (w / 2) * (1 + tx / ty);
      const lineH = h / ty;
      const bottom = horizon + lineH * 0.5;
      const spriteH = lineH * s.height;
      const spriteW = spriteH * (tex.w / tex.h);
      const x0 = Math.floor(screenX - spriteW / 2);
      const x1 = Math.ceil(screenX + spriteW / 2);
      if (x1 < 0 || x0 >= w) continue;
      const y0 = Math.floor(bottom - spriteH);
      const y1 = Math.ceil(bottom);
      if (y1 <= 0 || y0 >= h) continue;

      const cxn = Math.abs((screenX / w) * 2 - 1);
      let cone = cxn > 1 ? 0 : 1 - cxn / 0.96;
      cone = Math.max(0, Math.min(1, cone));
      let light = ambient * 0.5 + (flashPower * (0.3 + 1.55 * cone)) / (1 + ty * 0.62);
      if (s.emissive) light = Math.max(light, s.pulse ? 0.55 + 0.2 * Math.sin(time * 2.6) : 0.5);
      if (s.entity) light *= 0.92;
      const fogMix = Math.pow(clamp(ty / world.fogDist, 0, 1), 1.2) * 0.94;
      const keep = 1 - fogMix;
      const fr = fog[0] * fogMix;
      const fg = fog[1] * fogMix;
      const fb = fog[2] * fogMix;

      const cxStart = Math.max(0, x0);
      const cxEnd = Math.min(w, x1);
      const cyStart = Math.max(0, y0);
      const cyEnd = Math.min(h, y1);

      for (let x = cxStart; x < cxEnd; x++) {
        if (ty >= zbuf[x]) continue;
        const u = Math.min(tex.w - 1, Math.max(0, (((x - x0) / (x1 - x0)) * tex.w) | 0));
        for (let y = cyStart; y < cyEnd; y++) {
          const v = Math.min(tex.h - 1, Math.max(0, (((y - y0) / (y1 - y0)) * tex.h) | 0));
          const si = (v * tex.w + u) * 4;
          const a = (tex.data[si + 3] / 255) * (s.alpha || 1);
          if (a <= 0.02) continue;
          const di = (y * w + x) * 4;
          const r = tex.data[si] * light * keep + fr;
          const g = tex.data[si + 1] * light * keep + fg;
          const b = tex.data[si + 2] * light * keep + fb;
          if (a >= 0.985) {
            px[di] = r;
            px[di + 1] = g;
            px[di + 2] = b;
          } else {
            px[di] = px[di] * (1 - a) + r * a;
            px[di + 1] = px[di + 1] * (1 - a) + g * a;
            px[di + 2] = px[di + 2] * (1 - a) + b * a;
          }
        }
      }
    }

    this.ctx.putImageData(this.img, 0, 0);
  }
}
