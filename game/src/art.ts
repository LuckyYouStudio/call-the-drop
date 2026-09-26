// All artwork is drawn here in code: item icons, boss portraits and class emblems.
// Each picture is rendered once to an offscreen canvas and cached as a data URL.
import type { Archetype, Boss, Item } from './world';

type Ctx = CanvasRenderingContext2D;

function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const hsl = (h: number, s: number, l: number, a = 1) => `hsla(${h}, ${s}%, ${l}%, ${a})`;

function lin(ctx: Ctx, x0: number, y0: number, x1: number, y1: number, stops: Array<[number, string]>): CanvasGradient {
  const g = ctx.createLinearGradient(x0, y0, x1, y1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function rad(ctx: Ctx, x: number, y: number, r0: number, r1: number, stops: Array<[number, string]>): CanvasGradient {
  const g = ctx.createRadialGradient(x, y, r0, x, y, r1);
  for (const [o, c] of stops) g.addColorStop(o, c);
  return g;
}

function offscreen(size: number, draw: (ctx: Ctx) => void): string {
  const c = document.createElement('canvas');
  c.width = c.height = size;
  const ctx = c.getContext('2d')!;
  draw(ctx);
  return c.toDataURL('image/png');
}

// ------------------------------------------------------------------ materials

type Pal = { hi: string; mid: string; lo: string; line: string; accent: string; glow: string };

function steel(accentHue: number): Pal {
  return { hi: '#eef2f6', mid: '#8e99a6', lo: '#3a424d', line: '#15191e', accent: hsl(accentHue, 70, 55), glow: hsl(accentHue, 90, 65) };
}

function material(item: Item): Pal {
  const h = item.hue;
  if (item.armor === 'plate') return { hi: '#f3f5f7', mid: '#a4adb8', lo: '#454d58', line: '#14181d', accent: item.quality >= 4 ? '#e7c15a' : hsl(h, 55, 45), glow: hsl(h, 90, 65) };
  if (item.armor === 'mail') return { hi: '#d9dee4', mid: '#7a8591', lo: '#323941', line: '#121518', accent: hsl(h, 50, 45), glow: hsl(h, 90, 65) };
  if (item.armor === 'leather') return { hi: '#d6a36f', mid: '#8a5a32', lo: '#3e2511', line: '#1d1007', accent: hsl(h, 45, 40), glow: hsl(h, 90, 65) };
  if (item.armor === 'cloth') return { hi: hsl(h, 55, 72), mid: hsl(h, 45, 45), lo: hsl(h, 50, 20), line: hsl(h, 40, 8), accent: '#e8c96a', glow: hsl(h, 90, 70) };
  return steel(h);
}

const GOLD: Pal = { hi: '#fff1b8', mid: '#d9a93a', lo: '#6b4410', line: '#2b1a04', accent: '#fff', glow: '#ffd76a' };

function fillStroke(ctx: Ctx, fill: string | CanvasGradient, line: string, w: number): void {
  ctx.fillStyle = fill;
  ctx.fill();
  ctx.strokeStyle = line;
  ctx.lineWidth = w;
  ctx.lineJoin = 'round';
  ctx.stroke();
}

function gem(ctx: Ctx, x: number, y: number, r: number, hue: number): void {
  ctx.beginPath();
  ctx.arc(x, y, r, 0, Math.PI * 2);
  fillStroke(ctx, rad(ctx, x - r * 0.35, y - r * 0.35, r * 0.1, r * 1.1, [[0, hsl(hue, 100, 88)], [0.45, hsl(hue, 85, 55)], [1, hsl(hue, 80, 22)]]), 'rgba(0,0,0,0.7)', Math.max(1, r * 0.25));
  ctx.beginPath();
  ctx.arc(x - r * 0.35, y - r * 0.35, r * 0.28, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(255,255,255,0.8)';
  ctx.fill();
}

// ------------------------------------------------------------------ item shapes (drawn on a 64-unit square)

function blade(ctx: Ctx, len: number, width: number, p: Pal): void {
  // Straight blade along -y from the origin.
  ctx.beginPath();
  ctx.moveTo(-width / 2, 0);
  ctx.lineTo(-width / 2, -len + width);
  ctx.lineTo(0, -len);
  ctx.lineTo(width / 2, -len + width);
  ctx.lineTo(width / 2, 0);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, -width / 2, 0, width / 2, 0, [[0, p.lo], [0.45, p.hi], [0.55, p.mid], [1, p.lo]]), p.line, 1.6);
  ctx.beginPath();
  ctx.moveTo(0, -2);
  ctx.lineTo(0, -len + width);
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 1;
  ctx.stroke();
}

function grip(ctx: Ctx, len: number, w: number, hue: number): void {
  ctx.beginPath();
  ctx.rect(-w / 2, 0, w, len);
  fillStroke(ctx, lin(ctx, -w / 2, 0, w / 2, 0, [[0, '#2a170a'], [0.5, '#8a5a32'], [1, '#2a170a']]), '#140a03', 1.2);
  ctx.strokeStyle = hsl(hue, 30, 20);
  ctx.lineWidth = 1;
  for (let y = 2; y < len; y += 3) {
    ctx.beginPath();
    ctx.moveTo(-w / 2, y);
    ctx.lineTo(w / 2, y + 1.5);
    ctx.stroke();
  }
}

function sword(ctx: Ctx, item: Item, two: boolean): void {
  const p = steel(item.hue);
  ctx.translate(32, 34);
  ctx.rotate(Math.PI / 4);
  blade(ctx, two ? 40 : 32, two ? 9 : 7, p);
  ctx.beginPath();
  ctx.roundRect(-11, -1, 22, 5, 2);
  fillStroke(ctx, lin(ctx, 0, -1, 0, 4, [[0, GOLD.hi], [1, GOLD.lo]]), GOLD.line, 1.2);
  grip(ctx, two ? 14 : 11, 4, item.hue);
  gem(ctx, 0, (two ? 14 : 11) + 3, 3.2, item.hue);
}

function dagger(ctx: Ctx, item: Item): void {
  const p = steel(item.hue);
  ctx.translate(30, 36);
  ctx.rotate(Math.PI / 4);
  ctx.beginPath();
  ctx.moveTo(-5, 0);
  ctx.quadraticCurveTo(-6, -14, 0, -26);
  ctx.quadraticCurveTo(4, -14, 5, 0);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, -5, 0, 5, 0, [[0, p.lo], [0.5, p.hi], [1, p.lo]]), p.line, 1.5);
  ctx.beginPath();
  ctx.moveTo(-9, 0);
  ctx.quadraticCurveTo(0, 5, 9, 0);
  ctx.quadraticCurveTo(0, 2, -9, 0);
  fillStroke(ctx, GOLD.mid, GOLD.line, 1.2);
  grip(ctx, 9, 4, item.hue);
  gem(ctx, 0, 12, 2.8, item.hue);
}

function haft(ctx: Ctx, len: number, w = 4): void {
  ctx.beginPath();
  ctx.roundRect(-w / 2, -len / 2, w, len, 2);
  fillStroke(ctx, lin(ctx, -w / 2, 0, w / 2, 0, [[0, '#3a2210'], [0.5, '#a0703f'], [1, '#3a2210']]), '#160b03', 1.2);
}

function axe(ctx: Ctx, item: Item, two: boolean): void {
  const p = steel(item.hue);
  ctx.translate(32, 32);
  ctx.rotate(Math.PI / 4);
  haft(ctx, two ? 52 : 44);
  const top = two ? -20 : -17;
  const reach = two ? 20 : 15;
  for (const side of two ? [1, -1] : [1]) {
    ctx.beginPath();
    ctx.moveTo(0, top - 6);
    ctx.quadraticCurveTo(side * reach * 0.5, top - 9, side * reach, top - 12);
    ctx.quadraticCurveTo(side * (reach + 4), top + 1, side * reach, top + 12);
    ctx.quadraticCurveTo(side * reach * 0.5, top + 7, 0, top + 6);
    ctx.closePath();
    fillStroke(ctx, lin(ctx, 0, 0, side * reach, 0, [[0, p.lo], [0.7, p.hi], [1, p.mid]]), p.line, 1.5);
  }
  gem(ctx, 0, top, 2.6, item.hue);
}

function mace(ctx: Ctx, item: Item, two: boolean): void {
  const p = steel(item.hue);
  ctx.translate(32, 32);
  ctx.rotate(Math.PI / 4);
  haft(ctx, two ? 50 : 42);
  const y = two ? -18 : -15;
  const r = two ? 11 : 9;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    ctx.beginPath();
    ctx.moveTo(Math.cos(a) * r * 0.6, y + Math.sin(a) * r * 0.6);
    ctx.lineTo(Math.cos(a + 0.3) * r * 1.35, y + Math.sin(a + 0.3) * r * 1.35);
    ctx.lineTo(Math.cos(a + 0.6) * r * 0.6, y + Math.sin(a + 0.6) * r * 0.6);
    fillStroke(ctx, p.mid, p.line, 1.2);
  }
  ctx.beginPath();
  ctx.arc(0, y, r, 0, Math.PI * 2);
  fillStroke(ctx, rad(ctx, -r * 0.3, y - r * 0.3, 1, r * 1.2, [[0, p.hi], [0.6, p.mid], [1, p.lo]]), p.line, 1.5);
  gem(ctx, 0, y, 3, item.hue);
}

