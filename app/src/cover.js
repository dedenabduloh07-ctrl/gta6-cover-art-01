// Vice Cover Lab — cover renderer.
//
// Everything the poster is, drawn in code on a 2D canvas: the multi-panel
// layouts, the sunset/neon grades, the bold poster lettering with its
// misregistered-print shadow, the halftone strip, grain and vignette. No
// external assets, no external fonts — only system font stacks and canvas.
//
// A cover is drawn from a plain state object:
//   {
//     photos:  [{ id, img, name }],            // loaded images
//     slots:   [{ photo, zoom, ox, oy }],     // one per layout panel
//     layout:  'hero3' | 'grid4' | 'full' | 'trio' | 'nine' | 'tilted',
//     grade:   'sunset' | 'neon' | 'tealGold' | 'vicePink' | 'noir',
//     title, subtitle, badge: strings,
//     stars:   0..5,
//     grain:   true/false, vignette: true/false,
//   }
// Slots hold a photo index (or null for an empty panel), a zoom factor and a
// pan offset in fractions of the panel. renderCover draws the state into any
// canvas at any pixel size, so the on-screen preview and the exported PNGs
// are the same drawing at different resolutions.

export const LAYOUTS = [
  { id: 'hero3', name: 'Hero + 3', panels: 4 },
  { id: 'grid4', name: 'Four Grid', panels: 4 },
  { id: 'full', name: 'Full Bleed', panels: 1 },
  { id: 'trio', name: 'Trio Strip', panels: 3 },
  { id: 'nine', name: 'Nine Grid', panels: 9 },
  { id: 'tilted', name: 'Snapshots', panels: 3 },
];

export const GRADES = [
  { id: 'sunset', name: 'Sunset', swatch: ['#ffb347', '#ff2d78'] },
  { id: 'neon', name: 'Neon Night', swatch: ['#00e5c0', '#ff2d78'] },
  { id: 'tealGold', name: 'Teal Gold', swatch: ['#00b3a0', '#ffb347'] },
  { id: 'vicePink', name: 'Vice Pink', swatch: ['#ff7ad9', '#7b2dff'] },
  { id: 'noir', name: 'Mono Noir', swatch: ['#e8e8e8', '#111111'] },
];

export function layoutById(id) {
  return LAYOUTS.find((l) => l.id === id) || LAYOUTS[0];
}

export function gradeById(id) {
  return GRADES.find((g) => g.id === id) || GRADES[0];
}

function freshSlots(layoutId) {
  const n = layoutById(layoutId).panels;
  return Array.from({ length: n }, () => ({ photo: null, zoom: 1, ox: 0, oy: 0 }));
}

// Resize a slot list when the layout changes, keeping photos in place where
// the new layout has a panel for them.
export function slotsForLayout(oldSlots, layoutId) {
  const next = freshSlots(layoutId);
  for (let i = 0; i < Math.min(oldSlots.length, next.length); i += 1) {
    next[i] = { ...oldSlots[i] };
  }
  return next;
}

