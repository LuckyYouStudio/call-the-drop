// Share cards drawn on a canvas: the hero sheet and the "called it" brag after a win.
import { bossPortrait, classEmblem, itemIcon } from './art';
import { CLASSES, EQUIP_SLOTS, gearScore, itemPower, power, type Character } from './character';
import { QUALITY_NAMES, lang, t, tx } from './i18n';
import { formatMult, formatPct } from './odds';
import { ITEMS, type Boss, type Item } from './world';

const QUALITY_COLORS = ['#9d9d9d', '#ffffff', '#1eff00', '#0070dd', '#a335ee', '#ff8000'];
const SERIF = '"Cinzel", "Noto Serif SC", "Songti SC", SimSun, serif';
const SANS = 'system-ui, "Microsoft YaHei", "PingFang SC", sans-serif';

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise(resolve => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

/** Web fonts load per glyph range: ask for exactly the text that will be drawn. */
async function loadFonts(text: string): Promise<void> {
  try {
    await Promise.all([
      document.fonts.load(`700 40px "Cinzel"`, text),
      document.fonts.load(`900 40px "Noto Serif SC"`, text),
      document.fonts.load(`600 40px "Noto Serif SC"`, text),
    ]);
  } catch {
    /* fall back to system serif */
  }
}

function canvas(w: number, h: number): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return [c, c.getContext('2d')!];
}

function background(ctx: CanvasRenderingContext2D, w: number, h: number, glow: string): void {
  ctx.fillStyle = '#0c0a07';
  ctx.fillRect(0, 0, w, h);
  const g = ctx.createRadialGradient(w / 2, 0, 40, w / 2, 0, h * 0.9);
  g.addColorStop(0, glow);
  g.addColorStop(1, 'rgba(0,0,0,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, w, h);
  ctx.fillStyle = 'rgba(255,255,255,0.018)';
  for (let i = 0; i < 900; i++) ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2);
  ctx.strokeStyle = '#4a3b22';
  ctx.lineWidth = 10;
  ctx.strokeRect(5, 5, w - 10, h - 10);
  ctx.strokeStyle = 'rgba(201,166,75,0.7)';
  ctx.lineWidth = 2;
  ctx.strokeRect(16, 16, w - 32, h - 32);
}

function goldText(ctx: CanvasRenderingContext2D, text: string, x: number, y: number, size: number): void {
  ctx.font = `900 ${size}px ${SERIF}`;
  const g = ctx.createLinearGradient(0, y - size, 0, y);
  g.addColorStop(0, '#fff3b0');
  g.addColorStop(0.5, '#f0b429');
  g.addColorStop(1, '#8a5a12');
  ctx.shadowColor = 'rgba(255,170,40,0.45)';
  ctx.shadowBlur = 18;
  ctx.fillStyle = g;
  ctx.fillText(text, x, y);
  ctx.shadowBlur = 0;
}

function iconBox(ctx: CanvasRenderingContext2D, img: HTMLImageElement | null, x: number, y: number, s: number, color: string, glow = false): void {
  if (glow) {
    ctx.shadowColor = color;
    ctx.shadowBlur = s / 3;
  }
  ctx.fillStyle = '#000';
  ctx.fillRect(x - 2, y - 2, s + 4, s + 4);
  ctx.shadowBlur = 0;
  if (img) ctx.drawImage(img, x, y, s, s);
  ctx.strokeStyle = color;
  ctx.lineWidth = 2;
  ctx.strokeRect(x - 1, y - 1, s + 2, s + 2);
}

function fit(ctx: CanvasRenderingContext2D, text: string, max: number): string {
  if (ctx.measureText(text).width <= max) return text;
  let s = text;
  while (s.length > 1 && ctx.measureText(`${s}…`).width > max) s = s.slice(0, -1);
  return `${s}…`;
}

function footer(ctx: CanvasRenderingContext2D, w: number, h: number): void {
  ctx.textAlign = 'center';
  ctx.font = `600 22px ${SERIF}`;
  ctx.fillStyle = '#c9a64b';
  ctx.fillText(t('cardFooter'), w / 2, h - 44);
  ctx.font = `16px ${SANS}`;
  ctx.fillStyle = '#6f6450';
  ctx.fillText(new Date().toLocaleDateString(lang === 'zh' ? 'zh-CN' : 'en-US'), w / 2, h - 24);
}