function staff(ctx: Ctx, item: Item): void {
  ctx.translate(32, 32);
  ctx.rotate(Math.PI / 5);
  ctx.beginPath();
  ctx.moveTo(-2, 28);
  ctx.bezierCurveTo(-4, 10, 3, -6, -1, -18);
  ctx.lineTo(3, -18);
  ctx.bezierCurveTo(7, -6, 0, 10, 2, 28);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, -3, 0, 4, 0, [[0, '#2e1a0b'], [0.5, '#9a6a3a'], [1, '#2e1a0b']]), '#120801', 1.2);
  // claw holding a crystal
  ctx.strokeStyle = '#2b1a0a';
  ctx.lineWidth = 2.5;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(1, -17);
    ctx.quadraticCurveTo(s * 9, -22, s * 5, -30);
    ctx.stroke();
  }
  ctx.save();
  ctx.shadowColor = hsl(item.hue, 100, 65);
  ctx.shadowBlur = 12;
  ctx.beginPath();
  ctx.moveTo(1, -35);
  ctx.lineTo(6, -26);
  ctx.lineTo(1, -18);
  ctx.lineTo(-4, -26);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, -4, -35, 6, -18, [[0, hsl(item.hue, 100, 90)], [0.5, hsl(item.hue, 90, 60)], [1, hsl(item.hue, 80, 30)]]), 'rgba(0,0,0,0.6)', 1);
  ctx.restore();
}

function wand(ctx: Ctx, item: Item): void {
  ctx.translate(32, 32);
  ctx.rotate(Math.PI / 4);
  ctx.beginPath();
  ctx.moveTo(-2, 22);
  ctx.lineTo(-1.5, -12);
  ctx.lineTo(1.5, -12);
  ctx.lineTo(2, 22);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, -2, 0, 2, 0, [[0, '#1d1d2a'], [0.5, '#e8e0ff'], [1, '#1d1d2a']]), '#0a0a10', 1);
  for (let y = 16; y > -8; y -= 7) {
    ctx.beginPath();
    ctx.rect(-2.8, y, 5.6, 2);
    ctx.fillStyle = GOLD.mid;
    ctx.fill();
  }
  ctx.save();
  ctx.shadowColor = hsl(item.hue, 100, 70);
  ctx.shadowBlur = 14;
  gem(ctx, 0, -16, 5, item.hue);
  ctx.restore();
  ctx.fillStyle = 'rgba(255,255,255,0.9)';
  for (const [x, y, s] of [[8, -22, 1.6], [-7, -24, 1.2], [5, -10, 1]]) {
    ctx.beginPath();
    ctx.moveTo(x, y - s * 2);
    ctx.lineTo(x + s * 0.6, y);
    ctx.lineTo(x, y + s * 2);
    ctx.lineTo(x - s * 0.6, y);
    ctx.fill();
  }
}

function bow(ctx: Ctx, item: Item): void {
  ctx.translate(32, 32);
  ctx.rotate(-Math.PI / 4);
  ctx.beginPath();
  ctx.moveTo(-3, -27);
  ctx.bezierCurveTo(16, -18, 16, 18, -3, 27);
  ctx.bezierCurveTo(12, 16, 12, -16, -3, -27);
  fillStroke(ctx, lin(ctx, 0, -27, 14, 0, [[0, '#4a2c14'], [0.5, '#c28a52'], [1, '#4a2c14']]), '#1b0e04', 1.5);
  ctx.beginPath();
  ctx.moveTo(-3, -27);
  ctx.lineTo(-3, 27);
  ctx.strokeStyle = '#e9e2cf';
  ctx.lineWidth = 1;
  ctx.stroke();
  ctx.beginPath();
  ctx.roundRect(8, -5, 5, 10, 2);
  fillStroke(ctx, hsl(item.hue, 40, 30), '#120801', 1);
  // arrow
  ctx.strokeStyle = '#6b4a2a';
  ctx.lineWidth = 1.6;
  ctx.beginPath();
  ctx.moveTo(-3, 0);
  ctx.lineTo(20, 0);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(24, 0);
  ctx.lineTo(19, -3);
  ctx.lineTo(19, 3);
  ctx.closePath();
  fillStroke(ctx, '#d6dde5', '#222', 0.8);
  ctx.fillStyle = hsl(item.hue, 70, 55);
  ctx.beginPath();
  ctx.moveTo(-2, 0);
  ctx.lineTo(-7, -4);
  ctx.lineTo(-4, 0);
  ctx.lineTo(-7, 4);
  ctx.closePath();
  ctx.fill();
}

function shield(ctx: Ctx, item: Item): void {
  const p = item.stats.int ? { ...steel(item.hue), mid: hsl(item.hue, 40, 45), lo: hsl(item.hue, 45, 18) } : steel(item.hue);
  ctx.translate(32, 32);
  ctx.beginPath();
  ctx.moveTo(-20, -22);
  ctx.lineTo(20, -22);
  ctx.bezierCurveTo(20, 2, 14, 16, 0, 26);
  ctx.bezierCurveTo(-14, 16, -20, 2, -20, -22);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, -20, -22, 20, 20, [[0, p.hi], [0.4, p.mid], [1, p.lo]]), p.line, 2);
  ctx.save();
  ctx.clip();
  ctx.fillStyle = hsl(item.hue, 55, 38, 0.85);
  ctx.fillRect(-3, -22, 6, 50);
  ctx.fillRect(-20, -6, 40, 6);
  ctx.restore();
  ctx.beginPath();
  ctx.moveTo(-17, -19);
  ctx.lineTo(17, -19);
  ctx.bezierCurveTo(17, 1, 12, 13, 0, 22);
  ctx.bezierCurveTo(-12, 13, -17, 1, -17, -19);
  ctx.strokeStyle = GOLD.mid;
  ctx.lineWidth = 1.6;
  ctx.stroke();
  gem(ctx, 0, -3, 4.5, item.hue);
}

function orb(ctx: Ctx, item: Item, tome: boolean): void {
  ctx.translate(32, 32);
  if (tome) {
    ctx.beginPath();
    ctx.roundRect(-17, -21, 34, 42, 3);
    fillStroke(ctx, lin(ctx, -17, 0, 17, 0, [[0, hsl(item.hue, 50, 18)], [0.5, hsl(item.hue, 50, 38)], [1, hsl(item.hue, 50, 18)]]), '#0b0604', 1.8);
    ctx.fillStyle = '#e8dcc0';
    ctx.fillRect(13, -19, 3, 38);
    ctx.strokeStyle = GOLD.mid;
    ctx.lineWidth = 1.5;
    ctx.strokeRect(-13, -17, 24, 34);
    ctx.save();
    ctx.shadowColor = hsl(item.hue, 100, 70);
    ctx.shadowBlur = 10;
    ctx.beginPath();
    for (let i = 0; i < 5; i++) {
      const a = -Math.PI / 2 + (i * 4 * Math.PI) / 5;
      ctx[i ? 'lineTo' : 'moveTo'](-1 + Math.cos(a) * 9, Math.sin(a) * 9);
    }
    ctx.closePath();
    ctx.strokeStyle = hsl(item.hue, 100, 75);
    ctx.lineWidth = 1.6;
    ctx.stroke();
    ctx.restore();
    return;
  }
  ctx.save();
  ctx.shadowColor = hsl(item.hue, 100, 60);
  ctx.shadowBlur = 16;
  ctx.beginPath();
  ctx.arc(0, -3, 17, 0, Math.PI * 2);
  ctx.fillStyle = rad(ctx, -6, -9, 2, 20, [[0, hsl(item.hue, 100, 92)], [0.4, hsl(item.hue, 85, 55)], [1, hsl(item.hue, 80, 15)]]);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = hsl(item.hue, 100, 85, 0.6);
  ctx.lineWidth = 1.2;
  ctx.beginPath();
  ctx.arc(0, -3, 10, 0.5, 2.8);
  ctx.stroke();
  ctx.beginPath();
  ctx.arc(2, -5, 5, 3.5, 5.8);
  ctx.stroke();
  // claw stand
  ctx.beginPath();
  ctx.moveTo(-14, 10);
  ctx.quadraticCurveTo(-8, 22, 0, 24);
  ctx.quadraticCurveTo(8, 22, 14, 10);
  ctx.lineTo(8, 14);
  ctx.quadraticCurveTo(0, 18, -8, 14);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, 0, 10, 0, 24, [[0, GOLD.hi], [1, GOLD.lo]]), GOLD.line, 1.2);
}

