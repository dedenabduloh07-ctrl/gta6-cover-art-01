// Vice Cover Lab — hand-in program for gta6-cover-art-01 (Node 22+, stdlib only).
//
// What it does: takes this repo's app/ (the offline cover maker, plain static
// files) and screenshots/ (3-4 captures of the app and its exported covers) and
// hands them to the grader in /output, together with /output/dossier.json — the
// summary the judge reads, built by the vendored make.fun library.
//
// Run locally to try it:
//   mkdir -p out && MAKEFUN_OUTPUT_DIR=out node main.ts
// Serve the app while developing with `node serve.ts` (http://localhost:8080).

import { cpSync, existsSync, mkdirSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildDossier } from './vendor/makefun-app.ts';

// Where this file lives is the repo root; the grader runs it from there.
const repoRoot = dirname(fileURLToPath(import.meta.url));

// The grader hands us /output; outside its container MAKEFUN_OUTPUT_DIR
// stands in for it, so a local run never touches the real root.
const outputDir = process.env.MAKEFUN_OUTPUT_DIR ?? '/output';

function mirrorTree(sourceDir: string, targetDir: string): void {
  mkdirSync(targetDir, { recursive: true });
  if (existsSync(sourceDir)) {
    cpSync(sourceDir, targetDir, { recursive: true });
  }
}

mirrorTree(join(repoRoot, 'app'), join(outputDir, 'app'));
mirrorTree(join(repoRoot, 'screenshots'), join(outputDir, 'screenshots'));

// The scorer's caps for this bounty (its reference/gate.json): the text cap
// shapes the dossier bytes; the rest refuse an entry the scorer would refuse
// — more than 4 screenshots, one over 256 KiB, an app/ over 993 files or
// 48 MiB in all, or a path under app/ over 1000 bytes.
const dossierCaps = {
  text_max_bytes: 163840,
  screenshots: { max: 4, max_bytes: 262144 },
  app_max_files: 993,
  app_max_bytes: 50331648,
  app_path_max_bytes: 1000,
};

writeFileSync(
  join(outputDir, 'dossier.json'),
  buildDossier(outputDir, dossierCaps),
);
