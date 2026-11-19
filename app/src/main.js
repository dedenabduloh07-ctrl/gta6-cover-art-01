// Vice Cover Lab — editor wiring.
//
// Owns the state, the photo tray, the controls and the preview canvas, and
// hands the actual drawing to cover.js. Photos never leave the machine: an
// upload is read with FileReader into an Image, a sample is fetched from
// app/samples/, and every export is rendered locally on a canvas.
//
// Shot scenes (?shot=cover / ?shot=editor) come from shots.js; in cover mode
// the editor chrome hides and the canvas fills the viewport, so a screenshot
// is the cover itself.

import { GRADES, LAYOUTS, layoutById, layoutSlots, renderCover, renderToCanvas, slotsForLayout } from './cover.js';
import { SAMPLE_PHOTOS, configureShot } from './shots.js';

const ASPECTS = {
  square: { name: 'Square', w: 900, h: 900 },
  story: { name: 'Story', w: 720, h: 900 },
  wide: { name: 'Wide', w: 900, h: 506 },
};

const EXPORT_SIZES = [
  { id: 'square', label: 'Square 1080 × 1080', w: 1080, h: 1080 },
  { id: 'story', label: 'Story 1080 × 1350', w: 1080, h: 1350 },
  { id: 'wide', label: 'Wide 1920 × 1080', w: 1920, h: 1080 },
];

const state = {
  photos: [],
  slots: [],
  layout: 'hero3',
  grade: 'sunset',
  title: 'Sunset Heist',
  subtitle: 'a Vice City story',
  badge: 'VICE CITY • EST. 2026',
  stars: 4,
  grain: true,
  vignette: true,
  aspect: 'square',
  selectedSlot: 0,
};

let undoStack = [];
let redoStack = [];
let shotMode = null;

const $ = (id) => document.getElementById(id);
const stage = $('stage');

function snapshot() {
  return JSON.stringify({
    layout: state.layout,
    grade: state.grade,
    title: state.title,
    subtitle: state.subtitle,
    badge: state.badge,
    stars: state.stars,
    grain: state.grain,
    vignette: state.vignette,
    slots: state.slots,
    selectedSlot: state.selectedSlot,
  });
}

function restore(snap) {
  const s = JSON.parse(snap);
  Object.assign(state, s);
  state.slots = s.slots;
  syncControls();
  draw();
}

function pushHistory() {
  undoStack.push(snapshot());
  if (undoStack.length > 60) undoStack.shift();
  redoStack = [];
  syncUndoButtons();
}

function undo() {
  if (!undoStack.length) return;
  redoStack.push(snapshot());
  restore(undoStack.pop());
  syncUndoButtons();
}

function redo() {
  if (!redoStack.length) return;
  undoStack.push(snapshot());
  restore(redoStack.pop());
  syncUndoButtons();
}

function syncUndoButtons() {
  $('undoBtn').disabled = undoStack.length === 0;
  $('redoBtn').disabled = redoStack.length === 0;
}

function previewSize() {
  return ASPECTS[state.aspect] || ASPECTS.square;
}

function draw() {
  const { w, h } = previewSize();
  if (shotMode === 'cover') {
    stage.width = window.innerWidth;
    stage.height = window.innerHeight;
    const ctx = stage.getContext('2d');
    renderCover(ctx, state, stage.width, stage.height);
    return;
  }
  stage.width = w;
  stage.height = h;
  const ctx = stage.getContext('2d');
  renderCover(ctx, state, w, h);
  // Selected panel outline, drawn on top of the cover.
  const rects = layoutSlots(state.layout, w, h);
  const rect = rects[state.selectedSlot];
  if (rect) {
    ctx.save();
    ctx.strokeStyle = '#00e5c0';
    ctx.lineWidth = 3;
    ctx.setLineDash([12, 8]);
    ctx.strokeRect(rect.x + 2, rect.y + 2, rect.w - 4, rect.h - 4);
    ctx.restore();
  }
  updateStatus();
}