function helm(ctx: Ctx, item: Item): void {
  const p = material(item);
  ctx.translate(32, 34);
  if (item.armor === 'cloth' || item.armor === 'leather') {
    // hood
    ctx.beginPath();
    ctx.moveTo(0, -26);
    ctx.bezierCurveTo(20, -24, 24, 2, 20, 22);
    ctx.lineTo(-20, 22);
    ctx.bezierCurveTo(-24, 2, -20, -24, 0, -26);
    ctx.closePath();
    fillStroke(ctx, lin(ctx, -20, -20, 20, 20, [[0, p.hi], [0.45, p.mid], [1, p.lo]]), p.line, 1.8);
    ctx.beginPath();
    ctx.ellipse(0, 2, 11, 14, 0, 0, Math.PI * 2);
    ctx.fillStyle = '#07050a';
    ctx.fill();
    ctx.fillStyle = p.glow;
    for (const x of [-4.5, 4.5]) {
      ctx.beginPath();
      ctx.ellipse(x, 0, 2.2, 1.3, 0, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-18, 18);
    ctx.bezierCurveTo(-13, 12, 13, 12, 18, 18);
    ctx.stroke();
    return;
  }
  // great helm / coif
  ctx.beginPath();
  ctx.moveTo(-18, 18);
  ctx.lineTo(-19, -6);
  ctx.bezierCurveTo(-18, -24, 18, -24, 19, -6);
  ctx.lineTo(18, 18);
  ctx.quadraticCurveTo(0, 24, -18, 18);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, -19, 0, 19, 0, [[0, p.lo], [0.35, p.hi], [0.6, p.mid], [1, p.lo]]), p.line, 1.8);
  if (item.armor === 'mail') {
    ctx.save();
    ctx.clip();
    ctx.strokeStyle = 'rgba(0,0,0,0.35)';
    ctx.lineWidth = 0.8;
    for (let y = -20; y < 22; y += 3) for (let x = -20; x < 20; x += 3) {
      ctx.beginPath();
      ctx.arc(x + (y % 6 ? 1.5 : 0), y, 1.3, 0, Math.PI * 2);
      ctx.stroke();
    }
    ctx.restore();
  }
  ctx.fillStyle = '#060607';
  ctx.fillRect(-14, -3, 28, 4);
  ctx.fillRect(-2, -3, 4, 16);
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(0, -21);
  ctx.lineTo(0, -8);
  ctx.stroke();
  if (item.quality >= 4) {
    // horns
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(s * 16, -12);
      ctx.bezierCurveTo(s * 26, -16, s * 28, -26, s * 24, -30);
      ctx.bezierCurveTo(s * 24, -24, s * 20, -18, s * 13, -16);
      ctx.closePath();
      fillStroke(ctx, lin(ctx, 0, -30, 0, -12, [[0, '#f4ead2'], [1, '#8b7d62']]), '#2a2418', 1.2);
    }
  }
}

function shoulders(ctx: Ctx, item: Item): void {
  const p = material(item);
  ctx.translate(32, 34);
  for (const s of [-1, 1]) {
    ctx.save();
    ctx.translate(s * 13, 0);
    ctx.scale(s, 1);
    ctx.beginPath();
    ctx.moveTo(-10, 10);
    ctx.bezierCurveTo(-12, -12, 4, -18, 14, -8);
    ctx.bezierCurveTo(16, 2, 12, 10, 8, 14);
    ctx.quadraticCurveTo(-2, 16, -10, 10);
    ctx.closePath();
    fillStroke(ctx, rad(ctx, -2, -8, 2, 22, [[0, p.hi], [0.5, p.mid], [1, p.lo]]), p.line, 1.6);
    ctx.strokeStyle = p.accent;
    ctx.lineWidth = 1.6;
    ctx.beginPath();
    ctx.moveTo(-8, 6);
    ctx.bezierCurveTo(-8, -8, 4, -12, 12, -5);
    ctx.stroke();
    if (item.quality >= 4 && item.armor !== 'cloth') {
      ctx.beginPath();
      ctx.moveTo(0, -12);
      ctx.lineTo(4, -24);
      ctx.lineTo(7, -11);
      fillStroke(ctx, p.hi, p.line, 1);
    }
    ctx.restore();
  }
}

function chest(ctx: Ctx, item: Item): void {
  const p = material(item);
  ctx.translate(32, 32);
  const robe = item.armor === 'cloth';
  ctx.beginPath();
  ctx.moveTo(-10, -24);
  ctx.lineTo(-22, -18);
  ctx.lineTo(-20, -2);
  ctx.lineTo(-15, 0);
  ctx.lineTo(robe ? -20 : -15, robe ? 26 : 20);
  ctx.lineTo(robe ? 20 : 15, robe ? 26 : 20);
  ctx.lineTo(15, 0);
  ctx.lineTo(20, -2);
  ctx.lineTo(22, -18);
  ctx.lineTo(10, -24);
  ctx.quadraticCurveTo(0, -16, -10, -24);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, -20, -20, 20, 22, [[0, p.hi], [0.45, p.mid], [1, p.lo]]), p.line, 1.8);
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(0, -18);
  ctx.lineTo(0, robe ? 26 : 20);
  ctx.stroke();
  ctx.beginPath();
  ctx.moveTo(-15, 4);
  ctx.lineTo(15, 4);
  ctx.stroke();
  if (item.armor === 'plate') {
    ctx.strokeStyle = 'rgba(255,255,255,0.35)';
    ctx.lineWidth = 1;
    ctx.beginPath();
    ctx.arc(-6, -8, 7, Math.PI * 0.9, Math.PI * 1.7);
    ctx.stroke();
  }
  if (item.quality >= 3) gem(ctx, 0, -8, 3.5, item.hue);
}

function hands(ctx: Ctx, item: Item): void {
  const p = material(item);
  ctx.translate(32, 34);
  ctx.beginPath();
  ctx.moveTo(-11, 22);
  ctx.lineTo(-13, 2);
  ctx.lineTo(-19, -6);
  ctx.quadraticCurveTo(-18, -11, -13, -8);
  ctx.lineTo(-10, -4);
  ctx.lineTo(-10, -20);
  ctx.quadraticCurveTo(-7, -24, -4, -20);
  ctx.lineTo(-3, -9);
  ctx.lineTo(-2, -24);
  ctx.quadraticCurveTo(1, -27, 4, -23);
  ctx.lineTo(4, -9);
  ctx.lineTo(7, -21);
  ctx.quadraticCurveTo(10, -23, 12, -19);
  ctx.lineTo(11, -6);
  ctx.lineTo(14, -14);
  ctx.quadraticCurveTo(17, -15, 17, -11);
  ctx.lineTo(13, 4);
  ctx.lineTo(12, 22);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, -18, -20, 16, 20, [[0, p.hi], [0.5, p.mid], [1, p.lo]]), p.line, 1.6);
  ctx.beginPath();
  ctx.rect(-12, 10, 25, 7);
  fillStroke(ctx, p.accent, p.line, 1.2);
}

function feet(ctx: Ctx, item: Item): void {
  const p = material(item);
  ctx.translate(30, 32);
  ctx.beginPath();
  ctx.moveTo(-10, -24);
  ctx.lineTo(6, -24);
  ctx.lineTo(7, 6);
  ctx.quadraticCurveTo(22, 8, 24, 18);
  ctx.lineTo(24, 22);
  ctx.lineTo(-12, 22);
  ctx.lineTo(-11, 4);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, -12, -24, 20, 22, [[0, p.hi], [0.5, p.mid], [1, p.lo]]), p.line, 1.6);
  ctx.beginPath();
  ctx.rect(-12, -24, 20, 6);
  fillStroke(ctx, p.accent, p.line, 1.2);
  ctx.fillStyle = 'rgba(0,0,0,0.5)';
  ctx.fillRect(-12, 19, 36, 3);
}

function waist(ctx: Ctx, item: Item): void {
  const p = material(item);
  ctx.translate(32, 32);
  ctx.beginPath();
  ctx.moveTo(-27, -6);
  ctx.quadraticCurveTo(0, -12, 27, -6);
  ctx.lineTo(27, 6);
  ctx.quadraticCurveTo(0, 0, -27, 6);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, 0, -10, 0, 6, [[0, p.hi], [0.5, p.mid], [1, p.lo]]), p.line, 1.6);
  ctx.beginPath();
  ctx.roundRect(-9, -11, 18, 16, 3);
  fillStroke(ctx, lin(ctx, 0, -11, 0, 5, [[0, GOLD.hi], [1, GOLD.lo]]), GOLD.line, 1.5);
  gem(ctx, 0, -3, 4, item.hue);
  ctx.beginPath();
  ctx.moveTo(14, 4);
  ctx.lineTo(12, 20);
  ctx.lineTo(18, 16);
  ctx.lineTo(19, 3);
  fillStroke(ctx, p.mid, p.line, 1);
}