// Panel rectangles in pixels for a layout, with gutters between panels.
export function layoutSlots(layoutId, W, H) {
  const g = Math.max(6, Math.round(Math.min(W, H) * 0.018)); // gutter
  switch (layoutId) {
    case 'grid4': {
      const w = (W - g) / 2;
      const h = (H - g) / 2;
      return [
        { x: 0, y: 0, w, h },
        { x: w + g, y: 0, w, h },
        { x: 0, y: h + g, w, h },
        { x: w + g, y: h + g, w, h },
      ];
    }
    case 'full':
      return [{ x: 0, y: 0, w: W, h: H }];
    case 'trio': {
      const w = (W - 2 * g) / 3;
      return [
        { x: 0, y: 0, w, h: H },
        { x: w + g, y: 0, w, h: H },
        { x: 2 * (w + g), y: 0, w, h: H },
      ];
    }
    case 'nine': {
      const w = (W - 2 * g) / 3;
      const h = (H - 2 * g) / 3;
      const out = [];
      for (let r = 0; r < 3; r += 1) {
        for (let c = 0; c < 3; c += 1) {
          out.push({ x: c * (w + g), y: r * (h + g), w, h });
        }
      }
      return out;
    }
    case 'tilted':
      // Polaroid-style snapshots, tilted over a solid backdrop. Each panel
      // carries its rotation and a white frame drawn around the photo.
      return [
        { x: W * 0.16, y: H * 0.07, w: W * 0.66, h: H * 0.58, rot: -3, frame: true },
        { x: W * 0.02, y: H * 0.58, w: W * 0.44, h: H * 0.36, rot: -6, frame: true },
        { x: W * 0.54, y: H * 0.60, w: W * 0.44, h: H * 0.34, rot: 5, frame: true },
      ];
    case 'hero3':
    default: {
      const heroW = W * 0.60;
      const sideX = heroW + g;
      const sideW = W - sideX;
      const sideH = (H - 2 * g) / 3;
      return [
        { x: 0, y: 0, w: heroW, h: H },
        { x: sideX, y: 0, w: sideW, h: sideH },
        { x: sideX, y: sideH + g, w: sideW, h: sideH },
        { x: sideX, y: 2 * (sideH + g), w: sideW, h: sideH },
      ];
    }
  }
}

// Draw one photo into a panel, cover-fit, with the slot's zoom and pan.
function drawPhotoInto(ctx, img, rect, slot) {
  const iw = img.naturalWidth || img.width;
  const ih = img.naturalHeight || img.height;
  if (!iw || !ih) return;
  const scale = Math.max(rect.w / iw, rect.h / ih) * (slot.zoom || 1);
  const dw = iw * scale;
  const dh = ih * scale;
  const dx = rect.x + (rect.w - dw) / 2 + (slot.ox || 0) * rect.w;
  const dy = rect.y + (rect.h - dh) / 2 + (slot.oy || 0) * rect.h;
  ctx.drawImage(img, dx, dy, dw, dh);
}

