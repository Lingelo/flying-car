---
title: Le brouillard sur un matériau additif dessine des rectangles pâles au loin
date: 2026-10-19
category: ui-bugs
module: render
problem_type: ui_bug
component: frontend
symptoms:
  - "Mosaïque de grands carrés translucides le long des rues au loin, surtout par temps de brouillard"
  - Enseignes et halos néon devenant des rectangles couleur de brume au lieu de s'éteindre dans la distance
root_cause: wrong_api
resolution_type: code_fix
severity: medium
tags: [fog, additive-blending, shader, neon, threejs]
---

# Le brouillard sur un matériau additif dessine des rectangles pâles au loin

## Problem
Les matériaux en `AdditiveBlending` (tubes néon, halos, hologrammes, traînées de trafic, propulseurs)
incluent le chunk `fog_fragment` standard, qui **mélange** la couleur vers `fogColor`. En additif, ce
mélange est **ajouté** à l'image : chaque quad lointain devient un rectangle de la couleur du
brouillard, d'autant plus visible que le brouillard est dense.

## Symptoms
- Une mosaïque de carrés pâles empilés dans la perspective des rues (capture du joueur en
  « Brouillard »).
- Les points de halo restent ronds (`gl_PointCoord`), ce qui égare : le problème n'est pas la forme du
  sprite mais la couleur de brouillard ajoutée sur toute sa surface.

## What didn't work
- Chercher un sprite carré (halos, vapeur, `gl_PointSize` plafonné) : leur atténuation est bien
  radiale.
- Baisser l'intensité des halos : les rectangles restent, ils viennent du brouillard, pas de la
  lumière.

## Solution
`src/render/fog.ts` remplace le chunk de brouillard pour tout le projet ; une variante additive
**atténue** au lieu de mélanger :

```glsl
#ifdef ADDITIVE_FOG
  gl_FragColor *= 1.0 - fogFactor;   // la lumière s'éteint dans le brouillard
#else
  gl_FragColor.rgb = mix(gl_FragColor.rgb, fogColor, fogFactor);
#endif
```

Chaque matériau additif déclare `defines: ADDITIVE_FOG_DEFINES` (ShaderMaterial) ou
`material.defines = { ...ADDITIVE_FOG_DEFINES }` (matériaux intégrés).

## Why it works
En additif, la contribution d'un fragment doit tendre vers **zéro** quand il disparaît dans la brume :
c'est le brouillard *derrière* (porté par les surfaces opaques) qui donne la couleur de fond.
Mélanger vers `fogColor` revient à ajouter du brouillard une seconde fois, sur la forme du quad.

## Prevention
- Tout nouveau matériau `AdditiveBlending` avec `fog: true` reçoit `ADDITIVE_FOG_DEFINES`
  (`grep -rn "AdditiveBlending" src` pour vérifier).
- Contrôler visuellement par météo `fog` et de haut : c'est là que l'artefact saute aux yeux.

## Links
- Commit b3e4039 (« darker Blade Runner night, … fixes for square lights »).