function legs(ctx: Ctx, item: Item): void {
  const p = material(item);
  ctx.translate(32, 32);
  ctx.beginPath();
  ctx.moveTo(-15, -24);
  ctx.lineTo(15, -24);
  ctx.lineTo(17, 24);
  ctx.lineTo(4, 24);
  ctx.lineTo(0, -4);
  ctx.lineTo(-4, 24);
  ctx.lineTo(-17, 24);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, -17, -24, 17, 24, [[0, p.hi], [0.5, p.mid], [1, p.lo]]), p.line, 1.6);
  ctx.beginPath();
  ctx.rect(-15, -24, 30, 6);
  fillStroke(ctx, p.accent, p.line, 1.2);
  if (item.armor === 'plate' || item.armor === 'mail') {
    ctx.fillStyle = 'rgba(255,255,255,0.35)';
    for (const x of [-11, 10]) {
      ctx.beginPath();
      ctx.ellipse(x, 6, 4, 5, 0, 0, Math.PI * 2);
      ctx.fill();
    }
  }
}

function wrist(ctx: Ctx, item: Item): void {
  const p = material(item);
  ctx.translate(32, 32);
  ctx.rotate(-0.4);
  ctx.beginPath();
  ctx.moveTo(-12, -20);
  ctx.lineTo(12, -20);
  ctx.lineTo(15, 20);
  ctx.lineTo(-15, 20);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, -15, 0, 15, 0, [[0, p.lo], [0.4, p.hi], [1, p.lo]]), p.line, 1.6);
  ctx.strokeStyle = p.accent;
  ctx.lineWidth = 3;
  for (const y of [-14, 14]) {
    ctx.beginPath();
    ctx.moveTo(-13, y);
    ctx.lineTo(13, y);
    ctx.stroke();
  }
  if (item.quality >= 3) gem(ctx, 0, 0, 4, item.hue);
}

function cloak(ctx: Ctx, item: Item): void {
  const p = { ...material(item), hi: hsl(item.hue, 55, 62), mid: hsl(item.hue, 50, 38), lo: hsl(item.hue, 55, 14) };
  ctx.translate(32, 32);
  ctx.beginPath();
  ctx.moveTo(-9, -24);
  ctx.quadraticCurveTo(0, -20, 9, -24);
  ctx.bezierCurveTo(16, -8, 22, 10, 25, 26);
  ctx.quadraticCurveTo(12, 20, 6, 26);
  ctx.quadraticCurveTo(0, 20, -6, 26);
  ctx.quadraticCurveTo(-12, 20, -25, 26);
  ctx.bezierCurveTo(-22, 10, -16, -8, -9, -24);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, -20, -24, 20, 26, [[0, p.hi], [0.5, p.mid], [1, p.lo]]), p.line, 1.6);
  ctx.strokeStyle = 'rgba(0,0,0,0.3)';
  ctx.lineWidth = 1.2;
  for (const x of [-8, 0, 8]) {
    ctx.beginPath();
    ctx.moveTo(x * 0.5, -18);
    ctx.quadraticCurveTo(x * 1.2, 4, x * 1.6, 22);
    ctx.stroke();
  }
  ctx.beginPath();
  ctx.arc(0, -21, 4, 0, Math.PI * 2);
  fillStroke(ctx, GOLD.mid, GOLD.line, 1.2);
}

function neck(ctx: Ctx, item: Item): void {
  ctx.translate(32, 30);
  ctx.strokeStyle = GOLD.mid;
  ctx.lineWidth = 2;
  ctx.setLineDash([2.5, 1.5]);
  ctx.beginPath();
  ctx.moveTo(-18, -22);
  ctx.quadraticCurveTo(-20, 4, 0, 8);
  ctx.quadraticCurveTo(20, 4, 18, -22);
  ctx.stroke();
  ctx.setLineDash([]);
  ctx.beginPath();
  ctx.moveTo(0, 4);
  ctx.lineTo(10, 14);
  ctx.lineTo(0, 28);
  ctx.lineTo(-10, 14);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, 0, 4, 0, 28, [[0, GOLD.hi], [1, GOLD.lo]]), GOLD.line, 1.5);
  gem(ctx, 0, 15, 5, item.hue);
}

function ring(ctx: Ctx, item: Item): void {
  ctx.translate(32, 36);
  ctx.beginPath();
  ctx.ellipse(0, 4, 17, 12, 0, 0, Math.PI * 2);
  ctx.ellipse(0, 4, 12, 7.5, 0, 0, Math.PI * 2, true);
  fillStroke(ctx, lin(ctx, 0, -8, 0, 16, [[0, GOLD.hi], [0.5, GOLD.mid], [1, GOLD.lo]]), GOLD.line, 1.4);
  ctx.beginPath();
  ctx.moveTo(-8, -8);
  ctx.lineTo(8, -8);
  ctx.lineTo(5, -2);
  ctx.lineTo(-5, -2);
  ctx.closePath();
  fillStroke(ctx, GOLD.mid, GOLD.line, 1.2);
  gem(ctx, 0, -12, 7, item.hue);
}

function trinket(ctx: Ctx, item: Item, r: () => number): void {
  ctx.translate(32, 32);
  if (r() < 0.5) {
    // idol: a little carved figure
    ctx.beginPath();
    ctx.moveTo(-12, 24);
    ctx.lineTo(-10, 2);
    ctx.quadraticCurveTo(-16, -8, -10, -18);
    ctx.quadraticCurveTo(0, -30, 10, -18);
    ctx.quadraticCurveTo(16, -8, 10, 2);
    ctx.lineTo(12, 24);
    ctx.closePath();
    fillStroke(ctx, lin(ctx, -14, -24, 14, 24, [[0, hsl(item.hue, 30, 70)], [0.5, hsl(item.hue, 30, 40)], [1, hsl(item.hue, 35, 15)]]), '#0d0a08', 1.6);
    ctx.save();
    ctx.shadowColor = hsl(item.hue, 100, 65);
    ctx.shadowBlur = 8;
    ctx.fillStyle = hsl(item.hue, 100, 75);
    for (const x of [-4.5, 4.5]) {
      ctx.beginPath();
      ctx.arc(x, -10, 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(0,0,0,0.5)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(-6, 0);
    ctx.lineTo(6, 0);
    ctx.moveTo(-7, 10);
    ctx.lineTo(7, 10);
    ctx.stroke();
  } else {
    // charm: a teardrop stone in a cage
    ctx.save();
    ctx.shadowColor = hsl(item.hue, 100, 60);
    ctx.shadowBlur = 14;
    ctx.beginPath();
    ctx.moveTo(0, -24);
    ctx.bezierCurveTo(14, -6, 16, 10, 0, 24);
    ctx.bezierCurveTo(-16, 10, -14, -6, 0, -24);
    ctx.fillStyle = rad(ctx, -4, -2, 2, 22, [[0, hsl(item.hue, 100, 90)], [0.45, hsl(item.hue, 85, 50)], [1, hsl(item.hue, 80, 15)]]);
    ctx.fill();
    ctx.restore();
    ctx.strokeStyle = GOLD.mid;
    ctx.lineWidth = 1.8;
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, -24);
      ctx.bezierCurveTo(s * 9, -4, s * 9, 12, 0, 24);
      ctx.stroke();
    }
    ctx.beginPath();
    ctx.arc(0, -27, 3, 0, Math.PI * 2);
    ctx.stroke();
  }
}

const QUALITY_GLOW = ['', '', 'rgba(30,255,0,0.0)', 'rgba(0,112,221,0.0)', 'rgba(163,53,238,0.45)', 'rgba(255,128,0,0.55)'];

function iconBackground(ctx: Ctx, item: Item): void {
  ctx.fillStyle = rad(ctx, 32, 28, 4, 46, [[0, hsl(item.hue, 25, 22)], [1, hsl(item.hue, 30, 6)]]);
  ctx.fillRect(0, 0, 64, 64);
  if (item.quality >= 4) {
    ctx.fillStyle = rad(ctx, 32, 32, 2, 34, [[0, QUALITY_GLOW[item.quality]], [1, 'rgba(0,0,0,0)']]);
    ctx.fillRect(0, 0, 64, 64);
  }
  // faint engraved corner marks
  ctx.strokeStyle = 'rgba(255,255,255,0.05)';
  ctx.lineWidth = 1;
  ctx.strokeRect(3.5, 3.5, 57, 57);
}

function runes(ctx: Ctx, item: Item, r: () => number): void {
  if (item.quality < 5) return;
  ctx.save();
  ctx.shadowColor = '#ffb040';
  ctx.shadowBlur = 6;
  ctx.strokeStyle = 'rgba(255,200,110,0.85)';
  ctx.lineWidth = 1;
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + r();
    const x = 32 + Math.cos(a) * 26;
    const y = 32 + Math.sin(a) * 26;
    ctx.beginPath();
    ctx.moveTo(x - 2, y - 3);
    ctx.lineTo(x + 2, y);
    ctx.lineTo(x - 2, y + 3);
    ctx.stroke();
  }
  ctx.restore();
}