function updateStatus() {
  const filled = state.slots.filter((s) => s.photo != null).length;
  $('statusLine').textContent =
    `${state.photos.length} photo${state.photos.length === 1 ? '' : 's'} loaded · ` +
    `${filled}/${state.slots.length} panels filled · ${layoutById(state.layout).name} · ` +
    `${(GRADES.find((g) => g.id === state.grade) || {}).name || state.grade} grade · ` +
    `panel ${state.selectedSlot + 1} selected — drag to move it, scroll to zoom`;
}

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error(`could not load ${src}`));
    img.src = src;
  });
}

async function addPhoto(img, name) {
  const id = state.photos.length;
  state.photos.push({ id, img, name });
  // Fill the first empty panel, or the selected one if it is empty.
  let target = state.slots.findIndex((s) => s.photo == null);
  if (target === -1) target = state.selectedSlot;
  if (state.slots[target]) state.slots[target].photo = id;
  state.selectedSlot = target;
  renderTray();
  draw();
}

async function loadSample(key) {
  const sample = SAMPLE_PHOTOS[key];
  if (!sample) return;
  try {
    const img = await loadImage(sample.src);
    await addPhoto(img, sample.name);
  } catch (err) {
    console.warn(err.message);
  }
}

function renderTray() {
  const tray = $('tray');
  tray.innerHTML = '';
  state.photos.forEach((photo) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'tray-item';
    button.title = `Use ${photo.name} in the selected panel`;
    const thumb = document.createElement('img');
    thumb.src = photo.img.src;
    thumb.alt = photo.name;
    button.appendChild(thumb);
    const label = document.createElement('span');
    label.textContent = photo.name;
    button.appendChild(label);
    button.addEventListener('click', () => {
      pushHistory();
      if (state.slots[state.selectedSlot]) {
        state.slots[state.selectedSlot].photo = photo.id;
      }
      draw();
    });
    tray.appendChild(button);
  });
}

function buildControlRows() {
  const layoutRow = $('layoutRow');
  LAYOUTS.forEach((layout) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pill';
    button.dataset.layout = layout.id;
    button.textContent = layout.name;
    button.addEventListener('click', () => {
      if (state.layout === layout.id) return;
      pushHistory();
      state.layout = layout.id;
      state.slots = slotsForLayout(state.slots, layout.id);
      state.selectedSlot = 0;
      syncControls();
      draw();
    });
    layoutRow.appendChild(button);
  });

  const gradeRow = $('gradeRow');
  GRADES.forEach((grade) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'swatch';
    button.dataset.grade = grade.id;
    button.title = grade.name;
    button.style.background = `linear-gradient(135deg, ${grade.swatch[0]}, ${grade.swatch[1]})`;
    const label = document.createElement('span');
    label.textContent = grade.name;
    button.appendChild(label);
    button.addEventListener('click', () => {
      if (state.grade === grade.id) return;
      pushHistory();
      state.grade = grade.id;
      syncControls();
      draw();
    });
    gradeRow.appendChild(button);
  });

  const aspectRow = $('aspectRow');
  Object.entries(ASPECTS).forEach(([id, aspect]) => {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'pill';
    button.dataset.aspect = id;
    button.textContent = `${aspect.name} ${aspect.w}×${aspect.h}`;
    button.addEventListener('click', () => {
      if (state.aspect === id) return;
      state.aspect = id;
      syncControls();
      draw();
    });
    aspectRow.appendChild(button);
  });

  const starRow = $('starRow');
  for (let n = 1; n <= 5; n += 1) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'star-btn';
    button.dataset.stars = n;
    button.textContent = '★';
    button.setAttribute('aria-label', `${n} stars`);
    button.addEventListener('click', () => {
      pushHistory();
      state.stars = n;
      syncControls();
      draw();
    });
    starRow.appendChild(button);
  }
}