// ------------------------------------------------------------------ hero card

export async function characterCard(c: Character): Promise<HTMLCanvasElement> {
  const W = 720;
  const H = 1080;
  const cls = CLASSES[c.cls];
  const items = EQUIP_SLOTS.map(s => ({ slot: s, item: c.equipped[s.key] !== undefined ? ITEMS.get(c.equipped[s.key]!) : undefined }));
  const words = items.map(i => (i.item ? tx(i.item.name) : '')).join('') + c.name + t('title') + t('power') + t('cardFooter') + tx(cls.name) + t('levelClass', { level: c.level, cls: tx(cls.name) }) + t('fights') + t('itemsCollected') + t('ilvlShort') + items.map(i => tx(i.slot.name)).join('');
  const [emblemImg, ...icons] = await Promise.all([
    loadImage(classEmblem(c.cls, cls.color)),
    ...items.map(i => (i.item ? loadImage(itemIcon(i.item)) : Promise.resolve(null))),
    loadFonts(words),
  ]);
  const [cv, ctx] = canvas(W, H);
  background(ctx, W, H, `${cls.color}55`);

  ctx.textAlign = 'center';
  goldText(ctx, t('title'), W / 2, 96, lang === 'zh' ? 64 : 58);

  iconBox(ctx, emblemImg as HTMLImageElement | null, 48, 140, 128, cls.color, true);
  ctx.textAlign = 'left';
  ctx.font = `900 46px ${SERIF}`;
  ctx.fillStyle = cls.color;
  ctx.fillText(fit(ctx, c.name, 470), 206, 190);
  ctx.font = `22px ${SANS}`;
  ctx.fillStyle = '#e9dfc6';
  ctx.fillText(t('levelClass', { level: c.level, cls: tx(cls.name) }), 208, 230);
  ctx.font = `20px ${SANS}`;
  ctx.fillStyle = '#a3967a';
  ctx.fillText(t('power'), 208, 272);
  goldText(ctx, power(c).toLocaleString('en-US'), 208 + ctx.measureText(t('power')).width + 18, 280, 52);

  const fights = Object.values(c.kills).reduce((a, b) => a + b, 0);
  const owned = c.bag.length + Object.keys(c.equipped).length;
  const stats = [[t('ilvlShort'), gearScore(c)], [t('fights'), fights], [t('itemsCollected'), owned]] as const;
  stats.forEach(([label, value], i) => {
    const x = 48 + i * 212;
    ctx.fillStyle = 'rgba(14,11,7,0.85)';
    ctx.fillRect(x, 310, 200, 70);
    ctx.strokeStyle = '#2e2415';
    ctx.strokeRect(x, 310, 200, 70);
    ctx.textAlign = 'center';
    ctx.font = `16px ${SANS}`;
    ctx.fillStyle = '#a3967a';
    ctx.fillText(label, x + 100, 336);
    ctx.font = `700 26px ${SANS}`;
    ctx.fillStyle = '#e9dfc6';
    ctx.fillText(String(value), x + 100, 368);
  });

  ctx.textAlign = 'left';
  const colW = 312;
  items.forEach(({ slot, item }, i) => {
    const col = i < 8 ? 0 : 1;
    const row = i < 8 ? i : i - 8;
    const x = 48 + col * colW;
    const y = 410 + row * 70;
    const color = item ? QUALITY_COLORS[item.quality] : '#3b3222';
    iconBox(ctx, icons[i] as HTMLImageElement | null, x, y, 52, color);
    ctx.font = `14px ${SANS}`;
    ctx.fillStyle = '#6f6450';
    ctx.fillText(tx(slot.name), x + 64, y + 18);
    ctx.font = `600 19px ${SERIF}`;
    ctx.fillStyle = item ? color : '#4a3f2b';
    ctx.fillText(item ? fit(ctx, tx(item.name), colW - 80) : '—', x + 64, y + 44);
  });

  footer(ctx, W, H);
  return cv;
}