function drawItem(ctx: Ctx, item: Item, size: number): void {
  const r = rng(item.seed);
  ctx.scale(size / 64, size / 64);
  iconBackground(ctx, item);
  runes(ctx, item, r);
  ctx.save();
  const two = item.slot === 'twoHand';
  const tome = item.slot === 'orb' && item.name.en.includes('Tome');
  if (item.weapon) {
    // Weapons are drawn diagonally and read small; fill the frame like the armour does.
    ctx.translate(32, 32);
    ctx.scale(1.3, 1.3);
    ctx.translate(-32, -32);
  }
  switch (item.weapon ?? item.slot) {
    case 'sword': sword(ctx, item, two); break;
    case 'axe': axe(ctx, item, two); break;
    case 'mace': mace(ctx, item, two); break;
    case 'dagger': dagger(ctx, item); break;
    case 'staff': staff(ctx, item); break;
    case 'bow': bow(ctx, item); break;
    case 'wand': wand(ctx, item); break;
    case 'shield': shield(ctx, item); break;
    case 'orb': orb(ctx, item, tome); break;
    case 'head': helm(ctx, item); break;
    case 'shoulder': shoulders(ctx, item); break;
    case 'chest': chest(ctx, item); break;
    case 'hands': hands(ctx, item); break;
    case 'feet': feet(ctx, item); break;
    case 'waist': waist(ctx, item); break;
    case 'legs': legs(ctx, item); break;
    case 'wrist': wrist(ctx, item); break;
    case 'back': cloak(ctx, item); break;
    case 'neck': neck(ctx, item); break;
    case 'finger': ring(ctx, item); break;
    default: trinket(ctx, item, r);
  }
  ctx.restore();
  // top light
  ctx.fillStyle = lin(ctx, 0, 0, 0, 64, [[0, 'rgba(255,255,255,0.08)'], [0.5, 'rgba(255,255,255,0)'], [1, 'rgba(0,0,0,0.25)']]);
  ctx.fillRect(0, 0, 64, 64);
}

const iconCache = new Map<number, string>();

/** Data URL of the item's icon (128px, sharp on hi-dpi). */
export function itemIcon(item: Item): string {
  let url = iconCache.get(item.id);
  if (!url) {
    url = offscreen(128, ctx => drawItem(ctx, item, 128));
    iconCache.set(item.id, url);
  }
  return url;
}

// ------------------------------------------------------------------ boss portraits (drawn on a 240-unit square)

type BossPal = { skin: string; skinHi: string; skinLo: string; eye: string; line: string; hue: number };

function bossPalette(hue: number, archetype: Archetype): BossPal {
  const sat = archetype === 'undead' || archetype === 'golem' || archetype === 'knight' ? 18 : 42;
  return {
    hue,
    skin: hsl(hue, sat, 36),
    skinHi: hsl(hue, sat + 10, 62),
    skinLo: hsl(hue, sat, 12),
    eye: hsl((hue + (archetype === 'undead' || archetype === 'spectre' ? 0 : 160)) % 360, 100, 64),
    line: hsl(hue, 40, 5),
  };
}

function glowEyes(ctx: Ctx, pts: Array<[number, number]>, r: number, color: string): void {
  ctx.save();
  ctx.shadowColor = color;
  ctx.shadowBlur = r * 4;
  ctx.fillStyle = color;
  for (const [x, y] of pts) {
    ctx.beginPath();
    ctx.ellipse(x, y, r * 1.4, r, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.fillStyle = '#fff';
  for (const [x, y] of pts) {
    ctx.beginPath();
    ctx.arc(x, y, r * 0.4, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
}

function shoulderBase(ctx: Ctx, p: BossPal, width = 1): void {
  ctx.beginPath();
  ctx.moveTo(120 - 110 * width, 240);
  ctx.bezierCurveTo(120 - 105 * width, 190, 120 - 70 * width, 168, 120, 166);
  ctx.bezierCurveTo(120 + 70 * width, 168, 120 + 105 * width, 190, 120 + 110 * width, 240);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, 0, 166, 0, 240, [[0, p.skin], [1, p.skinLo]]), p.line, 3);
}

function beast(ctx: Ctx, p: BossPal, r: () => number): void {
  shoulderBase(ctx, p, 1.05);
  // ears
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(120 + s * 30, 70);
    ctx.lineTo(120 + s * 62, 18 + r() * 12);
    ctx.lineTo(120 + s * 68, 92);
    ctx.closePath();
    fillStroke(ctx, lin(ctx, 120, 20, 120, 90, [[0, p.skinHi], [1, p.skinLo]]), p.line, 3);
  }
  // head + snout
  ctx.beginPath();
  ctx.moveTo(120, 58);
  ctx.bezierCurveTo(170, 58, 178, 110, 160, 140);
  ctx.bezierCurveTo(150, 170, 136, 190, 120, 196);
  ctx.bezierCurveTo(104, 190, 90, 170, 80, 140);
  ctx.bezierCurveTo(62, 110, 70, 58, 120, 58);
  ctx.closePath();
  fillStroke(ctx, rad(ctx, 105, 90, 8, 120, [[0, p.skinHi], [0.55, p.skin], [1, p.skinLo]]), p.line, 3);
  // fur tufts
  ctx.strokeStyle = p.skinLo;
  ctx.lineWidth = 2;
  for (let i = 0; i < 10; i++) {
    const x = 84 + r() * 72;
    const y = 70 + r() * 40;
    ctx.beginPath();
    ctx.moveTo(x, y);
    ctx.lineTo(x + (r() - 0.5) * 8, y + 10);
    ctx.stroke();
  }
  // nose
  ctx.beginPath();
  ctx.ellipse(120, 176, 13, 9, 0, 0, Math.PI * 2);
  fillStroke(ctx, '#140c0a', '#000', 2);
  // fangs
  ctx.fillStyle = '#f2ead6';
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(120 + s * 9, 186);
    ctx.lineTo(120 + s * 13, 214);
    ctx.lineTo(120 + s * 18, 184);
    ctx.fill();
  }
  // brow
  ctx.fillStyle = p.skinLo;
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(120 + s * 10, 112);
    ctx.lineTo(120 + s * 48, 98);
    ctx.lineTo(120 + s * 44, 110);
    ctx.closePath();
    ctx.fill();
  }
  glowEyes(ctx, [[98, 122], [142, 122]], 6, p.eye);
}

function skull(ctx: Ctx, p: BossPal, cx: number, cy: number, s: number): void {
  const bone = lin(ctx, cx, cy - 60 * s, cx, cy + 60 * s, [[0, '#f1e8d2'], [0.6, '#b9ae95'], [1, '#5a5140']]);
  ctx.beginPath();
  ctx.moveTo(cx, cy - 64 * s);
  ctx.bezierCurveTo(cx + 54 * s, cy - 64 * s, cx + 58 * s, cy - 6 * s, cx + 40 * s, cy + 18 * s);
  ctx.lineTo(cx + 32 * s, cy + 46 * s);
  ctx.lineTo(cx - 32 * s, cy + 46 * s);
  ctx.lineTo(cx - 40 * s, cy + 18 * s);
  ctx.bezierCurveTo(cx - 58 * s, cy - 6 * s, cx - 54 * s, cy - 64 * s, cx, cy - 64 * s);
  ctx.closePath();
  fillStroke(ctx, bone, p.line, 3);
  ctx.fillStyle = '#0a0706';
  for (const sx of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(cx + sx * 20 * s, cy - 6 * s, 15 * s, 13 * s, sx * 0.2, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.beginPath();
  ctx.moveTo(cx, cy + 10 * s);
  ctx.lineTo(cx + 7 * s, cy + 24 * s);
  ctx.lineTo(cx - 7 * s, cy + 24 * s);
  ctx.closePath();
  ctx.fill();
  ctx.strokeStyle = '#2a2319';
  ctx.lineWidth = 2;
  for (let i = -3; i <= 3; i++) {
    ctx.beginPath();
    ctx.moveTo(cx + i * 8 * s, cy + 32 * s);
    ctx.lineTo(cx + i * 8 * s, cy + 46 * s);
    ctx.stroke();
  }
  glowEyes(ctx, [[cx - 20 * s, cy - 6 * s], [cx + 20 * s, cy - 6 * s]], 5 * s, p.eye);
}

function crown(ctx: Ctx, cx: number, y: number, w: number, hue: number, points = 5): void {
  ctx.beginPath();
  ctx.moveTo(cx - w, y);
  for (let i = 0; i <= points * 2; i++) {
    const x = cx - w + (i * w) / points;
    ctx.lineTo(x, i % 2 ? y - w * 0.28 : y - w * 0.62);
  }
  ctx.lineTo(cx + w, y);
  ctx.lineTo(cx + w, y + w * 0.2);
  ctx.lineTo(cx - w, y + w * 0.2);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, 0, y - w * 0.6, 0, y + w * 0.2, [[0, GOLD.hi], [1, GOLD.lo]]), GOLD.line, 2.5);
  gem(ctx, cx, y - w * 0.05, w * 0.12, hue);
}