function syncControls() {
  document.querySelectorAll('#layoutRow .pill').forEach((b) => {
    b.classList.toggle('active', b.dataset.layout === state.layout);
  });
  document.querySelectorAll('#gradeRow .swatch').forEach((b) => {
    b.classList.toggle('active', b.dataset.grade === state.grade);
  });
  document.querySelectorAll('#aspectRow .pill').forEach((b) => {
    b.classList.toggle('active', b.dataset.aspect === state.aspect);
  });
  document.querySelectorAll('#starRow .star-btn').forEach((b) => {
    b.classList.toggle('lit', Number(b.dataset.stars) <= state.stars);
  });
  $('titleInput').value = state.title;
  $('subtitleInput').value = state.subtitle;
  $('badgeInput').value = state.badge;
  $('grainToggle').checked = state.grain;
  $('vignetteToggle').checked = state.vignette;
  const slot = state.slots[state.selectedSlot];
  $('zoomRange').value = slot ? slot.zoom : 1;
  $('zoomValue').textContent = `${Math.round((slot ? slot.zoom : 1) * 100)}%`;
}

function downloadCanvas(canvas, filename) {
  canvas.toBlob((blob) => {
    if (!blob) return;
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }, 'image/png');
}

function exportSize(size) {
  const canvas = renderToCanvas(state, size.w, size.h);
  const slug = (state.title || 'cover').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '') || 'cover';
  downloadCanvas(canvas, `${slug}-${size.id}-${size.w}x${size.h}.png`);
}

function exportAll() {
  EXPORT_SIZES.forEach((size, i) => {
    setTimeout(() => exportSize(size), i * 350);
  });
}

// Canvas pointer: click selects a panel, drag pans it, wheel zooms it.
function slotAtPoint(clientX, clientY) {
  const rect = stage.getBoundingClientRect();
  const x = ((clientX - rect.left) / rect.width) * stage.width;
  const y = ((clientY - rect.top) / rect.height) * stage.height;
  const rects = layoutSlots(state.layout, stage.width, stage.height);
  for (let i = rects.length - 1; i >= 0; i -= 1) {
    const r = rects[i];
    if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return i;
  }
  return -1;
}

function bindCanvas() {
  let dragging = false;
  let lastX = 0;
  let lastY = 0;
  let moved = false;

  stage.addEventListener('pointerdown', (event) => {
    const hit = slotAtPoint(event.clientX, event.clientY);
    if (hit === -1) return;
    state.selectedSlot = hit;
    syncControls();
    draw();
    dragging = true;
    moved = false;
    lastX = event.clientX;
    lastY = event.clientY;
    stage.setPointerCapture(event.pointerId);
  });
  stage.addEventListener('pointermove', (event) => {
    if (!dragging) return;
    const rect = stage.getBoundingClientRect();
    const slot = state.slots[state.selectedSlot];
    if (!slot) return;
    const dx = (event.clientX - lastX) / rect.width;
    const dy = (event.clientY - lastY) / rect.height;
    if (Math.abs(dx) + Math.abs(dy) > 0.002) moved = true;
    slot.ox = Math.max(-1, Math.min(1, (slot.ox || 0) + dx));
    slot.oy = Math.max(-1, Math.min(1, (slot.oy || 0) + dy));
    lastX = event.clientX;
    lastY = event.clientY;
    draw();
  });
  stage.addEventListener('pointerup', () => {
    if (dragging && moved) pushHistory();
    dragging = false;
  });
  stage.addEventListener('wheel', (event) => {
    event.preventDefault();
    const slot = state.slots[state.selectedSlot];
    if (!slot) return;
    pushHistory();
    const factor = event.deltaY < 0 ? 1.12 : 1 / 1.12;
    slot.zoom = Math.max(1, Math.min(4, (slot.zoom || 1) * factor));
    syncControls();
    draw();
  }, { passive: false });
}