// ------------------------------------------------------------------ brag

export type Brag = { character: Character; boss: Boss; item: Item; chance: number; mult: number; won: string };

export async function bragCard(b: Brag): Promise<HTMLCanvasElement> {
  const W = 720;
  const H = 960;
  const color = QUALITY_COLORS[b.item.quality];
  const cls = CLASSES[b.character.cls];
  const big = b.item.quality >= 4 || b.mult >= 10;
  const title = b.item.quality >= 5 ? t('bragTitle5') : b.item.quality >= 4 ? t('bragTitle4') : big ? t('bragTitleBig') : t('bragTitle');
  const beat = t('beat', { boss: tx(b.boss.name), dungeon: tx(b.boss.dungeon.name) });
  const words = title + beat + tx(b.item.name) + b.character.name + tx(cls.name) + t('winChance') + t('odds') + t('won') + t('cardFooter') + tx(QUALITY_NAMES[b.item.quality]) + t('itemLevel', { n: 0 }) + t('powerTip', { n: 0 });
  const [icon, emblemImg, bossImg] = await Promise.all([
    loadImage(itemIcon(b.item)),
    loadImage(classEmblem(b.character.cls, cls.color)),
    loadImage(bossPortrait(b.boss)),
    loadFonts(words),
  ]);
  const [cv, ctx] = canvas(W, H);
  const glow = b.item.quality >= 5 ? 'rgba(255,128,0,0.5)' : b.item.quality >= 4 ? 'rgba(163,53,238,0.5)' : 'rgba(0,112,221,0.4)';
  background(ctx, W, H, glow);

  ctx.textAlign = 'center';
  goldText(ctx, title, W / 2, 120, lang === 'zh' ? 80 : 70);

  ctx.font = `24px ${SANS}`;
  const beatW = ctx.measureText(beat).width;
  const px = (W - beatW - 76) / 2;
  if (bossImg) {
    ctx.save();
    ctx.beginPath();
    ctx.arc(px + 32, 168, 32, 0, Math.PI * 2);
    ctx.fillStyle = '#1a140c';
    ctx.fill();
    ctx.clip();
    ctx.drawImage(bossImg, px, 136, 64, 64);
    ctx.restore();
    ctx.strokeStyle = '#c9a64b';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.arc(px + 32, 168, 32, 0, Math.PI * 2);
    ctx.stroke();
  }
  ctx.textAlign = 'left';
  ctx.fillStyle = '#e9dfc6';
  ctx.fillText(beat, px + 76, 177);
  ctx.textAlign = 'center';

  ctx.save();
  ctx.translate(W / 2, 330);
  for (let i = 0; i < 16; i++) {
    ctx.rotate((Math.PI * 2) / 16);
    const g = ctx.createLinearGradient(0, 0, 0, -230);
    g.addColorStop(0, glow);
    g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.moveTo(-14, 0);
    ctx.lineTo(0, -230);
    ctx.lineTo(14, 0);
    ctx.fill();
  }
  ctx.restore();
  iconBox(ctx, icon, W / 2 - 80, 250, 160, color, true);

  ctx.font = `900 40px ${SERIF}`;
  ctx.fillStyle = color;
  ctx.fillText(fit(ctx, tx(b.item.name), W - 100), W / 2, 480);
  ctx.font = `20px ${SANS}`;
  ctx.fillStyle = '#a3967a';
  const p = itemPower(b.character.cls, b.item);
  ctx.fillText(`${tx(QUALITY_NAMES[b.item.quality])} · ${t('itemLevel', { n: b.item.ilvl })}${p > 0 ? ` · ${t('powerTip', { n: p })}` : ''}`, W / 2, 516);

  const boxes = [[t('winChance'), formatPct(b.chance)], [t('odds'), formatMult(b.mult)]] as const;
  boxes.forEach(([label, value], i) => {
    const x = 110 + i * 260;
    ctx.fillStyle = 'rgba(14,11,7,0.85)';
    ctx.fillRect(x, 560, 240, 90);
    ctx.strokeStyle = '#2e2415';
    ctx.strokeRect(x, 560, 240, 90);
    ctx.font = `18px ${SANS}`;
    ctx.fillStyle = '#a3967a';
    ctx.fillText(label, x + 120, 592);
    ctx.font = `800 34px ${SANS}`;
    ctx.fillStyle = i === 1 ? '#ffd100' : '#e9dfc6';
    ctx.fillText(value, x + 120, 634);
  });

  ctx.font = `20px ${SANS}`;
  ctx.fillStyle = '#a3967a';
  ctx.fillText(t('won'), W / 2, 700);
  goldText(ctx, `+${b.won}`, W / 2, 764, 58);

  ctx.textAlign = 'left';
  ctx.font = `700 26px ${SERIF}`;
  const who = b.character.name;
  const meta = `  ${t('levelClass', { level: b.character.level, cls: tx(cls.name) })}`;
  const wWho = ctx.measureText(who).width;
  ctx.font = `20px ${SANS}`;
  const wMeta = ctx.measureText(meta).width;
  const x0 = (W - (44 + 12 + wWho + wMeta)) / 2;
  iconBox(ctx, emblemImg, x0, 800, 44, cls.color);
  ctx.font = `700 26px ${SERIF}`;
  ctx.fillStyle = cls.color;
  ctx.fillText(who, x0 + 56, 832);
  ctx.font = `20px ${SANS}`;
  ctx.fillStyle = '#a3967a';
  ctx.fillText(meta, x0 + 56 + wWho, 831);

  footer(ctx, W, H);
  return cv;
}