function undead(ctx: Ctx, p: BossPal, r: () => number): void {
  // tattered robe shoulders
  ctx.beginPath();
  ctx.moveTo(8, 240);
  ctx.bezierCurveTo(20, 180, 70, 160, 120, 160);
  ctx.bezierCurveTo(170, 160, 220, 180, 232, 240);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, 0, 160, 0, 240, [[0, hsl(p.hue, 25, 26)], [1, hsl(p.hue, 30, 8)]]), p.line, 3);
  skull(ctx, p, 120, 112, 1);
  if (r() < 0.7) crown(ctx, 120, 62, 44, p.hue);
}

function hood(ctx: Ctx, p: BossPal, cloth: string, clothLo: string): void {
  ctx.beginPath();
  ctx.moveTo(120, 22);
  ctx.bezierCurveTo(186, 30, 200, 120, 222, 240);
  ctx.lineTo(18, 240);
  ctx.bezierCurveTo(40, 120, 54, 30, 120, 22);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, 60, 20, 180, 240, [[0, cloth], [1, clothLo]]), p.line, 3);
  ctx.beginPath();
  ctx.moveTo(120, 58);
  ctx.bezierCurveTo(160, 62, 166, 120, 150, 162);
  ctx.quadraticCurveTo(120, 184, 90, 162);
  ctx.bezierCurveTo(74, 120, 80, 62, 120, 58);
  ctx.fillStyle = '#050307';
  ctx.fill();
}

function cultist(ctx: Ctx, p: BossPal, r: () => number): void {
  hood(ctx, p, hsl(p.hue, 45, 32), hsl(p.hue, 50, 8));
  glowEyes(ctx, [[104, 112], [136, 112]], 5, p.eye);
  // sigil on the chest
  ctx.save();
  ctx.shadowColor = p.eye;
  ctx.shadowBlur = 12;
  ctx.strokeStyle = p.eye;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.arc(120, 212, 16, 0, Math.PI * 2);
  ctx.moveTo(120, 192);
  ctx.lineTo(120, 232);
  ctx.moveTo(104, 206);
  ctx.lineTo(136, 218);
  ctx.stroke();
  ctx.restore();
  // trim
  ctx.strokeStyle = GOLD.mid;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(40, 190);
  ctx.bezierCurveTo(70, 176, 170, 176, 200, 190);
  ctx.stroke();
  if (r() < 0.5) {
    // mask
    ctx.beginPath();
    ctx.moveTo(96, 96);
    ctx.quadraticCurveTo(120, 88, 144, 96);
    ctx.lineTo(138, 148);
    ctx.quadraticCurveTo(120, 160, 102, 148);
    ctx.closePath();
    fillStroke(ctx, lin(ctx, 0, 90, 0, 160, [[0, '#e6dcc4'], [1, '#6e6552']]), '#111', 2);
    glowEyes(ctx, [[108, 114], [132, 114]], 4, p.eye);
  }
}

function hag(ctx: Ctx, p: BossPal, r: () => number): void {
  // pointed hat
  hood(ctx, p, hsl(p.hue, 35, 22), hsl(p.hue, 40, 6));
  ctx.beginPath();
  ctx.moveTo(40, 64);
  ctx.quadraticCurveTo(120, 44, 200, 64);
  ctx.quadraticCurveTo(160, 58, 146, 50);
  ctx.bezierCurveTo(140, 20, 150, 4, 176, -4);
  ctx.bezierCurveTo(130, 6, 104, 24, 96, 52);
  ctx.quadraticCurveTo(80, 58, 40, 64);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, 60, 0, 180, 64, [[0, hsl(p.hue, 30, 30)], [1, hsl(p.hue, 35, 8)]]), p.line, 3);
  // face
  ctx.beginPath();
  ctx.moveTo(120, 76);
  ctx.bezierCurveTo(150, 78, 152, 126, 140, 150);
  ctx.quadraticCurveTo(120, 170, 100, 150);
  ctx.bezierCurveTo(88, 126, 90, 78, 120, 76);
  fillStroke(ctx, lin(ctx, 0, 76, 0, 170, [[0, hsl(p.hue, 30, 55)], [1, hsl(p.hue, 30, 22)]]), p.line, 2.5);
  // nose
  ctx.beginPath();
  ctx.moveTo(118, 112);
  ctx.quadraticCurveTo(134, 132, 128, 142);
  ctx.quadraticCurveTo(122, 136, 114, 132);
  fillStroke(ctx, hsl(p.hue, 30, 42), p.line, 2);
  // grin
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 2.5;
  ctx.beginPath();
  ctx.moveTo(104, 150);
  ctx.quadraticCurveTo(120, 158, 136, 148);
  ctx.stroke();
  // wild hair
  ctx.strokeStyle = '#d8d4c8';
  ctx.lineWidth = 2;
  for (let i = 0; i < 14; i++) {
    const s = i % 2 ? 1 : -1;
    const y = 80 + r() * 60;
    ctx.beginPath();
    ctx.moveTo(120 + s * 26, y);
    ctx.quadraticCurveTo(120 + s * (46 + r() * 20), y + 20, 120 + s * (40 + r() * 30), y + 50);
    ctx.stroke();
  }
  glowEyes(ctx, [[106, 110], [134, 110]], 4.5, p.eye);
}

function brute(ctx: Ctx, p: BossPal, r: () => number): void {
  shoulderBase(ctx, p, 1.15);
  // pauldrons with spikes
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(120 + s * 78, 196, 42, 30, s * 0.3, 0, Math.PI * 2);
    fillStroke(ctx, rad(ctx, 120 + s * 70, 184, 4, 50, [[0, '#c9ced6'], [0.6, '#6d7580'], [1, '#262b31']]), '#0c0e10', 3);
    for (let k = 0; k < 3; k++) {
      ctx.beginPath();
      ctx.moveTo(120 + s * (60 + k * 16), 176 - k * 2);
      ctx.lineTo(120 + s * (64 + k * 16), 146 - k * 4);
      ctx.lineTo(120 + s * (72 + k * 16), 178 - k * 2);
      fillStroke(ctx, '#e8e2d0', '#1a1712', 2);
    }
  }
  // head
  ctx.beginPath();
  ctx.moveTo(120, 60);
  ctx.bezierCurveTo(172, 60, 176, 130, 162, 160);
  ctx.quadraticCurveTo(120, 196, 78, 160);
  ctx.bezierCurveTo(64, 130, 68, 60, 120, 60);
  fillStroke(ctx, rad(ctx, 104, 96, 6, 110, [[0, p.skinHi], [0.6, p.skin], [1, p.skinLo]]), p.line, 3);
  // brow ridge
  ctx.fillStyle = p.skinLo;
  ctx.beginPath();
  ctx.moveTo(80, 110);
  ctx.quadraticCurveTo(120, 94, 160, 110);
  ctx.lineTo(156, 120);
  ctx.quadraticCurveTo(120, 108, 84, 120);
  ctx.closePath();
  ctx.fill();
  // tusks + jaw
  ctx.beginPath();
  ctx.moveTo(92, 156);
  ctx.quadraticCurveTo(120, 170, 148, 156);
  ctx.strokeStyle = p.line;
  ctx.lineWidth = 3;
  ctx.stroke();
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.moveTo(120 + s * 18, 160);
    ctx.quadraticCurveTo(120 + s * 26, 140, 120 + s * 22, 128);
    ctx.quadraticCurveTo(120 + s * 30, 144, 120 + s * 28, 162);
    fillStroke(ctx, '#f0e8d2', '#1a1712', 2);
  }
  if (r() < 0.6) {
    // horned helm
    ctx.beginPath();
    ctx.moveTo(72, 96);
    ctx.bezierCurveTo(74, 50, 166, 50, 168, 96);
    ctx.quadraticCurveTo(120, 84, 72, 96);
    fillStroke(ctx, lin(ctx, 0, 50, 0, 96, [[0, '#cfd5dc'], [1, '#3b4249']]), '#0c0e10', 3);
    for (const s of [-1, 1]) {
      ctx.beginPath();
      ctx.moveTo(120 + s * 42, 78);
      ctx.bezierCurveTo(120 + s * 80, 72, 120 + s * 92, 40, 120 + s * 78, 20);
      ctx.bezierCurveTo(120 + s * 76, 44, 120 + s * 62, 60, 120 + s * 38, 64);
      fillStroke(ctx, lin(ctx, 0, 20, 0, 80, [[0, '#f5ecd6'], [1, '#8a7c60']]), '#1f1a12', 2.5);
    }
  }
  glowEyes(ctx, [[102, 124], [138, 124]], 5, p.eye);
}

