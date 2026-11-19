// Vice Cover Lab — shot scenes for screenshots and headless checks.
//
// The app reads its own query string, so a screenshot is just a URL:
//   ?shot=cover&photo=pier&caption=Sunset%20Heist
//     Full-bleed cover, no editor chrome — the exported-cover look.
//   ?shot=editor&photo=boulevard&caption=Boulevard%20Queen
//     The editor with a photo loaded, as a person sees it.
// Optional extras: &layout=grid4&trio... any layout id, &grade=neon and
// &stars=5. The sample names map to app/samples/<name>.jpg.
//
// configureShot returns { mode: 'cover' | 'editor' | null } plus the preset
// state to apply; main.js does the rest.

export const SAMPLE_PHOTOS = {
  boulevard: { src: 'samples/boulevard.jpg', name: 'Boulevard' },
  pier: { src: 'samples/pier.jpg', name: 'Pier' },
};

export function parseShotQuery(search) {
  const q = new URLSearchParams(search || '');
  const shot = q.get('shot');
  if (shot !== 'cover' && shot !== 'editor') return null;
  const preset = {};
  const photoName = q.get('photo');
  if (photoName && SAMPLE_PHOTOS[photoName]) preset.photo = photoName;
  const caption = q.get('caption');
  if (caption) preset.title = caption;
  const layout = q.get('layout');
  if (layout) preset.layout = layout;
  const grade = q.get('grade');
  if (grade) preset.grade = grade;
  const subtitle = q.get('subtitle');
  if (subtitle) preset.subtitle = subtitle;
  const stars = Number.parseInt(q.get('stars') || '', 10);
  if (Number.isInteger(stars) && stars >= 0 && stars <= 5) preset.stars = stars;
  return { mode: shot, preset };
}

export function configureShot(search) {
  const parsed = parseShotQuery(search);
  if (!parsed) return { mode: null, preset: {} };
  return parsed;
}
