---
title: Modéliser un véhicule procédural par profil latéral extrudé plutôt que par loft lissé
date: 2026-10-19
category: design-patterns
module: vehicle
problem_type: design_pattern
component: frontend
severity: medium
applies_when:
  - Créer ou détailler un véhicule (joueur ou trafic) entièrement en code
  - Ajouter des passages de roues, vitrages ou détails de carrosserie sans modèle 3D externe
tags: [procedural-modelling, vehicle, extrude-geometry, wheel-arches, threejs]
---

# Modéliser un véhicule procédural par profil latéral extrudé plutôt que par loft lissé

## Context
La première voiture « détaillée » était un loft de sections superellipses (150 × 84) dont on
retirait les faces dans les passages de roues, avec des pièces ajoutées (rétros, aileron, prises
d'air). Résultat jugé « cassé » en jeu : découpes en escalier, plis en tentant d'aligner les sommets
sur l'arc, éléments qui dépassaient de la carrosserie, reflets ondulés.

## Guidance
Construire la caisse à partir d'un **profil latéral 2D** (z, y) qui contient déjà les passages de
roues comme encoches polygonales, extrudé en largeur avec chanfreins, puis déformé en plan :

- `extrudeProfile(points, halfWidth, warp, bevel)` et `wheelWell(z, radius, floor)` dans
  `src/vehicle/bodyKit.ts` (utilisés par `src/vehicle/proceduralCar.ts` et
  `src/traffic/vehicleShapes.ts`).
- Un second profil extrudé, plus étroit en haut, forme le pavillon / les vitrages ; vitres, joints,
  bas de caisse et passages sombres viennent du shader ou des couleurs de faces, pas de géométrie
  rapportée.
- Les détails (feux, poignées, ouïes) sont **affleurants**, posés sur la surface calculée
  (`bodyWarp`), jamais en saillie libre.

## Why it matters
Les découpes sont nettes par construction (l'encoche fait partie du contour, la triangulation suit),
les facettes planes lisent comme des panneaux de tôle, et le style anguleux demandé (coupé type photo
fournie) se décrit en quelques points. Le loft lissé exige une maille fine et un recalage des sommets
au bord des découpes, qui crée justement les artefacts observés.

## When to apply it
- Véhicules au dessin anguleux ou semi-anguleux ; pour une caisse très organique, un modèle glTF
  (`public/models/roadster.glb`, chargé s'il existe) reste préférable au loft procédural.

## Examples
- Avant : loft + suppression de faces dans un rayon autour de chaque roue → bords en escalier, puis
  plis après « snapping ».
- Après : `wheelWell(1.36, 0.36, 0.22)` dans le profil, test `cuts wheel arches in the body so the
  wheels show` (`src/vehicle/carModel.test.ts`) vert sans aucune retouche de sommets.

## Links
- Commits 6000c95 et ce09a66.