function golem(ctx: Ctx, p: BossPal, r: () => number): void {
  const stone = (x: number, y: number, w: number, h: number) => {
    ctx.beginPath();
    ctx.moveTo(x + w * 0.1, y);
    ctx.lineTo(x + w * 0.92, y + h * 0.05);
    ctx.lineTo(x + w, y + h * 0.85);
    ctx.lineTo(x + w * 0.08, y + h);
    ctx.lineTo(x, y + h * 0.2);
    ctx.closePath();
    fillStroke(ctx, lin(ctx, x, y, x + w, y + h, [[0, p.skinHi], [0.5, p.skin], [1, p.skinLo]]), p.line, 3);
  };
  stone(14, 176, 90, 64);
  stone(136, 176, 90, 64);
  stone(80, 190, 80, 50);
  stone(62, 44, 116, 132);
  // cracks with inner glow
  ctx.save();
  ctx.shadowColor = p.eye;
  ctx.shadowBlur = 10;
  ctx.strokeStyle = p.eye;
  ctx.lineWidth = 2.5;
  for (let i = 0; i < 4; i++) {
    let x = 80 + r() * 80;
    let y = 50 + r() * 20;
    ctx.beginPath();
    ctx.moveTo(x, y);
    for (let k = 0; k < 4; k++) {
      x += (r() - 0.5) * 24;
      y += 12 + r() * 12;
      ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  ctx.restore();
  ctx.fillStyle = '#050505';
  ctx.fillRect(88, 102, 64, 20);
  glowEyes(ctx, [[102, 112], [138, 112]], 6, p.eye);
  ctx.fillStyle = '#050505';
  ctx.fillRect(98, 146, 44, 10);
}

function flame(ctx: Ctx, x: number, y: number, w: number, h: number, hue: number): void {
  ctx.beginPath();
  ctx.moveTo(x - w, y);
  ctx.bezierCurveTo(x - w, y - h * 0.5, x - w * 0.2, y - h * 0.6, x, y - h);
  ctx.bezierCurveTo(x + w * 0.2, y - h * 0.6, x + w, y - h * 0.5, x + w, y);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, 0, y - h, 0, y, [[0, hsl(hue + 30, 100, 85, 0.9)], [0.5, hsl(hue + 10, 100, 55, 0.9)], [1, hsl(hue, 100, 35, 0.2)]]);
  ctx.fill();
}

function elemental(ctx: Ctx, p: BossPal, r: () => number): void {
  const hue = p.hue;
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 16; i++) {
    const x = 30 + r() * 180;
    flame(ctx, x, 240, 16 + r() * 18, 70 + r() * 90, hue);
  }
  ctx.restore();
  // molten body
  shoulderBase(ctx, { ...p, skin: hsl(hue, 60, 22), skinLo: hsl(hue, 60, 6) }, 1);
  ctx.beginPath();
  ctx.moveTo(120, 56);
  ctx.bezierCurveTo(168, 58, 176, 124, 156, 158);
  ctx.quadraticCurveTo(120, 190, 84, 158);
  ctx.bezierCurveTo(64, 124, 72, 58, 120, 56);
  fillStroke(ctx, rad(ctx, 120, 110, 10, 90, [[0, hsl(hue + 25, 100, 60)], [0.5, hsl(hue, 80, 30)], [1, hsl(hue, 70, 10)]]), '#0a0302', 3);
  // lava seams
  ctx.save();
  ctx.shadowColor = hsl(hue + 30, 100, 60);
  ctx.shadowBlur = 10;
  ctx.strokeStyle = hsl(hue + 35, 100, 70);
  ctx.lineWidth = 2;
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(90 + r() * 60, 70 + r() * 20);
    ctx.quadraticCurveTo(80 + r() * 80, 110, 96 + r() * 48, 150 + r() * 20);
    ctx.stroke();
  }
  ctx.restore();
  // crown of fire
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  for (let i = 0; i < 7; i++) flame(ctx, 78 + i * 14, 72, 12, 50 + r() * 40, hue);
  ctx.restore();
  glowEyes(ctx, [[104, 116], [136, 116]], 6, '#fff3c0');
  ctx.fillStyle = hsl(hue + 30, 100, 75);
  ctx.beginPath();
  ctx.moveTo(100, 148);
  ctx.quadraticCurveTo(120, 162, 140, 148);
  ctx.quadraticCurveTo(120, 154, 100, 148);
  ctx.fill();
}

function aberration(ctx: Ctx, p: BossPal, r: () => number): void {
  // tentacles
  for (let i = 0; i < 9; i++) {
    const a = Math.PI * (0.15 + (i / 8) * 0.7);
    const x0 = 120 + Math.cos(a) * 40;
    const y0 = 140 + Math.sin(a) * 30;
    const x1 = 120 + Math.cos(a) * (110 + r() * 20);
    const y1 = 150 + Math.sin(a) * (100 + r() * 30);
    ctx.beginPath();
    ctx.moveTo(x0 - 10, y0);
    ctx.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 60, (y0 + y1) / 2, x1, y1);
    ctx.quadraticCurveTo((x0 + x1) / 2 + (r() - 0.5) * 40, (y0 + y1) / 2 + 10, x0 + 10, y0);
    fillStroke(ctx, lin(ctx, x0, y0, x1, y1, [[0, p.skin], [1, p.skinLo]]), p.line, 2.5);
  }
  // body
  ctx.beginPath();
  ctx.ellipse(120, 112, 78, 72, 0, 0, Math.PI * 2);
  fillStroke(ctx, rad(ctx, 100, 90, 10, 100, [[0, p.skinHi], [0.6, p.skin], [1, p.skinLo]]), p.line, 3);
  // small eyes around
  for (let i = 0; i < 6; i++) {
    const a = r() * Math.PI * 2;
    const d = 50 + r() * 12;
    ctx.beginPath();
    ctx.ellipse(120 + Math.cos(a) * d, 112 + Math.sin(a) * d * 0.9, 7, 5, a, 0, Math.PI * 2);
    fillStroke(ctx, '#f6f0dc', p.line, 2);
    ctx.beginPath();
    ctx.arc(120 + Math.cos(a) * d, 112 + Math.sin(a) * d * 0.9, 2.5, 0, Math.PI * 2);
    ctx.fillStyle = '#000';
    ctx.fill();
  }
  // the eye
  ctx.beginPath();
  ctx.ellipse(120, 112, 42, 30, 0, 0, Math.PI * 2);
  fillStroke(ctx, rad(ctx, 112, 104, 4, 46, [[0, '#ffffff'], [0.7, '#e2d8c0'], [1, '#8a7a5a']]), p.line, 3);
  ctx.save();
  ctx.shadowColor = p.eye;
  ctx.shadowBlur = 20;
  ctx.beginPath();
  ctx.arc(120, 112, 20, 0, Math.PI * 2);
  ctx.fillStyle = rad(ctx, 120, 112, 2, 20, [[0, hsl(p.hue + 160, 100, 80)], [1, hsl(p.hue + 160, 90, 35)]]);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(120, 112, 5, 16, 0, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.85)';
  ctx.beginPath();
  ctx.arc(110, 102, 5, 0, Math.PI * 2);
  ctx.fill();
}

function dragon(ctx: Ctx, p: BossPal, r: () => number): void {
  // neck
  ctx.beginPath();
  ctx.moveTo(60, 240);
  ctx.bezierCurveTo(70, 180, 110, 150, 130, 120);
  ctx.lineTo(176, 140);
  ctx.bezierCurveTo(150, 170, 150, 210, 170, 240);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, 60, 120, 170, 240, [[0, p.skin], [1, p.skinLo]]), p.line, 3);
  // belly plates
  ctx.strokeStyle = hsl(p.hue, 30, 60, 0.6);
  ctx.lineWidth = 2;
  for (let i = 0; i < 6; i++) {
    ctx.beginPath();
    ctx.moveTo(110 + i * 4, 150 + i * 16);
    ctx.lineTo(150 - i * 2, 160 + i * 14);
    ctx.stroke();
  }
  // horns behind
  for (const [dx, len] of [[-6, 70], [14, 56], [30, 44]]) {
    ctx.beginPath();
    ctx.moveTo(110 + dx, 74);
    ctx.bezierCurveTo(100 + dx - len * 0.3, 40, 84 + dx - len * 0.5, 20, 60 + dx - len * 0.4, 10);
    ctx.bezierCurveTo(92 + dx - len * 0.2, 32, 108 + dx, 50, 124 + dx, 70);
    fillStroke(ctx, lin(ctx, 40, 10, 120, 80, [[0, '#f3ead2'], [1, '#6b5f48']]), '#1a150e', 2.5);
  }
  // head in profile, facing right
  ctx.beginPath();
  ctx.moveTo(96, 96);
  ctx.bezierCurveTo(110, 62, 160, 62, 190, 90);
  ctx.lineTo(228, 110);
  ctx.quadraticCurveTo(232, 122, 222, 128);
  ctx.lineTo(186, 130);
  ctx.lineTo(214, 146);
  ctx.quadraticCurveTo(200, 160, 170, 150);
  ctx.bezierCurveTo(140, 150, 104, 140, 96, 96);
  ctx.closePath();
  fillStroke(ctx, rad(ctx, 140, 96, 10, 110, [[0, p.skinHi], [0.6, p.skin], [1, p.skinLo]]), p.line, 3);
  // teeth
  ctx.fillStyle = '#f5eedb';
  for (let i = 0; i < 5; i++) {
    ctx.beginPath();
    ctx.moveTo(192 + i * 6, 128);
    ctx.lineTo(195 + i * 6, 138);
    ctx.lineTo(198 + i * 6, 128);
    ctx.fill();
  }
  // brow spike + nostril
  ctx.beginPath();
  ctx.moveTo(140, 84);
  ctx.lineTo(178, 80);
  ctx.lineTo(150, 96);
  ctx.closePath();
  ctx.fillStyle = p.skinLo;
  ctx.fill();
  ctx.beginPath();
  ctx.ellipse(216, 114, 4, 2.5, 0.3, 0, Math.PI * 2);
  ctx.fillStyle = '#000';
  ctx.fill();
  // breath wisps
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.strokeStyle = hsl(p.hue + 160, 100, 65, 0.6);
  ctx.lineWidth = 3;
  for (let i = 0; i < 3; i++) {
    ctx.beginPath();
    ctx.moveTo(226, 132 + i * 4);
    ctx.bezierCurveTo(236, 140 + i * 8, 228 + r() * 10, 160 + i * 10, 238, 176 + i * 10);
    ctx.stroke();
  }
  ctx.restore();
  glowEyes(ctx, [[160, 98]], 6, p.eye);
}