function bindControls() {
  $('photoInput').addEventListener('change', async (event) => {
    const files = Array.from(event.target.files || []);
    for (const file of files) {
      if (!file.type.startsWith('image/')) continue;
      const dataUrl = await new Promise((resolve) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(file);
      });
      try {
        const img = await loadImage(dataUrl);
        await addPhoto(img, file.name.replace(/\.[^.]+$/, ''));
      } catch (err) {
        console.warn(err.message);
      }
    }
    pushHistory();
    event.target.value = '';
  });

  $('samplePier').addEventListener('click', () => loadSample('pier'));
  $('sampleBoulevard').addEventListener('click', () => loadSample('boulevard'));

  const textChanged = (key, input) => {
    pushHistory();
    state[key] = input.value;
    draw();
  };
  $('titleInput').addEventListener('change', (e) => textChanged('title', e.target));
  $('subtitleInput').addEventListener('change', (e) => textChanged('subtitle', e.target));
  $('badgeInput').addEventListener('change', (e) => textChanged('badge', e.target));
  $('titleInput').addEventListener('input', (e) => { state.title = e.target.value; draw(); });
  $('subtitleInput').addEventListener('input', (e) => { state.subtitle = e.target.value; draw(); });
  $('badgeInput').addEventListener('input', (e) => { state.badge = e.target.value; draw(); });

  $('zoomRange').addEventListener('input', (e) => {
    const slot = state.slots[state.selectedSlot];
    if (!slot) return;
    slot.zoom = Number(e.target.value);
    $('zoomValue').textContent = `${Math.round(slot.zoom * 100)}%`;
    draw();
  });
  $('zoomRange').addEventListener('change', () => pushHistory());
  $('resetPanel').addEventListener('click', () => {
    const slot = state.slots[state.selectedSlot];
    if (!slot) return;
    pushHistory();
    slot.zoom = 1;
    slot.ox = 0;
    slot.oy = 0;
    syncControls();
    draw();
  });
  $('clearPanel').addEventListener('click', () => {
    const slot = state.slots[state.selectedSlot];
    if (!slot) return;
    pushHistory();
    slot.photo = null;
    slot.zoom = 1;
    slot.ox = 0;
    slot.oy = 0;
    draw();
  });

  $('grainToggle').addEventListener('change', (e) => {
    pushHistory();
    state.grain = e.target.checked;
    draw();
  });
  $('vignetteToggle').addEventListener('change', (e) => {
    pushHistory();
    state.vignette = e.target.checked;
    draw();
  });

  $('undoBtn').addEventListener('click', undo);
  $('redoBtn').addEventListener('click', redo);

  $('exportSquare').addEventListener('click', () => exportSize(EXPORT_SIZES[0]));
  $('exportStory').addEventListener('click', () => exportSize(EXPORT_SIZES[1]));
  $('exportWide').addEventListener('click', () => exportSize(EXPORT_SIZES[2]));
  $('exportAll').addEventListener('click', exportAll);

  window.addEventListener('resize', () => {
    if (shotMode === 'cover') draw();
  });
  window.addEventListener('keydown', (event) => {
    if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === 'z') {
      event.preventDefault();
      if (event.shiftKey) redo();
      else undo();
    }
  });
}

async function init() {
  const { mode, preset } = configureShot(window.location.search);
  shotMode = mode;
  state.slots = slotsForLayout([], state.layout);
  buildControlRows();
  bindControls();
  bindCanvas();
  syncControls();
  syncUndoButtons();

  if (preset.layout) state.layout = preset.layout;
  if (preset.grade) state.grade = preset.grade;
  if (preset.title) state.title = preset.title;
  if (preset.subtitle) state.subtitle = preset.subtitle;
  if (Number.isInteger(preset.stars)) state.stars = preset.stars;
  state.slots = slotsForLayout(state.slots, state.layout);

  // Default photos: both samples, so the first paint is already a cover.
  const first = preset.photo || 'pier';
  const second = first === 'pier' ? 'boulevard' : 'pier';
  await loadSample(first);
  await loadSample(second);
  // Fill remaining panels with the samples, cycling, so every layout shows
  // a full cover even before the user uploads anything.
  for (let i = 0; i < state.slots.length; i += 1) {
    if (state.slots[i].photo == null && state.photos.length > 0) {
      state.slots[i].photo = state.photos[i % state.photos.length].id;
    }
  }
  if (shotMode === 'cover') {
    document.body.classList.add('shot-cover');
    document.title = `${state.title} — Vice Cover Lab`;
  }
  syncControls();
  draw();
}

init();