function drawEmptyPanel(ctx, rect) {
  const grad = ctx.createLinearGradient(rect.x, rect.y, rect.x + rect.w, rect.y + rect.h);
  grad.addColorStop(0, '#2a1638');
  grad.addColorStop(1, '#12081f');
  ctx.fillStyle = grad;
  ctx.fillRect(rect.x, rect.y, rect.w, rect.h);
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.35)';
  ctx.lineWidth = 2;
  ctx.setLineDash([10, 8]);
  ctx.strokeRect(rect.x + 10, rect.y + 10, rect.w - 20, rect.h - 20);
  ctx.restore();
  const size = Math.min(rect.w, rect.h) * 0.16;
  ctx.fillStyle = 'rgba(255,255,255,0.75)';
  ctx.font = `900 ${Math.max(14, size)}px "Arial Black", Impact, sans-serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('+', rect.x + rect.w / 2, rect.y + rect.h / 2 - size * 0.3);
  ctx.font = `700 ${Math.max(11, size * 0.42)}px "Helvetica Neue", Arial, sans-serif`;
  ctx.fillText('ADD PHOTO', rect.x + rect.w / 2, rect.y + rect.h / 2 + size * 0.55);
}

// The grade: a coloured wash over the panels, before the lettering.
function applyGrade(ctx, gradeId, W, H) {
  ctx.save();
  if (gradeId === 'noir') {
    ctx.globalCompositeOperation = 'saturation';
    ctx.fillStyle = '#8a8a8a';
    ctx.fillRect(0, 0, W, H);
    ctx.globalCompositeOperation = 'overlay';
    const g = ctx.createLinearGradient(0, 0, 0, H);
    g.addColorStop(0, 'rgba(255,255,255,0.10)');
    g.addColorStop(1, 'rgba(0,0,0,0.28)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    ctx.restore();
    return;
  }
  const washes = {
    sunset: { top: '#ff9a3d', bottom: '#ff2d78', op: 0.55, wash: '#ff7a18', washOp: 0.22 },
    neon: { top: '#00e5c0', bottom: '#ff2d78', op: 0.50, wash: '#1a0b2e', washOp: 0.20 },
    tealGold: { top: '#00b3a0', bottom: '#ffb347', op: 0.55, wash: '#ff9a3d', washOp: 0.18 },
    vicePink: { top: '#ff7ad9', bottom: '#7b2dff', op: 0.50, wash: '#2d0a4e', washOp: 0.20 },
  };
  const w = washes[gradeId] || washes.sunset;
  const g = ctx.createLinearGradient(0, 0, W * 0.25, H);
  g.addColorStop(0, w.top);
  g.addColorStop(1, w.bottom);
  ctx.globalCompositeOperation = 'overlay';
  ctx.globalAlpha = w.op;
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  ctx.globalCompositeOperation = 'soft-light';
  ctx.globalAlpha = w.washOp;
  ctx.fillStyle = w.wash;
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

let grainTileCanvas = null;
function grainTile() {
  if (grainTileCanvas) return grainTileCanvas;
  const t = document.createElement('canvas');
  t.width = 128;
  t.height = 128;
  const c = t.getContext('2d');
  const data = c.createImageData(128, 128);
  for (let i = 0; i < data.data.length; i += 4) {
    const v = Math.floor(Math.random() * 255);
    data.data[i] = v;
    data.data[i + 1] = v;
    data.data[i + 2] = v;
    data.data[i + 3] = 255;
  }
  c.putImageData(data, 0, 0);
  grainTileCanvas = t;
  return t;
}

function applyGrain(ctx, W, H) {
  ctx.save();
  ctx.globalAlpha = 0.07;
  ctx.globalCompositeOperation = 'overlay';
  ctx.fillStyle = ctx.createPattern(grainTile(), 'repeat');
  ctx.fillRect(0, 0, W, H);
  ctx.restore();
}

function applyVignette(ctx, W, H) {
  const r = Math.hypot(W, H) / 2;
  const g = ctx.createRadialGradient(W / 2, H / 2, r * 0.45, W / 2, H / 2, r);
  g.addColorStop(0, 'rgba(0,0,0,0)');
  g.addColorStop(1, 'rgba(5,0,15,0.42)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
}

// Fit a title into at most two lines at the given width, shrinking as needed.
function fitTitleLines(ctx, text, maxWidth, startSize) {
  let size = startSize;
  const words = String(text || '').split(/\s+/).filter(Boolean);
  if (words.length === 0) return { lines: [], size };
  const fontFor = (s) => `900 ${s}px "Arial Black", Impact, "Helvetica Neue", sans-serif`;
  const measure = (s, line) => {
    ctx.font = fontFor(s);
    return ctx.measureText(line).width;
  };
  while (size > 18) {
    const lines = [];
    let line = '';
    for (const word of words) {
      const trial = line ? `${line} ${word}` : word;
      if (measure(size, trial) <= maxWidth || !line) {
        line = trial;
      } else {
        lines.push(line);
        line = word;
      }
    }
    if (line) lines.push(line);
    if (lines.length <= 2 && lines.every((l) => measure(size, l) <= maxWidth)) {
      return { lines, size };
    }
    size = Math.floor(size * 0.92);
  }
  return { lines: words.slice(0, 4), size };
}

function drawStar(ctx, cx, cy, r, color) {
  ctx.save();
  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < 10; i += 1) {
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    const rad = i % 2 === 0 ? r : r * 0.45;
    const x = cx + Math.cos(angle) * rad;
    const y = cy + Math.sin(angle) * rad;
    if (i === 0) ctx.moveTo(x, y);
    else ctx.lineTo(x, y);
  }
  ctx.closePath();
  ctx.fill();
  ctx.restore();
}

function drawTitleBlock(ctx, state, W, H) {
  const title = (state.title || '').trim();
  const subtitle = (state.subtitle || '').trim();
  if (!title && !subtitle) return;
  const pad = Math.round(W * 0.045);
  const maxW = W - pad * 2;

  // A dark scrim behind the lettering so it reads over any photo.
  const scrimH = H * 0.34;
  const scrim = ctx.createLinearGradient(0, H - scrimH, 0, H);
  scrim.addColorStop(0, 'rgba(8,2,18,0)');
  scrim.addColorStop(1, 'rgba(8,2,18,0.62)');
  ctx.fillStyle = scrim;
  ctx.fillRect(0, H - scrimH, W, scrimH);

  let cursorY = H - pad;
  if (subtitle) {
    const subSize = Math.max(16, Math.round(W * 0.038));
    ctx.font = `italic 700 ${subSize}px "Brush Script MT", "Segoe Script", "Comic Sans MS", cursive`;
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    ctx.fillStyle = '#ffe9a8';
    ctx.shadowColor = 'rgba(0,0,0,0.6)';
    ctx.shadowBlur = 6;
    ctx.shadowOffsetY = 2;
    ctx.fillText(subtitle, pad, cursorY);
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetY = 0;
    cursorY -= subSize * 1.15;
  }
  if (title) {
    const { lines, size } = fitTitleLines(ctx, title.toUpperCase(), maxW, Math.round(W * 0.115));
    const grad = ctx.createLinearGradient(pad, 0, W - pad, 0);
    grad.addColorStop(0, '#ffd319');
    grad.addColorStop(0.55, '#ff2975');
    grad.addColorStop(1, '#8c1eff');
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
    try {
      ctx.letterSpacing = '1px';
    } catch {
      // Older engines ignore letter spacing; the drawing still works.
    }
    const lineHeight = size * 1.02;
    let y = cursorY - (lines.length - 1) * lineHeight;
    // Halftone dot strip above the title, clear of the subtitle below it.
    const dotY = y - size * 1.02;
    const dotGap = Math.max(10, W * 0.016);
    let dotR = Math.max(2, W * 0.006);
    for (let x = pad; x < W - pad && dotR > 0.6; x += dotGap) {
      ctx.fillStyle = 'rgba(255,211,25,0.85)';
      ctx.beginPath();
      ctx.arc(x, dotY, dotR, 0, Math.PI * 2);
      ctx.fill();
      dotR *= 0.94;
    }
    for (const line of lines) {
      ctx.font = `900 ${size}px "Arial Black", Impact, "Helvetica Neue", sans-serif`;
      // Misregistered-print shadows: cyan one way, magenta the other.
      ctx.fillStyle = 'rgba(0,229,192,0.55)';
      ctx.fillText(line, pad + 3, y + 3);
      ctx.fillStyle = 'rgba(255,45,120,0.55)';
      ctx.fillText(line, pad - 3, y - 2);
      ctx.lineWidth = Math.max(2, size * 0.07);
      ctx.strokeStyle = '#14061f';
      ctx.lineJoin = 'round';
      ctx.strokeText(line, pad, y);
      ctx.fillStyle = grad;
      ctx.fillText(line, pad, y);
      y += lineHeight;
    }
    try {
      ctx.letterSpacing = '0px';
    } catch {
      // ignore
    }
  }
}

function drawBadge(ctx, state, W, H) {
  const badge = (state.badge || '').trim();
  const stars = state.stars || 0;
  if (!badge && !stars) return;
  const pad = Math.round(W * 0.045);
  ctx.save();
  ctx.translate(W - pad, pad + Math.round(H * 0.02));
  ctx.rotate((-7 * Math.PI) / 180);
  if (badge) {
    const fontSize = Math.max(13, Math.round(W * 0.024));
    ctx.font = `900 ${fontSize}px "Arial Black", Impact, sans-serif`;
    const tw = ctx.measureText(badge).width;
    const bw = tw + fontSize * 1.6;
    const bh = fontSize * 2.1;
    ctx.fillStyle = '#ff2d78';
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.beginPath();
    ctx.rect(-bw, 0, bw, bh);
    ctx.fill();
    ctx.stroke();
    ctx.fillStyle = '#ffffff';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(badge, -bw / 2, bh / 2 + 1);
    ctx.translate(0, bh + Math.round(H * 0.018));
  }
  if (stars > 0) {
    const r = Math.max(8, Math.round(W * 0.014));
    for (let i = 0; i < 5; i += 1) {
      drawStar(ctx, -((5 - i) * (r * 2.4)), 0, r, i < stars ? '#ffd319' : 'rgba(255,255,255,0.35)');
    }
  }
  ctx.restore();
}

// Draw the whole cover into ctx at pixel size W x H.
export function renderCover(ctx, state, W, H) {
  ctx.clearRect(0, 0, W, H);
  const layoutId = state.layout || 'hero3';
  const slots = state.slots || [];
  const rects = layoutSlots(layoutId, W, H);

  // Backdrop: deep violet so gutters and the tilted layout read as poster.
  const bg = ctx.createLinearGradient(0, 0, W, H);
  bg.addColorStop(0, '#1c0b2e');
  bg.addColorStop(1, '#0a0518');
  ctx.fillStyle = bg;
  ctx.fillRect(0, 0, W, H);

  rects.forEach((rect, i) => {
    const slot = slots[i] || { photo: null, zoom: 1, ox: 0, oy: 0 };
    const photo = slot.photo != null ? state.photos[slot.photo] : null;
    ctx.save();
    if (rect.rot) {
      ctx.translate(rect.x + rect.w / 2, rect.y + rect.h / 2);
      ctx.rotate((rect.rot * Math.PI) / 180);
      ctx.translate(-rect.w / 2, -rect.h / 2);
    }
    if (rect.frame) {
      // Polaroid frame: white border, soft shadow, photo inset.
      const fw = Math.round(W * 0.012);
      const fh = Math.round(H * 0.012);
      ctx.shadowColor = 'rgba(0,0,0,0.55)';
      ctx.shadowBlur = Math.round(W * 0.02);
      ctx.shadowOffsetY = Math.round(H * 0.008);
      ctx.fillStyle = '#fdfdf8';
      ctx.fillRect(-fw, -fh, rect.w + fw * 2, rect.h + fh * 2);
      ctx.shadowColor = 'transparent';
      ctx.shadowBlur = 0;
      ctx.shadowOffsetY = 0;
      ctx.beginPath();
      ctx.rect(0, 0, rect.w, rect.h);
      ctx.clip();
      if (photo) drawPhotoInto(ctx, photo.img, { x: 0, y: 0, w: rect.w, h: rect.h }, slot);
      else drawEmptyPanel(ctx, { x: 0, y: 0, w: rect.w, h: rect.h });
    } else {
      ctx.beginPath();
      ctx.rect(rect.x, rect.y, rect.w, rect.h);
      ctx.clip();
      if (photo) drawPhotoInto(ctx, photo.img, rect, slot);
      else drawEmptyPanel(ctx, rect);
    }
    ctx.restore();
  });

  applyGrade(ctx, state.grade || 'sunset', W, H);
  if (state.grain !== false) applyGrain(ctx, W, H);
  if (state.vignette !== false) applyVignette(ctx, W, H);

  // Poster frame: a thin white rule inside the edge.
  ctx.save();
  ctx.strokeStyle = 'rgba(255,255,255,0.85)';
  ctx.lineWidth = Math.max(3, Math.round(W * 0.004));
  ctx.strokeRect(ctx.lineWidth, ctx.lineWidth, W - ctx.lineWidth * 2, H - ctx.lineWidth * 2);
  ctx.restore();

  drawTitleBlock(ctx, state, W, H);
  drawBadge(ctx, state, W, H);
}

// Render the state into a fresh canvas at exact pixel size (for export).
export function renderToCanvas(state, w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  renderCover(ctx, state, w, h);
  return canvas;
}