// ------------------------------------------------------------------ share sheet

function toBlob(cv: HTMLCanvasElement): Promise<Blob | null> {
  return new Promise(resolve => cv.toBlob(resolve, 'image/png'));
}

/** Shows the card with save / share / copy actions. */
export async function openShare(host: HTMLElement, cv: HTMLCanvasElement, filename: string, onClose: () => void = () => {}): Promise<void> {
  const blob = await toBlob(cv);
  const url = blob ? URL.createObjectURL(blob) : cv.toDataURL('image/png');
  const file = blob ? new File([blob], filename, { type: 'image/png' }) : null;
  const canShareFile = !!file && typeof navigator.canShare === 'function' && navigator.canShare({ files: [file] });
  const canCopy = !!blob && typeof ClipboardItem !== 'undefined' && !!navigator.clipboard?.write;
  host.innerHTML = `
  <div class="modal" data-share-bg>
    <div class="sharewin panel">
      <button class="x" data-share-close>×</button>
      <img class="sharewin__img" src="${url}" alt="" />
      <p class="muted sharewin__hint">${t('shareHint')}</p>
      <div class="sharewin__actions">
        ${canShareFile ? `<button class="btn" data-share-native>${t('shareNative')}</button>` : ''}
        ${canCopy ? `<button class="btn btn--ghost" data-share-copy>${t('copyImage')}</button>` : ''}
        <a class="btn" href="${url}" download="${filename}">${t('saveImage')}</a>
      </div>
      <p class="sharewin__msg" id="share-msg"></p>
    </div>
  </div>`;
  const msg = host.querySelector<HTMLElement>('#share-msg')!;
  const close = () => {
    host.innerHTML = '';
    if (blob) URL.revokeObjectURL(url);
    onClose();
  };
  host.querySelector('[data-share-close]')!.addEventListener('click', close);
  host.querySelector('[data-share-bg]')!.addEventListener('click', e => {
    if ((e.target as HTMLElement).hasAttribute('data-share-bg')) close();
  });
  host.querySelector('[data-share-native]')?.addEventListener('click', async () => {
    try {
      await navigator.share({ files: [file!], title: t('title') });
    } catch {
      /* dismissed */
    }
  });
  host.querySelector('[data-share-copy]')?.addEventListener('click', async () => {
    try {
      await navigator.clipboard.write([new ClipboardItem({ 'image/png': blob! })]);
      msg.textContent = t('copied');
    } catch {
      msg.textContent = t('copyFailed');
    }
  });
}