function spectre(ctx: Ctx, p: BossPal, r: () => number): void {
  ctx.save();
  ctx.globalAlpha = 0.9;
  ctx.beginPath();
  ctx.moveTo(120, 26);
  ctx.bezierCurveTo(184, 30, 196, 120, 200, 200);
  for (let i = 0; i < 6; i++) {
    const x = 200 - (i + 1) * 30;
    ctx.quadraticCurveTo(x + 15, 220 + r() * 20, x, 200 + r() * 10);
  }
  ctx.bezierCurveTo(44, 120, 56, 30, 120, 26);
  ctx.closePath();
  ctx.fillStyle = lin(ctx, 0, 26, 0, 240, [[0, hsl(p.hue, 60, 80, 0.95)], [0.6, hsl(p.hue, 50, 45, 0.7)], [1, hsl(p.hue, 60, 20, 0.1)]]);
  ctx.fill();
  ctx.restore();
  ctx.beginPath();
  ctx.ellipse(120, 104, 34, 44, 0, 0, Math.PI * 2);
  ctx.fillStyle = 'rgba(5,5,12,0.85)';
  ctx.fill();
  glowEyes(ctx, [[106, 98], [134, 98]], 5, p.eye);
  // lantern
  ctx.save();
  ctx.shadowColor = hsl(p.hue, 100, 70);
  ctx.shadowBlur = 30;
  ctx.beginPath();
  ctx.roundRect(160, 150, 30, 40, 5);
  ctx.fillStyle = hsl(p.hue, 100, 75);
  ctx.fill();
  ctx.restore();
  ctx.strokeStyle = '#1a1510';
  ctx.lineWidth = 3;
  ctx.strokeRect(160, 150, 30, 40);
  ctx.beginPath();
  ctx.moveTo(175, 150);
  ctx.lineTo(175, 136);
  ctx.moveTo(160, 170);
  ctx.lineTo(190, 170);
  ctx.stroke();
}

function knight(ctx: Ctx, p: BossPal, r: () => number): void {
  const metal = (x0: number, y0: number, x1: number, y1: number) => lin(ctx, x0, y0, x1, y1, [[0, '#f1f4f8'], [0.4, hsl(p.hue, 12, 62)], [1, hsl(p.hue, 15, 16)]]);
  shoulderBase(ctx, { ...p, skin: hsl(p.hue, 12, 40), skinLo: hsl(p.hue, 15, 10) }, 1.1);
  for (const s of [-1, 1]) {
    ctx.beginPath();
    ctx.ellipse(120 + s * 74, 198, 46, 28, s * 0.35, 0, Math.PI * 2);
    fillStroke(ctx, metal(120 + s * 40, 170, 120 + s * 110, 230), '#0b0c0e', 3);
  }
  // plume
  ctx.beginPath();
  ctx.moveTo(120, 40);
  ctx.bezierCurveTo(150, 10, 200, 20, 212, 70);
  ctx.bezierCurveTo(190, 44, 160, 40, 128, 60);
  ctx.closePath();
  fillStroke(ctx, lin(ctx, 120, 20, 212, 70, [[0, hsl(p.hue, 80, 55)], [1, hsl(p.hue, 80, 20)]]), p.line, 2);
  // helm
  ctx.beginPath();
  ctx.moveTo(78, 176);
  ctx.lineTo(74, 88);
  ctx.bezierCurveTo(76, 40, 164, 40, 166, 88);
  ctx.lineTo(162, 176);
  ctx.quadraticCurveTo(120, 190, 78, 176);
  ctx.closePath();
  fillStroke(ctx, metal(74, 40, 166, 190), '#0b0c0e', 3);
  ctx.fillStyle = '#040405';
  ctx.fillRect(86, 106, 68, 12);
  ctx.fillRect(114, 106, 12, 50);
  ctx.strokeStyle = GOLD.mid;
  ctx.lineWidth = 3;
  ctx.beginPath();
  ctx.moveTo(120, 50);
  ctx.lineTo(120, 100);
  ctx.stroke();
  for (let i = 0; i < 6; i++) {
    ctx.fillStyle = '#2a2d33';
    ctx.beginPath();
    ctx.arc(94 + (i % 3) * 8, 136 + Math.floor(i / 3) * 10, 2, 0, Math.PI * 2);
    ctx.arc(146 - (i % 3) * 8, 136 + Math.floor(i / 3) * 10, 2, 0, Math.PI * 2);
    ctx.fill();
  }
  glowEyes(ctx, [[102, 112], [138, 112]], 4, p.eye);
  if (r() < 0.5) crown(ctx, 120, 56, 30, p.hue, 4);
}

const ARCH: Record<Archetype, (ctx: Ctx, p: BossPal, r: () => number) => void> = {
  beast, undead, cultist, hag, brute, golem, elemental, aberration, dragon, spectre, knight,
};

function drawBoss(ctx: Ctx, boss: Boss, size: number): void {
  ctx.scale(size / 240, size / 240);
  const p = bossPalette(boss.hue, boss.archetype);
  // backdrop: a halo in the boss's colour
  ctx.fillStyle = rad(ctx, 120, 110, 10, 130, [[0, hsl(boss.hue, 60, 30, 0.9)], [0.6, hsl(boss.hue, 60, 12, 0.6)], [1, 'rgba(0,0,0,0)']]);
  ctx.fillRect(0, 0, 240, 240);
  ARCH[boss.archetype](ctx, p, rng(boss.id * 7919));
  // rim light from above
  ctx.globalCompositeOperation = 'source-atop';
  ctx.fillStyle = lin(ctx, 0, 0, 0, 240, [[0, 'rgba(255,240,210,0.12)'], [0.5, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0.35)']]);
  ctx.fillRect(0, 0, 240, 240);
  ctx.globalCompositeOperation = 'source-over';
}

const bossCache = new Map<number, string>();

/** Data URL of the boss portrait (320px). */
export function bossPortrait(boss: Boss): string {
  let url = bossCache.get(boss.id);
  if (!url) {
    url = offscreen(320, ctx => drawBoss(ctx, boss, 320));
    bossCache.set(boss.id, url);
  }
  return url;
}

// ------------------------------------------------------------------ class emblems

const EMBLEM_ITEM: Record<string, Partial<Item>> = {
  warblade: { slot: 'twoHand', weapon: 'sword', hue: 30 },
  shadowblade: { slot: 'oneHand', weapon: 'dagger', hue: 55 },
  ranger: { slot: 'twoHand', weapon: 'bow', hue: 100 },
  hexcaster: { slot: 'twoHand', weapon: 'staff', hue: 255 },
  lightbinder: { slot: 'oneHand', weapon: 'mace', hue: 45 },
};
const emblemCache = new Map<string, string>();

export function classEmblem(cls: string, color: string): string {
  let url = emblemCache.get(cls);
  if (!url) {
    const base = EMBLEM_ITEM[cls];
    const fake = { id: -1, name: { en: '', zh: '' }, quality: 4, ilvl: 1, req: 1, stats: {}, seed: 7, ...base } as Item;
    url = offscreen(128, ctx => {
      ctx.scale(2, 2);
      ctx.fillStyle = rad(ctx, 32, 30, 4, 46, [[0, color], [0.25, 'rgba(0,0,0,0)'], [1, 'rgba(0,0,0,0)']]);
      ctx.fillStyle = rad(ctx, 32, 30, 2, 44, [[0, 'rgba(255,255,255,0.18)'], [1, 'rgba(0,0,0,0.9)']]);
      ctx.fillRect(0, 0, 64, 64);
      ctx.save();
      switch (fake.weapon) {
        case 'sword': sword(ctx, fake, true); break;
        case 'dagger': dagger(ctx, fake); break;
        case 'bow': bow(ctx, fake); break;
        case 'staff': staff(ctx, fake); break;
        default: mace(ctx, fake, false);
      }
      ctx.restore();
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.strokeRect(1, 1, 62, 62);
    });
    emblemCache.set(cls, url);
  }
  return url;
}
