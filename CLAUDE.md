# CLAUDE.md

Guidance for Claude Code when working in this repository.

## What this is

A Three.js (WebGL2) + Vite + TypeScript browser game: a flying car in an endless, seeded, procedural
cyberpunk Tokyo, always at night. No backend. Deployed to GitHub Pages from `main`
(`.github/workflows/pages.yml`); CI in `.github/workflows/ci.yml`.

## Commands

```bash
npm run dev         # http://localhost:5173 (URL params: ?seed= ?hour= ?weather= ?quality= ?bench=1 ?debug=1)
npm run typecheck   # tsc for src and e2e
npm test            # Vitest, tests next to sources (*.test.ts)
npm run build
npm run e2e         # Playwright (e2e/), needs a build; set PLAYWRIGHT_CHROMIUM_PATH to a local Chromium if needed
python3 scripts/fetch_assets.py   # re-download the CC0 textures listed in src/render/textureManifest.json
```

## Architecture

- `src/main.ts` wires everything; `src/game.ts` runs the fixed-step simulation (render interpolates).
- `src/city/`: pure placement functions `(chunk, seed)` (generator, signage, streetLife, details,
  temples, rail, reserved landmarks) built into `GeometryData` in a Web Worker (`payload.ts`,
  `chunk.worker.ts`), mounted by `cityView.ts` into pooled meshes. Keep placement pure and
  deterministic: tests compare two runs.
- `src/render/`: pipeline (post-processing, quality), height fog (`fog.ts` replaces three's fog chunks
  globally), planar reflection, materials (`materials/*`: facade with interior mapping, road/ground,
  surface for props, neon/holograms), CC0 texture loading with procedural fallback.
- `src/vehicle/`: controller (arcade physics), procedural car built from extruded side profiles
  (`bodyKit.ts`, also used by `src/traffic/vehicleShapes.ts`).
- `src/atmosphere/`: night clock, weather (clear/rain/fog/storm), lightning, sky, skyline ring.
- `src/audio/`: everything synthesized with Web Audio (ambience, engine, darkwave radio).

## Conventions

- Shaders are GLSL strings injected with `onBeforeCompile`; bump `customProgramCacheKey` when a
  shader string changes.
- Shared uniform registries (`cityUniforms`, `facadeUniforms`, `groundUniforms`, `surfaceUniforms`,
  `signUniforms`) are mutated through `.value`, never replaced.
- Additive materials with fog declare `ADDITIVE_FOG_DEFINES` (`src/render/fog.ts`).
- Costly visual features follow the quality presets in `src/settings/quality.ts`.
- User-facing text (HUD, menu, README) is in French; code, comments and commit messages in English
  (conventional commits).
- Kaizen workflow: plans in `docs/plans/` (validate with the Kaizen CLI `plan check`), commits cite
  their plan unit.

## Before planning or debugging

Read the project's learnings in `docs/learnings/` (frontmatter: module, tags, symptoms,
applies_when). They record traps already paid for: fog on additive materials, uniform registries,
render passes and shadow maps, procedural vehicle modelling.
